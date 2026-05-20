create table notification_configs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade unique,
  email_to      text,                        -- comma-separated recipient addresses
  notify_journey_complete  boolean not null default true,
  notify_low_score         boolean not null default true,
  low_score_threshold      numeric not null default 5,   -- out of 10
  notify_idle_user         boolean not null default false,
  resend_api_key_secret_id uuid,             -- stored in Supabase Vault via RPC
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table notification_configs enable row level security;

create policy "tenant isolation" on notification_configs
  using (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ── Vault helpers (Resend API Key) ─────────────────────────────────────────────────────────────

-- Stores the Resend API key for a tenant in Vault and records the secret_id.
create or replace function set_tenant_resend_api_key(
  p_tenant_id uuid,
  p_api_key   text
) returns void language plpgsql security definer as $$
declare
  v_secret_id uuid;
  v_existing  uuid;
begin
  select resend_api_key_secret_id into v_existing
    from notification_configs where tenant_id = p_tenant_id;

  if v_existing is not null then
    -- Update existing secret in-place.
    perform vault.update_secret(v_existing, p_api_key);
  else
    -- Create a new secret and store its id.
    v_secret_id := vault.create_secret(
      p_api_key,
      'resend_api_key_' || p_tenant_id::text,
      'Resend API key for tenant ' || p_tenant_id::text
    );

    -- Ensure row exists before updating
    insert into notification_configs (tenant_id, resend_api_key_secret_id)
    values (p_tenant_id, v_secret_id)
    on conflict (tenant_id) do update
    set resend_api_key_secret_id = excluded.resend_api_key_secret_id;
  end if;
end;
$$;

-- Retrieves the decrypted Resend API key for a tenant.
-- Only callable by service role (server-side).
create or replace function get_tenant_resend_api_key(
  p_tenant_id uuid
) returns text language plpgsql security definer as $$
declare
  v_secret_id uuid;
  v_api_key   text;
begin
  select resend_api_key_secret_id into v_secret_id
    from notification_configs where tenant_id = p_tenant_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_api_key
    from vault.decrypted_secrets where id = v_secret_id;

  return v_api_key;
end;
$$;
