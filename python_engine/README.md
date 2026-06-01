# Small Town Watchdog — Python Data Engine

Standalone command-line engine that powers the source validation, document ingestion,
and AI summarization pipeline for Small Town Watchdog.

## Setup

```bash
cd python_engine
pip install -r requirements.txt
```

Requires `DATABASE_URL` environment variable (same Postgres as the Node.js app).
Copy from `.env` in the workspace root or set directly:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
export OPENAI_API_KEY="sk-..."   # optional — needed for AI summaries
```

## Commands

```bash
# Validate all source URLs in the registry
python -m python_engine.main validate-sources
python -m python_engine.main validate-sources --state LA

# Fetch and ingest documents from active verified sources
python -m python_engine.main fetch-documents
python -m python_engine.main fetch-documents --state LA --county "St. Tammany Parish"

# Generate AI summaries for queued items (requires OPENAI_API_KEY)
python -m python_engine.main summarize-pending
python -m python_engine.main summarize-pending --limit 50

# Import election-specific sources
python -m python_engine.main import-election-data --state LA

# Import meeting agendas and minutes
python -m python_engine.main import-meetings --state LA

# Run the full pipeline end-to-end
python -m python_engine.main run-full-pipeline --state LA
```

## Pipeline Flow

```
source_registry table
       ↓
  validate-sources  →  marks broken/verified in DB
       ↓
  fetch-documents   →  fetches HTML/PDF from verified sources
       ↓
  parse + guardrails →  extracts title/text/date; legal rules applied
       ↓
  civic_items table  →  inserted with admin_review_status = needs_review
       ↓
  summarize-pending  →  AI summary generated + notice attached
       ↓
  admin reviews      →  approve/reject in Admin Panel
       ↓
  public display     →  only approved items shown
```

## Safety Rules (Non-Negotiable)

1. **No source = no publication.** Items without source_url or original_text are blocked.
2. **No accusations.** AI summaries containing crime/corruption language outside direct quotes are flagged.
3. **No rumors.** Only sourced, fetched content enters the pipeline.
4. **No political endorsements.** Vote-direction language triggers needs_review.
5. **Every item goes to admin review before public display** (`ADMIN_REVIEW_REQUIRED=True`).
6. **Every AI summary includes the required notice** attached automatically.
7. **Original source always wins.** AI summary is for convenience only.

## Tests

```bash
python -m pytest python_engine/tests/ -v
```

## File Map

| File | Purpose |
|------|---------|
| `config.py` | Environment variables and constants |
| `models.py` | Pydantic data models |
| `db.py` | PostgreSQL helpers (psycopg2) |
| `source_registry.py` | Load/filter source registry |
| `source_validator.py` | HTTP validation of source URLs |
| `document_fetcher.py` | Fetch HTML and PDF documents |
| `document_parser.py` | Extract title, text, date, amounts |
| `summarizer.py` | OpenAI AI summaries with guardrails |
| `legal_guardrails.py` | Pre-publication safety checks |
| `ingestion_pipeline.py` | Main orchestration pipeline |
| `election_pipeline.py` | Election-specific ingestion |
| `meeting_pipeline.py` | Meeting agenda/minutes ingestion |
| `reminder_pipeline.py` | Upcoming item notifications |
| `compare_engine.py` | Year-over-year budget comparison |
| `main.py` | CLI entry point |
| `tests/test_pipeline.py` | Automated tests |
