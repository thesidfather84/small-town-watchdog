"""
AI summarizer using OpenAI.
Generates plain-English summaries with required legal notices.
Applies legal guardrails before returning. Never publishes without flagging issues.
"""

from __future__ import annotations
import logging
from typing import Optional

from . import config
from .legal_guardrails import check_summary_text
from .models import CivicItemDraft

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = f"""You are a civic information assistant for Small Town Watchdog.

Your job: write plain-English summaries of public government documents for regular citizens.

RULES (non-negotiable):
1. Do NOT endorse candidates, parties, or ballot positions.
2. Do NOT say "vote yes", "vote no", or anything that tells people how to vote.
3. Do NOT accuse anyone of corruption, fraud, or criminal activity.
4. Do NOT speculate beyond what the source document states.
5. Include dollar amounts factually when mentioned.
6. Write for a 6th-grade reading level.
7. Keep summaries to 2–4 short paragraphs.
8. Start with what this document IS (meeting minutes, budget proposal, audit report, etc.).
9. End with one sentence: "Why this matters: [plain-English reason a citizen should care]."

PLATFORM MISSION: {config.PLATFORM_MISSION}
"""


def summarize(draft: CivicItemDraft) -> CivicItemDraft:
    """
    Generate and attach an AI summary to a CivicItemDraft.
    Marks for admin review if OpenAI unavailable or guardrails flag content.
    Always returns the draft.
    """
    if not config.OPENAI_API_KEY:
        log.warning("OPENAI_API_KEY not set — skipping AI summary for '%s'", draft.title)
        return draft

    if not draft.original_text:
        log.warning("No original_text for '%s' — cannot summarize", draft.title)
        return draft

    try:
        import openai

        client = openai.OpenAI(api_key=config.OPENAI_API_KEY)
        agency_line = f"Agency: {draft.source_agency}" if draft.source_agency else ""
        user_content = (
            f"Document type: {draft.item_type}\n"
            f"Title: {draft.title}\n"
            f"{agency_line}\n\n"
            f"Document text (excerpt):\n{draft.original_text[:8000]}\n\n"
            "Please write a plain-English summary following the rules above."
        )

        response = client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,
            max_tokens=600,
        )
        summary_text = response.choices[0].message.content.strip()

    except Exception as e:
        log.error("OpenAI call failed for '%s': %s", draft.title, e)
        draft.admin_review_status = "needs_review"
        return draft

    result = check_summary_text(summary_text)
    draft.ai_summary = summary_text
    draft.ai_summary_notice = config.AI_SUMMARY_NOTICE

    if not result.passed:
        log.warning("Guardrails flagged summary for '%s': %s", draft.title, "; ".join(result.reasons))
        draft.admin_review_status = "needs_review"

    return draft


def summarize_pending_items(limit: int = 20) -> int:
    """Pull civic_items with original_text but no ai_summary; summarize and update DB."""
    from . import db

    pending = db.get_pending_summaries(limit=limit)
    generated = 0

    for row in pending:
        draft = CivicItemDraft(
            item_type="document",
            title=row["title"],
            original_text=row.get("original_text"),
            source_url=row.get("source_url"),
            source_agency=row.get("source_agency"),
        )
        updated = summarize(draft)
        if updated.ai_summary:
            db.update_civic_item_summary(row["id"], updated.ai_summary, updated.ai_summary_notice)
            if updated.admin_review_status == "needs_review":
                db.mark_civic_item_review(row["id"], "needs_review", "guardrails")
            generated += 1
            log.info("Summarized item %d: %s", row["id"], row["title"])

    return generated
