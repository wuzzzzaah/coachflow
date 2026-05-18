import { supabase } from './supabaseClient';
import { Tenant } from '@coachflow/shared';

export async function getTenantByPhoneNumberId(phoneNumberId: string): Promise<Tenant | null> {
  const db = supabase();
  const { data, error } = await db
    .from('tenants')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();
  if (error) throw new Error(`Get tenant by phone_number_id failed: ${error.message}`);
  return (data as Tenant) ?? null;
}

export async function getTenantWhatsAppToken(tenantId: string): Promise<string | null> {
  const db = supabase();
  const { data, error } = await db.rpc('get_tenant_whatsapp_token', { p_tenant_id: tenantId });
  if (error) throw new Error(`Get tenant WhatsApp token failed: ${error.message}`);
  return data as string | null;
}

export async function getTenantPromptOverrides(tenantId: string): Promise<Record<string, string>> {
  const db = supabase();
  const { data, error } = await db
    .from('tenant_prompts')
    .select('prompt_key, content')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(`Get tenant prompt overrides failed: ${error.message}`);
  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    result[(row as { prompt_key: string; content: string }).prompt_key] = (
      row as { prompt_key: string; content: string }
    ).content;
  }
  return result;
}
