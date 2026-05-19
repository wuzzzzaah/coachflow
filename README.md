# AI Coaching Platform — WhatsApp + Gemini Prototype

A working backend prototype of an AI-powered leadership coaching platform for the maritime/cruise industry. Coaching is delivered through WhatsApp using the **Meta Cloud API** (no SDK) and **Google Gemini** for the AI layer, with **Supabase** for persistence.

The architecture mirrors the production target so the migration is a swap of three thin adapters:

- Meta Cloud API → **Infobip** (`src/whatsapp/`)
- Gemini → **Claude** (`src/ai/`)
- In-memory session map → **Upstash Redis** (`src/engine/sessionManager.ts`)

See [`docs/production-migration.md`](docs/production-migration.md) for the swap procedure.

---

## 1. Overview

```
┌─────────────┐    inbound HTTPS    ┌──────────────────────┐
│  WhatsApp   │  ─────────────────► │  Meta Cloud API      │
│  (user)     │  ◄───── outbound ── │  Webhook  (Meta)     │
└─────────────┘                     └──────────┬───────────┘
                                               │  POST /webhook/whatsapp
                                               ▼
                              ┌────────────────────────────────────┐
                              │  Express server (this repo)        │
                              │                                    │
                              │  parser ─► dedup ─► flowRouter ──┐ │
                              │                                  │ │
                              │   ┌────────────────┐  ┌───────┐  │ │
                              │   │ sessionManager │  │ Gemini│◄─┘ │
                              │   │ (in-memory)    │  │  AI   │    │
                              │   └────────────────┘  └───────┘    │
                              │           │              │         │
                              │           ▼              ▼         │
                              │      ┌─────────────────────┐       │
                              │      │  Supabase (Postgres)│       │
                              │      └─────────────────────┘       │
                              └────────────────────────────────────┘
```

---

## 2. Prerequisites

- **Node.js v20+**
- A **Meta for Developers** account with WhatsApp Cloud API access
- A **Google AI Studio** API key for Gemini (`aistudio.google.com`)
- A **Supabase** project (free tier is fine)
- **ngrok** (or any HTTPS tunnel) for local webhook testing

---

## 3. Meta WhatsApp Cloud API Setup

Step-by-step (also see [`docs/whatsapp-setup.md`](docs/whatsapp-setup.md)):

1. Sign up at <https://developers.facebook.com> and create a **Business**-type app.
2. In your app, click **Add Product** → **WhatsApp** → **Set up**.
3. Open **WhatsApp → API Setup**. Copy the **Phone Number ID** and the **temporary access token** (you can generate a permanent token later).
4. Under **Send and receive messages → To**, add your own WhatsApp number as a test recipient and verify the OTP.
5. In a terminal, run `ngrok http 3000`. Copy the `https://*.ngrok.io` URL.
6. In Meta App Dashboard → **WhatsApp → Configuration → Webhook**, set:
   - **Callback URL**: `https://YOUR_NGROK_URL/webhook/whatsapp`
   - **Verify token**: same string you put in `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env`
7. Click **Verify and save** (Meta will hit your GET endpoint).
8. Subscribe to the **messages** webhook field.
9. Send a WhatsApp message from your test number to the WhatsApp business number — you should see your server receive the webhook and respond.

---

## 4. Local Setup

> **Note:** The `docker compose up -d` services are scaffolding for future integration tests.
> The current application stack requires a hosted Supabase project (`SUPABASE_URL` / `SUPABASE_ANON_KEY`)
> and an Upstash Redis account (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) —
> the local containers are not protocol-compatible with those clients.

