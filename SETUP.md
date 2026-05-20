# Setup Guide

This guide will help you get the project up and running on your local machine.

## Prerequisites

- **Node.js**: version 20 or higher
- **pnpm**: version 9 or higher
- **Python**: version 3.11 or higher (required for `llmstxt-gen`)
- **Docker**: (Optional, for running local infrastructure like Redis/Postgres)
- **Supabase CLI**: For database migrations and local development

## 1. Clone and Install

```bash
git clone <repository-url>
cd <repository-name>
pnpm install
```

## 2. Supabase Setup

1.  **Create a Supabase Project**: Go to [Supabase](https://supabase.com/) and create a new project.
2.  **Enable Vault Extension**: In your Supabase dashboard, go to **Database** > **Extensions** and enable the `vault` extension.
3.  **Run Migrations**:
    Login to Supabase CLI and link your project:
    ```bash
    supabase login
    supabase link --project-ref <your-project-id>
    ```
    Push the migrations to your project:
    ```bash
    supabase db push
    ```

## 3. Environment Configuration

Copy the `.env.example` files to `.env` in both the API and Admin applications:

### API (`apps/api`)
```bash
cp apps/api/.env.example apps/api/.env
```
Edit `apps/api/.env` and fill in:
- `SUPABASE_URL` & `SUPABASE_ANON_KEY` & `SUPABASE_SERVICE_ROLE_KEY`: From your Supabase project settings.
- `GEMINI_API_KEY`: From [Google AI Studio](https://aistudio.google.com/).
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: (Optional) From Upstash console. Falls back to in-memory if not set.

### Admin (`apps/admin`)
```bash
cp apps/admin/.env.example apps/admin/.env
```
Edit `apps/admin/.env` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Same as above.
- `NEXT_PUBLIC_API_URL`: `http://localhost:3000` (default for local dev).

## 4. Start Development Servers

Run the following commands in separate terminals:

**Start API:**
```bash
pnpm --filter api dev
```

**Start Admin UI:**
```bash
pnpm --filter admin dev
```

## 5. WhatsApp Configuration

1.  **Create a Meta WhatsApp Business App**: Follow the official Meta documentation to create a WhatsApp Business app.
2.  **Configure Webhook**:
    -   Point the webhook URL to your API endpoint (e.g., `https://your-public-url.com/whatsapp/webhook`).
    -   Use the `WHATSAPP_WEBHOOK_VERIFY_TOKEN` you set in your `.env`.
3.  **Update `.env`**: Fill in `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_APP_SECRET`.

## 6. Create Your First Tenant

1.  Open the Admin UI at `http://localhost:3001` (or the port shown in your terminal).
2.  Navigate to the Tenants section.
3.  Create a new tenant.
4.  Copy the new Tenant ID and set it as `DEFAULT_TENANT_ID` in `apps/api/.env` and `NEXT_PUBLIC_DEFAULT_TENANT_ID` in `apps/admin/.env` for easier local development.
