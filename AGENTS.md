# CoachFlow — Agent Onboarding

Read this before touching the repo. It covers how to run the project, how the code is structured, and what not to change.

---

## Quick Start

```bash
# Install deps
pnpm install

# Run the API in dev mode
pnpm --filter api dev          # starts on port 3000

# Type-check everything
pnpm -r typecheck

# Lint everything
pnpm -r lint

# Run all tests (no cloud credentials needed)
pnpm -r test
```

Copy `.env.example` to `.env` and fill in your values. Tests use `InMemorySessionStore` and mock adapters — you can run `pnpm -r test` on a fresh clone with no credentials.

---

## Repo Layout

```
apps/
  api/          Express API server (Node 20 / TypeScript)
  admin/        Next.js 14 admin UI (Phase 2 — scaffold only)
packages/
  shared/       Shared types, Zod schemas, adapter contracts
supabase/
  migrations/   Numbered SQL migrations (run in order)
docs/
  architecture.md   Full system diagram + data model
```

---

## Adapter Pattern (critical — read before editing)

The engine decouples from infrastructure through three seams:

### Session store — `apps/api/src/engine/sessionStore.ts`

Interface: `ISessionStore { get, set, delete, size }`.

- `InMemorySessionStore` — tests and local dev.
- `RedisSessionStore` — production (needs Upstash env vars).

Wire at startup: `configureSessionStore(store)` in `apps/api/src/index.ts`.

**Contract test:** `packages/shared/src/contracts/sessionStore.contract.ts`. Any new implementation must pass it. Run via `pnpm --filter api test`.

### AI client — `apps/api/src/ai/geminiClient.ts`

Exports `generate(input: GenerateInput): Promise<string>`. The engine calls this; it returns raw JSON that `parseAIResponse` validates. To swap models, implement the same signature and update the import in `flowRouter.ts`.

### WhatsApp sender — `apps/api/src/whatsapp/sender.ts`

All functions accept `creds?: SenderCredentials`. Production creds come from Supabase Vault (loaded in `webhook.ts`). In tests, functions are mocked via `vi.mock`.

---

## Files NOT to Touch

These files define the engine contract. Changes here break other adapters:

| File                                                     | Why hands-off                                         |
| -------------------------------------------------------- | ----------------------------------------------------- |
| `packages/shared/src/types/index.ts`                     | All shared types — changing shapes breaks API + admin |
| `packages/shared/src/schemas/index.ts`                   | Zod schemas used for runtime validation on both sides |
| `apps/api/src/engine/sessionStore.ts`                    | `ISessionStore` interface — change breaks both stores |
| `packages/shared/src/contracts/sessionStore.contract.ts` | Contract test — don't weaken it                       |
| `supabase/migrations/` (any existing file)               | Never edit past migrations; add new ones instead      |

---

## Coding Conventions

- **No `any`** — use `unknown` and narrow, or define a type.
- **Zod for all external inputs** — every external boundary (webhook body, API request body, AI response) must be validated with a Zod schema from `@coachflow/shared`.
- **No raw SQL outside `apps/api/src/db/`** — use the Supabase JS client in the `db/` layer only.
- **No secrets in source** — `.env` is gitignored; tokens live in Supabase Vault.
- **Async everywhere** — `flowRouter.ts` calls DB, AI, and session store (`RedisSessionStore` or `InMemorySessionStore`) asynchronously. Ensure all session reads/writes use `await`.
- **One migration per change** — add `supabase/migrations/NNN_description.sql`, never edit an existing one.

---

## Running Tests

```bash
pnpm --filter api test          # all tests, no credentials needed
pnpm --filter api test -- --coverage   # with coverage report
```

Tests live in `apps/api/src/**/__tests__/`. Vitest config is at `apps/api/vitest.config.ts`.

The contract suite in `packages/shared/src/contracts/` is consumed by `sessionStore.contract.test.ts` — it verifies `InMemorySessionStore` against the `ISessionStore` interface. A `RedisSessionStore` contract test should be added when integration testing against a real Redis instance.

---

## Adding a Phase 2 Admin UI Feature

See the Phase 2 issue backlog in the plan for acceptance criteria per feature. The pattern is:

1. Add an API route in `apps/api/src/index.ts` under `/api/…` (auth middleware is already mounted there).
2. Write the DB query in `apps/api/src/db/`.
3. Add a page in `apps/admin/app/…` using Next.js App Router.
4. Use types from `@coachflow/shared` on both sides — never duplicate type definitions.

For detailed architectural context (data model, flow lifecycle, where to add what), see `docs/architecture.md`.

---

## Environment Variables

See `.env.example` for the full list. Key vars:

| Var                                                   | Used by                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `WHATSAPP_APP_SECRET`                                 | HMAC signature verification                                                                                                           |
| `WHATSAPP_PHONE_NUMBER_ID`                            | Default sender (overridden per-tenant in production)                                                                                  |
| `WHATSAPP_ACCESS_TOKEN`                               | Default sender (overridden per-tenant in production)                                                                                  |
| `GEMINI_API_KEY`                                      | AI client                                                                                                                             |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`          | DB client                                                                                                                             |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Redis session store. Automatically activates `RedisSessionStore` when both are present, otherwise defaults to `InMemorySessionStore`. |
| `DEFAULT_TENANT_ID`                                   | Fallback tenant for local dev when no `phone_number_id` match                                                                         |
