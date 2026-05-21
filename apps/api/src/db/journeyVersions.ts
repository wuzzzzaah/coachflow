import crypto from 'node:crypto';
import { supabase } from './supabaseClient';
import { JourneyRow, JourneyStepRow } from '@coachflow/shared';

/**
 * Creates a snapshot of a journey and its steps.
 * Pins it to parent_journey_id, increments version, sets status to 'draft'.
 */
export async function snapshotJourney(tenantId: string, journeyId: string): Promise<string> {
  const db = supabase();

  // 1. Fetch source journey
  const { data: sourceJourney, error: jErr } = await db
    .from('journeys')
    .select('*')
    .eq('id', journeyId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (jErr || !sourceJourney) {
    throw new Error(`Source journey not found for snapshot: ${jErr?.message || 'unknown'}`);
  }

  // 2. Fetch source steps
  const { data: sourceSteps, error: sErr } = await db
    .from('journey_steps')
    .select('*')
    .eq('journey_id', journeyId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (sErr) {
    throw new Error(`Source steps not found for snapshot: ${sErr.message}`);
  }

  const snapshotId = crypto.randomUUID();

  // 3. Insert snapshot journey
  const { error: njErr } = await db
    .from('journeys')
    .insert({
      ...sourceJourney,
      id: snapshotId,
      parent_journey_id: journeyId,
      version_number: (sourceJourney.version_number || 1),
      status: 'draft',
      is_template: false,
      created_at: new Date().toISOString(),
    });

  if (njErr) {
    throw new Error(`Create snapshot journey failed: ${njErr.message}`);
  }

  // 4. Insert snapshot steps
  if (sourceSteps && sourceSteps.length > 0) {
    const newSteps = (sourceSteps as JourneyStepRow[]).map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      journey_id: snapshotId,
    }));

    const { error: nsErr } = await db.from('journey_steps').insert(newSteps);
    if (nsErr) {
      throw new Error(`Create snapshot steps failed: ${nsErr.message}`);
    }
  }

  // 5. Increment version of the original journey
  await db
    .from('journeys')
    .update({ version_number: (sourceJourney.version_number || 1) + 1 })
    .eq('id', journeyId);

  return snapshotId;
}

/**
 * Returns the correct journey ID for a user.
 * If they are pinned to a version, returns that version's ID.
 */
export async function getActiveVersionForUser(
  userId: string,
  journeyId: string,
  tenantId: string,
): Promise<string> {
  const db = supabase();
  const { data, error } = await db
    .from('user_journeys')
    .select('journey_version_id')
    .eq('user_id', userId)
    .eq('journey_id', journeyId)
    .eq('tenant_id', tenantId)
    .is('completed_at', null)
    .maybeSingle();

  if (error || !data?.journey_version_id) {
    return journeyId;
  }
  return data.journey_version_id;
}

/**
 * Lists all snapshots (versions) of a journey.
 */
export async function listJourneyVersions(tenantId: string, journeyId: string) {
  const db = supabase();

  // Get snapshots
  const { data: snapshots, error } = await db
    .from('journeys')
    .select('id, version_number, created_at')
    .eq('parent_journey_id', journeyId)
    .eq('tenant_id', tenantId)
    .order('version_number', { ascending: false });

  if (error) throw new Error(`List journey versions failed: ${error.message}`);

  // Get active user counts for each snapshot
  const snapshotIds = (snapshots || []).map(s => s.id);
  const { data: counts, error: cErr } = await db
    .from('user_journeys')
    .select('journey_version_id')
    .in('journey_version_id', snapshotIds)
    .is('completed_at', null);

  if (cErr) throw new Error(`Get version user counts failed: ${cErr.message}`);

  const countsMap: Record<string, number> = {};
  for (const c of (counts || [])) {
    if (c.journey_version_id) {
      countsMap[c.journey_version_id] = (countsMap[c.journey_version_id] || 0) + 1;
    }
  }

  return (snapshots || []).map(s => ({
    ...s,
    active_users: countsMap[s.id] || 0,
  }));
}

/**
 * Returns count of active users currently on the main version of the journey.
 */
export async function getActiveUserCount(tenantId: string, journeyId: string): Promise<number> {
  const db = supabase();
  const { count, error } = await db
    .from('user_journeys')
    .select('*', { count: 'exact', head: true })
    .eq('journey_id', journeyId)
    .eq('tenant_id', tenantId)
    .is('journey_version_id', null)
    .is('completed_at', null);

  if (error) throw new Error(`Get active user count failed: ${error.message}`);
  return count || 0;
}
