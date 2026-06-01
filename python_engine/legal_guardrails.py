"""
Legal guardrails — must run before any civic item is published.

Rules enforced here:
  1. Must have source_url OR original_text (no source = no publication)
  2. Must have source_title
  3. AI summary must not accuse anyone of a crime
  4. AI summary must not endorse or oppose a vote
  5. Flagged terms blocked unless inside direct quotes
"""

from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from typing import Optional

from . import config

log = logging.getLogger(__name__)

_QUOTE_RE = re.compile(r'"[^"]*"|\'[^\']*\'')

_VOTE_PHRASES = [
    r"\bvote yes\b", r"\bvote no\b", r"\bvote for\b", r"\bvote against\b",
    r"\byou should vote\b", r"\bsupport this measure\b", r"\boppose this measure\b",
    r"\breject this\b", r"\bpass this\b",
]
_VOTE_RE = re.compile("|".join(_VOTE_PHRASES), re.IGNORECASE)


@dataclass
class GuardrailResult:
    passed: bool
    reasons: list[str] = field(default_factory=list)
    admin_review_status: str = "needs_review"

    def block(self, reason: str) -> "GuardrailResult":
        self.passed = False
        self.admin_review_status = "needs_review"
        self.reasons.append(reason)
        return self


def _strip_quotes(text: str) -> str:
    return _QUOTE_RE.sub("", text)


def check_item(
    source_url: Optional[str],
    original_text: Optional[str],
    source_title: Optional[str],
    ai_summary: Optional[str],
) -> GuardrailResult:
    result = GuardrailResult(passed=True, admin_review_status="needs_review")

    if not source_url and not original_text:
        result.block("No source URL and no original text — cannot publish without a source.")

    if not source_title:
        result.block("Missing source title.")

    if ai_summary:
        unquoted = _strip_quotes(ai_summary)

        for term in config.FLAGGED_TERMS:
            pattern = re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)
            if pattern.search(unquoted):
                result.block(
                    f"AI summary contains flagged term '{term}' outside a direct quote. "
                    "Requires admin review."
                )

        if _VOTE_RE.search(unquoted):
            result.block("AI summary appears to endorse or oppose a vote. Requires admin review.")

    return result


def check_summary_text(text: str) -> GuardrailResult:
    """Check only an AI summary string."""
    return check_item(
        source_url="placeholder",
        original_text="placeholder",
        source_title="placeholder",
        ai_summary=text,
    )
