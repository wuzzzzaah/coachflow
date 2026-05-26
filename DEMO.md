# CoachFlow — Demo Setup Guide

Everything you need to run a live demo of one complete journey, either through the **web chat UI** or directly on **WhatsApp**.

---

## What the demo shows

1. **Admin view** — journey list, live telemetry, alert rules
2. **Learner login** — one-click guest access (no email needed) via web, or message on WhatsApp
3. **Journey picker** — choose from 3 journeys: "Leading with Presence", "Difficult Conversations", "Managing Up"
4. **Coaching** → **Roleplay** → **Reflection** → **Scorecard** — a full AI coaching session

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
   Tenant ID : a0000000-de40-0000-0000-000000000001
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
select id, 'a0000000-de40-0000-0000-000000000001', 'super_admin'
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

## WhatsApp setup (optional — adds live WhatsApp channel)

Skip this if you're only demoing the web UI.

### Prerequisites

- A [Meta Developer](https://developers.facebook.com) account
- A WhatsApp Business phone number (or the free Meta test number — see [quickstart](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started))
- [ngrok](https://ngrok.com) installed: `brew install ngrok/ngrok/ngrok`

### Step-by-step

#### 1. Get your WhatsApp credentials from Meta

In [Meta Developer Portal](https://developers.facebook.com) → your app → **WhatsApp → API Setup**:

| Value               | Where to find it                                                              |
| ------------------- | ----------------------------------------------------------------------------- |
| **Phone Number ID** | "From" dropdown → phone number ID below the number                            |
| **Access Token**    | Temporary token (valid 24h for testing) or a System User token for production |
| **App Secret**      | App Settings → Basic → App Secret                                             |

#### 2. Set the env vars

Add to `apps/api/.env`:

```
WHATSAPP_PHONE_NUMBER_ID=<your-phone-number-id>
WHATSAPP_ACCESS_TOKEN=<your-access-token>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=coachflow-demo-verify   # any string you choose
WHATSAPP_APP_SECRET=<your-app-secret>                 # optional: skipped if blank
```

#### 3. Start ngrok

In a new terminal:

```bash
ngrok http 3001
```

Copy the `https://` forwarding URL — e.g. `https://abc123.ngrok-free.app`.

#### 4. Configure Meta webhook

In Meta Developer Portal → **WhatsApp → Configuration → Webhook**:

| Field        | Value                                                |
| ------------ | ---------------------------------------------------- |
| Callback URL | `https://<your-ngrok-url>/webhook/whatsapp`          |
| Verify Token | The value you set as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |

Click **Verify and Save**, then **Subscribe** to the `messages` field.

#### 5. (Optional) Link the WhatsApp number to the demo tenant

This allows proper multi-tenant routing. Run in **Supabase SQL Editor**:

```sql
update tenants
set phone_number_id = '<your-phone-number-id>'
where id = 'a0000000-de40-0000-0000-000000000001';
```

Without this, the API falls back to `DEFAULT_TENANT_ID` from the env — which works fine for a single-tenant demo.

#### 6. Test it

Send any message to your WhatsApp demo number. You should receive:

> 👋 Welcome to CoachFlow! …

---

## Demo script (≈20 min)

### Act 1: Admin view (2 min)

1. Open `http://localhost:3000`
2. Log in as `admin@coachflow.demo`
3. Show **Journeys** → 3 journeys published
4. Show **Analytics → Live** → active sessions counter

### Act 2: Learner experience — Web (10 min)

1. Open a new incognito window → `http://localhost:3000/start`
2. Click **✨ Try a Demo Journey** (no email needed)
3. Select a journey and walk through it end-to-end
4. Switch back to admin → show the session appearing in the live dashboard

### Act 2b: Learner experience — WhatsApp (optional, 5 min)

1. Show the WhatsApp number on screen
2. Send a message from your phone → "Hi"
3. Select a journey from the interactive list
4. Exchange 2-3 coaching turns live
5. Switch to admin → show the session appearing in real-time

### Act 3: Admin depth (3 min)

- Show the **score** under the user's profile
- Show **Alert Rules** — explain how drop-off alerts work
- Point out the session appearing from the WhatsApp user

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

| Problem                                       | Fix                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "Anonymous sign-in disabled" error            | Enable in Supabase → Auth → Providers → Anonymous                                                                  |
| Journey picker shows empty (web)              | Run `demo_setup.sql` in Supabase SQL editor                                                                        |
| API 500 on `/channel/web/receive`             | Check `SUPABASE_SERVICE_ROLE_KEY` is set in `apps/api/.env`                                                        |
| Scorecard doesn't appear                      | Check `GEMINI_API_KEY` is valid — test at [aistudio.google.com](https://aistudio.google.com)                       |
| Admin login fails                             | Confirm the user exists in Supabase Auth and has a `user_roles` row                                                |
| WhatsApp webhook verification fails           | Confirm `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env` matches what you entered in Meta portal                          |
| WhatsApp messages not received                | Check ngrok is running and the URL in Meta webhook config is current (ngrok URL changes on restart)                |
| WhatsApp bot doesn't respond                  | Check API logs for errors; confirm `WHATSAPP_ACCESS_TOKEN` is valid and not expired                                |
| WhatsApp sends messages but bot doesn't reply | Ensure `messages` webhook field is subscribed in Meta Developer Portal                                             |
| "Unknown phone_number_id" in API logs         | Normal if you skipped Step 5 — the API falls back to `DEFAULT_TENANT_ID`. Or run the SQL update to link the number |
