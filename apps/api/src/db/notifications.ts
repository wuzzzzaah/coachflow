import { supabase } from './supabaseClient';
import { NotificationConfig } from '@coachflow/shared';

export async function getNotificationConfig(tenantId: string): Promise<NotificationConfig | null> {
  const db = supabase();
  const { data, error } = await db
    .from('notification_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw new Error(`Get notification config failed: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    email_to: data.email_to,
    notify_journey_complete: data.notify_journey_complete,
    notify_low_score: data.notify_low_score,
    low_score_threshold: Number(data.low_score_threshold),
    notify_idle_user: data.notify_idle_user,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function getResendApiKey(tenantId: string): Promise<string | null> {
  const db = supabase();
  const { data, error } = await db.rpc('get_tenant_resend_api_key', { p_tenant_id: tenantId });
  if (error) throw new Error(`Get Resend API key failed: ${error.message}`);
  return data as string | null;
}

export async function upsertNotificationConfig(
  tenantId: string,
  config: Partial<NotificationConfig>
): Promise<NotificationConfig> {
  const db = supabase();

  // Handle the Resend API key separately via Vault RPC if provided
  if (config.resend_api_key) {
    const { error: rpcError } = await db.rpc('set_tenant_resend_api_key', {
      p_tenant_id: tenantId,
      p_api_key: config.resend_api_key,
    });
    if (rpcError) throw new Error(`Set Resend API key failed: ${rpcError.message}`);
  }

  // Upsert the rest of the config. We use a surgical update or insert to avoid
  // wiping out the resend_api_key_secret_id.
  const { resend_api_key, id, created_at, ...rest } = config;
  const payload = {
    ...rest,
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await db
    .from('notification_configs')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  let result;
  if (existing) {
    const { data, error } = await db
      .from('notification_configs')
      .update(payload)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new Error(`Update notification config failed: ${error.message}`);
    result = data;
  } else {
    const { data, error } = await db
      .from('notification_configs')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(`Insert notification config failed: ${error.message}`);
    result = data;
  }

  return {
    id: result.id,
    tenant_id: result.tenant_id,
    email_to: result.email_to,
    notify_journey_complete: result.notify_journey_complete,
    notify_low_score: result.notify_low_score,
    low_score_threshold: Number(result.low_score_threshold),
    notify_idle_user: result.notify_idle_user,
    created_at: result.created_at,
    updated_at: result.updated_at,
  };
}
