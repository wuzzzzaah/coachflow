import { supabase } from './supabaseClient';

export interface WebMessageRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  direction: 'inbound' | 'outbound';
  content: any;
  created_at: string;
}

/** Store an outbound message for a web user. */
export async function storeOutboundWebMessage(
  tenantId: string,
  userId: string,
  content: any,
): Promise<void> {
  const db = supabase();
  const { error } = await db.from('web_messages').insert({
    tenant_id: tenantId,
    user_id: userId,
    direction: 'outbound',
    content,
  });

  if (error) {
    throw new Error(`Failed to store outbound web message: ${error.message}`);
  }
}

/** Poll and clear pending outbound messages for a user. */
export async function pollAndClearWebMessages(
  tenantId: string,
  userId: string,
): Promise<WebMessageRecord[]> {
  const db = supabase();

  // Atomically delete and return pending messages
  const { data, error } = await db
    .from('web_messages')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('direction', 'outbound')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to poll web messages: ${error.message}`);
  }

  return (data || []) as WebMessageRecord[];
}
