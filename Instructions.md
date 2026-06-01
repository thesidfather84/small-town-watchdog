# Small Town Watchdog — Data Workflow Instructions

**Date written:** 2026-06-01  
**Scope:** Auto-approval, flag system, duplicate detection, enhanced logging, state expansion.  
**Do NOT:** Redesign the interface, remove existing features, change homepage layout.

---

## 1. Codebase Research Summary

### Files and Functions Relevant to This Plan

| File | Relevance |
|---|---|
| `python_engine/config.py` | `ADMIN_REVIEW_REQUIRED = True` — the root cause of the no-auto-approve problem |
| `python_engine/ingestion_pipeline.py` | Sets `admin_review_status` for all scraped items |
| `python_engine/legal_guardrails.py` | Runs safety checks; contains auto-approve logic that is bypassed |
| `python_engine/db.py` | All DB writes; `insert_civic_item`, `find_or_create_location` |
| `python_engine/models.py` | Pydantic models; `PipelineRun` stats |
| `python_engine/seed_sources.py` | Official source list (LA/MS only today) |
| `lib/db/src/schema/civic-items.ts` | Drizzle schema for `civic_items` table |
| `lib/db/src/schema/source-registry.ts` | Drizzle schema for `source_registry` table |
| `lib/db/src/schema/scraper-runs.ts` | Drizzle schema for `scraper_runs` table |
| `artifacts/api-server/src/routes/civic-items.ts` | Express routes for civic items (public + admin) |
| `artifacts/api-server/src/routes/source-registry.ts` | CRUD for source registry |
| `artifacts/api-server/src/routes/diagnostics.ts` | Diagnostics endpoint |

---

## 2. Root Cause Analysis

### Problem A: Nothing Ever Auto-Approves (Two Bugs)

**Bug 1 — `ingestion_pipeline.py` line 84:**
```python
# CURRENT (broken — both branches do the same thing):
admin_status = "needs_review" if not guardrail.passed else "needs_review"

# INTENDED behaviour:
admin_status = "needs_review" if not guardrail.passed else guardrail.admin_review_status
```

**Bug 2 — `legal_guardrails.py` line 78:**
```python
# CURRENT (never auto-approves because ADMIN_REVIEW_REQUIRED is True):
result.admin_review_status = "approved" if not config.ADMIN_REVIEW_REQUIRED else "needs_review"
```
`config.ADMIN_REVIEW_REQUIRED = True` overrides all auto-approval. Even if an item passes
every guardrail check, it is still saved as `needs_review`. This is the core issue.

**Fix:** Change `ADMIN_REVIEW_REQUIRED` from a blanket boolean to source-trust-based logic.
An item should auto-approve when ALL of the following are true:
1. Its source is in the `source_registry` with `verification_status = 'verified'` **AND** `is_active = TRUE`
2. It has a `source_url` (no source = no publish — existing guardrail)
3. It passed all legal guardrail checks (no flagged terms, no vote advocacy)
4. The parser was confident (title present, text present)

Items that fail any of the above save as `needs_review` (pending).

### Problem B: No Duplicate Detection

`insert_civic_item` in `db.py` does a plain INSERT with no uniqueness check.
Running the pipeline twice inserts duplicate rows. We need a `content_hash` column
on `civic_items` and an `ON CONFLICT DO NOTHING` upsert strategy.

The hash should be: `sha256(source_url + "|" + (title.lower().strip()))`.
This catches exact re-fetches of the same page without requiring full-text comparison.

### Problem C: No Public/Admin Flag System

The existing `error_reports` table handles "report an error" (wrong info, broken link).
It is NOT a visibility-flag system. We need a new `civic_item_flags` table so that:
- Any user (anonymous) or admin can flag an item
- Flagged items stay visible unless an admin explicitly hides/deletes them
- Admin console shows all open flags
- Admin can: delete item, hide item, edit item, or mark flag resolved

### Problem D: Scraper Run Logs Are Thin

`scraper_runs` tracks only `items_created` and `items_updated`. It has no columns for:
- `items_auto_approved` (how many were auto-approved vs queued)
- `items_pending` (how many went to needs_review)
- `items_duplicate_skipped` (how many duplicates were dropped)
- `items_validation_failed` (how many failed guardrails)
- `items_flagged` (how many open flags were created in this run — N/A for pipeline, but useful for admin)

