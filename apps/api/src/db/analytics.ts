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
