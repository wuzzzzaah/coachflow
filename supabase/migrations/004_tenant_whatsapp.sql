-- Per-tenant WhatsApp credentials.
-- phone_number_id and webhook_verify_token are stored in plaintext (low-sensitivity).
-- access_token is stored in Supabase Vault (pgsodium) — never appears in the tenants row.

alter table tenants
  add column if not exists phone_number_id       text,
  add column if not exists webhook_verify_token  text;

-- Lookup index: Meta sends phone_number_id on every inbound webhook.
create unique index if not exists idx_tenants_phone_number_id on tenants(phone_number_id)
  where phone_number_id is not null;

-- ── Vault helpers ─────────────────────────────────────────────────────────────
-- Stores the WhatsApp access token for a tenant in Vault and records the secret_id.
-- Call this when provisioning or rotating a tenant's token.
alter table tenants
  add column if not exists whatsapp_token_secret_id uuid;

create or replace function set_tenant_whatsapp_token(
  p_tenant_id uuid,
  p_token     text
) returns void language plpgsql security definer as $$
declare
  v_secret_id uuid;
  v_existing  uuid;
begin
  select whatsapp_token_secret_id into v_existing
    from tenants where id = p_tenant_id;

  if v_existing is not null then
    -- Update existing secret in-place.
    perform vault.update_secret(v_existing, p_token);
  else
    -- Create a new secret and store its id.
    v_secret_id := vault.create_secret(
      p_token,
      'whatsapp_token_' || p_tenant_id::text,
      'WhatsApp access token for tenant ' || p_tenant_id::text
    );
    update tenants set whatsapp_token_secret_id = v_secret_id where id = p_tenant_id;
  end if;
end;
$$;

-- Retrieves the decrypted WhatsApp access token for a tenant.
-- Only callable by service role (server-side); never exposed to client JWTs.
create or replace function get_tenant_whatsapp_token(
  p_tenant_id uuid
) returns text language plpgsql security definer as $$
declare
  v_secret_id uuid;
  v_token     text;
begin
  select whatsapp_token_secret_id into v_secret_id
    from tenants where id = p_tenant_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_token
    from vault.decrypted_secrets where id = v_secret_id;

  return v_token;
end;
$$;
