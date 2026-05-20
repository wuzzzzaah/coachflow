import { supabase } from './supabaseClient';

/**
 * Find users for a tenant who:
 * 1. Have an active journey (current_journey_id IS NOT NULL).
 * 2. Have not sent any messages in the last `idleHours`.
 * 3. Have not received a reminder in the last `reminderCooldownHours`.
 */
export async function getIdleUsers(
  tenantId: string,
  idleHours: number = 48,
  reminderCooldownHours: number = 24,
) {
  const db = supabase();

  const idleThreshold = new Date(Date.now() - idleHours * 60 * 60 * 1000).toISOString();
  const cooldownThreshold = new Date(
    Date.now() - reminderCooldownHours * 60 * 60 * 1000,
  ).toISOString();

  // 1. Find users with an active journey
  const { data: activeUsers, error: usersError } = await db
    .from('users')
    .select('id, whatsapp_number, current_journey_id')
    .eq('tenant_id', tenantId)
    .not('current_journey_id', 'is', null);

  if (usersError) {
    throw new Error(`Failed to fetch active users: ${usersError.message}`);
  }

  if (!activeUsers || activeUsers.length === 0) {
    return [];
  }

  const userIds = activeUsers.map((u) => u.id);

  // 2. Filter out users who had activity (messages) since the idle threshold
  const { data: recentMessages, error: messagesError } = await db
    .from('messages')
    .select('user_id')
    .in('user_id', userIds)
    .gte('created_at', idleThreshold);

  if (messagesError) {
    throw new Error(`Failed to fetch recent messages: ${messagesError.message}`);
  }

  const activeUserIds = new Set(recentMessages.map((m) => m.user_id));
  const candidateUsers = activeUsers.filter((u) => !activeUserIds.has(u.id));

  if (candidateUsers.length === 0) {
    return [];
  }

  const candidateIds = candidateUsers.map((u) => u.id);

  // 3. Filter out users who received a reminder since the cooldown threshold
  const { data: recentReminders, error: remindersError } = await db
    .from('reminder_log')
    .select('user_id')
    .in('user_id', candidateIds)
    .gte('sent_at', cooldownThreshold);

  if (remindersError) {
    throw new Error(`Failed to fetch recent reminders: ${remindersError.message}`);
  }

  const remindedUserIds = new Set(recentReminders.map((r) => r.user_id));
  const idleUsers = candidateUsers.filter((u) => !remindedUserIds.has(u.id));

  // 4. Fetch journey titles for the final list
  const journeyIds = Array.from(new Set(idleUsers.map((u) => u.current_journey_id).filter(Boolean))) as string[];
  if (journeyIds.length === 0) return [];

  const { data: journeys, error: journeysError } = await db
    .from('journeys')
    .select('id, title')
    .in('id', journeyIds);

  if (journeysError) {
    throw new Error(`Failed to fetch journey titles: ${journeysError.message}`);
  }

  const journeyMap = new Map(journeys.map((j) => [j.id, j.title]));

  return idleUsers.map((u) => ({
    id: u.id,
    whatsapp_number: u.whatsapp_number,
    journey_id: u.current_journey_id,
    journey_title: journeyMap.get(u.current_journey_id!) || 'your journey',
  }));
}

/** Log a reminder send event. */
export async function logReminder(tenantId: string, userId: string, type: string = 'nudge') {
  const db = supabase();
  const { error } = await db.from('reminder_log').insert({
    tenant_id: tenantId,
    user_id: userId,
    reminder_type: type,
  });

  if (error) {
    throw new Error(`Failed to log reminder: ${error.message}`);
  }
}
