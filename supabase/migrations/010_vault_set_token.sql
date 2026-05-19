-- ── Vault helpers (Set) ─────────────────────────────────────────────────────────────
-- Stores the WhatsApp access token for a tenant in Vault and records the secret_id.
-- Call this when provisioning or rotating a tenant's token.

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
