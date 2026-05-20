import { supabase } from './supabaseClient';
import { Cohort, CohortMember } from '@coachflow/shared';

export async function listCohorts(tenantId: string) {
  const db = supabase();
  const { data, error } = await db
    .from('cohorts')
    .select('*, journeys(title)')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`List cohorts failed: ${error.message}`);

  // Get member counts and progress for each cohort
  const cohortIds = data.map(c => c.id);
  if (cohortIds.length === 0) return [];

  const result = [];
  for (const cohort of data) {
    const progress = await getCohortProgress(cohort.id, tenantId);
    const memberCount = progress.length;
    const avgProgress = memberCount > 0
      ? progress.reduce((acc, curr) => acc + (curr.completed_steps / (curr.total_steps || 1)), 0) / memberCount
      : 0;

    result.push({
      ...cohort,
      journey_title: cohort.journeys?.title,
      member_count: memberCount,
      avg_progress: Math.round(avgProgress * 100)
    });
  }

  return result;
}

export async function getCohort(cohortId: string, tenantId: string) {
  const db = supabase();
  const { data, error } = await db
    .from('cohorts')
    .select('*, journeys(title)')
    .eq('id', cohortId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Get cohort failed: ${error.message}`);
  return data;
}

export async function createCohort(
  tenantId: string,
  name: string,
  journeyId: string,
  startsAt?: string,
  endsAt?: string
) {
  const db = supabase();
  const { data, error } = await db
    .from('cohorts')
    .insert({
      tenant_id: tenantId,
      name,
      journey_id: journeyId,
      starts_at: startsAt || null,
      ends_at: endsAt || null
    })
    .select()
    .single();

  if (error) throw new Error(`Create cohort failed: ${error.message}`);
  return data;
}

export async function deleteCohort(cohortId: string, tenantId: string) {
  const db = supabase();
  const { error } = await db
    .from('cohorts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', cohortId)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(`Delete cohort failed: ${error.message}`);
}

export async function addCohortMembers(cohortId: string, userIds: string[]) {
  const db = supabase();
  const inserts = userIds.map(userId => ({
    cohort_id: cohortId,
    user_id: userId
  }));

  const { error } = await db
    .from('cohort_members')
    .insert(inserts);

  if (error) throw new Error(`Add cohort members failed: ${error.message}`);
}

export async function removeCohortMember(cohortId: string, userId: string) {
  const db = supabase();
  const { error } = await db
    .from('cohort_members')
    .delete()
    .eq('cohort_id', cohortId)
    .eq('user_id', userId);

  if (error) throw new Error(`Remove cohort member failed: ${error.message}`);
}

export async function getCohortProgress(cohortId: string, tenantId: string) {
  const db = supabase();

  // 1. Get cohort details
  const { data: cohort, error: cohortError } = await db
    .from('cohorts')
    .select('journey_id')
    .eq('id', cohortId)
    .eq('tenant_id', tenantId)
    .single();

  if (cohortError) throw new Error(`Get cohort details failed: ${cohortError.message}`);

  // 2. Get cohort members with user details
  const { data: members, error: membersError } = await db
    .from('cohort_members')
    .select('user_id, users(display_name, whatsapp_number)')
    .eq('cohort_id', cohortId);

  if (membersError) throw new Error(`Get cohort members failed: ${membersError.message}`);

  if (members.length === 0) return [];

  // 3. Get total steps for the journey
  const { data: steps, error: stepsError } = await db
    .from('journey_steps')
    .select('id')
    .eq('journey_id', cohort.journey_id)
    .is('deleted_at', null);

  if (stepsError) throw new Error(`Get journey steps failed: ${stepsError.message}`);
  const totalSteps = steps.length;

  // 4. Get completed sessions for these users in this journey
  const userIds = members.map(m => m.user_id);
  const { data: sessions, error: sessionsError } = await db
    .from('sessions')
    .select('user_id, step_id, started_at, ended_at')
    .in('user_id', userIds)
    .eq('journey_id', cohort.journey_id);

  if (sessionsError) throw new Error(`Get sessions failed: ${sessionsError.message}`);

  // 5. Calculate progress per user
  return members.map((member: any) => {
    const userSessions = sessions.filter(s => s.user_id === member.user_id);
    const completedStepIds = new Set(
      userSessions
        .filter(s => s.ended_at !== null)
        .map(s => s.step_id)
        .filter(Boolean)
    );

    const sortedSessions = [...userSessions].sort((a, b) => {
      const timeA = new Date(a.ended_at || a.started_at).getTime();
      const timeB = new Date(b.ended_at || b.started_at).getTime();
      return timeB - timeA;
    });
    const lastActivity = sortedSessions.length > 0 ? (sortedSessions[0].ended_at || sortedSessions[0].started_at) : null;

    return {
      user_id: member.user_id,
      display_name: member.users?.display_name,
      whatsapp_number: member.users?.whatsapp_number,
      completed_steps: completedStepIds.size,
      total_steps: totalSteps,
      last_active_at: lastActivity
    };
  });
}
