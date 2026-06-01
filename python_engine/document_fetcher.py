"""
Fetches document content from source URLs.
Handles HTML pages and PDF files. Never crashes — returns None on failure.
Also provides extract_document_links() to discover agenda/minutes/budget links.
"""

from __future__ import annotations
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

from . import config
from .models import FetchedDocument

log = logging.getLogger(__name__)

_SESSION = requests.Session()
_SESSION.headers.update({"User-Agent": config.FETCH_USER_AGENT})

# Keywords that suggest a link points to a civic document worth fetching
_CIVIC_LINK_KEYWORDS = re.compile(
    r"\b(agenda|minutes|budget|audit|ordinance|resolution|notice|"
    r"election|ballot|contract|bid|rfp|report|financial|annual|"
    r"meeting|hearing|zoning|permit|tax|millage|assessment)\b",
    re.IGNORECASE,
)

# File extensions considered civic documents
_DOCUMENT_EXTENSIONS = re.compile(r"\.(pdf|doc|docx|xls|xlsx)(\?|$)", re.IGNORECASE)


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
        log.warning("Fetch failed for %s: %s", url, type(e).__name__)
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

    if "pdf" in content_type or url.lower().split("?")[0].endswith(".pdf"):
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


def extract_document_links(html: str, base_url: str) -> list[str]:
    """
    Find links in an HTML page that likely point to civic documents
    (agendas, minutes, budgets, PDFs, etc.) on the same domain.

    Returns a deduplicated list of absolute URLs, same-origin only.
    """
    from bs4 import BeautifulSoup

    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        return []

    base_parsed = urlparse(base_url)

    seen: set[str] = set()
    links: list[str] = []

    for tag in soup.find_all("a", href=True):
        href: str = (tag.get("href") or "").strip()
        if not href or href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue

        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)

        # Same domain only
        if parsed.netloc != base_parsed.netloc:
            continue

        # Normalize: strip fragment
        clean = absolute.split("#")[0].rstrip("/")
        if clean == base_url.rstrip("/") or clean in seen:
            continue

        link_text = (tag.get_text(strip=True) or "").lower()
        url_path  = parsed.path.lower()

        # Include if URL path or link text contains civic keywords, or it's a document file
        if (
            _CIVIC_LINK_KEYWORDS.search(url_path)
            or _CIVIC_LINK_KEYWORDS.search(link_text)
            or _DOCUMENT_EXTENSIONS.search(url_path)
        ):
            seen.add(clean)
            links.append(clean)

        if len(links) >= 30:
            break

    return links
