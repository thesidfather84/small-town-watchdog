"""
Parses fetched HTML/text to extract title, body text, date, and dollar amounts.
"""

from __future__ import annotations
import re
import logging
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

_DATE_PATTERNS = [
    r"\b(\w+ \d{1,2},?\s+\d{4})\b",
    r"\b(\d{1,2}/\d{1,2}/\d{4})\b",
    r"\b(\d{4}-\d{2}-\d{2})\b",
    r"\b(\w+ \d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b",
]
_DATE_RE = re.compile("|".join(_DATE_PATTERNS), re.IGNORECASE)
_AMOUNT_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{2})?)\s*(million|billion|thousand)?", re.IGNORECASE)


class ParsedDocument:
    def __init__(self, title: Optional[str], body_text: str,
                 published_date: Optional[date], agency: Optional[str], amounts: list[float]):
        self.title = title
        self.body_text = body_text
        self.published_date = published_date
        self.agency = agency
        self.amounts = amounts

    def largest_amount(self) -> Optional[float]:
        return max(self.amounts) if self.amounts else None


def parse_html(html: str, source_agency: Optional[str] = None) -> ParsedDocument:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    title: Optional[str] = None
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)

    main = soup.find("main") or soup.find("article") or soup.find("body") or soup
    body_text = main.get_text(separator=" ", strip=True)
    body_text = re.sub(r"\s{2,}", " ", body_text)

    return ParsedDocument(
        title=title,
        body_text=body_text,
        published_date=_extract_date(body_text),
        agency=source_agency,
        amounts=_extract_amounts(body_text),
    )


def parse_text(text: str, source_agency: Optional[str] = None) -> ParsedDocument:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    body_text = " ".join(lines)
    return ParsedDocument(
        title=lines[0] if lines else None,
        body_text=body_text,
        published_date=_extract_date(body_text),
        agency=source_agency,
        amounts=_extract_amounts(body_text),
    )


def _extract_date(text: str) -> Optional[date]:
    match = _DATE_RE.search(text)
    if not match:
        return None
    raw = next(g for g in match.groups() if g)
    for fmt in ("%B %d, %Y", "%B %d %Y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            cleaned = re.sub(r"(st|nd|rd|th),?", "", raw, flags=re.IGNORECASE).strip()
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def _extract_amounts(text: str) -> list[float]:
    amounts: list[float] = []
    for match in _AMOUNT_RE.finditer(text):
        try:
            value = float(match.group(1).replace(",", ""))
            mult = (match.group(2) or "").lower()
            if mult == "billion":
                value *= 1_000_000_000
            elif mult == "million":
                value *= 1_000_000
            elif mult == "thousand":
                value *= 1_000
            amounts.append(value)
        except ValueError:
            continue
    return amounts
