import { supabase } from './supabaseClient';
import { TenantWebhook } from '@coachflow/shared';

export async function listWebhooks(tenantId: string): Promise<TenantWebhook[]> {
  const db = supabase();
  const { data, error } = await db
    .from('tenant_webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`List webhooks failed: ${error.message}`);
  return data as TenantWebhook[];
}

export async function createWebhook(
  tenantId: string,
  webhook: { url: string; secret: string; events: string[] }
): Promise<TenantWebhook> {
  const db = supabase();
  const { data, error } = await db
    .from('tenant_webhooks')
    .insert({
      tenant_id: tenantId,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Create webhook failed: ${error.message}`);
  return data as TenantWebhook;
}

export async function deleteWebhook(tenantId: string, id: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('tenant_webhooks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(`Delete webhook failed: ${error.message}`);
}

export async function getEnabledWebhooksForEvent(
  tenantId: string,
  event: string
): Promise<TenantWebhook[]> {
  const db = supabase();
  const { data, error } = await db
    .from('tenant_webhooks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .contains('events', [event]);

  if (error) throw new Error(`Get enabled webhooks failed: ${error.message}`);
  return data as TenantWebhook[];
}
