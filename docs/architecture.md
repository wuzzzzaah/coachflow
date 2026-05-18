# CoachFlow Architecture

## System Diagram

```
WhatsApp User
      │  HTTPS POST /webhook/whatsapp
      ▼
┌─────────────────────────────────────────────────┐
│  apps/api  (Express, Node 20)                   │
│                                                 │
│  verifySignature (HMAC-SHA256)                  │
│       │                                         │
│  receiveWebhook → parseWebhook                  │
│       │ extracts phone_number_id                │
│       ▼                                         │
│  getTenantByPhoneNumberId (DB)                  │
│       │ resolves tenantId + access token        │
│       ▼                                         │
│  handleInbound (flowRouter)                     │
│    ├─ claimMessage (dedup)                      │
│    ├─ upsertUser / getSession / createSession   │
│    ├─ keyword handler (MENU/RESET/HELP/…)       │
│    ├─ journey selection                         │
│    └─ runStepTurn                               │
│         ├─ generate (AI client)                 │
│         ├─ parseAIResponse (output parser)      │
│         ├─ sendTextMessage (sender)             │
│         └─ advanceStep (if shouldAdvance)       │
│                                                 │
│  GET /api/journeys (requireAuth → requireRole)  │
└─────────────────────────────────────────────────┘
      │                              │
      ▼                              ▼
 Supabase Postgres            Upstash Redis
 (users, sessions,            (session state,
  journeys, scores)            30-min TTL)
```

## Adapter Pattern

Three seams allow swapping implementations without changing the engine.

### ISessionStore (`apps/api/src/engine/sessionStore.ts`)

```typescript
interface ISessionStore {
  get(whatsappNumber: string): Promise<Session | null>;
  set(session: Session): Promise<void>;
  delete(whatsappNumber: string): Promise<void>;
  size(): Promise<number>;
}
```

| Implementation         | File                             | When used                                   |
| ---------------------- | -------------------------------- | ------------------------------------------- |
| `InMemorySessionStore` | `engine/inMemorySessionStore.ts` | Tests + local dev                           |
| `RedisSessionStore`    | `engine/redisSessionStore.ts`    | Production (needs `UPSTASH_REDIS_REST_URL`) |

Wire the store at startup in `apps/api/src/index.ts` via `configureSessionStore(store)`.

To add a new store (e.g. DynamoDB): implement `ISessionStore`, run the contract suite at `packages/shared/src/contracts/sessionStore.contract.ts`, wire it in `index.ts`.

### AI Client (`apps/api/src/ai/geminiClient.ts`)

The engine calls `generate(input: GenerateInput): Promise<string>`. The function takes `mode`, `stepGuidance`, `history`, `latestUserMessage`, `turnCount`, and optional `promptOverrides`. It returns raw JSON that `parseAIResponse` validates.

To swap to a different model: write a new module that exports the same `generate` signature and update the import in `flowRouter.ts`.

### WhatsApp Sender (`apps/api/src/whatsapp/sender.ts`)

All outbound functions accept an optional `creds?: SenderCredentials`. In production, credentials are loaded per-tenant from Supabase Vault and passed through the call stack. In tests, functions are mocked entirely.

To add a different messaging channel: implement the same function signatures and swap the import in `flowRouter.ts`.

## Flow Lifecycle

```
Inbound POST /webhook/whatsapp
  1. HMAC-SHA256 signature verified against X-Hub-Signature-256
  2. parseWebhook() → InboundMessage[]
  3. phone_number_id extracted → tenant resolved (DB lookup)
  4. For each message:
     a. markAsRead (fire-and-forget)
     b. claimMessage() → dedup via DB unique insert; duplicate = return early
     c. upsertUser() → create or retrieve the users row
     d. getSession() → in-memory (or Redis) session; create if absent
     e. Unsupported message type → send canned reply, return
     f. Keyword check (RESET/HELP/PROGRESS/STOP/MENU)
     g. currentMode dispatch:
        - onboarding  → markOnboarded, sendWelcome, switch to menu
        - menu        → parse journey choice, startJourney or sendWelcome
        - coaching/roleplay/reflection/assessment → runStepTurn
        - journey_complete → canned "type MENU" reply
     h. runStepTurn:
        - appendTurn (user) + logMessage to DB
        - generate() → parseAIResponse
        - sendTextMessage (assistant reply)
        - appendTurn (assistant) + logMessage to DB
        - if assessment mode + score: saveScore + send scorecard
        - if shouldAdvance && turnCount >= minTurns: advanceStep
     i. advanceStep:
        - endSession (DB) for current step
        - nextIndex >= totalSteps → completeUserJourney, mode=journey_complete
        - else advanceUserJourney + beginStep(nextIndex)
```

## Data Model

### `tenants`

Root entity. Each tenant has a unique `phone_number_id` (one WhatsApp Business number per tenant). The access token is stored in Supabase Vault, not in the `tenants` table itself.

### `users`

Per-phone-number user record. Linked to a tenant via `tenant_id`. Tracks `onboarded_at` and `current_journey_id` / `current_step_index` for progress display.

### `journeys` / `journey_steps` / `journey_prompts`

Journey content loaded from DB at runtime (not compiled into the binary). `journey_steps.mode` determines which AI prompt template is used. `scoring_criteria` is only set on assessment steps.

### `sessions` / `messages`

Immutable audit log. Each `sessions` row represents one step interaction; `messages` stores every turn. Used for transcript display, analytics, and debugging — not for live session state (that's Redis).

### `scores`

One row per assessment step completed. `score` is a JSONB blob (`AIScore` type: dimensions, overall, summary, developmentFocus).

### `user_journeys`

Tracks a user's progress through a journey (`status`, `current_step_index`). Used by the engine to resume from the correct step.

### `tenant_prompts`

Per-tenant overrides for the AI system prompt and mode guidance. `prompt_key` matches: `system`, `coaching`, `roleplay`, `reflection`, `scoring`. Missing keys fall back to the defaults in `geminiClient.ts`.

### Row-Level Security

All tables have RLS enabled. Policies use `current_tenant_id()` (a Postgres function that reads `auth.jwt()->>'tenant_id'`). Cross-tenant reads return 0 rows.

## Where to Add What

| Task                           | Where                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| New WhatsApp/messaging adapter | `apps/api/src/whatsapp/` — new sender module; update import in `flowRouter.ts`         |
| New AI provider                | `apps/api/src/ai/` — new client; export same `generate(input)` signature               |
| New session backend            | `apps/api/src/engine/` — implement `ISessionStore`; run contract suite                 |
| Journey content                | `supabase/migrations/` — new seed SQL; rows in `journeys` + `journey_steps`            |
| Per-tenant prompt tuning       | `tenant_prompts` table rows via admin UI (Phase 2) or direct DB insert                 |
| New API route                  | `apps/api/src/index.ts` — mount under `/api/*` (auth middleware applied automatically) |
| Shared type or Zod schema      | `packages/shared/src/types/` or `packages/shared/src/schemas/`                         |
| Admin UI feature               | `apps/admin/` — Next.js App Router; see Phase 2 issues                                 |
