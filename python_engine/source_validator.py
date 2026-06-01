"""
Validates source URLs by making lightweight HTTP requests.
Updates source_registry with results. Never crashes.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from . import config, db
from .models import ValidationResult

log = logging.getLogger(__name__)

_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": config.FETCH_USER_AGENT})


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(requests.exceptions.ConnectionError),
    reraise=True,
)
def _head(url: str) -> requests.Response:
    return _SESSION.head(url, timeout=config.FETCH_TIMEOUT_SECONDS, allow_redirects=True)


def validate_url(url: str) -> ValidationResult:
    """
    Check whether a source URL is reachable.
    HEAD first, falls back to GET if HEAD returns 405.
    Never crashes — always returns a ValidationResult.
    """
    now = datetime.now(timezone.utc)
    try:
        resp = _head(url)
        status = resp.status_code
        if status == 405:
            resp = _SESSION.get(url, timeout=config.FETCH_TIMEOUT_SECONDS, allow_redirects=True, stream=True)
            resp.close()
            status = resp.status_code

        if status < 400:
            return ValidationResult(source_url=url, status="valid", http_status=status, checked_at=now)
        return ValidationResult(source_url=url, status="broken", http_status=status, error=f"HTTP {status}", checked_at=now)

    except requests.exceptions.Timeout:
        return ValidationResult(source_url=url, status="broken", error="Timeout", checked_at=now)
    except requests.exceptions.SSLError as e:
        return ValidationResult(source_url=url, status="broken", error=f"SSL: {e}", checked_at=now)
    except requests.exceptions.ConnectionError as e:
        return ValidationResult(source_url=url, status="broken", error=f"Connection: {e}", checked_at=now)
    except Exception as e:
        return ValidationResult(source_url=url, status="broken", error=str(e), checked_at=now)


def validate_all_registry_sources(state: Optional[str] = None) -> dict:
    """Validate every active source in source_registry. Updates DB. Returns counts."""
    sources = db.load_active_sources(state=state)
    total = len(sources)
    valid_count = broken_count = 0

    log.info("Validating %d sources%s…", total, f" for {state}" if state else "")

    for src in sources:
        result = validate_url(src["source_url"])
        now = result.checked_at
        if result.status == "valid":
            valid_count += 1
            db.update_source_registry_status(src["id"], "verified", now, last_successful_update=now)
        else:
            broken_count += 1
            db.update_source_registry_status(src["id"], "broken", now)
            log.warning("Broken [%s] %s: %s", src["id"], src["source_url"], result.error)

    return {"checked": total, "valid": valid_count, "broken": broken_count}


def validate_document_sources() -> dict:
    """Validate source URLs on the legacy documents table."""
    docs = db.get_documents_needing_source_check()
    valid_count = broken_count = missing_count = 0
    results = []

    for doc in docs:
        url = doc.get("source_url")
        now = datetime.now(timezone.utc)
        if not url:
            missing_count += 1
            db.update_document_source_status(doc["id"], "missing", now)
            results.append({"documentId": doc["id"], "title": doc["title"], "sourceUrl": url, "status": "missing"})
            continue
        vr = validate_url(url)
        if vr.status == "valid":
            valid_count += 1
            db.update_document_source_status(doc["id"], "valid", now)
        else:
            broken_count += 1
            db.update_document_source_status(doc["id"], "broken", now)
        results.append({"documentId": doc["id"], "title": doc["title"], "sourceUrl": url, "status": vr.status})

    return {"checked": len(docs), "valid": valid_count, "broken": broken_count, "missing": missing_count, "results": results}
