# CoachFlow — GitHub Issues for Jules

Create these as GitHub issues on the repo after the initial push. They are ordered by
dependency group. Issues within the same group can be assigned in parallel.

---

## How to create all issues at once after pushing

```bash
# From repo root after `git push`:
gh issue create --title "<title>" --label "<label>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Or use the GitHub UI and paste each issue body below.

Labels to create first:

- `infrastructure` (blue)
- `api` (green)
- `admin-ui` (purple)
- `good first issue` (yellow — mark issues 1, 4, 9)

---

## Group A — Infrastructure (no dependencies, can be done in parallel)

---

### Issue 1 · Wire RedisSessionStore automatically when Upstash env vars are present

**Labels:** `infrastructure`

**Background**

`RedisSessionStore` is fully implemented and passes the contract suite. However
`apps/api/src/index.ts` always instantiates `InMemorySessionStore`. The store should
switch to Redis automatically when `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` are both set, with no code change needed from the operator.

**Tasks**

- In `apps/api/src/index.ts`, replace the hardcoded `new InMemorySessionStore()` with:
  ```ts
  const store =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? new RedisSessionStore()
      : new InMemorySessionStore();
  configureSessionStore(store);
  ```
- Add a startup log line that prints which store is active.
- Update the comment in `index.ts` to remove the `(see T8.1)` note — it is done.
- Add a note to `AGENTS.md` under **Environment Variables** clarifying the Redis
  activation behaviour.

**Files to touch**

- `apps/api/src/index.ts`
- `AGENTS.md`

**Do NOT touch**

- `apps/api/src/engine/redisSessionStore.ts`
- `apps/api/src/engine/inMemorySessionStore.ts`
- `apps/api/src/engine/sessionStore.ts`
- Any test files

**Acceptance criteria**

- `pnpm -r typecheck` passes.
- `pnpm -r test` passes (all 55+ tests).
- When `UPSTASH_REDIS_REST_URL` is absent, startup log reads: `[session] using InMemorySessionStore`.
- When `UPSTASH_REDIS_REST_URL` is present, startup log reads: `[session] using RedisSessionStore`.

---

### Issue 2 · Add docker-compose.yml for local Postgres + Redis

**Labels:** `infrastructure`, `good first issue`

**Background**

Contributors currently need a live Supabase project and Upstash account to run
integration tests that touch the DB. A `docker-compose.yml` spinning up Postgres
and Redis locally removes that barrier.

**Tasks**

- Add `docker-compose.yml` at the repo root:
  - Service `db`: `postgres:16`, port `5432`, env `POSTGRES_PASSWORD=postgres