### Problem E: State Expansion Is Semi-Hard

`find_or_create_location` in `db.py` has a hardcoded dict for state names:
```python
state_name = {"LA": "Louisiana", "MS": "Mississippi", "TX": "Texas"}.get(state_code, state_code)
```
Adding Tennessee requires updating this dict. The rest of the system (location filtering,
UI state filter) is already generic — only this dict needs to grow as states are added.

---

## 3. Implementation Plan

### Step 1: Fix Auto-Approval Logic (Python Engine)

**Files to change:**
- `python_engine/config.py`
- `python_engine/ingestion_pipeline.py`
- `python_engine/db.py`
- `python_engine/models.py`

**Changes:**

**`config.py`** — Replace `ADMIN_REVIEW_REQUIRED = True` with a named constant that is
now only used as a "force review" override for specific content types (flagged terms, etc.):
```python
# Remove this:
# ADMIN_REVIEW_REQUIRED: bool = True

# Add this:
AUTO_APPROVE_VERIFIED_SOURCES: bool = True   # flip to False to disable auto-approve globally
```

**`ingestion_pipeline.py`** — After guardrail check, determine auto-approval based on
source trust:
```python
# After guardrail check:
source_is_verified = src.get("verification_status") == "verified"

if not guardrail.passed:
    admin_status = "needs_review"
    run_stats.items_pending += 1
    run_stats.items_validation_failed += 1
elif config.AUTO_APPROVE_VERIFIED_SOURCES and source_is_verified and url:
    admin_status = "approved"
    run_stats.items_auto_approved += 1
else:
    admin_status = "needs_review"
    run_stats.items_pending += 1
```

**`models.py`** — Add new counters to `PipelineRun`:
```python
items_auto_approved: int = 0
items_pending: int = 0
items_duplicate_skipped: int = 0
items_validation_failed: int = 0
```

### Step 2: Add Duplicate Detection

**Files to change:**
- `lib/db/src/schema/civic-items.ts` (add `content_hash` column)
- `python_engine/db.py` (upsert logic)
- Run `pnpm --filter @workspace/db run push` after schema change

**Schema addition in `civic-items.ts`:**
```typescript
contentHash: text("content_hash"),  // sha256(source_url + "|" + lower(title))
```
Add a unique index:
```typescript
import { uniqueIndex } from "drizzle-orm/pg-core";
// In pgTable options:
(table) => [uniqueIndex("civic_items_content_hash_idx").on(table.contentHash)]
```

**`db.py` — change `insert_civic_item` to compute hash and use ON CONFLICT:**
```python
import hashlib

def _content_hash(source_url: str, title: str) -> str:
    raw = f"{(source_url or '').strip()}|{(title or '').lower().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()

def insert_civic_item(item: dict) -> tuple[int, bool]:
    """Returns (id, created). created=False means duplicate was skipped."""
    h = _content_hash(item.get("source_url", ""), item.get("title", ""))
    item["content_hash"] = h
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO civic_items (..., content_hash)
            VALUES (..., %(content_hash)s)
            ON CONFLICT (content_hash) DO NOTHING
            RETURNING id
            """,
            item,
        )
        row = cur.fetchone()
        if row is None:
            # Duplicate — fetch the existing id
            cur.execute("SELECT id FROM civic_items WHERE content_hash=%s", (h,))
            existing = cur.fetchone()
            return (existing[0] if existing else -1), False
        return row[0], True
```

Update all call sites in `ingestion_pipeline.py`, `election_pipeline.py`,
`meeting_pipeline.py` to handle the `(id, created)` return tuple and count duplicates.

### Step 3: Add Civic Item Flags Table

**Files to change:**
- `lib/db/src/schema/civic-item-flags.ts` (new file)
- `lib/db/src/schema/index.ts` (add export)
- `lib/api-spec/openapi.yaml` (new paths)
- `artifacts/api-server/src/routes/civic-item-flags.ts` (new route file)
- `artifacts/api-server/src/routes/index.ts` (mount route)
- `artifacts/small-town-watchdog/src/pages/admin.tsx` (add Flagged Items tab panel)
- Minimal UI: add a "Flag this item" button on civic item cards/rows

