import { supabase } from './supabaseClient';

export async function getCompletionRates(tenantId: string) {
  const db = supabase();

  // Get total users for tenant
  const { count: totalUsers, error: usersErr } = await db
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (usersErr) throw new Error(`Failed to count users: ${usersErr.message}`);

  // Get users who completed at least one journey
  const { data: completedJourneys, error: journeysErr } = await db
    .from('user_journeys')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed');

  if (journeysErr) throw new Error(`Failed to fetch completed journeys: ${journeysErr.message}`);

  const uniqueCompletedUsers = new Set(completedJourneys.map(j => j.user_id)).size;
  const total = totalUsers || 0;
  const completionRatePct = total > 0 ? Math.round((uniqueCompletedUsers / total) * 100) : 0;

  return {
    total_users: total,
    completed_at_least_one_journey: uniqueCompletedUsers,
    completion_rate_pct: completionRatePct,
  };
}

export async function getStepFunnel(tenantId: string, journeyId: string, since?: string) {
  const db = supabase();

  // Get all steps for the journey
  const { data: steps, error: stepsErr } = await db
    .from('journey_steps')
    .select('id, step_index, title')
    .eq('tenant_id', tenantId)
    .eq('journey_id', journeyId)
    .order('step_index', { ascending: true });

  if (stepsErr) throw new Error(`Failed to fetch steps: ${stepsErr.message}`);

  // Get all sessions for this journey
  let query = db
    .from('sessions')
    .select('user_id, step_id, ended_at')
    .eq('tenant_id', tenantId)
    .eq('journey_id', journeyId);

  if (since) {
    query = query.gte('started_at', since);
  }

  const { data: sessions, error: sessionsErr } = await query;

  if (sessionsErr) throw new Error(`Failed to fetch sessions: ${sessionsErr.message}`);

  const funnel = steps.map(step => {
    const stepSessions = sessions.filter(s => s.step_id === step.id);

    // Unique users who reached the step (started a session)
    const reachedUserIds = new Set(stepSessions.map(s => s.user_id));

    // Unique users who completed the step (ended_at is not null)
    const completedUserIds = new Set(
      stepSessions.filter(s => s.ended_at !== null).map(s => s.user_id)
    );

    return {
      step_index: step.step_index,
      title: step.title,
      users_reached: reachedUserIds.size,
      users_completed: completedUserIds.size,
    };
  });

  return funnel;
}

export async function getScoreDistribution(tenantId: string, journeyId?: string, since?: string) {
  const db = supabase();

  let query = db
    .from('scores')
    .select('criteria, created_at')
    .eq('tenant_id', tenantId);

  if (journeyId) {
    query = query.eq('journey_id', journeyId);
  }

  if (since) {
    query = query.gte('created_at', since);
  }

  const { data: scores, error: scoresErr } = await query;

  if (scoresErr) throw new Error(`Failed to fetch scores: ${scoresErr.message}`);

  const distribution = new Map<string, number[]>();

  for (const row of scores) {
    if (row.criteria && Array.isArray(row.criteria)) {
      for (const criteria of row.criteria) {
        if (criteria && typeof criteria.name === 'string' && typeof criteria.score === 'number') {
          const { name, score } = criteria;
          if (!distribution.has(name)) {
            distribution.set(name, []);
          }
          distribution.get(name)!.push(score);
        }
      }
    }
  }

  const calculatePercentile = (values: number[], percentile: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (upper >= sorted.length) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  const result = Array.from(distribution.entries()).map(([dimension, values]) => {
    const sum = values.reduce((a, b) => a + b, 0);
    const count = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
    const p25 = calculatePercentile(values, 25);
    const p75 = calculatePercentile(values, 75);

    return {
      dimension,
      avg_score: avg,
      min_score: min,
      max_score: max,
      p25_score: Number(p25.toFixed(2)),
      p75_score: Number(p75.toFixed(2)),
      count: count,
    };
  });

  // Sort alphabetically by dimension name for consistency
  return result.sort((a, b) => a.dimension.localeCompare(b.dimension));
}

export async function getCohortCompletionRate(tenantId: string, cohortId: string) {
  const db = supabase();

  // 1. Get cohort and journey info
  const { data: cohort, error: cohortErr } = await db
    .from('cohorts')
    .select('name, journey_id, journeys(title)')
    .eq('id', cohortId)
    .eq('tenant_id', tenantId)
    .single();

  if (cohortErr) throw new Error(`Failed to fetch cohort: ${cohortErr.message}`);

  // 2. Get total members
  const { count: totalMembers, error: membersErr } = await db
    .from('cohort_members')
    .select('*', { count: 'exact', head: true })
    .eq('cohort_id', cohortId);

  if (membersErr) throw new Error(`Failed to count cohort members: ${membersErr.message}`);

  // 3. Get members who completed the journey
  const { data: members, error: membersListErr } = await db
    .from('cohort_members')
    .select('user_id')
    .eq('cohort_id', cohortId);

  if (membersListErr) throw new Error(`Failed to list cohort members: ${membersListErr.message}`);

  const userIds = members.map(m => m.user_id);
  if (userIds.length === 0) {
    return {
      cohortId,
      cohortName: cohort.name,
      journeyTitle: (cohort.journeys as any)?.title,
      totalMembers: 0,
      completedMembers: 0,
      completionRate: 0,
    };
  }

  const { count: completedMembers, error: completedErr } = await db
    .from('user_journeys')
    .select('*', { count: 'exact', head: true })
    .eq('journey_id', cohort.journey_id)
    .eq('status', 'completed')
    .in('user_id', userIds);

  if (completedErr) throw new Error(`Failed to count completed members: ${completedErr.message}`);

  const total = totalMembers || 0;
  const completed = completedMembers || 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    cohortId,
    cohortName: cohort.name,
    journeyTitle: (cohort.journeys as any)?.title,
    totalMembers: total,
    completedMembers: completed,
    completionRate,
  };
}

