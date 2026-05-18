# Planning Session Kickoff — OSS Evolution of AI Coaching Platform

> Paste this entire document as the first message in a new Claude Code session, running with `cwd = /Users/omarshariff/code/ai-coach`. Tell Claude to **enter plan mode** before doing anything else.

---

## 1. Your role in this session

You are planning the evolution of an existing working prototype into a reusable, open-source AI coaching platform. The output of this session is **a plan**, not code. At the end you will have:

1. A written plan in `/Users/omarshariff/.claude/plans/<your-plan>.md` (or equivalent).
2. A prioritised list of GitHub issues to file, scoped so each is a 1-to-3-hour atomic unit suitable for an **async coding agent (Google Jules)** to pick up.
3. A clear definition of "done for the base" — i.e. the state the repo must be in **before** the first push to GitHub and the first Jules handoff.

Do not write feature code in this session. Editing the plan file and READ-ONLY exploration only.

---

## 2. Where things stand today

### What exists in `/Users/omarshariff/code/ai-coach`

A working WhatsApp ↔ Gemini ↔ Supabase coaching prototype, single-tenant, single-journey, no UI. The codebase has:

- **`src/whatsapp/`** — Meta Cloud API adapter (raw HTTP via axios, no SDK). Webhook GET verification with HMAC challenge, POST receiver that acks 200 first then processes async, parser that normalises inbound payloads, sender for text/button/list/mark-as-read with 4096-char splitting.
- **`src/ai/`** — Gemini client (`gemini-2.5-flash`) with strict JSON-mode output. System prompt + four mode-specific guidance files (coaching / roleplay / reflection / scoring).
- **`src/engine/`** — provider-agnostic flow router, in-memory session manager (30-min idle TTL, 5-min sweeper), context builder (rolling 20-turn history), output parser (markdown-fence stripping + safe fallback).
- **`src/db/`** — Supabase client + CRUD for users, sessions, journeys, scores. Dedup via atomic insert into `processed_messages` (Postgres 23505 unique-violation = skip).
- **`src/journeys/`** — one hardcoded journey (`maritime-leadership-001`) with 4 steps: intro coaching → Marcos roleplay → reflection → assessment across Self-Awareness/Communication/Resilience.
- **`src/index.ts`** — Express bootstrap, webhook routes, internal API (`/health`, `/api/journeys`, `/api/users/:number`, `/api/users/:number/scores`, `/api/sessions/:id`).
- **`supabase/schema.sql`** — 7 tables: `users`, `user_journeys`, `sessions`, `messages`, `scores`, `progression`, `processed_messages`.
- **`docs/whatsapp-setup.md`** and **`docs/production-migration.md`** — onboarding and the adapter-swap playbook (Meta→Infobip, Gemini→Claude, Map→Upstash Redis).

### What works (manually tested by the owner)

- Webhook verification with Meta.
- Inbound text/button/list parsing.
- Outbound text/button/list/mark-as-read.
- Dedup against replayed Meta webhooks.
- Step 1 coaching conversation reaching `shouldAdvance: true` via Gemini structured output.
- End-to-end TypeScript typecheck (`npm run typecheck` is clean).

### Known gaps (from prior review — do not re-discover, build on these)

| #   | Gap                                     | Why it blocks reuse                                              |
| --- | --------------------------------------- | ---------------------------------------------------------------- |
| 1   | Journeys are TypeScript code            | Every new client journey = code change + redeploy                |
| 2   | No multi-tenancy                        | One deployment serves one client; no `org_id` anywhere           |
| 3   | WhatsApp credentials are env vars       | Can't host multiple tenants' WhatsApp numbers on one deployment  |
| 4   | Prompts are hardcoded                   | Per-client tone/voice needs PRs to change                        |
| 5   | No webhook signature verification       | Anyone who guesses the URL can POST fake webhooks                |
| 6   | `/api/*` endpoints open                 | No auth before any UI can ship                                   |
| 7   | In-memory session Map                   | Breaks horizontal scaling (Upstash swap documented but not done) |
| 8   | Zero tests                              | OSS consumers need a safety net                                  |
| 9   | No LICENSE / CONTRIBUTING / CI / Docker | Standard OSS housekeeping missing                                |
| 10  | No journey versioning                   | Edits to journeys mid-flight break user sessions                 |
| 11  | No analytics surface                    | Operators need completion funnels, score distributions, drop-off |
| 12  | No admin UI                             | Owner wants a web UI for journey authoring                       |
| 13  | Voice notes stubbed                     | Real coaching likely needs voice transcription                   |

---

## 3. The destination

