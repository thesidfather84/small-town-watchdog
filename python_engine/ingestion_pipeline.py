"""
Main ingestion pipeline.
Orchestrates: source validation → fetch → parse → guardrails → civic_item insert → queue summarization.
"""

from __future__ import annotations
import logging
from typing import Optional

from . import db, config
from .document_fetcher import fetch
from .document_parser import parse_html, parse_text
from .legal_guardrails import check_item
from .models import CivicItemDraft, PipelineRun
from .source_validator import validate_url

log = logging.getLogger(__name__)


def run(state: Optional[str] = None, county: Optional[str] = None) -> PipelineRun:
    """
    Full ingestion pass for all active sources.
    Optionally filtered to a specific state/county.

    Flow per source:
      1. Validate source URL
      2. If valid, fetch content
      3. Parse title, text, date, amounts
      4. Run legal guardrails
      5. Determine admin_review_status:
           - approved if source is verified AND guardrails pass AND AUTO_APPROVE_VERIFIED_SOURCES
           - needs_review otherwise
      6. Insert civic_item (ON CONFLICT DO NOTHING for duplicates)
      7. Items with original_text are queued for summarization by a separate run
    """
    run_stats = PipelineRun()
    sources = db.load_active_sources(state=state)

    if county:
        sources = [s for s in sources if s.get("county", "").lower() == county.lower()]

    log.info("Starting ingestion for %d sources…", len(sources))

    for src in sources:
        url = src.get("source_url", "")
        if not url:
            run_stats.errors.append(f"Source {src['id']} has no URL — skipped")
            continue

        # 1. Validate
        run_stats.sources_checked += 1
        validation = validate_url(url)

        if validation.status != "valid":
            run_stats.sources_broken += 1
            db.update_source_registry_status(src["id"], "broken", validation.checked_at)
            log.warning("Broken source %s: %s", url, validation.error)
            continue

        run_stats.sources_valid += 1
        db.update_source_registry_status(src["id"], "verified", validation.checked_at, validation.checked_at)

        # 2. Fetch
        fetched = fetch(url)
        if fetched is None:
            run_stats.errors.append(f"Fetch failed: {url}")
            continue

        run_stats.documents_fetched += 1

        # 3. Parse
        if fetched.content_type == "application/pdf":
            parsed = parse_text(fetched.raw_text, source_agency=src.get("entity_name"))
        else:
            parsed = parse_html(fetched.raw_text, source_agency=src.get("entity_name"))

        title = parsed.title or src.get("entity_name", "Untitled Document")

        # 4. Guardrails (pre-summary — checks source presence and title)
        guardrail = check_item(
            source_url=url,
            original_text=parsed.body_text or None,
            source_title=title,
            ai_summary=None,
        )

        # 5. Determine approval status
        #    Auto-approve only when: source is verified + guardrails pass + feature enabled
        source_is_verified = src.get("verification_status") == "verified"

        if not guardrail.passed:
            admin_status = "needs_review"
            run_stats.items_validation_failed += 1
            for reason in guardrail.reasons:
                log.warning("Guardrail blocked item from %s: %s", url, reason)
        elif config.AUTO_APPROVE_VERIFIED_SOURCES and source_is_verified and url:
            admin_status = "approved"
        else:
            admin_status = "needs_review"

        # 6. Resolve location_id
        location_id: Optional[int] = None
        if src.get("state") and src.get("county"):
            try:
                location_id = db.find_or_create_location(src["state"], src["county"])
            except Exception as e:
                log.warning("Could not resolve location for %s/%s: %s", src["state"], src["county"], e)

        # 7. Insert civic_item (returns (id, created); created=False means duplicate)
        item: dict = {
            "location_id": location_id,
            "entity_id": None,
            "state_code": src.get("state"),
            "county_parish": src.get("county"),
            "scope": db.derive_scope(src),
            "item_type": _source_category_to_item_type(src.get("source_category", "")),
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
                run_stats.items_duplicate_skipped += 1
                log.debug("Duplicate skipped: %s", title)
            else:
                run_stats.items_created += 1
                if admin_status == "approved":
                    run_stats.items_auto_approved += 1
                    log.info("Auto-approved civic_item %d: %s", new_id, title)
                else:
                    run_stats.items_pending += 1
                    log.info("Pending review civic_item %d: %s", new_id, title)
        except Exception as e:
            run_stats.errors.append(f"DB insert failed for {url}: {e}")
            log.error("DB insert failed for %s: %s", url, e)

    return run_stats


def _source_category_to_item_type(category: str) -> str:
    mapping = {
        "agenda-page": "meeting",
        "minutes-page": "meeting",
        "budget-page": "budget",
        "audit-page": "audit",
        "election-page": "election",
        "contract-page": "contract",
        "bid-page": "contract",
        "public-notice-page": "notice",
        "news-page": "notice",
    }
    return mapping.get(category, "notice")