export async function getCohortScoreDistribution(tenantId: string, cohortId: string) {
  const db = supabase();

  // 1. Get cohort and members
  const { data: cohort, error: cohortErr } = await db
    .from('cohorts')
    .select('journey_id')
    .eq('id', cohortId)
    .eq('tenant_id', tenantId)
    .single();

  if (cohortErr) throw new Error(`Failed to fetch cohort: ${cohortErr.message}`);

  const { data: members, error: membersErr } = await db
    .from('cohort_members')
    .select('user_id')
    .eq('cohort_id', cohortId);

  if (membersErr) throw new Error(`Failed to fetch cohort members: ${membersErr.message}`);

  const userIds = members.map(m => m.user_id);
  const buckets = [
    { range: '0-2', count: 0 },
    { range: '3-4', count: 0 },
    { range: '5-6', count: 0 },
    { range: '7-8', count: 0 },
    { range: '9-10', count: 0 },
  ];

  if (userIds.length === 0) return buckets;

  // 2. Get scores for these users in this journey
  const { data: scores, error: scoresErr } = await db
    .from('scores')
    .select('score')
    .eq('journey_id', cohort.journey_id)
    .in('user_id', userIds);

  if (scoresErr) throw new Error(`Failed to fetch scores: ${scoresErr.message}`);

  for (const row of scores) {
    const s = row.score;
    if (s <= 2) buckets[0].count++;
    else if (s <= 4) buckets[1].count++;
    else if (s <= 6) buckets[2].count++;
    else if (s <= 8) buckets[3].count++;
    else buckets[4].count++;
  }

  return buckets;
}

export async function getCohortMemberProgress(tenantId: string, cohortId: string) {
  const db = supabase();

  // 1. Get cohort and journey info
  const { data: cohort, error: cohortErr } = await db
    .from('cohorts')
    .select('journey_id')
    .eq('id', cohortId)
    .eq('tenant_id', tenantId)
    .single();

  if (cohortErr) throw new Error(`Failed to fetch cohort: ${cohortErr.message}`);

  // 2. Get members with user details
  const { data: members, error: membersErr } = await db
    .from('cohort_members')
    .select('user_id, users(whatsapp_number)')
    .eq('cohort_id', cohortId);

  if (membersErr) throw new Error(`Failed to fetch cohort members: ${membersErr.message}`);

  if (members.length === 0) return [];

  const userIds = members.map(m => m.user_id);

  // 3. Get total steps
  const { data: steps, error: stepsErr } = await db
    .from('journey_steps')
    .select('id')
    .eq('journey_id', cohort.journey_id)
    .is('deleted_at', null);

  if (stepsErr) throw new Error(`Failed to fetch journey steps: ${stepsErr.message}`);
  const totalSteps = steps.length;

  // 4. Get completed sessions
  const { data: sessions, error: sessionsErr } = await db
    .from('sessions')
    .select('user_id, step_id, started_at, ended_at')
    .eq('journey_id', cohort.journey_id)
    .in('user_id', userIds);

  if (sessionsErr) throw new Error(`Failed to fetch sessions: ${sessionsErr.message}`);

  // 5. Get scores to calculate average
  const { data: scores, error: scoresErr } = await db
    .from('scores')
    .select('user_id, score')
    .eq('journey_id', cohort.journey_id)
    .in('user_id', userIds);

  if (scoresErr) throw new Error(`Failed to fetch scores: ${scoresErr.message}`);

  // 6. Aggregate results
  const result = members.map((member: any) => {
    const userSessions = sessions.filter(s => s.user_id === member.user_id);
    const completedStepIds = new Set(
      userSessions
        .filter(s => s.ended_at !== null)
        .map(s => s.step_id)
        .filter(Boolean)
    );

    const userScores = scores.filter(s => s.user_id === member.user_id);
    const avgScore = userScores.length > 0
      ? Number((userScores.reduce((acc, s) => acc + s.score, 0) / userScores.length).toFixed(1))
      : 0;

    const sortedSessions = [...userSessions].sort((a, b) => {
      const timeA = new Date(a.ended_at || a.started_at).getTime();
      const timeB = new Date(b.ended_at || b.started_at).getTime();
      return timeB - timeA;
    });
    const lastActiveAt = sortedSessions.length > 0 ? (sortedSessions[0].ended_at || sortedSessions[0].started_at) : null;

    return {
      userId: member.user_id,
      phone: member.users?.whatsapp_number,
      completedSteps: completedStepIds.size,
      totalSteps,
      avgScore,
      lastActiveAt,
    };
  });

  return result.sort((a, b) => b.completedSteps - a.completedSteps);
}
