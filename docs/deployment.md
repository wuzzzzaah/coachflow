# Deployment Guide

Production deployment requires four services: API (Node), admin UI (Next.js), Supabase (DB + Auth), and Upstash (Redis). Follow these steps in order to self-host the CoachFlow application.

## 1. Supabase (Database & Authentication)

1. Create a new project on [Supabase](https://supabase.com).
2. Go to the SQL Editor and run the SQL scripts in `supabase/migrations/*.sql` in sequential order to initialize the database schema.
3. Go to **Authentication > Providers** and ensure **Email** provider is enabled.
4. **Auth Hook Setup**: You must configure a Supabase Auth Hook to set custom claims (`app_metadata.role` and `app_metadata.tenant_id`) on user creation. This ensures multi-tenancy and role-based access control work correctly.

## 2. Upstash (Redis Session Store)

1. Create a new Redis database on [Upstash](https://upstash.com).
2. Once created, go to the database details page.
3. Under the **REST API** section, copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**. You will need these for the API deployment.

## 3. API (Railway or Fly.io)

1. Create a new project/service on your host (e.g., [Railway](https://railway.app)).
2. Connect your GitHub repository.
3. Set the Root Directory to `/apps/api` (or define it in the build settings).
4. Set the build command: `pnpm install && pnpm build`
5. Set the start command: `node dist/index.js`
6. Configure the following environment variables:

| Variable | Description / Where to find |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developer App > WhatsApp > API Setup |
| `WHATSAPP_ACCESS_TOKEN` | Meta Developer App > WhatsApp > API Setup |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Arbitrary string you define to verify the webhook |
| `WHATSAPP_APP_SECRET` | Meta Developer App > Settings > Basic |
| `GEMINI_API_KEY` | Google AI Studio (aistudio.google.com) |
| `SUPABASE_URL` | Supabase Project Settings > API |
| `SUPABASE_ANON_KEY` | Supabase Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings > API |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis Console > REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis Console > REST API |
| `DEFAULT_TENANT_ID` | A valid UUID for the primary tenant (create one in Supabase) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | URL of your deployed Admin UI (e.g. `https://admin.yourdomain.com`) - required for CORS |

## 4. Admin UI (Vercel)

1. Create a new project on [Vercel](https://vercel.com).
2. Connect your GitHub repository.
3. Set the Root Directory to `apps/admin`.
4. Ensure the Framework Preset is set to **Next.js**.
5. Configure the following environment variables:

| Variable | Description / Where to find |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Project Settings > API |
| `NEXT_PUBLIC_API_URL` | URL of your deployed API (e.g., from Railway) |

## 5. Wiring it together

1. Set the `NEXT_PUBLIC_API_URL` in your Vercel project to point to the URL of your deployed API (e.g., `https://coachflow-api.up.railway.app`).
2. Make sure your API environment variable `FRONTEND_URL` (or the hardcoded CORS policy if using one) includes the domain of your Vercel Admin UI so that requests from the dashboard are permitted.
