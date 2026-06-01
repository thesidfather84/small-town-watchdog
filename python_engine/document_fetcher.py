"""
Fetches document content from source URLs.
Handles HTML pages and PDF files. Never crashes — returns None on failure.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional

import requests
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

from . import config
from .models import FetchedDocument

log = logging.getLogger(__name__)

_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": config.FETCH_USER_AGENT})


@retry(
    stop=stop_after_attempt(2),
    wait=wait_fixed(3),
    retry=retry_if_exception_type((requests.exceptions.Timeout, requests.exceptions.ConnectionError)),
    reraise=False,
)
def _get(url: str) -> Optional[requests.Response]:
    try:
        resp = _SESSION.get(url, timeout=config.FETCH_TIMEOUT_SECONDS, allow_redirects=True)
        resp.raise_for_status()
        return resp
    except Exception as e:
        log.warning("Fetch failed for %s: %s", url, e)
        return None


def fetch(url: str) -> Optional[FetchedDocument]:
    """
    Fetch a URL and return a FetchedDocument or None on failure.
    Determines HTML vs PDF from content-type header.
    """
    resp = _get(url)
    if resp is None:
        return None

    content_type = resp.headers.get("Content-Type", "").lower()
    now = datetime.now(timezone.utc)

    if "pdf" in content_type or url.lower().endswith(".pdf"):
        return _parse_pdf(resp, url, now)

    resp.encoding = resp.apparent_encoding or "utf-8"
    return FetchedDocument(
        source_url=url,
        raw_text=resp.text[: config.MAX_DOCUMENT_CHARS],
        content_type="text/html",
        http_status=resp.status_code,
        fetched_at=now,
    )


def _parse_pdf(resp: requests.Response, url: str, now: datetime) -> Optional[FetchedDocument]:
    try:
        from pdfminer.high_level import extract_text_to_fp
        from pdfminer.layout import LAParams
        import io

        pdf_bytes = io.BytesIO(resp.content)
        output = io.StringIO()
        extract_text_to_fp(pdf_bytes, output, laparams=LAParams())
        text = output.getvalue()[: config.MAX_DOCUMENT_CHARS]
        return FetchedDocument(
            source_url=url,
            raw_text=text,
            content_type="application/pdf",
            http_status=resp.status_code,
            fetched_at=now,
        )
    except Exception as e:
        log.warning("PDF parse failed for %s: %s", url, e)
        return None
