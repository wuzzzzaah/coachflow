import { supabase } from './supabaseClient';
import { AlertRule } from '@coachflow/shared';

export async function listAlertRules(tenantId: string): Promise<AlertRule[]> {
  const db = supabase();
  const { data, error } = await db
    .from('alert_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`List alert rules failed: ${error.message}`);
  return data as AlertRule[];
}

export async function upsertAlertRule(
  tenantId: string,
  rule: Partial<AlertRule> & { id?: string }
): Promise<AlertRule> {
  const db = supabase();

  if (rule.id) {
    const { data, error } = await db
      .from('alert_rules')
      .update({
        ...rule,
        tenant_id: tenantId,
      })
      .eq('id', rule.id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw new Error(`Update alert rule failed: ${error.message}`);
    return data as AlertRule;
  } else {
    const { data, error } = await db
      .from('alert_rules')
      .insert({
        ...rule,
        tenant_id: tenantId,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Create alert rule failed: ${error.message}`);
    return data as AlertRule;
  }
}

export async function deleteAlertRule(tenantId: string, id: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('alert_rules')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(`Delete alert rule failed: ${error.message}`);
}