An **open-source, multi-tenant coaching platform** that other organisations can self-host. Positioning: _"Open-source AI coaching delivered over WhatsApp. Author journeys in a web UI, deliver coaching at scale."_

The competitive moat is the **journey-authoring UI** plus the **adapter pattern** — swap WhatsApp/SMS/Telegram, swap Claude/Gemini/OpenAI. The coaching logic itself lives in journey content (data, not code), which is what consumers customise.

---

## 4. Hard constraints to bake into the plan

**Architecture**

- Monorepo with two apps (`apps/api`, `apps/admin`) and a shared package (`packages/shared` containing types + zod schemas). pnpm workspaces.
- API: keep Node 20 + TypeScript + Express. Don't switch to NestJS or Fastify in Phase 1.
- Admin UI: Next.js 14 (App Router) + Supabase Auth + Tailwind + shadcn/ui + react-hook-form + zod. No state library beyond React Query.
- DB: Supabase Postgres. Multi-tenancy enforced via Row-Level Security keyed off JWT `tenant_id` claim.
- Sessions: Upstash Redis (do the swap during Phase 1).
- License: **MIT**.
- CI: GitHub Actions running `typecheck`, `lint`, `test` on every PR. Required-status checks on `main`.

**Adapter discipline**

- WhatsApp adapter contract lives in `packages/shared`. The Infobip adapter must be implementable without touching `engine/` or `ai/`.
- AI adapter contract lives in `packages/shared`. The Claude adapter must be implementable without touching `engine/`.
- Session-store adapter contract too — the in-memory and Upstash implementations conform to the same interface.

**Operational**

