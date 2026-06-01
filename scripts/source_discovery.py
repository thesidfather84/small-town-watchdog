"""
Small Town Watchdog
Source Discovery Crawler

Purpose:
Find official public government source pages for any city, county/parish, and state.

This does NOT scrape private data.
This does NOT invent records.
This only finds possible official public sources for admin review.

Usage:
    python scripts/source_discovery.py

Requirements:
    pip install requests beautifulsoup4

Workflow:
1. Run this crawler against known or candidate URLs.
2. Each URL is HEAD-checked (live), scored, and categorised.
3. Records with status "needs_review_*" are queued for admin approval.
4. Admin approves sources before they appear publicly in the app.
5. Broken or low-confidence URLs are rejected automatically.
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from datetime import datetime


KNOWN_GOV_PLATFORMS = [
    "civicclerk.com",
    "granicus.com",
    "legistar.com",
    "civicplus.com",
    "boarddocs.com",
    "municode.com",
]

REJECT_WORDS = [
    "campaign",
    "donate",
    "vote for",
    "facebook.com",
    "reddit.com",
    "blog",
    "opinion",
    "party",
]


SOURCE_KEYWORDS = {
    "Agenda": ["agenda", "meeting agenda", "council agenda"],
    "Minutes": ["minutes", "meeting minutes"],
    "Budget": ["budget", "adopted budget", "proposed budget"],
    "Audit": ["audit", "financial report", "annual report"],
    "Election": ["election", "voting", "sample ballot", "registrar"],
    "Public Notice": ["public notice", "legal notice"],
    "Contracts": ["contracts", "procurement", "purchasing"],
    "Bids": ["bids", "rfp", "rfq"],
    "Planning and Zoning": ["planning", "zoning", "land use"],
    "Sheriff": ["sheriff", "law enforcement district"],
    "School Board": ["school board", "board agenda"],
}


def build_queries(city: str, county: str, state: str) -> list[str]:
    return [
        f"{city} {state} official city council agenda",
        f"{city} {state} city council minutes",
        f"{city} {state} budget pdf",
        f"{city} {state} audit financial report",
        f"{city} {state} public notices",
        f"{city} {state} planning zoning agenda",
        f"{county} {state} county agenda minutes",
        f"{county} {state} election voting sample ballot",
        f"{county} {state} sheriff budget",
        f"{county} {state} school board agenda",
        f"{state} secretary of state elections {county}",
        f"{state} state auditor {county}",
    ]


def is_url_valid(url: str) -> bool:
    """HEAD-check the URL. Returns True if status < 400."""
    if not url.startswith("http"):
        return False

    try:
        response = requests.head(url, timeout=8, allow_redirects=True)
        return response.status_code < 400
    except Exception:
        return False


def get_page_title(url: str) -> str:
    """Fetch the page and extract the <title> tag text."""
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        if soup.title:
            return soup.title.text.strip()
    except Exception:
        pass

    return ""


def guess_category(url: str, title: str) -> str:
    """Match URL + title text against known source keyword groups."""
    text = f"{url} {title}".lower()

    for category, words in SOURCE_KEYWORDS.items():
        for word in words:
            if word in text:
                return category

    return "Needs Review"


def confidence_score(url: str, title: str, city: str, county: str, state: str) -> int:
    """
    Score a URL 0-100+ based on:
    - .gov domain (+30)
    - known gov platform (+15)
    - city/county/state name in URL or title (+10-20 each)
    - source keyword present (+10)
    - reject words present (-30)
    - URL is broken (-50)
    """
    score = 0
    text = f"{url} {title}".lower()
    domain = urlparse(url).netloc.lower()

    if ".gov" in domain:
        score += 30

    for platform in KNOWN_GOV_PLATFORMS:
        if platform in domain:
            score += 15

    if city.lower() in text:
        score += 20

    if county.lower() in text:
        score += 20

    if state.lower() in text:
        score += 10

    source_words = [
        "agenda",
        "minutes",
        "budget",
        "audit",
        "election",
        "voting",
        "notice",
        "procurement",
        "bids",
        "zoning",
        "sheriff",
    ]

    for word in source_words:
        if word in text:
            score += 10
            break

    for bad in REJECT_WORDS:
        if bad in text:
            score -= 30

    if not is_url_valid(url):
        score -= 50

    return max(score, 0)


def create_source_record(url: str, city: str, county: str, state: str) -> dict:
    """
    Build a source record dict ready for admin review.
    High-confidence (>=70) and low-confidence (>=40) records are both saved
    as needs_review_* so an admin can approve or reject before public display.
    Records below 40 are auto-rejected.
    """
    title = get_page_title(url)
    score = confidence_score(url, title, city, county, state)

    if score >= 70:
        status = "needs_review_high_confidence"
    elif score >= 40:
        status = "needs_review_low_confidence"
    else:
        status = "rejected_low_confidence"

    return {
        "state": state,
        "countyParish": county,
        "city": city,
        "entityName": f"{city} / {county}",
        "entityType": "Government Source",
        "sourceCategory": guess_category(url, title),
        "sourcePlatform": urlparse(url).netloc,
        "sourceUrl": url,
        "pageTitle": title,
        "confidenceScore": score,
        "verificationStatus": status,
        "lastCheckedAt": datetime.utcnow().isoformat(),
    }


def discover_sources_from_urls(urls: list[str], city: str, county: str, state: str) -> list[dict]:
    """
    Validate and score a list of candidate URLs for a given location.
    Returns a list of source record dicts sorted by confidence score descending.
    Only records with status needs_review_* should be offered for admin approval.
    """
    records = []

    for url in urls:
        print(f"  Checking: {url}")
        record = create_source_record(url, city, county, state)
        records.append(record)
        print(f"    → [{record['confidenceScore']:3d}] {record['verificationStatus']}  ({record['sourceCategory']})")

    records.sort(key=lambda r: r["confidenceScore"], reverse=True)
    return records


def print_report(records: list[dict]) -> None:
    """Print a human-readable summary of discovered sources."""
    approved   = [r for r in records if "high_confidence" in r["verificationStatus"]]
    review     = [r for r in records if "low_confidence"  in r["verificationStatus"] and "rejected" not in r["verificationStatus"]]
    rejected   = [r for r in records if "rejected"        in r["verificationStatus"]]

    print(f"\n{'='*60}")
    print(f"  Discovery complete — {len(records)} URLs checked")
    print(f"  High confidence (needs admin review): {len(approved)}")
    print(f"  Low confidence  (needs admin review): {len(review)}")
    print(f"  Auto-rejected:                        {len(rejected)}")
    print(f"{'='*60}\n")

    for r in records:
        flag = "✓" if "high_confidence" in r["verificationStatus"] else ("?" if "low_confidence" in r["verificationStatus"] and "rejected" not in r["verificationStatus"] else "✗")
        print(f"  {flag} [{r['confidenceScore']:3d}] {r['sourceCategory']:<20} {r['sourceUrl']}")

    print(f"\nNext step: submit needs_review records to the app's source registry for admin approval.")
    print(f"Contact:   support@smalltownwatchdog.com\n")


if __name__ == "__main__":
    # ── Example: Bay St. Louis / Hancock County, Mississippi ──────────────────
    city   = "Bay St. Louis"
    county = "Hancock County"
    state  = "Mississippi"

    print(f"\nSmall Town Watchdog — Source Discovery")
    print(f"Location: {city}, {county}, {state}\n")

    test_urls = [
        "https://www.baystlouis-ms.gov/city-council",
        "https://www.baystlouis-ms.gov/meetings",
        "https://www.baystlouis-ms.gov/mayor/page/budget-and-audited-financial-statements",
        "https://www.hancockcounty.ms.gov/agendacenter",
        "https://www.hancockcounty.ms.gov/215/Elections-Voting",
    ]

    results = discover_sources_from_urls(test_urls, city, county, state)
    print_report(results)
