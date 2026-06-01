"""
Main ingestion pipeline.
Orchestrates: source validation → fetch → parse → classify → guardrails → civic_item insert.

Key rules:
  - No source = no publication (source_url required)
  - Auto-approve only when source verified AND guardrails pass
  - Follow document links on source pages (agendas, PDFs, minutes)
  - Classify red/yellow/green based on content
  - Duplicate detection via content_hash
"""

from __future__ import annotations
import logging
import re
from typing import Optional

from . import db, config
from .document_fetcher import fetch, extract_document_links
from .document_parser import parse_html, parse_text
from .legal_guardrails import check_item
from .models import PipelineRun
from .source_validator import validate_url

log = logging.getLogger(__name__)


# ── Red / Yellow / Green classification ──────────────────────────────────────

_RED_KEYWORDS = re.compile(
    r"\b(tax increase|tax hike|millage|mill rate|budget (increase|cut|deficit)|"
    r"audit (finding|exception|deficiency)|emergency|"
    r"major contract|bond issue|bond election|special assessment|"
    r"election|ballot|candidate|qualify|runoff|primary election|"
    r"salary increase|pay raise)\b",
    re.IGNORECASE,
)

_YELLOW_KEYWORDS = re.compile(
    r"\b(agenda|minutes|meeting|ordinance|resolution|public hearing|"
    r"school board|zoning|variance|subdivision|planning commission|permit|"
    r"policy change|budget proposal|bid award|contract award|"
    r"appointments?|annual report|department report)\b",
    re.IGNORECASE,
)

_ITEM_TYPE_TO_FLAG: dict[str, str] = {
    "budget":     "red",
    "audit":      "red",
    "election":   "red",
    "tax":        "red",
    "contract":   "yellow",
    "meeting":    "yellow",
    "zoning":     "yellow",
    "ordinance":  "yellow",
    "resolution": "yellow",
    "notice":     "green",
}


def classify_flag_level(title: str, item_type: str, body_text: str) -> str:
    """Return 'red', 'yellow', or 'green' based on title, type, and content."""
    combined = f"{title} {body_text[:2000]}"
    base = _ITEM_TYPE_TO_FLAG.get(item_type, "green")
    if _RED_KEYWORDS.search(combined):
        return "red"
    if base == "red":
        return "red"
    if _YELLOW_KEYWORDS.search(combined):
        return "yellow"
    if base == "yellow":
        return "yellow"
    return "green"


# ── Source category → item type ───────────────────────────────────────────────

_CATEGORY_TO_TYPE: dict[str, str] = {
    "agenda-page":        "meeting",
    "minutes-page":       "meeting",
    "budget-page":        "budget",
    "audit-page":         "audit",
    "election-page":      "election",
    "contract-page":      "contract",
    "bid-page":           "contract",
    "public-notice-page": "notice",
    "news-page":          "notice",
    "report-page":        "notice",
    "financial-page":     "budget",
    "planning-page":      "zoning",
    "permit-page":        "notice",
}


def _source_category_to_item_type(category: str) -> str:
    return _CATEGORY_TO_TYPE.get(category, "notice")


def _infer_type_from_url(url: str) -> str:
    u = url.lower()
    if any(k in u for k in ["agenda", "meeting"]):       return "meeting"
    if any(k in u for k in ["budget", "finance"]):       return "budget"
    if any(k in u for k in ["audit", "auditor"]):        return "audit"
    if any(k in u for k in ["election", "ballot", "vote"]): return "election"
    if any(k in u for k in ["ordinance", "resolution"]): return "ordinance"
    if any(k in u for k in ["contract", "bid", "rfp"]):  return "contract"
    if any(k in u for k in ["zoning", "planning"]):      return "zoning"
    if any(k in u for k in ["minutes"]):                 return "meeting"
    return "notice"


# ── Core pipeline ─────────────────────────────────────────────────────────────

