import { supabase } from './supabaseClient';
import { JourneyRow } from '@coachflow/shared';

export async function getScheduledJourneys(tenantId: string): Promise<JourneyRow[]> {
  const db = supabase();
  const { data, error } = await db
    .from('journeys')
    .select('*')
    .eq('tenant_id', tenantId)
    .neq('schedule_type', 'manual')
    .eq('status', 'published')
    .is('deleted_at', null);

  if (error) throw new Error(`getScheduledJourneys failed: ${error.message}`);
  return (data ?? []) as JourneyRow[];
}

export async function getEnrolledUsers(tenantId: string, journeyId: string) {
  const db = supabase();
  const { data, error } = await db
    .from('user_journeys')
    .select(`
      user_id,
      users!inner (
        id,
        whatsapp_number,
        current_step_index
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('journey_id', journeyId)
    .is('completed_at', null);

  if (error) throw new Error(`getEnrolledUsers failed: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: row.users.id,
    whatsapp_number: row.users.whatsapp_number,
    current_step_index: row.users.current_step_index,
  }));
}

export async function hasDeliveredToday(
  tenantId: string,
  userId: string,
  journeyId: string,
  stepIndex: number,
  scheduleType: 'daily' | 'weekly'
): Promise<boolean> {
  const db = supabase();
  let query = db
    .from('scheduled_deliveries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('journey_id', journeyId)
    .eq('step_index', stepIndex);

  if (scheduleType === 'daily') {
    // Check if delivered in the last 24h
    const dayAgo = new Date();
    dayAgo.setHours(dayAgo.getHours() - 23); // Give some buffer
    query = query.gte('delivered_at', dayAgo.toISOString());
  } else if (scheduleType === 'weekly') {
    // Check if delivered in the last 6 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    query = query.gte('delivered_at', weekAgo.toISOString());
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`hasDeliveredToday failed: ${error.message}`);
  return !!data;
}

export async function logDelivery(
  tenantId: string,
  userId: string,
  journeyId: string,
  stepIndex: number
): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('scheduled_deliveries')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      journey_id: journeyId,
      step_index: stepIndex,
    });

  if (error) throw new Error(`logDelivery failed: ${error.message}`);
}
