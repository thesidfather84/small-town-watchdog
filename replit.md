# Small Town Watchdog

A mobile-first local government transparency app that tracks public records (budgets, agendas, minutes, audits, contracts) for Louisiana local government entities and translates them into plain English summaries using AI. Includes a neutral election information and ballot explainer feature.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS v4 + shadcn/ui
- Routing: Wouter (client-side)
- Data fetching: React Query (via Orval-generated hooks)
- Charts: Recharts
- AI summaries: OpenAI via Replit AI Integrations proxy

## Where things live

- DB schema: `lib/db/src/schema/index.ts` (entities, sources, documents, elections)
- API contract: `lib/api-spec/openapi.yaml`
- Generated hooks/schemas: `lib/api-client-react/src/generated/api.ts` and `lib/api-zod/src/generated/`
- API routes: `artifacts/api-server/src/routes/`
- AI summary generation: `artifacts/api-server/src/lib/ai.ts`
- AI ballot explainer: `artifacts/api-server/src/routes/ballot-items.ts`
- Frontend pages: `artifacts/small-town-watchdog/src/pages/`
- Shared components: `artifacts/small-town-watchdog/src/components/`
- Theme: `artifacts/small-town-watchdog/src/index.css` (charcoal + navy + deep red patriotic)
- Notification helpers: `artifacts/small-town-watchdog/src/lib/notifications.ts`

## Architecture decisions

- OpenAPI-first: all API contracts defined in `openapi.yaml`, Orval generates React Query hooks AND TypeScript interfaces — never edit generated files
- Alerts are not a separate table — they are documents that have an `alertCategory` set (non-null = alert)
- `redFlagLevel` (green/yellow/red) is set either manually or by AI summarization
- AI summaries use dynamic `import("openai")` to gracefully fall back if env vars are missing
- Wouter `<Link>` renders as `<a>` directly — never nest `<a>` inside `<Link>` tags
- API routes do NOT use `zod/v4` directly — esbuild cannot bundle `zod/v4` subpath. Use `@workspace/api-zod` (generated schemas) or manual validation instead.
- Election OpenAPI schemas use `Input`/`Patch` suffix (e.g. `ElectionInput`, `BallotItemPatch`) to avoid collision with Orval auto-generated `CreateXBody`/`UpdateXBody` names.

## Product

- **Dashboard**: stats overview (entities, docs, red flags, warnings) + recent alerts feed
- **Alerts Feed**: filterable by flag level and category; shows all documents with `alertCategory` set
- **Elections**: neutral election tracker — upcoming/past filter, push notification opt-in, vibration support, official Louisiana resource links, ballot explainer with YES/NO/who pays/amount/duration/receiving body breakdown
- **Election Detail**: per-election ballot items with expandable explainer cards, AI explain button, neutral disclaimer
- **Entities**: lists all tracked government bodies with doc counts; drills into per-entity documents
- **Document Detail**: full plain English summary, "Explain Like I'm 12" toggle, AI badge, red flag indicator, source link; one-click AI summarize button if no summary yet
- **Compare Years**: side-by-side year comparison for any entity, with plain English change descriptions
- **Reports**: pie chart (docs by type) and bar chart (docs by year) visualizations
- **Admin Panel**: full CRUD for entities, documents, and sources via tab interface
- **Settings**: about page, source policy, red flag key, legal disclaimer + links to T&C / Privacy / AI Disclosure
- **Terms & Conditions**: full legal terms including election info disclaimer, AI disclosure, limitation of liability
- **Privacy Policy**: data collection, cookies, push notifications, third-party AI services
- **AI Disclosure Policy**: what AI does/doesn't do, neutrality on elections, red flag disclaimers

## Tracked Entities (seeded)

- St. Tammany Parish Government
- City of Slidell
- St. Tammany Parish School Board
- St. Tammany Parish Sheriff's Office
- Louisiana Legislative Auditor

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec changes
- Run `pnpm --filter @workspace/db run push` after any schema changes
- `alerts` endpoint returns documents where `alert_category IS NOT NULL`
- Wouter `<Link>` renders as `<a>` — don't wrap with another `<a>` tag
- `zod/v4` cannot be imported directly in API routes (esbuild bundler can't resolve subpath) — use manual validation or `@workspace/api-zod`
- OpenAPI schema names `CreateXBody`/`UpdateXBody` collide with Orval auto-generated names — use `XInput`/`XPatch` instead

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