def run(state: Optional[str] = None, county: Optional[str] = None) -> PipelineRun:
    """
    Full ingestion pass for all active non-placeholder sources.

    Flow per source:
      1. Skip placeholder URLs (PLACEHOLDER-- prefix)
      2. Validate source URL (HTTP check) → mark verified/broken
      3. Fetch content
      4. Extract document links (agendas, PDFs, minutes pages)
      5. For source page + each linked document:
           a. Parse title, body text, date, amounts
           b. Classify red/yellow/green
           c. Run legal guardrails
           d. Auto-approve if source verified + guardrails pass
           e. Insert civic_item (duplicate-safe via content_hash)
    """
    run_stats = PipelineRun()
    sources = db.load_active_sources(state=state)

    if county:
        sources = [s for s in sources if (s.get("county") or "").lower() == county.lower()]

    # Skip placeholder URLs from the checklist generator
    real_sources = [
        s for s in sources
        if not (s.get("source_url") or "").startswith("PLACEHOLDER")
    ]
    skipped_ph = len(sources) - len(real_sources)
    if skipped_ph:
        log.info("Skipped %d placeholder URL(s) — use discover-election-sources to find real URLs", skipped_ph)

    log.info("Starting ingestion for %d real sources (state=%s county=%s)…",
             len(real_sources), state or "ALL", county or "ALL")

    for src in real_sources:
        url = src.get("source_url", "")
        if not url:
            run_stats.errors.append(f"Source {src['id']} has no URL — skipped")
            continue

        # 1. Validate URL
        run_stats.sources_checked += 1
        validation = validate_url(url)

        if validation.status != "valid":
            run_stats.sources_broken += 1
            db.update_source_registry_status(src["id"], "broken", validation.checked_at)
            msg = f"Broken [{validation.http_status}] {url}: {validation.error}"
            log.warning(msg)
            run_stats.errors.append(msg)
            continue

        run_stats.sources_valid += 1
        # *** KEY FIX: source_is_verified set AFTER successful validation ***
        source_is_verified = True
        db.update_source_registry_status(src["id"], "verified", validation.checked_at, validation.checked_at)

        # 2. Fetch source page
        fetched = fetch(url)
        if fetched is None:
            run_stats.errors.append(f"Fetch failed: {url}")
            continue
        run_stats.documents_fetched += 1

        # Resolve location once for all items from this source
        location_id: Optional[int] = None
        if src.get("state") and src.get("county"):
            try:
                location_id = db.find_or_create_location(src["state"], src["county"])
            except Exception as e:
                log.warning("Could not resolve location %s/%s: %s", src["state"], src["county"], e)

        base_item_type = _source_category_to_item_type(src.get("source_category", ""))

        # 3. Extract document links from the source page
        discovered: list[str] = []
        if fetched.content_type != "application/pdf":
            discovered = extract_document_links(fetched.raw_text, base_url=url)
            if discovered:
                log.info("  Found %d document link(s) on %s", len(discovered), url)

        # 4. Process source page + discovered links (cap at 20 sub-docs per source)
        urls_to_process = [url] + discovered[:20]

        for doc_url in urls_to_process:
            is_main = (doc_url == url)

            if is_main:
                doc_fetched = fetched
            else:
                doc_fetched = fetch(doc_url)
                if doc_fetched is None:
                    log.debug("  Could not fetch linked doc: %s", doc_url)
                    continue
                run_stats.documents_fetched += 1

            # Parse
            if doc_fetched.content_type == "application/pdf":
                parsed = parse_text(doc_fetched.raw_text, source_agency=src.get("entity_name"))
            else:
                parsed = parse_html(doc_fetched.raw_text, source_agency=src.get("entity_name"))

            # Skip nearly empty pages (navigation menus, login walls, etc.)
            if not parsed.body_text or len(parsed.body_text.strip()) < 150:
                log.debug("  Thin content (%d chars) at %s — skipped",
                          len(parsed.body_text or ""), doc_url)
                continue

            title = (parsed.title or src.get("entity_name", "Public Record")).strip()
            item_type = base_item_type if is_main else _infer_type_from_url(doc_url)

            # Guardrail check (requires source_url + source_title)
            guardrail = check_item(
                source_url=doc_url,
                original_text=parsed.body_text or None,
                source_title=title,
                ai_summary=None,
            )
            if not guardrail.passed:
                run_stats.items_validation_failed += 1
                for reason in guardrail.reasons:
                    log.warning("  Guardrail blocked item from %s: %s", doc_url, reason)
                continue

            flag_level = classify_flag_level(title, item_type, parsed.body_text or "")

            admin_status = (
                "approved"
                if config.AUTO_APPROVE_VERIFIED_SOURCES and source_is_verified and doc_url
                else "needs_review"
            )

            item: dict = {
                "location_id":         location_id,
                "entity_id":           None,
                "state_code":          src.get("state"),
                "county_parish":       src.get("county"),
                "scope":               db.derive_scope(src),
                "item_type":           item_type,
                "title":               title,
                "source_title":        title,
                "source_agency":       src.get("entity_name"),
                "source_url":          doc_url,
                "source_date":         parsed.published_date,
                "original_text":       (parsed.body_text or "")[:config.MAX_DOCUMENT_CHARS] or None,
                "ai_summary":          None,
                "ai_summary_notice":   config.AI_SUMMARY_NOTICE,
                "red_flag_level":      flag_level,
                "source_status":       "valid",
                "admin_review_status": admin_status,
                "amount_involved":     parsed.largest_amount(),
                "event_date":          parsed.published_date,
            }

            try:
                new_id, created = db.insert_civic_item(item)
                if not created:
                    run_stats.items_duplicate_skipped += 1
                    log.debug("  Duplicate skipped: %s", title[:80])
                else:
                    run_stats.items_created += 1
                    if admin_status == "approved":
                        run_stats.items_auto_approved += 1
                        log.info("  ✓ [%s|%s] id=%d: %s", flag_level.upper(), item_type, new_id, title[:80])
                    else:
                        run_stats.items_pending += 1
                        log.info("  ⏳ Pending id=%d: %s", new_id, title[:80])
            except Exception as e:
                run_stats.errors.append(f"DB insert failed for {doc_url}: {e}")
                log.error("  DB insert failed for %s: %s", doc_url, e)

    return run_stats
