"""
Seed official government sources into source_registry.
Only official, publicly accessible URLs. No Ballotpedia as primary source.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone

from . import db

log = logging.getLogger(__name__)

OFFICIAL_SOURCES: list[dict] = [
    # ── Louisiana Secretary of State ──────────────────────────────────────────
    {
        "state": "LA",
        "county": None,
        "city": None,
        "entity_name": "Louisiana Secretary of State",
        "entity_type": "election-office",
        "source_url": "https://www.sos.la.gov/ElectionsAndVoting/Pages/default.aspx",
        "source_category": "election-page",
        "source_platform": "Custom Website",
        "notes": "Official LA SOS election calendar and results portal",
    },
    {
        "state": "LA",
        "county": None,
        "city": None,
        "entity_name": "Louisiana Secretary of State",
        "entity_type": "election-office",
        "source_url": "https://voterportal.sos.la.gov/",
        "source_category": "election-page",
        "source_platform": "Custom Website",
        "notes": "LA voter portal — sample ballots and registration",
    },
    {
        "state": "LA",
        "county": None,
        "city": None,
        "entity_name": "Louisiana Secretary of State",
        "entity_type": "election-office",
        "source_url": "https://www.sos.la.gov/ElectionsAndVoting/PublishedDocuments/UpcomingElections.pdf",
        "source_category": "election-page",
        "source_platform": "PDF Repository",
        "notes": "Upcoming election dates PDF — Louisiana SOS",
    },
    # ── Louisiana Legislative Auditor ─────────────────────────────────────────
    {
        "state": "LA",
        "county": None,
        "city": None,
        "entity_name": "Louisiana Legislative Auditor",
        "entity_type": "county-government",
        "source_url": "https://www.lla.la.gov/",
        "source_category": "audit-page",
        "source_platform": "Custom Website",
        "notes": "LLA home — statewide audit reports and local government audits",
    },
    {
        "state": "LA",
        "county": None,
        "city": None,
        "entity_name": "Louisiana Legislative Auditor",
        "entity_type": "county-government",
        "source_url": "https://www.lla.la.gov/PublicReports.nsf/SearchForm?OpenForm",
        "source_category": "audit-page",
        "source_platform": "Custom Website",
        "notes": "LLA public reports search — all local government audit reports",
    },
    # ── St. Tammany Parish Government ─────────────────────────────────────────
    {
        "state": "LA",
        "county": "St. Tammany Parish",
        "city": None,
        "entity_name": "St. Tammany Parish Government",
        "entity_type": "parish-government",
        "source_url": "https://www.stpgov.org/government/council/meeting-agendas-minutes",
        "source_category": "agenda-page",
        "source_platform": "Custom Website",
        "notes": "STP Parish Council agendas and minutes",
    },
    {
        "state": "LA",
        "county": "St. Tammany Parish",
        "city": None,
        "entity_name": "St. Tammany Parish Government",
        "entity_type": "parish-government",
        "source_url": "https://www.stpgov.org/departments/finance/annual-budget",
        "source_category": "budget-page",
        "source_platform": "Custom Website",
        "notes": "St. Tammany Parish annual budget page",
    },
    {
        "state": "LA",
        "county": "St. Tammany Parish",
        "city": None,
        "entity_name": "St. Tammany Parish Government",
        "entity_type": "parish-government",
        "source_url": "https://www.stpgov.org/",
        "source_category": "public-notice-page",
        "source_platform": "Custom Website",
        "notes": "St. Tammany Parish main government website",
    },
    # ── St. Tammany Parish School Board ───────────────────────────────────────
    {
        "state": "LA",
        "county": "St. Tammany Parish",
        "city": None,
        "entity_name": "St. Tammany Parish School Board",
        "entity_type": "school-board",
        "source_url": "https://www.stpsb.org/domain/81",
        "source_category": "agenda-page",
        "source_platform": "Custom Website",
        "notes": "STPSB board meeting agendas and minutes",
    },
    {
        "state": "LA",
        "county": "St. Tammany Parish",
        "city": None,
        "entity_name": "St. Tammany Parish School Board",
        "entity_type": "school-board",
        "source_url": "https://www.stpsb.org/",
        "source_category": "budget-page",
        "source_platform": "Custom Website",
        "notes": "St. Tammany Parish School Board main website",
    },
    # ── Mississippi Secretary of State ────────────────────────────────────────
    {
        "state": "MS",
        "county": None,
        "city": None,
        "entity_name": "Mississippi Secretary of State",
        "entity_type": "election-office",
        "source_url": "https://www.sos.ms.gov/elections-voting",
        "source_category": "election-page",
        "source_platform": "Custom Website",
        "notes": "MS SOS elections and voting hub",
    },
    {
        "state": "MS",
        "county": None,
        "city": None,
        "entity_name": "Mississippi Secretary of State",
        "entity_type": "election-office",
        "source_url": "https://www.sos.ms.gov/elections-voting/election-dates",
        "source_category": "election-page",
        "source_platform": "Custom Website",
        "notes": "MS official election calendar",
    },
    {
        "state": "MS",
        "county": None,
        "city": None,
        "entity_name": "Mississippi Y'all Vote",
        "entity_type": "election-office",
        "source_url": "https://www.ms.gov/",
        "source_category": "election-page",
        "source_platform": "Custom Website",
        "notes": "MS.gov — voter services and election info",
    },
    # ── Hancock County, MS ────────────────────────────────────────────────────
    {
        "state": "MS",
        "county": "Hancock County",
        "city": None,
        "entity_name": "Hancock County Government",
        "entity_type": "county-government",
        "source_url": "https://www.hancockcountyms.gov/",
        "source_category": "public-notice-page",
        "source_platform": "Custom Website",
        "notes": "Hancock County MS official government website",
    },
]


def seed(state: str | None = None) -> dict:
    """
    Insert official sources into source_registry.
    Skips sources already present (by URL).
    Returns counts: inserted, skipped, errors.
    """
    counts = {"inserted": 0, "skipped": 0, "errors": 0}
    sources = OFFICIAL_SOURCES
    if state:
        sources = [s for s in sources if s["state"] == state.upper()]

    import psycopg2, psycopg2.extras
    from . import config
    config.validate()

    conn = psycopg2.connect(config.DATABASE_URL)
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        for src in sources:
            # Check if URL already exists
            cur.execute(
                "SELECT id FROM source_registry WHERE source_url = %s",
                (src["source_url"],),
            )
            if cur.fetchone():
                log.info("Skip (exists): %s", src["source_url"])
                counts["skipped"] += 1
                continue

            try:
                cur.execute(
                    """
                    INSERT INTO source_registry
                      (state, county, city, entity_name, entity_type,
                       source_url, source_category, source_platform,
                       verification_status, is_active, notes, created_at, updated_at)
                    VALUES
                      (%(state)s, %(county)s, %(city)s, %(entity_name)s, %(entity_type)s,
                       %(source_url)s, %(source_category)s, %(source_platform)s,
                       'pending', TRUE, %(notes)s, NOW(), NOW())
                    """,
                    src,
                )
                log.info("Inserted: %s — %s", src["entity_name"], src["source_url"])
                counts["inserted"] += 1
            except Exception as e:
                log.error("Failed to insert %s: %s", src["source_url"], e)
                counts["errors"] += 1

        conn.commit()
    finally:
        conn.close()

    return counts
