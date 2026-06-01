#!/usr/bin/env python3
"""
Small Town Watchdog — Python data engine CLI.

Usage:
  python python_engine/main.py seed-sources [--state LA]
  python python_engine/main.py validate-sources [--state LA]
  python python_engine/main.py run-daily [--state LA] [--county "St. Tammany Parish"]
  python python_engine/main.py export-json [--out data/civic_items.json]
  python python_engine/main.py diagnostics --state LA --county "St. Tammany"
  python python_engine/main.py fetch-documents [--state LA] [--county "St. Tammany Parish"]
  python python_engine/main.py summarize-pending [--limit 20]
  python python_engine/main.py import-election-data [--state LA]
  python python_engine/main.py import-meetings [--state LA]
"""

import argparse
import json
import logging
import sys
import os
from datetime import datetime, timezone

# When run as `python python_engine/main.py`, add workspace root to sys.path
_here = os.path.dirname(os.path.abspath(__file__))
_root = os.path.dirname(_here)
if _root not in sys.path:
    sys.path.insert(0, _root)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("watchdog")


# ── seed-sources ──────────────────────────────────────────────────────────────

def cmd_seed_sources(args) -> None:
    from python_engine.seed_sources import seed, OFFICIAL_SOURCES
    state = args.state or None
    total = len([s for s in OFFICIAL_SOURCES if not state or s["state"] == state.upper()])
    log.info("Seeding %d official sources (state=%s)…", total, state or "ALL")
    counts = seed(state=state)
    print("\n=== Seed Sources ===")
    print(f"  Sources to seed : {total}")
    print(f"  Inserted        : {counts['inserted']}")
    print(f"  Skipped (exists): {counts['skipped']}")
    print(f"  Errors          : {counts['errors']}")
    print("====================\n")


# ── validate-sources ──────────────────────────────────────────────────────────

def cmd_validate_sources(args) -> None:
    from python_engine.source_validator import validate_all_registry_sources, validate_document_sources
    log.info("=== Validating source registry ===")
    reg = validate_all_registry_sources(state=args.state or None)
    print(f"\n=== Source Validation ===")
    print(f"  Sources checked : {reg['checked']}")
    print(f"  Sources valid   : {reg['valid']}")
    print(f"  Sources broken  : {reg['broken']}")
    if reg.get("broken_urls"):
        print("  Broken URLs:")
        for u in reg["broken_urls"]:
            print(f"    - {u}")
    print("=========================\n")


# ── fetch-documents ───────────────────────────────────────────────────────────

def cmd_fetch_documents(args) -> None:
    from python_engine.ingestion_pipeline import run
    log.info("=== Fetching documents ===")
    stats = run(state=args.state or None, county=args.county or None)
    stats.print_summary()


# ── summarize-pending ─────────────────────────────────────────────────────────

def cmd_summarize_pending(args) -> None:
    from python_engine.summarizer import summarize_pending_items
    limit = int(args.limit) if hasattr(args, "limit") and args.limit else 20
    log.info("=== Summarizing pending items (limit=%d) ===", limit)
    count = summarize_pending_items(limit=limit)
    print(f"\nSummaries generated: {count}")


# ── import-election-data ──────────────────────────────────────────────────────

def cmd_import_elections(args) -> None:
    from python_engine.election_pipeline import run
    log.info("=== Importing election data ===")
    stats = run(state=args.state or None)
    stats.print_summary()


# ── import-meetings ───────────────────────────────────────────────────────────

def cmd_import_meetings(args) -> None:
    from python_engine.meeting_pipeline import run
    log.info("=== Importing meeting data ===")
    stats = run(state=args.state or None)
    stats.print_summary()


# ── run-daily ─────────────────────────────────────────────────────────────────

