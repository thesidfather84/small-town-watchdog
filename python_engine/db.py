"""
Database helpers for the Python engine.
Uses psycopg2 with DATABASE_URL from config.
All civic_items writes and source_registry updates go through here.
"""

from __future__ import annotations
import hashlib
import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Generator, Optional

import psycopg2
import psycopg2.extras

from . import config

log = logging.getLogger(__name__)

# Full lookup table — add one line per new state, no other changes needed.
_STATE_NAMES: dict[str, str] = {
    "AL": "Alabama",
    "AR": "Arkansas",
    "FL": "Florida",
    "GA": "Georgia",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "MS": "Mississippi",
    "TN": "Tennessee",
    "TX": "Texas",
    "VA": "Virginia",
}

# Louisiana uses "parish"; all other states default to "county".
_COUNTY_TYPE: dict[str, str] = {
    "LA": "parish",
}


@contextmanager
def get_conn() -> Generator[psycopg2.extensions.connection, None, None]:
    config.validate()
    conn = psycopg2.connect(config.DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Source Registry ────────────────────────────────────────────────────────────

def load_active_sources(state: Optional[str] = None) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        sql = (
            "SELECT * FROM source_registry "
            "WHERE is_active = TRUE AND verification_status != 'broken'"
        )
        params: list = []
        if state:
            sql += " AND state = %s"
            params.append(state)
        sql += " ORDER BY state, county, entity_name"
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]


def update_source_registry_status(
    source_id: int,
    verification_status: str,
    last_checked: datetime,
    last_successful_update: Optional[datetime] = None,
) -> None:
    with get_conn() as conn:
        cur = conn.cursor()
        if last_successful_update:
            cur.execute(
                "UPDATE source_registry "
                "SET verification_status=%s, last_checked=%s, last_successful_update=%s "
                "WHERE id=%s",
                (verification_status, last_checked, last_successful_update, source_id),
            )
        else:
            cur.execute(
                "UPDATE source_registry "
                "SET verification_status=%s, last_checked=%s "
                "WHERE id=%s",
                (verification_status, last_checked, source_id),
            )


# ── Locations ──────────────────────────────────────────────────────────────────

def find_or_create_location(state_code: str, county_parish: str) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM locations WHERE state_code=%s AND county_parish=%s",
            (state_code, county_parish),
        )
        row = cur.fetchone()
        if row:
            return row[0]
        state_name = _STATE_NAMES.get(state_code, state_code)
        county_type = _COUNTY_TYPE.get(state_code, "county")
        cur.execute(
            "INSERT INTO locations (state_code, state_name, county_parish, county_type) "
            "VALUES (%s, %s, %s, %s) RETURNING id",
            (state_code, state_name, county_parish, county_type),
        )
        return cur.fetchone()[0]


# ── Civic Items ────────────────────────────────────────────────────────────────

def derive_scope(src: dict) -> str:
    """Derive an item's geographic scope from its source record.

    county present       -> 'county_parish'
    city present (no county) -> 'city'
    state only           -> 'statewide'
    """
    if src.get("county"):
        return "county_parish"
    if src.get("city"):
        return "city"
    return "statewide"


def _content_hash(source_url: str, title: str) -> str:
    """Deterministic hash for deduplication: sha256(url|lower(title))."""
    raw = f"{(source_url or '').strip()}|{(title or '').lower().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def insert_civic_item(item: dict) -> tuple[int, bool]:
    """Insert a civic item with duplicate detection.

    Returns (id, created) where created=False means the item already existed
    (duplicate was skipped via ON CONFLICT DO NOTHING on content_hash).
    """
    item.setdefault("state_code", None)
    item.setdefault("county_parish", None)
    item.setdefault("scope", "statewide")

    h = _content_hash(item.get("source_url", ""), item.get("title", ""))
    item["content_hash"] = h

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO civic_items
              (content_hash, location_id, entity_id, state_code, county_parish, scope, item_type, title,
               source_title, source_agency, source_url, source_date,
               original_text, ai_summary, ai_summary_notice,
               red_flag_level, source_status, admin_review_status,
               amount_involved, event_date)
            VALUES
              (%(content_hash)s, %(location_id)s, %(entity_id)s, %(state_code)s, %(county_parish)s,
               %(scope)s, %(item_type)s, %(title)s,
               %(source_title)s, %(source_agency)s, %(source_url)s, %(source_date)s,
               %(original_text)s, %(ai_summary)s, %(ai_summary_notice)s,
               %(red_flag_level)s, %(source_status)s, %(admin_review_status)s,
               %(amount_involved)s, %(event_date)s)
            ON CONFLICT (content_hash) DO NOTHING
            RETURNING id
            """,
            item,
        )
        row = cur.fetchone()
        if row is None:
            # Duplicate — find the existing id for reference
            cur.execute("SELECT id FROM civic_items WHERE content_hash=%s", (h,))
            existing = cur.fetchone()
            return (existing[0] if existing else -1), False
        return row[0], True


# ── Scraper Runs ───────────────────────────────────────────────────────────────

def record_scraper_run(
    command: str,
    state: Optional[str] = None,
    status: str = "completed",
    sources_checked: int = 0,
    sources_valid: int = 0,
    sources_broken: int = 0,
    items_created: int = 0,
    items_updated: int = 0,
    items_auto_approved: int = 0,
    items_pending: int = 0,
    items_duplicate_skipped: int = 0,
    items_validation_failed: int = 0,
    errors: Optional[str] = None,
    notes: Optional[str] = None,
    started_at: Optional[datetime] = None,
    finished_at: Optional[datetime] = None,
) -> int:
    """Record a completed pipeline run so diagnostics can report 'last scraper run'."""
    from datetime import datetime as _dt, timezone as _tz
    now = _dt.now(_tz.utc)
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO scraper_runs
              (command, state, status, sources_checked, sources_valid,
               sources_broken, items_created, items_updated,
               items_auto_approved, items_pending, items_duplicate_skipped,
               items_validation_failed, errors, notes, started_at, finished_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                command, state, status, sources_checked, sources_valid,
                sources_broken, items_created, items_updated,
                items_auto_approved, items_pending, items_duplicate_skipped,
                items_validation_failed, errors, notes,
                started_at or now, finished_at or now,
            ),
        )
        return cur.fetchone()[0]


def get_pending_summaries(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT id, title, original_text, source_url, source_agency
            FROM civic_items
            WHERE original_text IS NOT NULL
              AND ai_summary IS NULL
              AND admin_review_status != 'rejected'
            ORDER BY created_at ASC
            LIMIT %s
            """,
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]


def update_civic_item_summary(item_id: int, ai_summary: str, notice: str) -> None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE civic_items SET ai_summary=%s, ai_summary_notice=%s, updated_at=NOW() WHERE id=%s",
            (ai_summary, notice, item_id),
        )


def mark_civic_item_review(item_id: int, status: str, reason: Optional[str] = None) -> None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE civic_items SET admin_review_status=%s, updated_at=NOW() WHERE id=%s",
            (status, item_id),
        )
        if reason:
            log.info("Item %s → %s: %s", item_id, status, reason)


# ── Legacy documents table ─────────────────────────────────────────────────────

def get_documents_needing_source_check(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT id, title, source_url FROM documents
            WHERE source_url IS NOT NULL
              AND (source_status IS NULL OR source_status = 'pending_review')
            ORDER BY created_at ASC LIMIT %s
            """,
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]


def update_document_source_status(doc_id: int, status: str, verified_at: datetime) -> None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE documents SET source_status=%s, last_verified_at=%s WHERE id=%s",
            (status, verified_at, doc_id),
        )
