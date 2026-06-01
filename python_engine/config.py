"""
Configuration loader for the Small Town Watchdog Python engine.
Reads from environment or .env file in the workspace root.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

_root = Path(__file__).resolve().parent.parent
_env_file = _root / ".env"
if _env_file.exists():
    load_dotenv(_env_file)

DATABASE_URL: str = os.environ.get("DATABASE_URL", "")
OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

FETCH_TIMEOUT_SECONDS: int = int(os.environ.get("FETCH_TIMEOUT", "15"))
FETCH_USER_AGENT: str = (
    "SmallTownWatchdog/1.0 (+https://smalltownwatchdog.com; "
    "civic transparency aggregator; respects robots.txt)"
)

MAX_DOCUMENT_CHARS: int = 40_000

# When True, items scraped from a verified source that pass all guardrails
# are automatically approved and shown publicly — no manual step required.
# Set to False to revert to full manual review for everything.
AUTO_APPROVE_VERIFIED_SOURCES: bool = True

FLAGGED_TERMS = [
    "corrupt", "corruption", "fraud", "fraudulent",
    "stolen", "criminal", "scam", "scheme",
    "bribe", "bribery", "embezzle", "embezzlement",
    "money laundering", "racketeering",
]

AI_SUMMARY_NOTICE = (
    "AI-generated summary for convenience. "
    "Review the original source for complete information."
)

PLATFORM_MISSION = (
    "Small Town Watchdog is a civic information platform that organizes public "
    "information, election information, meeting schedules, budgets, and public "
    "records into plain English. We do not endorse candidates, parties, ballot "
    "measures, or political viewpoints."
)


def validate():
    """Raise on missing required config."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set.")