**New Drizzle schema `lib/db/src/schema/civic-item-flags.ts`:**
```typescript
export const FLAG_REASONS = [
  "inaccurate", "outdated", "broken_link", "inappropriate", "other",
] as const;

export const FLAG_STATUSES = [
  "open", "resolved", "dismissed",
] as const;

export const civicItemFlagsTable = pgTable("civic_item_flags", {
  id: serial("id").primaryKey(),
  civicItemId: integer("civic_item_id").notNull().references(() => civicItemsTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull().default("other"),
  notes: text("notes"),
  flaggedBy: text("flagged_by"),        // "public" or "admin" or user-supplied label
  ipHash: text("ip_hash"),              // sha256 of IP — no PII, just for dedup
  status: text("status").notNull().default("open"),
  resolvedBy: text("resolved_by"),      // "admin" label
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

**New API paths in `openapi.yaml`:**
```yaml
/civic-item-flags:
  post:
    summary: Flag a civic item (public)
    requestBody: { civicItemId, reason, notes, flaggedBy }
    responses: { 201: FlagCreated }

/admin/civic-item-flags:
  get:
    summary: List all open flags (admin)
    responses: { 200: FlagList }

/admin/civic-item-flags/{id}:
  patch:
    summary: Resolve, dismiss, or update a flag (admin)
    requestBody: { status, resolvedBy }
    responses: { 200: FlagUpdated }
```

**Flag behavior (route logic):**
- `POST /api/civic-item-flags` — public, no auth. Rate-limit by IP hash (1 flag per item per IP per 24h). Item stays visible after flag. Returns generic `{success:true}`.
- `GET /api/admin/civic-item-flags` — requires `requireAdmin`. Returns all open flags with the linked civic item title, source, flag reason, and timestamp.
- `PATCH /api/admin/civic-item-flags/:id` — requires `requireAdmin`. Admin can set `status = "resolved"` or `"dismissed"`. Separately, admin can hide/delete the civic item via the existing `PATCH /api/admin/civic-items/:id` route (set `adminReviewStatus = "rejected"`).

**Admin panel addition:**
Add a "Flagged" tab to the existing admin tab bar in `admin.tsx`.
The tab queries `GET /admin/civic-item-flags` via `fetchAdminJSON` + `useQuery`.
Each row shows: Item title, flag reason, notes, date flagged, and action buttons:
- "Hide Item" → calls `PATCH /admin/civic-items/:civicItemId` with `adminReviewStatus: "rejected"`
- "Resolve Flag" → calls `PATCH /admin/civic-item-flags/:id` with `status: "resolved"`
- "Dismiss Flag" → calls `PATCH /admin/civic-item-flags/:id` with `status: "dismissed"`

**Public "Flag" button:**
Add a small `<button>` or link "Flag this item" on civic item cards. Opens a minimal
inline form (reason dropdown + optional notes). Submits to `POST /api/civic-item-flags`.
No login required. Show a confirmation "Thanks for the report." Flagged items do NOT
disappear from the public feed unless an admin explicitly hides them.

### Step 4: Enhance Scraper Run Logging

**Files to change:**
- `lib/db/src/schema/scraper-runs.ts` (add columns)
- `python_engine/db.py` (`record_scraper_run` signature)
- `python_engine/main.py` (pass new stats)
- `python_engine/models.py` (add fields to `PipelineRun`)

**New columns in `scraper_runs`:**
```typescript
itemsAutoApproved: integer("items_auto_approved").notNull().default(0),
itemsPending: integer("items_pending").notNull().default(0),
itemsDuplicateSkipped: integer("items_duplicate_skipped").notNull().default(0),
itemsValidationFailed: integer("items_validation_failed").notNull().default(0),
```

**`record_scraper_run` in `db.py`** — add matching parameters and include them in the INSERT.

**`cmd_run_daily` in `main.py`** — surface the new stats in the printed summary:
```
Items auto-approved : X
Items pending review: Y
Duplicates skipped  : Z
Validation failed   : W
```

### Step 5: State Expansion Support

**Files to change:**
- `python_engine/db.py` — expand the `state_name` dict
- `python_engine/seed_sources.py` — add Tennessee (or any new state) sources

**`find_or_create_location` in `db.py`:**
```python
STATE_NAMES = {
    "AL": "Alabama", "AR": "Arkansas", "FL": "Florida",
    "GA": "Georgia",  "KY": "Kentucky", "LA": "Louisiana",
    "MS": "Mississippi", "TN": "Tennessee", "TX": "Texas",
    "VA": "Virginia",
}
COUNTY_TYPE = {
    "LA": "parish",
}  # default "county" for all others

