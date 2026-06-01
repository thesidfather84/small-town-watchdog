"""
Reminder pipeline.
Queries upcoming civic_items and identifies items that need notifications sent.
MVP: logs what would be sent. DB structure is ready for real push later.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from . import db

log = logging.getLogger(__name__)


def get_upcoming_items(days_ahead: int = 7) -> list[dict]:
    """Return approved civic_items with event_date within the next N days."""
    from .db import get_conn
    import psycopg2.extras

    cutoff = datetime.now(timezone.utc).date() + timedelta(days=days_ahead)
    today = datetime.now(timezone.utc).date()

    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT ci.id, ci.title, ci.item_type, ci.event_date,
                   ci.election_date, ci.meeting_date, ci.source_url,
                   l.state_code, l.county_parish
            FROM civic_items ci
            LEFT JOIN locations l ON ci.location_id = l.id
            WHERE ci.admin_review_status = 'approved'
              AND (
                (ci.event_date IS NOT NULL AND ci.event_date BETWEEN %s AND %s)
                OR (ci.election_date IS NOT NULL AND ci.election_date BETWEEN %s AND %s)
              )
            ORDER BY COALESCE(ci.event_date, ci.election_date) ASC
            """,
            (today, cutoff, today, cutoff),
        )
        return [dict(r) for r in cur.fetchall()]


def get_user_reminders_for_item(civic_item_id: int) -> list[dict]:
    """Return all reminder subscriptions for a specific civic_item."""
    from .db import get_conn
    import psycopg2.extras

    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT * FROM reminders WHERE civic_item_id = %s",
            (civic_item_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def run_reminder_check() -> dict:
    """
    Check all upcoming items and log what reminders would fire.
    In production this would trigger push notifications or emails.
    """
    upcoming = get_upcoming_items(days_ahead=7)
    log.info("Reminder check: %d upcoming items in next 7 days", len(upcoming))

    notifications_due = 0
    for item in upcoming:
        reminders = get_user_reminders_for_item(item["id"])
        for r in reminders:
            # In production: send push notification per reminder preference
            log.info(
                "  [REMINDER DUE] item=%d '%s' → device=%s",
                item["id"], item["title"], r["user_device_id"],
            )
            notifications_due += 1

    log.info("Total notifications due: %d", notifications_due)
    return {"upcoming_items": len(upcoming), "notifications_due": notifications_due}
