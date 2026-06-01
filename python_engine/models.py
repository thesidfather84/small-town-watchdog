"""
Pydantic data models used throughout the Python engine.
These mirror the database tables but are used for in-memory processing.
"""

from __future__ import annotations
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel


AdminReviewStatus = Literal["draft", "needs_review", "approved", "rejected", "broken_source"]
SourceStatus      = Literal["valid", "broken", "missing", "pending_review"]
RedFlagLevel      = Literal["green", "yellow", "red"]


class SourceRegistryEntry(BaseModel):
    id: int
    state: str
    county: Optional[str] = None
    city: Optional[str] = None
    entity_name: str
    entity_type: str
    source_url: str
    source_category: str
    source_platform: str
    verification_status: str
    last_checked: Optional[datetime] = None
    last_successful_update: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: bool = True


class FetchedDocument(BaseModel):
    source_url: str
    source_title: Optional[str] = None
    source_agency: Optional[str] = None
    source_date: Optional[date] = None
    raw_text: str
    content_type: str = "text/html"
    fetched_at: datetime = datetime.utcnow()
    http_status: int = 200


class CivicItemDraft(BaseModel):
    """In-memory representation before writing to civic_items table."""
    location_id: Optional[int] = None
    entity_id: Optional[int] = None
    item_type: str
    title: str
    event_date: Optional[date] = None
    amount_involved: Optional[float] = None
    vote_result: Optional[str] = None
    source_title: Optional[str] = None
    source_agency: Optional[str] = None
    source_url: Optional[str] = None
    source_date: Optional[date] = None
    original_text: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_summary_notice: str = ""
    red_flag_level: RedFlagLevel = "green"
    source_status: SourceStatus = "pending_review"
    admin_review_status: AdminReviewStatus = "needs_review"


class ValidationResult(BaseModel):
    source_url: str
    status: SourceStatus
    http_status: Optional[int] = None
    error: Optional[str] = None
    checked_at: datetime = datetime.utcnow()


class PipelineRun(BaseModel):
    """Summary statistics for a pipeline run."""
    sources_checked: int = 0
    sources_valid: int = 0
    sources_broken: int = 0
    documents_fetched: int = 0
    items_created: int = 0
    items_auto_approved: int = 0
    items_pending: int = 0
    items_duplicate_skipped: int = 0
    items_validation_failed: int = 0
    items_blocked_for_review: int = 0
    summaries_generated: int = 0
    errors: list[str] = []

    def print_summary(self):
        print("\n=== Pipeline Run Summary ===")
        print(f"  sources checked       : {self.sources_checked}")
        print(f"  sources valid         : {self.sources_valid}")
        print(f"  sources broken        : {self.sources_broken}")
        print(f"  documents fetched     : {self.documents_fetched}")
        print(f"  items created         : {self.items_created}")
        print(f"  items auto-approved   : {self.items_auto_approved}")
        print(f"  items pending review  : {self.items_pending}")
        print(f"  duplicates skipped    : {self.items_duplicate_skipped}")
        print(f"  validation failed     : {self.items_validation_failed}")
        print(f"  summaries generated   : {self.summaries_generated}")
        if self.errors:
            print(f"  errors ({len(self.errors)}):")
            for e in self.errors[:10]:
                print(f"    - {e}")
        print("============================\n")
