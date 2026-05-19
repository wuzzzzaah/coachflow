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

export async function listTenants(): Promise<Tenant[]> {
  const db = supabase();
  const { data, error } = await db.from('tenants').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(`List tenants failed: ${error.message}`);
  return data as Tenant[];
}

export async function createTenant(payload: { name: string; phone_number_id?: string; webhook_verify_token?: string }): Promise<Tenant> {
  const db = supabase();
  const { data, error } = await db.from('tenants').insert(payload).select().single();
  if (error) throw new Error(`Create tenant failed: ${error.message}`);
  return data as Tenant;
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const db = supabase();
  const { data, error } = await db.from('tenants').select('*').eq('id', tenantId).maybeSingle();
  if (error) throw new Error(`Get tenant failed: ${error.message}`);
  return data as Tenant | null;
}

export async function updateTenant(tenantId: string, payload: { name?: string; phone_number_id?: string; webhook_verify_token?: string }): Promise<Tenant> {
  const db = supabase();
  const { data, error } = await db.from('tenants').update(payload).eq('id', tenantId).select().single();
  if (error) throw new Error(`Update tenant failed: ${error.message}`);
  return data as Tenant;
}

export async function setTenantWhatsAppToken(tenantId: string, token: string): Promise<void> {
  const db = supabase();
  const { error } = await db.rpc('set_tenant_whatsapp_token', {
    p_tenant_id: tenantId,
    p_token: token,
  });
  if (error) throw new Error(`Set tenant WhatsApp token failed: ${error.message}`);
}

export async function upsertTenantPrompt(tenantId: string, key: string, content: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('tenant_prompts')
    .upsert({ tenant_id: tenantId, prompt_key: key, content }, { onConflict: 'tenant_id, prompt_key' });
  if (error) throw new Error(`Upsert tenant prompt failed: ${error.message}`);
}

export async function deleteTenantPrompt(tenantId: string, key: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('tenant_prompts')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('prompt_key', key);
  if (error) throw new Error(`Delete tenant prompt failed: ${error.message}`);
}