def cmd_run_daily(args) -> None:
    """Full daily pipeline with structured log output."""
    started_at = datetime.now(timezone.utc)
    state = args.state or None
    county = args.county or None

    print(f"\n{'='*54}")
    print(f"  SMALL TOWN WATCHDOG — Daily Pipeline")
    print(f"  Started : {started_at.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"  State   : {state or 'ALL'}")
    print(f"  County  : {county or 'ALL'}")
    print(f"{'='*54}\n")

    # ── Step 1: Validate sources ──
    log.info("Step 1/4 — Validating sources…")
    from python_engine.source_validator import validate_all_registry_sources
    val = validate_all_registry_sources(state=state)

    # ── Step 2: Fetch & ingest ────
    log.info("Step 2/4 — Fetching documents…")
    from python_engine.ingestion_pipeline import run as ingest
    ingest_stats = ingest(state=state, county=county)

    # ── Step 3: Elections ─────────
    log.info("Step 3/4 — Election pipeline…")
    from python_engine.election_pipeline import run as elections
    e_stats = elections(state=state)

    # ── Step 4: Summarize ─────────
    log.info("Step 4/4 — Generating AI summaries…")
    from python_engine.summarizer import summarize_pending_items
    summaries = summarize_pending_items(limit=50)

    finished_at = datetime.now(timezone.utc)
    elapsed = (finished_at - started_at).total_seconds()

    # ── Combined DB diagnostics ───
    from python_engine import db as _db, config as _cfg
    _cfg.validate()
    import psycopg2
    conn = psycopg2.connect(_cfg.DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM civic_items WHERE admin_review_status='approved'")
    approved_total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM civic_items WHERE admin_review_status='needs_review'")
    pending_total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM civic_items")
    total_items = cur.fetchone()[0]
    conn.close()

    total_sources_checked = val["checked"]
    total_valid = val["valid"]
    total_broken = val["broken"]
    total_fetched = (
        ingest_stats.documents_fetched
        + e_stats.documents_fetched
    )
    total_created = (
        ingest_stats.items_created
        + e_stats.items_created
    )
    total_blocked = (
        ingest_stats.items_blocked_for_review
        + e_stats.items_blocked_for_review
    )
    total_auto_approved = (
        ingest_stats.items_auto_approved
        + e_stats.items_auto_approved
    )
    total_pending = (
        ingest_stats.items_pending
        + e_stats.items_pending
    )
    total_duplicate_skipped = (
        ingest_stats.items_duplicate_skipped
        + e_stats.items_duplicate_skipped
    )
    total_validation_failed = (
        ingest_stats.items_validation_failed
        + e_stats.items_validation_failed
    )
    all_errors = ingest_stats.errors + e_stats.errors

    # ── Record this run so diagnostics can report "last scraper run" ──
    try:
        _db.record_scraper_run(
            command="run-daily",
            state=state,
            status="completed",
            sources_checked=total_sources_checked,
            sources_valid=total_valid,
            sources_broken=total_broken,
            items_created=total_created,
            items_updated=0,
            items_auto_approved=total_auto_approved,
            items_pending=total_pending,
            items_duplicate_skipped=total_duplicate_skipped,
            items_validation_failed=total_validation_failed,
            errors="\n".join(all_errors) if all_errors else None,
            notes="; ".join(all_errors[:5]) if all_errors else None,
            started_at=started_at,
            finished_at=finished_at,
        )
    except Exception as e:
        log.warning("Could not record scraper run: %s", e)

    print(f"\n{'='*54}")
    print(f"  DAILY PIPELINE RESULTS")
    print(f"{'='*54}")
    print(f"  Sources checked  : {total_sources_checked}")
    print(f"  Sources valid    : {total_valid}")
    print(f"  Sources broken   : {total_broken}")
    print(f"  Documents fetched: {total_fetched}")
    print(f"  Items created    : {total_created}")
    print(f"  Auto-approved    : {total_auto_approved}")
    print(f"  Pending review   : {total_pending}")
    print(f"  Duplicates skip  : {total_duplicate_skipped}")
    print(f"  Validation fail  : {total_validation_failed}")
    print(f"  Items approved   : {approved_total}")
    print(f"  Summaries made   : {summaries}")
    print(f"  Errors           : {len(all_errors)}")
    print(f"  Elapsed          : {elapsed:.1f}s")
    print(f"{'='*54}")

    if total_fetched == 0:
        print("\n  WHY ZERO DOCUMENTS?")
        if total_sources_checked == 0:
            print("  → sources table is empty — run seed-sources first")
        elif total_broken == total_sources_checked:
            print("  → all sources returned HTTP errors or timeouts (URLs may be blocked or down)")
        else:
            print(f"  → {total_valid} source(s) reachable but parser returned no extractable items")
            print("    (pages may require JavaScript rendering or use login walls)")
        print()

    if all_errors:
        print("  ERRORS:")
        for err in all_errors[:10]:
            print(f"    - {err}")
    print()


# ── export-json ───────────────────────────────────────────────────────────────

def cmd_export_json(args) -> None:
    from python_engine import config as _cfg
    _cfg.validate()
    import psycopg2, psycopg2.extras
    out_path = getattr(args, "out", None) or "data/civic_items.json"

    conn = psycopg2.connect(_cfg.DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        """
        SELECT ci.id, ci.item_type, ci.title, ci.source_agency, ci.source_url,
               ci.source_date, ci.ai_summary, ci.ai_summary_notice,
               ci.red_flag_level, ci.admin_review_status, ci.source_status,
               ci.amount_involved, ci.event_date,
               l.state_code, l.state_name, l.county_parish,
               ci.created_at, ci.updated_at
        FROM civic_items ci
        LEFT JOIN locations l ON ci.location_id = l.id
        WHERE ci.admin_review_status = 'approved'
          AND ci.source_status IN ('valid', 'verified')
          AND (ci.source_url IS NOT NULL OR ci.original_text IS NOT NULL)
        ORDER BY ci.created_at DESC
        """
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    # Serialize dates
    def _serial(obj):
        if isinstance(obj, (datetime,)):
            return obj.isoformat()
        from decimal import Decimal
        if isinstance(obj, Decimal):
            return float(obj)
        return str(obj)

    import os
    os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({"exported_at": datetime.now(timezone.utc).isoformat(), "items": rows}, f, default=_serial, indent=2)

    print(f"\n=== Export JSON ===")
    print(f"  Approved items exported: {len(rows)}")
    print(f"  Output file: {out_path}")
    print("==================\n")


# ── diagnostics ───────────────────────────────────────────────────────────────

def cmd_diagnostics(args) -> None:
    from python_engine import config as _cfg
    _cfg.validate()
    import psycopg2
    state = getattr(args, "state", None) or None
    county = getattr(args, "county", None) or None

    conn = psycopg2.connect(_cfg.DATABASE_URL)
    cur = conn.cursor()

    def q(sql, params=()):
        cur.execute(sql, params)
        return cur.fetchone()[0]

    loc_count = q("SELECT COUNT(*) FROM locations")
    ent_count = q("SELECT COUNT(*) FROM entities")
    src_count = q("SELECT COUNT(*) FROM source_registry")
    valid_src  = q("SELECT COUNT(*) FROM source_registry WHERE verification_status='verified'")
    broken_src = q("SELECT COUNT(*) FROM source_registry WHERE verification_status='broken'")
    pending_src = q("SELECT COUNT(*) FROM source_registry WHERE verification_status='pending'")
    total_items = q("SELECT COUNT(*) FROM civic_items")
    approved    = q("SELECT COUNT(*) FROM civic_items WHERE admin_review_status='approved'")
    pending_rev = q("SELECT COUNT(*) FROM civic_items WHERE admin_review_status='needs_review'")
    red_items   = q("SELECT COUNT(*) FROM civic_items WHERE red_flag_level='red'")
    yel_items   = q("SELECT COUNT(*) FROM civic_items WHERE red_flag_level='yellow'")
    grn_items   = q("SELECT COUNT(*) FROM civic_items WHERE red_flag_level='green'")

    # Location-specific if requested
    loc_approved = loc_pending = loc_red = loc_yel = None
    if state and county:
        cur.execute(
            "SELECT id FROM locations WHERE state_code=%s AND county_parish ILIKE %s",
            (state.upper(), f"%{county}%"),
        )
        row = cur.fetchone()
        if row:
            lid = row[0]
            loc_approved = q("SELECT COUNT(*) FROM civic_items WHERE location_id=%s AND admin_review_status='approved'", (lid,))
            loc_pending  = q("SELECT COUNT(*) FROM civic_items WHERE location_id=%s AND admin_review_status='needs_review'", (lid,))
            loc_red      = q("SELECT COUNT(*) FROM civic_items WHERE location_id=%s AND red_flag_level='red'", (lid,))
            loc_yel      = q("SELECT COUNT(*) FROM civic_items WHERE location_id=%s AND red_flag_level='yellow'", (lid,))

    # Last activity — prefer the dedicated scraper_runs table, fall back to civic_items
    last_run = None
    try:
        cur.execute("SELECT MAX(finished_at) FROM scraper_runs")
        last_run = cur.fetchone()[0]
    except Exception:
        pass
    if last_run is None:
        cur.execute("SELECT MAX(updated_at) FROM civic_items")
        last_run = cur.fetchone()[0]
    conn.close()

    print(f"\n{'='*54}")
    print(f"  DIAGNOSTICS — {state or 'ALL'} / {county or 'ALL'}")
    print(f"{'='*54}")
    print(f"  Locations in DB      : {loc_count}")
    print(f"  Entities in DB       : {ent_count}")
    print(f"  Sources in registry  : {src_count}")
    print(f"    verified           : {valid_src}")
    print(f"    pending            : {pending_src}")
    print(f"    broken             : {broken_src}")
    print(f"  ─────────────────────────────────────────")
    print(f"  Civic Items total    : {total_items}")
    print(f"    approved           : {approved}")
    print(f"    pending review     : {pending_rev}")
    print(f"    red flag           : {red_items}")
    print(f"    yellow flag        : {yel_items}")
    print(f"    green              : {grn_items}")
    if state and county:
        if loc_approved is not None:
            print(f"  ─────────────────────────────────────────")
            print(f"  For {state} / {county}:")
            print(f"    approved           : {loc_approved}")
            print(f"    pending review     : {loc_pending}")
            print(f"    red items          : {loc_red}")
            print(f"    yellow items       : {loc_yel}")
        else:
            print(f"  ─────────────────────────────────────────")
            print(f"  Location '{county}' not found in locations table.")
            print(f"  (Will be created automatically when pipeline ingests data for it.)")
    print(f"  ─────────────────────────────────────────")
    print(f"  Last scraper run     : {last_run.strftime('%Y-%m-%d %H:%M UTC') if last_run else 'Never'}")
    print(f"{'='*54}\n")

    if total_items == 0:
        print("  DIAGNOSIS: No civic items in database yet.")
        print("  Run: python python_engine/main.py seed-sources")
        print("  Then: python python_engine/main.py run-daily\n")
    elif approved == 0:
        print("  DIAGNOSIS: Items exist but none are approved.")
        print("  Items in needs_review must be approved via Admin Panel")
        print("  or set admin_review_status='approved' directly.\n")


# ── parser ────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python_engine",
        description="Small Town Watchdog civic data engine",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def add_location_args(p):
        p.add_argument("--state", help="Filter by state code (e.g. LA, MS)")
        p.add_argument("--county", help="Filter by county/parish name")

    p_seed = sub.add_parser("seed-sources", help="Seed official government sources into source_registry")
    add_location_args(p_seed)
    p_seed.set_defaults(func=cmd_seed_sources)

    p_val = sub.add_parser("validate-sources", help="Validate all source URLs in registry")
    add_location_args(p_val)
    p_val.set_defaults(func=cmd_validate_sources)

    p_fetch = sub.add_parser("fetch-documents", help="Fetch and ingest documents from active sources")
    add_location_args(p_fetch)
    p_fetch.set_defaults(func=cmd_fetch_documents)

    p_sum = sub.add_parser("summarize-pending", help="Generate AI summaries for queued items")
    p_sum.add_argument("--limit", default=20, type=int)
    p_sum.set_defaults(func=cmd_summarize_pending)

    p_elec = sub.add_parser("import-election-data", help="Import election-specific sources")
    add_location_args(p_elec)
    p_elec.set_defaults(func=cmd_import_elections)

    p_meet = sub.add_parser("import-meetings", help="Import meeting agendas and minutes")
    add_location_args(p_meet)
    p_meet.set_defaults(func=cmd_import_meetings)

    p_daily = sub.add_parser("run-daily", help="Run the full daily pipeline end-to-end")
    add_location_args(p_daily)
    p_daily.set_defaults(func=cmd_run_daily)

    p_export = sub.add_parser("export-json", help="Export approved civic_items to JSON")
    p_export.add_argument("--out", default="data/civic_items.json", help="Output file path")
    p_export.set_defaults(func=cmd_export_json)

    p_diag = sub.add_parser("diagnostics", help="Show live database counts")
    add_location_args(p_diag)
    p_diag.set_defaults(func=cmd_diagnostics)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
    except Exception as e:
        log.error("Pipeline failed: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