- One-click deploy paths documented: Vercel (admin) + Fly.io or Railway (api) + Supabase (db) + Upstash (redis).
- Dockerfile and `docker-compose.yml` for local dev (the compose spins up Postgres + Redis so contributors don't need cloud accounts to run tests).
- Webhook signature verification (`X-Hub-Signature-256`) is mandatory before push.

---

## 5. Phase model — design around this

Use this phase model from the prior review. Refine the scope/timeline inside the plan, but do not change the ordering.

### Phase 1 — Harden the engine (target: 1–2 weeks of dev time)

Goal: turn the prototype into a base that is safe to push public and safe to hand to Jules.

Must include:

1. Monorepo migration: `apps/api`, `apps/admin` (empty Next.js scaffold), `packages/shared`.
2. `tenants` table + `tenant_id` FK on users, user_journeys, sessions, messages, scores, progression. Supabase RLS policies keyed on JWT claim.
3. Per-tenant WhatsApp config in `tenants` row (phone_number_id, encrypted access_token, webhook verify token). Engine resolves tenant by incoming `phone_number_id` from Meta's payload.
4. Journeys moved into DB: `journeys`, `journey_steps`, `journey_prompts` tables. Existing TS journey becomes a **seed migration**. The journey loader fetches from DB; the TS files are deleted after the seed lands.
5. Per-tenant prompt overrides (system prompt + per-mode guidance) stored in `journey_prompts` or a `tenant_prompts` table.
6. `X-Hub-Signature-256` HMAC verification on POST webhook.
7. Supabase Auth integration on `/api/*` with role-based access (`admin`, `coach`, `viewer`).
8. In-memory session Map → Upstash Redis (the doc in `docs/production-migration.md` is the spec).
9. Test suite: Vitest, ~30 tests minimum. Coverage targets:
   - Unit: `parser`, `outputParser`, `sessionManager`, `contextBuilder`, journey-loader.
   - Integration: `flowRouter` end-to-end with mocked WhatsApp adapter + mocked AI adapter. Fixtures for inbound payloads.
   - Contract tests: WhatsApp adapter implementations and AI adapter implementations both pass the same shared contract test suite.
10. Tooling: ESLint (`@typescript-eslint/recommended`), Prettier, `lint-staged` + husky pre-commit, GitHub Actions CI.
11. OSS housekeeping: `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, PR template, `.github/dependabot.yml`.
12. `docker-compose.yml` for local Postgres + Redis. Update README accordingly.
13. Webhook signature verification doc in `docs/whatsapp-setup.md`.

**Definition of done for "solid base ready to push":** Phase 1 items 1–13 complete, CI green on `main`, manual end-to-end test passes (same flow as the prototype works against the new multi-tenant code path with a seed tenant).

### Phase 2 — Admin UI (handed off to Jules)

Scope (each becomes its own Jules-sized issue):

- Auth shell + protected routes.
- Tenant management (super-admin only): list, create, configure WhatsApp creds.
- Journey list + create.
- Journey editor: drag-reorder steps, edit opening message + guidance + min-turns + mode + scoring criteria. Zod schema shared with API.
- Prompt editor per tenant (system + per-mode).
- User browser: search by WhatsApp number, view profile + progress + transcripts.
- Score viewer: per-user scores with dimension breakdown.
- Analytics dashboard: completion-rate per journey, mean score per dimension, step drop-off funnel.

### Phase 3 — Public release polish

- Docs site (Docusaurus or MkDocs).
- One-click deploy templates.
- Example journeys beyond maritime.
- Voice-note support via Whisper.

---

## 6. What "Jules-ready" means

Google Jules is an async coding agent. It pulls a GitHub issue, opens a branch, makes changes, opens a PR. It re-derives context from scratch every time. For it to succeed at handoff, the repo must satisfy:

- **Green CI on `main`.** Jules runs CI on its branches; broken baseline → broken signal.
- **Tests fast and stable.** Target full suite <60s. No flaky tests.
- **Architecture doc.** A `docs/architecture.md` that explains the adapter pattern, the flow lifecycle, the data model, and where to add what.
- **Atomic issues with acceptance criteria.** Each issue states: the goal, the files involved, the contract to satisfy, the tests that must pass, and "out of scope" notes.
- **No required external credentials to run tests.** Mocked WhatsApp + AI adapters in tests. Local Supabase via docker-compose for integration tests, or pure unit tests against an in-memory adapter.
- **Lint and format on save.** ESLint + Prettier configured so Jules' diffs match repo style automatically.
- **A `JULES.md` or `AGENTS.md`** at the repo root with: how to run tests, how to run typecheck, how the adapter pattern works, what files NOT to touch, what coding conventions to follow.

Plan must include a step to write this `AGENTS.md` before the first Jules handoff.

---

## 7. Out of scope for this planning session

Do not plan:

- The actual implementation of journey content beyond what already exists.
- Detailed UI mockups (visual design is downstream).
- Pricing, monetisation, or business model.
- Multi-channel rollout (SMS, Telegram, web chat) beyond confirming the adapter pattern leaves room for it.
- Voice-note implementation (Phase 3).

---

## 8. Deliverables of THIS session

By the time you exit plan mode, the plan file must contain:

1. **Context** section explaining the prototype and the OSS goal.
2. **Phase 1 task breakdown** — every Phase 1 item from §5 expanded into 1–3 concrete sub-tasks with file paths and acceptance criteria. Aim for 20–35 sub-tasks total.
3. **Migration order** — strict dependency order showing which tasks can run in parallel and which block which. The tenants table must come before anything that depends on `tenant_id`. The journey-data-in-DB migration must come before any admin-UI work on journeys.
4. **Jules handoff readiness checklist** — a tickable list of everything from §6 plus anything Phase-1-specific.
5. **GitHub issue backlog for Phase 2** — one bullet per planned issue, with title, short description, files likely involved, and acceptance criteria sketch. Don't write the full issue bodies; that's a later step.
6. **Open questions for the owner** (use `AskUserQuestion` to resolve any blockers before exiting plan mode). Likely candidates:
   - Repo name and GitHub org/user for the eventual push.
   - Whether to keep the existing prototype's `main` branch or start fresh.
   - Whether super-admin / multi-tenant management is part of the OSS distribution or a separate hosted service.
   - Whether encryption of stored WhatsApp tokens uses libsodium, a KMS provider, or Supabase Vault.
   - Confirm MIT license vs Apache-2.0.
   - Confirm Vitest vs Jest (Vitest recommended).
   - Confirm pnpm vs npm workspaces.

---

## 9. Process for this session

1. Enter plan mode.
2. Read `README.md`, `docs/production-migration.md`, and `src/engine/flowRouter.ts` to ground yourself. Skim `src/db/*.ts` and `supabase/schema.sql` to confirm the data model. **Do not read every file** — trust this document for context and only open files you need to verify a specific claim or design decision.
3. Use `AskUserQuestion` to resolve the §8 open questions early — the answers shape several Phase 1 tasks.
4. Draft the plan. Iterate. Keep it scannable: tables and bulleted lists, not prose walls.
5. Call `ExitPlanMode` when the plan satisfies §8 and the owner's open questions are answered.

---

## 10. Tone and rigour

- This is a real product the owner intends to ship and open-source. Be opinionated where the existing review (the gap table in §2) is already settled. Use `AskUserQuestion` for genuine forks where you do not have enough information.
- Prefer fewer, higher-quality sub-tasks over many vague ones. Every sub-task should be one Jules-PR-sized chunk.
- Do not propose rewrites of working code. The prototype's adapter seams are correct; build on them.
- Do not propose alternative tech stacks. §4 is settled.

---

End of kickoff prompt. Begin.
