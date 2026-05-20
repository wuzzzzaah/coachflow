import { supabase } from './supabaseClient';
import { AuditLog } from '@coachflow/shared';

export interface AuditEntry {
  tenantId?: string;
  actorId: string;
  actorEmail?: string;
  action: string;        // '<resource>.<verb>' e.g. 'journey.create'
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('audit_log')
    .insert({
      tenant_id: entry.tenantId,
      actor_id: entry.actorId,
      actor_email: entry.actorEmail,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId,
      metadata: entry.metadata,
    });

  if (error) {
    console.error('[audit_log] failed to write entry:', error);
  }
}

export async function getAuditLog(tenantId: string, limit: number = 50): Promise<AuditLog[]> {
  const db = supabase();
  const { data, error } = await db
    .from('audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch audit log: ${error.message}`);
  }

  return data as AuditLog[];
}
