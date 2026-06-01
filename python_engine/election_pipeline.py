"""
Election data pipeline.
Ingests election-specific sources from source_registry where source_category = 'election-page'.
Creates civic_items with item_type='election' or 'amendment'.
"""

from __future__ import annotations
import logging
from typing import Optional

from . import db, config
from .document_fetcher import fetch
from .document_parser import parse_html, parse_text
from .legal_guardrails import check_item
from .models import PipelineRun
from .source_validator import validate_url

log = logging.getLogger(__name__)


def run(state: Optional[str] = None) -> PipelineRun:
    """
    Import election data for all active election sources.
    Filters source_registry to source_category = 'election-page'.
    """
    stats = PipelineRun()
    all_sources = db.load_active_sources(state=state)
    election_sources = [s for s in all_sources if s.get("source_category") == "election-page"]

    log.info("Election pipeline: processing %d sources…", len(election_sources))

    for src in election_sources:
        url = src.get("source_url", "")
        if not url:
            continue

        stats.sources_checked += 1
        v = validate_url(url)
        if v.status != "valid":
            stats.sources_broken += 1
            db.update_source_registry_status(src["id"], "broken", v.checked_at)
            continue

        stats.sources_valid += 1
        fetched = fetch(url)
        if fetched is None:
            stats.errors.append(f"Election fetch failed: {url}")
            continue

        stats.documents_fetched += 1
        parsed = (
            parse_text(fetched.raw_text, source_agency=src.get("entity_name"))
            if fetched.content_type == "application/pdf"
            else parse_html(fetched.raw_text, source_agency=src.get("entity_name"))
        )

        title = parsed.title or f"Election Information — {src.get('entity_name', 'Unknown')}"

        guardrail = check_item(
            source_url=url,
            original_text=parsed.body_text or None,
            source_title=title,
            ai_summary=None,
        )

        # Determine approval status (same logic as ingestion pipeline)
        source_is_verified = src.get("verification_status") == "verified"
        if not guardrail.passed:
            admin_status = "needs_review"
            stats.items_validation_failed += 1
        elif config.AUTO_APPROVE_VERIFIED_SOURCES and source_is_verified and url:
            admin_status = "approved"
        else:
            admin_status = "needs_review"

        location_id: Optional[int] = None
        if src.get("state") and src.get("county"):
            try:
                location_id = db.find_or_create_location(src["state"], src["county"])
            except Exception as e:
                log.warning("Location lookup failed: %s", e)

        item = {
            "location_id": location_id,
            "entity_id": None,
            "state_code": src.get("state"),
            "county_parish": src.get("county"),
            "scope": db.derive_scope(src),
            "item_type": "election",
            "title": title,
            "source_title": title,
            "source_agency": src.get("entity_name"),
            "source_url": url,
            "source_date": parsed.published_date,
            "original_text": (parsed.body_text or "")[:config.MAX_DOCUMENT_CHARS] or None,
            "ai_summary": None,
            "ai_summary_notice": config.AI_SUMMARY_NOTICE,
            "red_flag_level": "green",
            "source_status": "valid",
            "admin_review_status": admin_status,
            "amount_involved": parsed.largest_amount(),
            "event_date": parsed.published_date,
        }

        try:
            new_id, created = db.insert_civic_item(item)
            if not created:
                stats.items_duplicate_skipped += 1
                log.debug("Election duplicate skipped: %s", title)
            else:
                stats.items_created += 1
                if admin_status == "approved":
                    stats.items_auto_approved += 1
                    log.info("Election auto-approved %d: %s", new_id, title)
                else:
                    stats.items_pending += 1
                    log.info("Election item %d pending review: %s", new_id, title)
        except Exception as e:
            stats.errors.append(f"DB insert failed for {url}: {e}")

    return stats
