-- Per-tenant Slack credentials.
-- slack_team_id and slack_team_name are stored in plaintext.
-- bot_token is stored in Supabase Vault (pgsodium).

alter table tenants
  add column if not exists slack_team_id            text,
  add column if not exists slack_team_name          text,
  add column if not exists slack_bot_token_secret_id uuid;

-- Lookup index for Slack team ID.
create unique index if not exists idx_tenants_slack_team_id on tenants(slack_team_id)
  where slack_team_id is not null;

-- ── Vault helpers for Slack ───────────────────────────────────────────────────

-- Stores the Slack bot token for a tenant in Vault.
create or replace function set_tenant_slack_token(
  p_tenant_id uuid,
  p_token     text
) returns void language plpgsql security definer as $$
declare
  v_secret_id uuid;
  v_existing  uuid;
begin
  select slack_bot_token_secret_id into v_existing
    from tenants where id = p_tenant_id;

  if v_existing is not null then
    perform vault.update_secret(v_existing, p_token);
  else
    v_secret_id := vault.create_secret(
      p_token,
      'slack_bot_token_' || p_tenant_id::text,
      'Slack bot token for tenant ' || p_tenant_id::text
    );
    update tenants set slack_bot_token_secret_id = v_secret_id where id = p_tenant_id;
  end if;
end;
$$;

-- Retrieves the decrypted Slack bot token for a tenant.
create or replace function get_tenant_slack_token(
  p_tenant_id uuid
) returns text language plpgsql security definer as $$
declare
  v_secret_id uuid;
  v_token     text;
begin
  select slack_bot_token_secret_id into v_secret_id
    from tenants where id = p_tenant_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_token
    from vault.decrypted_secrets where id = v_secret_id;

  return v_token;
end;
$$;

-- Clears the Slack credentials for a tenant.
create or replace function clear_tenant_slack_token(
  p_tenant_id uuid
) returns void language plpgsql security definer as $$
declare
  v_secret_id uuid;
begin
  select slack_bot_token_secret_id into v_secret_id
    from tenants where id = p_tenant_id;

  if v_secret_id is not null then
    -- We don't necessarily need to delete from vault.secrets if we want to keep history,
    -- but usually it's cleaner to remove it if we're disconnecting.
    -- However, vault.delete_secret might not exist or might be different.
    -- Looking at other migrations, they don't seem to delete secrets.
    -- Let's just null out the references in the tenants table.
    update tenants
       set slack_bot_token_secret_id = null,
           slack_team_id = null,
           slack_team_name = null
     where id = p_tenant_id;
  end if;
end;
$$;
