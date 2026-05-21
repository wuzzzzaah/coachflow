import { supabase } from './supabaseClient';
import { writeAuditLog } from './auditLog';
import { UserDataExport, SessionMessage, UserScore, UserProgress } from '@coachflow/shared';
import { getUserProgress } from './users';

/**
 * Anonymize user PII and delete sensitive conversation data.
 */
export async function eraseUser(userId: string, tenantId: string, actorId: string, actorEmail: string): Promise<void> {
  const db = supabase();

  // 1. Verify the user belongs to the tenant
  const { data: user, error: userError } = await db
    .from('users')
    .select('id')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (userError) throw new Error(`Verify user failed: ${userError.message}`);
  if (!user) throw new Error('User not found or does not belong to tenant');

  // 2. Null out personally identifiable fields on the users row
  const { error: updateError } = await db
    .from('users')
    .update({
      whatsapp_number: `[deleted-${userId.slice(0, 8)}]`,
      display_name: '[deleted]',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('tenant_id', tenantId);

  if (updateError) throw new Error(`Anonymize user failed: ${updateError.message}`);

  // 3. Hard-delete messages rows for the user
  const { error: msgError } = await db
    .from('messages')
    .delete()
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (msgError) throw new Error(`Delete messages failed: ${msgError.message}`);

  // 4. Hard-delete reminder_log rows for the user
  const { error: reminderError } = await db
    .from('reminder_log')
    .delete()
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (reminderError) throw new Error(`Delete reminders failed: ${reminderError.message}`);

  // 5. Soft-delete user_journeys rows
  const { error: ujError } = await db
    .from('user_journeys')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (ujError) throw new Error(`Soft-delete user journeys failed: ${ujError.message}`);

  // 6. Write an audit log entry
  await writeAuditLog({
    tenantId,
    actorId,
    actorEmail,
    action: 'user.erase',
    resource: 'user',
    resourceId: userId,
  });
}

/**
 * Export all data stored about a user.
 */
export async function exportUserData(userId: string, tenantId: string): Promise<UserDataExport> {
  const db = supabase();

  // 1. Fetch user metadata
  const { data: user, error: userError } = await db
    .from('users')
    .select('id, whatsapp_number, display_name, created_at')
    .eq('id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (userError) throw new Error(`Fetch user failed: ${userError.message}`);
  if (!user) throw new Error('User not found');

  // 2. Fetch journey progress (using existing helper)
  const journeyProgress = await getUserProgress(tenantId, userId);

  // 3. Fetch session scores
  const { data: scores, error: scoresError } = await db
    .from('scores')
    .select('id, session_id, journey_id, step_id, score, max_score, criteria, feedback, created_at')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (scoresError) throw new Error(`Fetch scores failed: ${scoresError.message}`);

  // 4. Fetch session messages (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: messages, error: messagesError } = await db
    .from('messages')
    .select('id, session_id, role, content, created_at')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  if (messagesError) throw new Error(`Fetch messages failed: ${messagesError.message}`);

  // Group messages by sessionId
  const sessionMessagesMap = new Map<string, SessionMessage[]>();
  (messages || []).forEach((m) => {
    const sessionId = m.session_id;
    if (!sessionMessagesMap.has(sessionId)) {
      sessionMessagesMap.set(sessionId, []);
    }
    sessionMessagesMap.get(sessionId)!.push({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      created_at: m.created_at,
    });
  });

  const sessionMessages = Array.from(sessionMessagesMap.entries()).map(([sessionId, messages]) => ({
    sessionId,
    messages,
  }));

  // 5. Fetch reminders
  const { data: reminders, error: remindersError } = await db
    .from('reminder_log')
    .select('sent_at')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .order('sent_at', { ascending: false });

  if (remindersError) throw new Error(`Fetch reminders failed: ${remindersError.message}`);

  return {
    user: {
      id: user.id,
      whatsapp_number: user.whatsapp_number,
      name: user.display_name,
      created_at: user.created_at,
    },
    journeyProgress,
    sessionScores: (scores || []) as UserScore[],
    sessionMessages,
    reminders: (reminders || []) as { sent_at: string }[],
    exportedAt: new Date().toISOString(),
  };
}
