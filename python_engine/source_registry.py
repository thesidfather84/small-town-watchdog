"""
Loads and manages the source registry.
The source_registry table is the canonical list of official government sources.
"""

from __future__ import annotations
import logging
from typing import Optional

from . import db
from .models import SourceRegistryEntry

log = logging.getLogger(__name__)


def load_sources(state: Optional[str] = None) -> list[SourceRegistryEntry]:
    """Load all active sources, optionally filtered by state."""
    rows = db.load_active_sources(state=state)
    entries = []
    for row in rows:
        try:
            entries.append(SourceRegistryEntry(**row))
        except Exception as e:
            log.warning("Could not parse source_registry row %s: %s", row.get("id"), e)
    return entries


def sources_by_county(state: str, county: str) -> list[SourceRegistryEntry]:
    """Load sources for a specific state + county/parish."""
    all_sources = load_sources(state=state)
    return [s for s in all_sources if s.county and s.county.lower() == county.lower()]


def sources_needing_validation() -> list[SourceRegistryEntry]:
    """Sources that have never been checked or were last checked > 7 days ago."""
    from datetime import datetime, timezone, timedelta
    rows = db.load_active_sources()
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    return [
        SourceRegistryEntry(**r)
        for r in rows
        if not r.get("last_checked") or r["last_checked"] < cutoff
    ]