state_name = STATE_NAMES.get(state_code, state_code)
county_type = COUNTY_TYPE.get(state_code, "county")
```

Adding a new state then only requires:
1. Add sources to `seed_sources.py` with the new state code.
2. Add the state code to `STATE_NAMES` in `db.py` (one line).
3. Run `python python_engine/main.py seed-sources --state TN`.
4. Run `python python_engine/main.py run-daily --state TN`.
The location row is created automatically. No interface changes required.

---

## 4. Execution Order

Run these steps in order (each step unblocks the next):

| # | Step | Action after completing |
|---|---|---|
| 1 | Add `content_hash` + flag columns to DB schemas | `pnpm --filter @workspace/db run push` |
| 2 | Run codegen | `pnpm --filter @workspace/api-spec run codegen` |
| 3 | Fix auto-approval in Python engine | Test with `python python_engine/main.py diagnostics` |
| 4 | Add flag routes (API + OpenAPI) | Restart API workflow, test endpoints |
| 5 | Add Flagged Items tab in admin panel | Visual verify in app |
| 6 | Add "Flag this" button on civic item cards | Visual verify in app |
| 7 | Enhance scraper run logging | `pnpm --filter @workspace/db run push` again |
| 8 | Expand state name dict + Tennessee sources | Test with `seed-sources --state TN` |
| 9 | Full typecheck | `pnpm run typecheck` must be clean |

---

## 5. Data Safety Rules (Preserved Exactly)

These rules are already implemented and must NOT be relaxed:
- No `source_url` → do not save (guardrail rule 1 in `legal_guardrails.py`)
- Source must exist in `source_registry` — already enforced because the pipeline only loads from `source_registry`
- If source is not verified (`verification_status != 'verified'`) → save as `needs_review`
- If parser returns no title → save as `needs_review` (guardrail rule 2)
- If AI summary contains flagged terms or vote advocacy → save as `needs_review` (guardrails rules 3–4)
- Never fabricate civic records — no mock/seed civic data, only real scraped sources

---

## 6. What Each Prompt Should Do

### 1st Prompt (this file) — Research & Plan ✅ DONE

### 2nd Prompt — Implement

When you begin implementation, read this file and follow the steps in Section 4 in order.
Do not start Step 4 (flag routes) until Step 1–2 (schema + codegen) are done.
Do not start Step 5 (admin flag tab) until Step 4 is done.
Do not skip Step 9 (typecheck) — it must be clean before delivery.

---

## 7. Gotchas / Things That Could Block You

1. **`zod/v4` subpath in API routes** — esbuild can't bundle it. Use `@workspace/api-zod` generated schemas or manual validation in all Express routes. This is existing project convention.
2. **Generated hooks don't send `x-admin-key`** — all admin endpoints must be called via `fetchAdminJSON(path)` in the frontend, not the generated `useXxx` hook. See `.agents/memory/admin-endpoint-auth.md`.
3. **OpenAPI schema name collisions with Orval** — use `XInput`/`XPatch` suffix pattern, not `CreateXBody`/`UpdateXBody`.
4. **`pnpm --filter @workspace/db run push` must run after any schema file changes** — otherwise the DB table won't have the new columns.
5. **`pnpm --filter @workspace/api-spec run codegen` temporarily deletes generated files** — the Vite HMR "Failed to reload" errors that appear during codegen are transient and resolve once codegen finishes. They are not real errors.
6. **`content_hash` unique constraint** — if the pipeline has already run and created items without hashes, add `content_hash` as nullable first, backfill hashes for existing rows, then add the unique index. The safest migration: add column nullable, backfill via SQL, then add unique constraint.
7. **IP hashing for flags** — Express 5 uses `req.ip` but behind a proxy you need `req.socket.remoteAddress`. Use `(req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown'` as the raw IP, then SHA-256 hash it before storing. Never store raw IPs.
