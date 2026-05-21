-- Add last_fired_at to alert_rules to support cooldowns
alter table alert_rules add column last_fired_at timestamptz;

-- Add slack_webhook_url_secret_id to notification_configs
alter table notification_configs add column slack_webhook_url_secret_id uuid;

-- ── Vault helpers (Slack Webhook URL) ─────────────────────────────────────────────────────────────

-- Stores the Slack webhook URL for a tenant in Vault and records the secret_id.
create or replace function set_tenant_slack_webhook_url(
  p_tenant_id uuid,
  p_url       text
) returns void language plpgsql security definer as $$
declare
  v_secret_id uuid;
  v_existing  uuid;
begin
  select slack_webhook_url_secret_id into v_existing
    from notification_configs where tenant_id = p_tenant_id;

  if v_existing is not null then
    -- Update existing secret in-place.
    perform vault.update_secret(v_existing, p_url);
  else
    -- Create a new secret and store its id.
    v_secret_id := vault.create_secret(
      p_url,
      'slack_webhook_url_' || p_tenant_id::text,
      'Slack webhook URL for tenant ' || p_tenant_id::text
    );

    -- Ensure row exists before updating
    insert into notification_configs (tenant_id, slack_webhook_url_secret_id)
    values (p_tenant_id, v_secret_id)
    on conflict (tenant_id) do update
    set slack_webhook_url_secret_id = excluded.slack_webhook_url_secret_id;
  end if;
end;
$$;

-- Retrieves the decrypted Slack webhook URL for a tenant.
-- Only callable by service role (server-side).
create or replace function get_tenant_slack_webhook_url(
  p_tenant_id uuid
) returns text language plpgsql security definer as $$
declare
  v_secret_id uuid;
  v_url       text;
begin
  select slack_webhook_url_secret_id into v_secret_id
    from notification_configs where tenant_id = p_tenant_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where id = v_secret_id;

  return v_url;
end;
$$;