POSTGRES_DB=coachflow`, volume `pgdata`.
  - Service `redis`: `redis:7-alpine`, port `6379`.
- Add a `docker-compose.env.example` (or instructions in README) showing the
  equivalent local env vars:
  ```
  SUPABASE_URL=http://localhost:5432   # replace with local postgres URL format
  UPSTASH_REDIS_REST_URL=http://localhost:6379
  ```
- Update the **Local Setup** section in `README.md` to mention:
  > `docker compose up -d` starts Postgres and Redis. Run `supabase/migrations/*.sql`
  > in order against the local Postgres to initialise the schema.
- Add `.dockerignore` at repo root (exclude `node_modules`, `dist`, `.next`, `.env`).

**Files to touch**

- `docker-compose.yml` (new)
- `.dockerignore` (new)
- `README.md`

**Acceptance criteria**

- `docker compose up -d` starts both services without errors.
- `docker compose down -v` tears down cleanly.
- `pnpm -r typecheck` and `pnpm -r test` still pass.

---

### Issue 3 · One-click deploy documentation

**Labels:** `infrastructure`

**Background**

Production deployment requires four services: the API (Node), the admin UI (Next.js),
Supabase (DB + Auth), and Upstash (Redis). Deployment guides for each need to be
written so adopters can self-host.

**Tasks**

Create `docs/deployment.md` covering:

1. **Supabase** — create project, run migrations in order, enable Auth, set JWT secret,
   configure `app_metadata.role` and `app_metadata.tenant_id` claims on user creation
   (via a Supabase Auth hook or manual SQL).
2. **Upstash** — create Redis database, copy REST URL + token.
3. **API on Railway (or Fly.io)** — connect GitHub repo, set root to `apps/api`,
   build command `pnpm install && pnpm build`, start command `node dist/index.js`,
   list all env vars from `.env.example` with where to find each.
4. **Admin UI on Vercel** — connect GitHub repo, set root to `apps/admin`,
   framework Next.js, list required env vars (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `API_URL`).
5. **Wiring it together** — set `API_URL` in the admin to point at the Railway URL;
   set CORS origin in `apps/api/src/index.ts` to the Vercel domain.

Also: add a note at the top of `README.md` linking to `docs/deployment.md`.

**Files to touch**

- `docs/deployment.md` (new)
- `README.md`

**Acceptance criteria**

- Document covers all four services in order.
- Each service section lists every required env var with a "where to find it" note.
- `pnpm -r typecheck` passes (no code changes expected).

---

## Group B — API extensions (can be done in parallel, require `requireAuth` which already exists)

---

### Issue 4 · Journey CRUD API

**Labels:** `api`

**Background**

The admin UI (Phase 2) needs full CRUD for journeys and their steps. Currently only
`GET /api/journeys` (list) exists. This issue adds the remaining routes so the admin
can create, edit, and delete journeys without touching the DB directly.

**Tasks**

Add to `apps/api/src/index.ts` under the `/api` (authed) block:

| Method   | Path                              | Action                                                          |
| -------- | --------------------------------- | --------------------------------------------------------------- |
| `POST`   | `/api/journeys`                   | Create a journey row + initial steps                            |
| `GET`    | `/api/journeys/:id`               | Get a single journey with all its steps                         |
| `PATCH`  | `/api/journeys/:id`               | Update journey metadata (title, description, estimated_minutes) |
| `DELETE` | `/api/journeys/:id`               | Soft-delete (set `deleted_at`; requires migration — see below)  |
| `POST`   | `/api/journeys/:id/steps`         | Add a step to a journey                                         |
| `PATCH`  | `/api/journeys/:id/steps/:stepId` | Update a step                                                   |
| `DELETE` | `/api/journeys/:id/steps/:stepId` | Delete a step                                                   |
| `PUT`    | `/api/journeys/:id/steps/reorder` | Accept `{ order: stepId[] }`, update `step_index` for each      |

DB layer:

- Add `createJourney`, `updateJourney`, `deleteJourney` to `apps/api/src/db/journeyLoader.ts`.
- Add `createStep`, `updateStep`, `deleteStep`, `reorderSteps` to a new
  `apps/api/src/db/journeySteps.ts`.
- Add `supabase/migrations/009_journey_soft_delete.sql` adding `deleted_at timestamptz` to
  `journeys` and `journey_steps`.

Input validation:

- Use Zod schemas from `@coachflow/shared` for request bodies. Add any missing schemas to
  `packages/shared/src/schemas/index.ts`.

Auth:

- All routes require `requireAuth` (already mounted on `/api`).
- `POST /api/journeys` and `DELETE` routes also require `requireRole('admin')`.

**Files to touch**

- `apps/api/src/index.ts`
- `apps/api/src/db/journeyLoader.ts`
- `apps/api/src/db/journeySteps.ts` (new)
- `packages/shared/src/schemas/index.ts`
- `supabase/migrations/009_journey_soft_delete.sql` (new)

**Do NOT touch**

- `apps/api/src/engine/flowRouter.ts`
- `packages/shared/src/types/index.ts`
- Any existing test files

**Acceptance criteria**

- `pnpm -r typecheck` passes.
- `pnpm -r test` passes.
- Each route returns appropriate HTTP status codes: `200` list/get, `201` create,
  `204` delete, `400` on Zod validation failure, `401` unauthenticated, `403` wrong role,
  `404` not found.
- Reorder endpoint correctly updates `step_index` values without gaps.

---

### Issue 5 · Tenant management API (super-admin)

**Labels:** `api`

**Background**

Super-admins need to create tenants, view their WhatsApp configuration, and update
settings (tenant name, phone number ID). Access tokens live in Supabase Vault — this
API writes them there via the existing `get_tenant_whatsapp_token` RPC pattern, extended
with a set counterpart.

**Tasks**

Add routes (all require `requireRole('super_admin')`):

| Method  | Path                              | Action                                                   |
| ------- | --------------------------------- | -------------------------------------------------------- |
| `GET`   | `/api/tenants`                    | List all tenants (id, name, phone_number_id, created_at) |
| `POST`  | `/api/tenants`                    | Create a tenant row                                      |
| `GET`   | `/api/tenants/:id`                | Get a single tenant                                      |
| `PATCH` | `/api/tenants/:id`                | Update name or phone_number_id                           |
| `PUT`   | `/api/tenants/:id/whatsapp-token` | Store access token in Supabase Vault                     |

DB layer:

- Add `listTenants`, `createTenant`, `updateTenant` to `apps/api/src/db/tenants.ts`.
- Add `setTenantWhatsAppToken` which calls a new Postgres RPC
  `set_tenant_whatsapp_token(p_tenant_id uuid, p_token text)` (add this function to
  `supabase/migrations/010_vault_set_token.sql`).

The Vault write RPC should use `vault.create_secret` / `vault.update_secret` (Supabase
Vault API) — look at the existing `get_tenant_whatsapp_token` RPC in
`supabase/migrations/004_tenant_whatsapp.sql` for the pattern.

**Files to touch**

- `apps/api/src/index.ts`
- `apps/api/src/db/tenants.ts`
- `packages/shared/src/schemas/index.ts`
- `supabase/migrations/010_vault_set_token.sql` (new)

**Acceptance criteria**

- `pnpm -r typecheck` passes.
- A non-super-admin token hits `GET /api/tenants` and receives `403`.
- `PUT /api/tenants/:id/whatsapp-token` returns `204` on success.

---

### Issue 6 · Prompt overrides API

**Labels:** `api`

**Background**

Per-tenant prompt overrides live in `tenant_prompts` (loaded by
`getTenantPromptOverrides`). Admins need to read and write them via the API so
the admin UI can surface a prompt editor per tenant.

Valid `prompt_key` values: `system`, `coaching`, `roleplay`, `reflection`, `scoring`.

**Tasks**

Add routes (require `requireAuth` + `requireRole('admin', 'super_admin')`):

| Method   | Path                            | Action                                                |
| -------- | ------------------------------- | ----------------------------------------------------- |
| `GET`    | `/api/tenants/:id/prompts`      | Return all prompt overrides as `{ key: content }` map |
| `PUT`    | `/api/tenants/:id/prompts/:key` | Upsert a single prompt override                       |
| `DELETE` | `/api/tenants/:id/prompts/:key` | Delete an override (falls back to system default)     |

DB layer: add `upsertTenantPrompt`, `deleteTenantPrompt` to `apps/api/src/db/tenants.ts`.

Validation: `prompt_key` must be one of the five valid values (Zod enum). `content` must
be a non-empty string.

**Files to touch**

- `apps/api/src/index.ts`
- `apps/api/src/db/tenants.ts`
- `packages/shared/src/schemas/index.ts`

**Acceptance criteria**

- `pnpm -r typecheck` passes.
- `PUT` with an invalid `prompt_key` returns `400`.
- `GET` for a tenant with no overrides returns `{}` (empty object), not `404`.

---

### Issue 7 · User management API

**Labels:** `api`

**Background**

The admin UI needs to search for users by WhatsApp number fragment and view their
progress. The existing `GET /api/users/:number` does an exact match — this issue adds
a search endpoint and a progress rollup.

**Tasks**

Add routes (require `requireAuth` + `requireRole('admin', 'super_admin', 'coach')`):

| Method | Path                          | Action                                                                                                         |
| ------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/users`                  | Search users. Query params: `q` (partial number match), `tenantId`, `limit` (default 20), `offset` (default 0) |
| `GET`  | `/api/users/:number/progress` | Return: user record + active journey + all `user_journeys` rows + latest score per journey                     |

DB layer:

- Add `searchUsers(tenantId, query, limit, offset)` to `apps/api/src/db/users.ts`.
- Add `getUserProgress(userId)` that joins `user_journeys` and the latest score per journey.

**Files to touch**

- `apps/api/src/index.ts`
- `apps/api/src/db/users.ts`

**Acceptance criteria**

- `GET /api/users?q=1234&tenantId=<id>` returns an array (empty if no match).
- `GET /api/users/:number/progress` returns `404` if user not found.
- `pnpm -r typecheck` passes.

---

### Issue 8 · Analytics API

**Labels:** `api`

**Background**

The analytics dashboard needs aggregate data per journey: how many users started,
how many completed, mean score per dimension, and where users drop off.

**Tasks**

Add routes (require `requireAuth` + `requireRole('admin', 'super_admin')`):

| Method | Path                                 | Description                                                                 |
| ------ | ------------------------------------ | --------------------------------------------------------------------------- |
| `GET`  | `/api/analytics/journeys`            | Per-journey: `{ journeyId, title, started, completed, completionRate }`     |
| `GET`  | `/api/analytics/journeys/:id/funnel` | Per-step drop-off: `{ stepIndex, title, reached, completed }`               |
| `GET`  | `/api/analytics/journeys/:id/scores` | Score distribution per dimension: `{ dimension, mean, min, max, p25, p75 }` |

All routes accept a `tenantId` query param (required). Response data should only include
rows for that tenant (RLS enforces this, but validate in code too).

Implement as raw Supabase queries in `apps/api/src/db/analytics.ts` (new file).
Use `group by` / `count` / `avg` queries via `supabase.rpc` or the `.select()` builder
with aggregates.

**Files to touch**

- `apps/api/src/index.ts`
- `apps/api/src/db/analytics.ts` (new)

**Acceptance criteria**

- `completionRate` is a float between 0 and 1.
- All three endpoints return `400` if `tenantId` is missing.
- `pnpm -r typecheck` passes.

---

## Group C — Admin UI (all depend on Issue 9 being merged first; 10–16 can be parallelised after)

---

### Issue 9 · Admin auth shell — login page + protected layout

**Labels:** `admin-ui`, `good first issue`

**Background**

`apps/admin` is currently a bare Next.js 14 scaffold. This issue wires Supabase Auth
(email/password) and creates the protected layout shell that all admin pages live inside.
It is a prerequisite for every other admin UI issue.

**Tasks**

- Install `@supabase/ssr` and `@supabase/supabase-js` in `apps/admin`.
- Add env vars to `apps/admin/.env.local.example`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  NEXT_PUBLIC_API_URL=           # URL of apps/api (e.g. http://localhost:3000)
  ```
- Create `apps/admin/lib/supabase/` with `client.ts` (browser client) and `server.ts`
  (server-side client using `@supabase/ssr`).
- `app/login/page.tsx` — email + password form. On success, redirects to `/`.
  Show error message on bad credentials.
- `app/layout.tsx` — server component: check session via `supabase/server.ts`.
  Redirect to `/login` if not authenticated.
- Protected layout: sidebar with nav links:
  - Journeys
  - Users
  - Analytics
  - Settings (Prompts + Tenant config; visible to `admin` and `super_admin` only)
  - Super Admin / Tenants (visible to `super_admin` only)
- Header: user email + sign out button.
- `app/page.tsx` — simple dashboard home with card placeholders for the four metric
  tiles (populated in Issue 16).

Use `shadcn/ui` components throughout: `Button`, `Input`, `Label`, `Card`, `Sidebar`
(or build a minimal sidebar with `cn` utility).

**Files to touch**

- `apps/admin/` (all new — do not modify `apps/api/`)
- Add `@supabase/ssr`, `@supabase/supabase-js`, `shadcn/ui` deps to `apps/admin/package.json`

**Do NOT touch**

- `apps/api/`
- `packages/shared/`

**Acceptance criteria**

- `pnpm --filter admin build` succeeds with no TypeScript errors.
- Unauthenticated user visiting `/` is redirected to `/login`.
- Authenticated user sees the sidebar and their email in the header.
- Sign out button clears the session and redirects to `/login`.

---

### Issue 10 · Journey list + create page

**Labels:** `admin-ui`
**Depends on:** Issue 9 (auth shell), Issue 4 (journey CRUD API)

**Background**

Operators need to see all journeys for their tenant and create new ones.

**Tasks**

- `app/journeys/page.tsx` — server component. Fetches `GET /api/journeys?tenantId=<jwt-tenant>`
  with the user's JWT. Renders a table: Journey title | Steps | Est. duration | Status | Actions.
- Empty state: "No journeys yet. Create your first journey →".
- "New Journey" button opens a `Dialog` (shadcn/ui) with a form:
  - Title (required)
  - Description
  - Estimated minutes (number)
  - On submit: `POST /api/journeys`, redirect to `/journeys/:id/edit`.
- Each row has an "Edit" link → `/journeys/:id/edit` and a "Delete" button (with
  confirmation dialog).
- "Delete" calls `DELETE /api/journeys/:id`. On success, removes the row from the list
  without a full page reload (use React state or `router.refresh()`).

**Files to touch**

- `apps/admin/app/journeys/` (new)

**Acceptance criteria**

- `pnpm --filter admin build` passes.
- Empty state renders when no journeys exist.
- Creating a journey redirects to the edit page.
- Deleting a journey removes it from the list.

---

### Issue 11 · Journey editor — steps CRUD + reorder

**Labels:** `admin-ui`
**Depends on:** Issue 9, Issue 4

**Background**

The journey editor is the core authoring surface. An operator opens a journey and can
edit its metadata, add/edit/remove steps, and reorder them via drag-and-drop.

**Tasks**

- `app/journeys/[id]/edit/page.tsx` — server component that fetches the journey and its
  steps from `GET /api/journeys/:id`.
- Journey metadata form (title, description, estimated_minutes) — auto-saves on blur
  via `PATCH /api/journeys/:id`.
- Steps list with `@dnd-kit/core` and `@dnd-kit/sortable` for drag-reorder. On drop,
  call `PUT /api/journeys/:id/steps/reorder` with the new order.
- Each step row shows: step number, title, mode badge (colour-coded), "Edit" button.
- "Edit" opens a right-panel sheet (`Sheet` from shadcn/ui) with:
  - Title
  - Mode selector (`coaching` | `roleplay` | `reflection` | `assessment`)
  - Opening message (textarea)
  - Step guidance (textarea — shown to AI, not to user)
  - Min turns (number)
  - Scoring criteria (tag input — only shown when mode = `assessment`)
- "Add step" button appends a new step with defaults, opens the sheet.
- "Delete step" button with confirmation.

Use `react-hook-form` + `zod` (schema from `@coachflow/shared`) for all forms.

**Files to touch**

- `apps/admin/app/journeys/[id]/edit/` (new)
- Add `@dnd-kit/core`, `@dnd-kit/sortable`, `react-hook-form`, `zod` to
  `apps/admin/package.json` if not already present.

**Acceptance criteria**

- `pnpm --filter admin build` passes.
- Dragging and dropping a step calls the reorder API and persists the new order on
  page refresh.
- All form fields validate with Zod before submission.
- Mode `assessment` shows the scoring criteria tag input; other modes hide it.

---

### Issue 12 · Prompt overrides editor

**Labels:** `admin-ui`
**Depends on:** Issue 9, Issue 6

**Background**

Admins need to customise the AI's tone and behaviour per tenant without a code change.
This editor shows the current override (if any) and the system default as a fallback
preview.

**Tasks**

- `app/settings/prompts/page.tsx` — fetches `GET /api/tenants/:id/prompts`.
- Renders five tabs: System | Coaching | Roleplay | Reflection | Scoring.
- Each tab: a `Textarea` pre-filled with the current override (or placeholder showing
  the default value from a `DEFAULTS` constant matching the strings in
  `apps/api/src/ai/prompts/*.ts`).
- "Save" button calls `PUT /api/tenants/:id/prompts/:key`.
- "Reset to default" button calls `DELETE /api/tenants/:id/prompts/:key` and clears
  the textarea back to the placeholder.
- Show a `Badge` on each tab: "Custom" (yellow) if an override exists, "Default" (grey)
  if not.

**Files to touch**

- `apps/admin/app/settings/prompts/` (new)

**Acceptance criteria**

- `pnpm --filter admin build` passes.
- "Reset to default" results in the `DELETE` call and the tab badge switching to "Default".
- Unsaved changes trigger a browser `beforeunload` warning.

---

### Issue 13 · User browser

**Labels:** `admin-ui`
**Depends on:** Issue 9, Issue 7

**Background**

Coaches need to look up a user by (partial) WhatsApp number, see their current journey
status, and drill into individual session transcripts.

**Tasks**

- `app/users/page.tsx` — search input. On submit, fetches
  `GET /api/users?q=<term>&tenantId=<id>`. Renders results in a table:
  Last 4 digits of number | Display name | Current journey | Step | Last active.
- Each row links to `/users/:number`.
- `app/users/[number]/page.tsx` — fetches `GET /api/users/:number/progress`.
  Renders:
  - User card: number (masked), display name, onboarded date.
  - Journey progress cards: one per `user_journey` row — journey title, status badge,
    current step progress bar, latest score.
  - Session list: each session row shows journey, step, mode, date, message count.
    Clicking a row opens a `Dialog` with the full transcript (fetches
    `GET /api/sessions/:id`).

**Files to touch**

- `apps/admin/app/users/` (new)

**Acceptance criteria**

- `pnpm --filter admin build` passes.
- Searching with an empty query returns the 20 most recent users.
- The transcript dialog renders assistant messages right-aligned and user messages
  left-aligned.
- WhatsApp numbers are masked (show last 4 digits only) everywhere in the UI.

---

### Issue 14 · Score viewer

**Labels:** `admin-ui`
**Depends on:** Issue 9

**Background**

Coaches want to review individual scores in detail — the dimension breakdown,
AI-generated feedback, and summary — not just the overall number.

**Tasks**

- On the user profile page (`app/users/[number]/page.tsx`, from Issue 13): expand each
  journey progress card to include a "View scores" button that fetches
  `GET /api/users/:number/scores` and shows a modal.
- The modal renders each score record as a card with:
  - Date
  - Overall score (large, bold)
  - A horizontal bar chart or progress bar per dimension (using `shadcn/ui` `Progress`
    component)
  - Summary text
  - Development focus text
- If no scores exist, show an empty state.

**Files to touch**

- `apps/admin/app/users/[number]/` (modifies the page from Issue 13)

**Note for Jules:** this issue should be picked up after Issue 13 is merged. If Issue 13 is not merged yet, build the score modal as a standalone route at `/users/[number]/scores` that can be merged independently.

**Acceptance criteria**

- `pnpm --filter admin build` passes.
- Each dimension renders a labelled progress bar with the score and feedback text.
- Empty state message shown when `scores` array is empty.

---

### Issue 15 · Tenant management page (super-admin)

**Labels:** `admin-ui`
**Depends on:** Issue 9, Issue 5

**Background**

Super-admins (the platform operator) need to provision new tenants and configure their
WhatsApp numbers. This is separate from the journey/user management pages which are
scoped to a single tenant.

**Tasks**

- `app/super-admin/tenants/page.tsx` — visible only when user role = `super_admin`
  (check in the layout; redirect to `/` otherwise).
- Table: tenant name | phone_number_id | created date | Actions.
- "New Tenant" button → modal with: Name (required), Phone Number ID (optional).
  On submit: `POST /api/tenants`.
- Each row: "Edit" → modal to update name or phone_number_id via `PATCH /api/tenants/:id`.
- "Set WhatsApp Token" → a separate modal with a password input.
  On submit: `PUT /api/tenants/:id/whatsapp-token`. The token is sent once and never
  displayed again (show a "Token set ✓" indicator if one exists, no reveal button).

**Files to touch**

- `apps/admin/app/super-admin/tenants/` (new)

**Acceptance criteria**

- `pnpm --filter admin build` passes.
- Non-super-admin user is redirected away from the page.
- WhatsApp token input is type `password`. Value is never echoed back from the API.

---

### Issue 16 · Analytics dashboard

**Labels:** `admin-ui`
**Depends on:** Issue 9, Issue 8

**Background**

The home page (`app/page.tsx`) currently has placeholder cards. This issue replaces
them with real data and adds a dedicated analytics page.

**Tasks**

- `app/page.tsx` — replace placeholder cards with four real metric tiles (client-side
  fetch from `/api/analytics/journeys`):
  - Total users
  - Active sessions (from `/health`)
  - Journeys (count)
  - Avg completion rate across all journeys
- `app/analytics/page.tsx` — analytics detail:
  - Journey selector (dropdown).
  - On selection, fetch and render:
    - **Funnel chart** (step-by-step drop-off) — use a simple horizontal bar chart
      built with Tailwind + absolute widths (no chart library required).
    - **Score distribution table** — per dimension: mean ± std dev, p25/p75.
  - Date range filter (last 7d / 30d / 90d / all time) — pass as `since` query param
    to the analytics API.

**Files to touch**

- `apps/admin/app/page.tsx`
- `apps/admin/app/analytics/` (new)

**Acceptance criteria**

- `pnpm --filter admin build` passes.
- All data fetches show a loading skeleton while pending.
- Empty state renders gracefully when no data exists (new tenant with no users).
- Switching journeys in the dropdown updates both the funnel and score distribution.

---

## Recommended issue creation order for Jules

```
Week 1 (foundation):
  Issue 1 — Redis wiring (30 min)
  Issue 2 — docker-compose (1 hr)
  Issue 9 — Admin auth shell (3 hr) ← unblocks all admin UI

Week 2 (API layer):
  Issue 4 — Journey CRUD API
  Issue 5 — Tenant management API
  Issue 6 — Prompt overrides API
  Issue 7 — User management API
  Issue 8 — Analytics API
  (all can run in parallel after Issue 9)

Week 3 (Admin UI — parallel after Issues 4–8 merged):
  Issue 10 — Journey list
  Issue 11 — Journey editor
  Issue 12 — Prompt overrides editor
  Issue 13 — User browser
  Issue 15 — Tenant management (super-admin)

Week 4:
  Issue 14 — Score viewer (after Issue 13)
  Issue 16 — Analytics dashboard (after Issue 8)
  Issue 3  — Deployment docs (any time)
```
