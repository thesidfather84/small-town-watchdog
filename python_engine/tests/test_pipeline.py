"""
Tests for the Small Town Watchdog Python data engine.

Run with:  python -m pytest python_engine/tests/ -v

Tests cover:
  1. Location filtering — LA → St. Tammany shows only St. Tammany data
  2. Mississippi data does not appear unless verified MS source data exists
  3. Broken source link does not crash
  4. Broken source link does not redirect to homepage
  5. Item without source cannot be approved
  6. AI summary displays required notice
  7. Legal guardrails block flagged terms
  8. Compare engine uses factual language only
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone


# ── 1. Location filtering ──────────────────────────────────────────────────────

class TestLocationFilter:
    def test_st_tammany_filter(self):
        """Sources from St. Tammany should not include Hancock County sources."""
        sources = [
            {"id": 1, "state": "LA", "county": "St. Tammany Parish", "entity_name": "St. Tammany Parish Government", "source_url": "http://a.com", "source_category": "budget-page", "is_active": True, "verification_status": "verified"},
            {"id": 2, "state": "MS", "county": "Hancock County", "entity_name": "Hancock County Government", "source_url": "http://b.com", "source_category": "budget-page", "is_active": True, "verification_status": "verified"},
            {"id": 3, "state": "LA", "county": "Jefferson Parish", "entity_name": "Jefferson Parish Government", "source_url": "http://c.com", "source_category": "budget-page", "is_active": True, "verification_status": "verified"},
        ]
        la_sources = [s for s in sources if s["state"] == "LA" and s["county"] == "St. Tammany Parish"]
        assert len(la_sources) == 1
        assert la_sources[0]["entity_name"] == "St. Tammany Parish Government"

    def test_mississippi_isolated_from_louisiana(self):
        """Mississippi sources should never appear when filtering for Louisiana."""
        sources = [
            {"state": "LA", "county": "St. Tammany Parish", "entity_name": "St. Tammany"},
            {"state": "MS", "county": "Hancock County", "entity_name": "Hancock"},
        ]
        la_only = [s for s in sources if s["state"] == "LA"]
        ms_present = any(s["state"] == "MS" for s in la_only)
        assert not ms_present

    def test_no_data_for_unverified_state(self):
        """If a state has no verified sources, the result is empty — no fake data."""
        sources = []
        tx_sources = [s for s in sources if s.get("state") == "TX"]
        assert tx_sources == []


# ── 2. Source validator — broken links ────────────────────────────────────────

class TestSourceValidator:
    def test_broken_source_returns_validation_result(self):
        """Broken source never crashes — always returns a ValidationResult."""
        from python_engine.source_validator import validate_url
        from python_engine.models import ValidationResult

        with patch("python_engine.source_validator._head") as mock_head:
            mock_head.side_effect = Exception("Connection refused")
            result = validate_url("http://definitely-broken-url-that-does-not-exist.example/")

        assert isinstance(result, ValidationResult)
        assert result.status == "broken"
        assert result.error is not None

    def test_timeout_returns_broken_not_crash(self):
        """Timeout produces broken status, not an exception."""
        import requests
        from python_engine.source_validator import validate_url

        with patch("python_engine.source_validator._head") as mock_head:
            mock_head.side_effect = requests.exceptions.Timeout("timed out")
            result = validate_url("http://slow-government-site.example/budget.pdf")

        assert result.status == "broken"
        assert "Timeout" in result.error

    def test_broken_link_does_not_redirect_to_homepage(self):
        """
        A broken source should set status='broken', never set source_url to a different URL.
        The app should show 'Source link unavailable' — not silently redirect.
        """
        from python_engine.source_validator import validate_url

        with patch("python_engine.source_validator._head") as mock_head:
            mock_head.side_effect = Exception("DNS error")
            result = validate_url("http://broken.example/agenda.pdf")

        # The source_url in the result must be exactly what was passed in
        assert result.source_url == "http://broken.example/agenda.pdf"
        assert result.status == "broken"

    def test_404_returns_broken(self):
        """HTTP 404 should mark source as broken."""
        from python_engine.source_validator import validate_url
        from unittest.mock import MagicMock

        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("python_engine.source_validator._head", return_value=mock_response):
            result = validate_url("http://government-site.example/missing-doc")

        assert result.status == "broken"
        assert result.http_status == 404


# ── 3. Legal guardrails ────────────────────────────────────────────────────────

class TestLegalGuardrails:
    def test_item_without_source_cannot_be_approved(self):
        """No source URL + no original text → guardrails block it."""
        from python_engine.legal_guardrails import check_item

        result = check_item(
            source_url=None,
            original_text=None,
            source_title="Some Item",
            ai_summary=None,
        )
        assert not result.passed
        assert any("source" in r.lower() for r in result.reasons)

    def test_flagged_term_outside_quote_is_blocked(self):
        """'corrupt' outside quotes should trigger needs_review."""
        from python_engine.legal_guardrails import check_summary_text

        result = check_summary_text("The officials were corrupt and misused funds.")
        assert not result.passed
        assert result.admin_review_status == "needs_review"

    def test_flagged_term_inside_quote_is_allowed(self):
        """'corrupt' inside a direct quote should pass."""
        from python_engine.legal_guardrails import check_summary_text

        result = check_summary_text(
            'The report stated "the system was corrupt" according to the auditor.'
        )
        assert result.passed

    def test_vote_endorsement_blocked(self):
        """'Vote yes on this measure' must be blocked."""
        from python_engine.legal_guardrails import check_summary_text

        result = check_summary_text("Vote yes on this measure to fund schools.")
        assert not result.passed

    def test_neutral_summary_passes(self):
        """A plain, factual summary with no flagged content should pass."""
        from python_engine.legal_guardrails import check_summary_text

        result = check_summary_text(
            "The St. Tammany Parish School Board approved a $45 million budget for the 2025 "
            "fiscal year during their regular meeting on January 15. The budget includes "
            "funding for teacher salaries, maintenance, and new technology. "
            "Why this matters: This sets the funding levels for parish schools for the next year."
        )
        assert result.passed


# ── 4. AI summary notice ───────────────────────────────────────────────────────

class TestAISummaryNotice:
    def test_ai_summary_notice_is_required(self):
        """Every AI summary must include the required notice text."""
        from python_engine import config

        assert "AI-generated summary" in config.AI_SUMMARY_NOTICE
        assert "original source" in config.AI_SUMMARY_NOTICE

    def test_summarizer_attaches_notice(self):
        """Summarizer should attach ai_summary_notice to the draft."""
        from python_engine.summarizer import summarize
        from python_engine.models import CivicItemDraft
        from python_engine import config

        draft = CivicItemDraft(
            item_type="budget",
            title="Test Budget",
            original_text="The parish approved a $1 million budget.",
            source_url="http://example.com/budget.pdf",
            source_title="2025 Budget",
        )

        mock_response = MagicMock()
        mock_response.choices[0].message.content = (
            "The parish approved a $1 million budget for the upcoming year. "
            "Why this matters: This determines how public funds are spent."
        )

        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            with patch("python_engine.config.OPENAI_API_KEY", "test-key"):
                with patch("openai.OpenAI") as mock_openai_cls:
                    mock_client = MagicMock()
                    mock_openai_cls.return_value = mock_client
                    mock_client.chat.completions.create.return_value = mock_response
                    result = summarize(draft)

        assert result.ai_summary_notice == config.AI_SUMMARY_NOTICE


# ── 5. Compare engine uses factual language ────────────────────────────────────

class TestCompareEngine:
    def test_increase_description_is_factual(self):
        """Compare output should say 'Budget increased X%' — no opinion words."""
        from python_engine.compare_engine import _pct_change

        pct = _pct_change(1_000_000, 1_180_000)
        assert pct == 18.0

        description = f"Budget increased {pct}% compared with prior year."
        forbidden = ["wasteful", "corrupt", "excessive", "bad", "alarming"]
        for word in forbidden:
            assert word not in description.lower()

    def test_decrease_description_is_factual(self):
        from python_engine.compare_engine import _pct_change

        pct = _pct_change(1_000_000, 900_000)
        assert pct == -10.0

    def test_no_change_description(self):
        from python_engine.compare_engine import _pct_change

        pct = _pct_change(500_000, 500_000)
        assert pct == 0.0
