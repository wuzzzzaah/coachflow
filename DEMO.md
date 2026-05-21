# CoachFlow — Demo Setup Guide

Everything you need to run a live demo of one complete journey end-to-end through the web chat UI.

---

## What the demo shows

1. **Admin view** — journey list, live telemetry, alert rules
2. **Learner login** — one-click guest access (no email needed)
3. **Journey picker** — choose "Leading with Presence"
4. **Coaching** → **Roleplay** → **Reflection** → **Scorecard** — a full 4-step AI coaching session

---

## One-time setup (~10 min)

### 1. Get your Supabase service role key

1. Open [supabase.com](https://supabase.com) → project `rtoyabghwddcdkbbsqvl`
2. **Project Settings → API → `service_role` (secret)**
3. Copy the key

### 2. Add it to the API env file

Open `apps/api/.env` and replace:

```
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SERVICE_ROLE_KEY_HERE
```

### 3. Enable Anonymous Auth in Supabase

The demo login uses anonymous sign-in (no email needed).

1. Supabase dashboard → **Authentication → Providers**
2. Under **Anonymous** — toggle **Enable anonymous sign-ins** → Save

### 4. Run all migrations

In Supabase dashboard → **SQL Editor → New query**, paste and run each migration file in order:

```
supabase/migrations/001_tenants.sql  →  028_slack_config.sql
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 5. Seed the demo data

In Supabase **SQL Editor**, paste and run:

```
supabase/seed/demo_setup.sql
```

You'll see a notice confirming:

```
✅ Demo setup complete!
   Tenant ID : a0000000-demo-0000-0000-000000000001
   Journey   : Leading with Presence
```

### 6. Create an admin user

In Supabase dashboard → **Authentication → Users → Add user**

- Email: `admin@coachflow.demo` (or your own)
- Password: anything
- Mark email as confirmed

Then in **SQL Editor**, assign the super_admin role:

```sql
insert into user_roles (user_id, tenant_id, role)
select id, 'a0000000-demo-0000-0000-000000000001', 'super_admin'
from auth.users
where email = 'admin@coachflow.demo';
```

---

## Running the demo locally

### Terminal 1 — API

```bash
cd apps/api
pnpm dev
# Starts on http://localhost:3001
```

### Terminal 2 — Admin UI

```bash
cd apps/admin
pnpm dev
# Starts on http://localhost:3000
```

---

## Demo script (≈20 min)

### Act 1: Admin view (2 min)

1. Open `http://localhost:3000`
2. Log in as `admin@coachflow.demo`
3. Show **Journeys** → "Leading with Presence" is published
4. Show **Analytics → Live** → active sessions counter

### Act 2: Learner experience (15 min)

1. Open a new incognito window → `http://localhost:3000/login`
2. Click **✨ Try a Demo Journey** (no email needed)
3. Select **"Leading with Presence"**
4. Walk through the 4 steps:
   - **Step 1 (Coaching)** — share a real or fictional leadership challenge
   - **Step 2 (Roleplay)** — have a difficult conversation with "Jordan"
   - **Step 3 (Reflection)** — one reflective exchange
   - **Step 4 (Scorecard)** — personalised AI-generated score with specific feedback
5. Switch back to admin → show the session appearing in the live dashboard

### Act 3: Admin depth (3 min)

- Show the **score** under the user's profile
- Show **Alert Rules** — explain how drop-off alerts work
- Mention WhatsApp / Slack channels work exactly the same engine

---

## Resetting between demo runs

If you need to replay the journey from scratch (e.g. for a second audience):

```bash
curl -X POST "http://localhost:3001/api/demo/reset?userId=<LEARNER_USER_ID>"
```

The learner user ID appears in the URL or browser dev tools after login.

Or just open a new incognito window — each anonymous session is a fresh user.

---

## Troubleshooting

| Problem                            | Fix                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| "Anonymous sign-in disabled" error | Enable in Supabase → Auth → Providers → Anonymous                                            |
| Journey picker shows empty         | Run `demo_setup.sql` in Supabase SQL editor                                                  |
| API 500 on `/channel/web/receive`  | Check `SUPABASE_SERVICE_ROLE_KEY` is set in `apps/api/.env`                                  |
| Scorecard doesn't appear           | Check `GEMINI_API_KEY` is valid — test at [aistudio.google.com](https://aistudio.google.com) |
| Admin login fails                  | Confirm the user exists in Supabase Auth and has a `user_roles` row                          |
