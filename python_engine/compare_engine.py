"""
Compare engine.
Compares budget/spending data across years or agencies within the same location.
Outputs factual plain-English descriptions only — no opinion language.

Rules:
- Never say spending is "wasteful" or "corrupt"
- Always say: "Budget increased X% compared with prior year"
- Source for every comparison
"""

from __future__ import annotations
import logging
from typing import Optional

log = logging.getLogger(__name__)


def _pct_change(old: float, new: float) -> float:
    if old == 0:
        return 0.0
    return round(((new - old) / old) * 100, 1)


def _format_amount(amount: float) -> str:
    if amount >= 1_000_000_000:
        return f"${amount / 1_000_000_000:.2f} billion"
    if amount >= 1_000_000:
        return f"${amount / 1_000_000:.2f} million"
    if amount >= 1_000:
        return f"${amount / 1_000:.1f} thousand"
    return f"${amount:,.2f}"


def compare_years(entity_id: int, year_a: int, year_b: int) -> list[dict]:
    """
    Compare civic_items for an entity across two years.
    Returns list of comparison rows with plain-English descriptions.
    """
    from .db import get_conn
    import psycopg2.extras

    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT item_type, title, amount_involved,
                   EXTRACT(YEAR FROM event_date)::int AS year
            FROM civic_items
            WHERE entity_id = %s
              AND admin_review_status = 'approved'
              AND amount_involved IS NOT NULL
              AND EXTRACT(YEAR FROM event_date) IN (%s, %s)
            ORDER BY item_type, title
            """,
            (entity_id, year_a, year_b),
        )
        rows = [dict(r) for r in cur.fetchall()]

    by_title: dict[str, dict] = {}
    for row in rows:
        key = f"{row['item_type']}::{row['title']}"
        if key not in by_title:
            by_title[key] = {"item_type": row["item_type"], "title": row["title"]}
        by_title[key][row["year"]] = float(row["amount_involved"])

    comparisons = []
    for key, data in by_title.items():
        a = data.get(year_a)
        b = data.get(year_b)
        if a is None or b is None:
            continue

        pct = _pct_change(a, b)
        if pct > 0:
            description = f"Budget increased {pct}% compared with prior year ({_format_amount(a)} → {_format_amount(b)})."
        elif pct < 0:
            description = f"Budget decreased {abs(pct)}% compared with prior year ({_format_amount(a)} → {_format_amount(b)})."
        else:
            description = f"Budget unchanged from prior year ({_format_amount(a)})."

        comparisons.append({
            "item_type": data["item_type"],
            "title": data["title"],
            "year_a": year_a,
            "year_b": year_b,
            "amount_a": a,
            "amount_b": b,
            "pct_change": pct,
            "description": description,
        })

    log.info("compare_years entity=%d (%d→%d): %d items compared", entity_id, year_a, year_b, len(comparisons))
    return comparisons


def compare_agencies(location_id: int, year: int) -> list[dict]:
    """
    Compare multiple agencies within the same location for a given year.
    Returns per-agency budget rows for side-by-side display.
    """
    from .db import get_conn
    import psycopg2.extras

    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT ci.source_agency, ci.item_type,
                   SUM(ci.amount_involved::float) AS total_amount
            FROM civic_items ci
            WHERE ci.location_id = %s
              AND ci.admin_review_status = 'approved'
              AND ci.amount_involved IS NOT NULL
              AND EXTRACT(YEAR FROM ci.event_date) = %s
            GROUP BY ci.source_agency, ci.item_type
            ORDER BY total_amount DESC
            """,
            (location_id, year),
        )
        return [dict(r) for r in cur.fetchall()]