```bash
git clone <repo>
cd ai-coach
cp .env.example .env
# fill in WHATSAPP_*, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY

npm install

# Start local infrastructure (Postgres and Redis)
docker compose up -d

# Apply database schema — either:
#   - paste supabase/schema.sql into the Supabase SQL editor and run it, OR
#   - if using the Supabase CLI: `supabase db push`, OR
#   - run `supabase/migrations/*.sql` in order against the local Postgres to initialise the schema.

npm run dev

# In a separate terminal:
ngrok http 3000
# Then point Meta's webhook to https://YOUR_NGROK_URL/webhook/whatsapp
```

---

## 5. Environment Variable Reference

| Variable                        | Description                     | Where to find                          |
| ------------------------------- | ------------------------------- | -------------------------------------- |
| `WHATSAPP_PHONE_NUMBER_ID`      | The business phone number's ID  | Meta App → WhatsApp → API Setup        |
| `WHATSAPP_ACCESS_TOKEN`         | Bearer token for Meta Graph API | Meta App → WhatsApp → API Setup        |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Arbitrary string you choose     | You define it (must match Meta config) |
| `GEMINI_API_KEY`                | Gemini API key                  | <https://aistudio.google.com>          |
| `SUPABASE_URL`                  | Supabase project URL            | Supabase project → Settings → API      |
| `SUPABASE_ANON_KEY`             | Supabase anon public key        | Supabase project → Settings → API      |
| `PORT`                          | Server port (default 3000)      | –                                      |
| `NODE_ENV`                      | `development` or `production`   | –                                      |

---

## 6. User-Facing Commands

WhatsApp doesn't support slash commands, so the bot recognises these keywords (case-insensitive):

| Keyword                 | Action                        |
| ----------------------- | ----------------------------- |
| `MENU` / `hi` / `hello` | Show journey picker           |
| `PROGRESS`              | Show your scores and progress |
| `RESET`                 | Clear the current session     |
| `HELP`                  | List the keywords             |
| `STOP`                  | Pause the conversation        |

Greetings (`hi`, `hello`) only act as MENU outside of an active coaching turn — once you're mid-roleplay, "hi" is treated as part of the dialogue.

---

## 7. Adding a New Journey

1. Create `src/journeys/<your-journey>/journey.config.ts` exporting a `JourneyConfig`.
2. Create one file per step under `src/journeys/<your-journey>/steps/` exporting a `JourneyStep` (id, index, mode, title, openingMessage, minTurns, stepGuidance).
3. Register the journey in `src/journeys/index.ts`.
4. Restart the dev server. The new journey appears in the picker automatically.

Each step has a `mode`: one of `coaching`, `roleplay`, `reflection`, or `assessment`. Each mode has a corresponding prompt block in `src/ai/prompts/`.

---

## 8. Testing Locally

End-to-end manual test:

1. Start `npm run dev` and `ngrok http 3000`. Configure the Meta webhook with the ngrok URL.
2. Send "hi" from your test WhatsApp number. Expect a welcome + journey picker.
3. Pick **Leading with Confidence at Sea** from the list.
4. Complete all 4 steps. The assessment step writes a row to the `scores` table.
5. Send `PROGRESS` — expect a formatted progress summary.
6. Send `RESET` — expect the menu.
7. Replay a previously delivered webhook (curl the same payload twice) — the bot should respond only once thanks to `processed_messages` dedup.

Smoke endpoints:

- `GET /health` — `{ status: 'ok', activeSessions: number }`
- `GET /api/journeys` — list of available journeys
- `GET /api/users/:number` — user record by WhatsApp number
- `GET /api/users/:number/scores` — all scores for a user
- `GET /api/sessions/:id` — message log for a session

---

## 9. Project Layout

```
src/
├── index.ts                # Express bootstrap, internal API
├── whatsapp/               # Meta Cloud API adapter (swap boundary for Infobip)
├── engine/                 # Provider-agnostic flow router + session state
├── ai/                     # Gemini adapter + prompt library (swap boundary for Claude)
├── db/                     # Supabase access (users, sessions, journeys, scores)
├── journeys/               # Journey content
└── types/                  # Shared TypeScript types
supabase/schema.sql         # Database schema
docs/
├── whatsapp-setup.md       # Meta API setup walkthrough
└── production-migration.md # Swap to Infobip, Claude, Upstash Redis
```
