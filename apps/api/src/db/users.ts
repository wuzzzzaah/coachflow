import { supabase } from './supabaseClient';
import { UserRecord } from '@coachflow/shared';

/**
 * Find a user by their WhatsApp number, or create one if not present.
 * Returns the user record and a boolean indicating whether it was just created.
 */
export async function upsertUser(
  whatsappNumber: string,
  displayName?: string,
): Promise<{ user: UserRecord; created: boolean }> {
  const db = supabase();
  const existing = await db
    .from('users')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Lookup user failed: ${existing.error.message}`);
  }
  if (existing.data) {
    return { user: existing.data as UserRecord, created: false };
  }

  const insert = await db
    .from('users')
    .insert({ whatsapp_number: whatsappNumber, display_name: displayName ?? null })
    .select('*')
    .single();
  if (insert.error) {
    throw new Error(`Create user failed: ${insert.error.message}`);
  }
  return { user: insert.data as UserRecord, created: true };
}

/** Update the current journey/step pointers on the user record. */
export async function updateUserProgress(
  userId: string,
  journeyId: string | null,
  stepIndex: number,
): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('users')
    .update({
      current_journey_id: journeyId,
      current_step_index: stepIndex,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw new Error(`Update user progress failed: ${error.message}`);
}

/** Mark a user as onboarded (first time they interact). */
export async function markOnboarded(userId: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('users')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(`Mark onboarded failed: ${error.message}`);
}

/**
 * Atomically claim a Meta message ID for processing.
 * Returns true if this is the first time we've seen it, false if duplicate.
 */
export async function claimMessage(whatsappMessageId: string): Promise<boolean> {
  const db = supabase();
  const { error } = await db
    .from('processed_messages')
    .insert({ whatsapp_message_id: whatsappMessageId });
  if (!error) return true;
  // Postgres unique-violation code is 23505
  if (error.code === '23505') return false;
  throw new Error(`Claim message failed: ${error.message}`);
}

export async function getUserByNumber(whatsappNumber: string): Promise<UserRecord | null> {
  const db = supabase();
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .maybeSingle();
  if (error) throw new Error(`Get user failed: ${error.message}`);
  return (data as UserRecord) ?? null;
}
