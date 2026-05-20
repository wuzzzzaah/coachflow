'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../../../lib/api';
import { JourneyRow, Cohort } from '@coachflow/shared';
import { ChevronDown, BarChart3, Table as TableIcon, Send, Loader2, Users } from 'lucide-react';

interface FunnelStep {
  step_index: number;
  title: string;
  users_reached: number;
  users_completed: number;
}

interface ScoreDist {
  dimension: string;
  avg_score: number;
  min_score: number;
  max_score: number;
  p25_score: number;
  p75_score: number;
  count: number;
}

const DATE_RANGES = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

export default function AnalyticsPage() {
  const [journeys, setJourneys] = useState<JourneyRow[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('30d');

  const [cohorts, setCohorts] = useState<any[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [cohortAnalytics, setCohortAnalytics] = useState<any>(null);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [loadingCohortData, setLoadingCohortData] = useState(false);

  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [scoreData, setScoreData] = useState<ScoreDist[]>([]);

  const [loadingJourneys, setLoadingJourneys] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ sent: number; skipped: number } | null>(null);

  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  // Initial fetch: journeys
  useEffect(() => {
    async function fetchJourneys() {
      try {
        const res = await apiFetch(`/api/journeys?tenantId=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setJourneys(data);
          if (data.length > 0) {
            setSelectedJourneyId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch journeys:', err);
      } finally {
        setLoadingJourneys(false);
      }
    }

    async function fetchCohorts() {
      try {
        const res = await apiFetch(`/api/cohorts?tenantId=${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          setCohorts(data);
        }
      } catch (err) {
        console.error('Failed to fetch cohorts:', err);
      } finally {
        setLoadingCohorts(false);
      }
    }

    fetchJourneys();
    fetchCohorts();
  }, [tenantId]);

  // Fetch cohort analytics when selection changes
  useEffect(() => {
    if (!selectedCohortId) {
      setCohortAnalytics(null);
      return;
    }

    async function fetchCohortData() {
      setLoadingCohortData(true);
      try {
        const res = await apiFetch(`/api/cohorts/${selectedCohortId}/analytics?tenantId=${tenantId}`);
        if (res.ok) {
          setCohortAnalytics(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch cohort analytics:', err);
      } finally {
        setLoadingCohortData(false);
      }
    }

    fetchCohortData();
  }, [selectedCohortId, tenantId]);

  // Fetch funnel and score data when selection changes
  useEffect(() => {
    if (!selectedJourneyId) return;

    async function fetchData() {
      setLoadingData(true);
      try {
        let since = '';
        if (dateRange !== 'all') {
          const days = parseInt(dateRange);
          const date = new Date();
          date.setDate(date.getDate() - days);
          since = date.toISOString();
        }

        const [funnelRes, scoreRes] = await Promise.all([
          apiFetch(`/api/analytics/funnel?tenantId=${tenantId}&journeyId=${selectedJourneyId}${since ? `&since=${since}` : ''}`),
          apiFetch(`/api/analytics/scores?tenantId=${tenantId}&journeyId=${selectedJourneyId}${since ? `&since=${since}` : ''}`),
        ]);

        if (funnelRes.ok) setFunnelData(await funnelRes.json());
        if (scoreRes.ok) setScoreData(await scoreRes.json());
      } catch (err) {
        console.error('Failed to fetch analytics data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [selectedJourneyId, dateRange, tenantId]);

  const maxReached = useMemo(() => {
    if (funnelData.length === 0) return 0;
    return funnelData[0].users_reached; // Step 1 is the baseline
  }, [funnelData]);

  const handleSendReminders = async () => {
    if (!confirm('Are you sure you want to send re-engagement reminders to all idle users?')) return;

    setSendingReminders(true);
    setReminderResult(null);
    try {
      const res = await apiFetch(`/api/reminders/send?tenantId=${tenantId}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setReminderResult(data);
        setTimeout(() => setReminderResult(null), 5000);
      } else {
        const err = await res.json();
        alert(`Failed to send reminders: ${err.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Failed to send reminders:', err);
      alert('An unexpected error occurred while sending reminders.');
    } finally {
      setSendingReminders(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          {reminderResult && (
            <p className="text-sm text-green-600 mt-1 animate-pulse">
              Successfully sent {reminderResult.sent} reminders ({reminderResult.skipped} skipped).
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Send Reminders Button */}
          <button
            onClick={handleSendReminders}
            disabled={sendingReminders}
            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingReminders ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Reminders
          </button>

          {/* Journey Selector */}
          <div className="relative">
            <select
              value={selectedJourneyId}
              onChange={(e) => setSelectedJourneyId(e.target.value)}
              disabled={loadingJourneys}
              className="appearance-none bg-white border border-zinc-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              {loadingJourneys ? (
                <option>Loading journeys...</option>
              ) : journeys.length === 0 ? (
                <option>No journeys found</option>
              ) : (
                journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="appearance-none bg-white border border-zinc-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {DATE_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Step Funnel Chart */}
        <section className="bg-white rounded-xl shadow-sm border border-zinc-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Completion Funnel</h2>
          </div>

          {loadingData ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 w-full bg-zinc-50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : funnelData.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">No funnel data available for this selection.</div>
          ) : (
            <div className="space-y-6">
              {funnelData.map((step) => {
                const percentage = maxReached > 0 ? (step.users_reached / maxReached) * 100 : 0;
                return (
                  <div key={step.step_index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-zinc-700">
                        {step.step_index + 1}. {step.title}
                      </span>
                      <span className="text-zinc-500">
                        {step.users_reached} reached ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="h-8 w-full bg-zinc-50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Score Distribution Table */}
        <section className="bg-white rounded-xl shadow-sm border border-zinc-100 p-6 overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <TableIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Score Distribution</h2>
          </div>

          {loadingData ? (
            <div className="space-y-4">
              <div className="h-10 w-full bg-zinc-100 animate-pulse rounded" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 w-full bg-zinc-50 animate-pulse rounded" />
              ))}
            </div>
          ) : scoreData.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">No score data available for this selection.</div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-y border-zinc-100">
                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Dimension</th>
                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Mean</th>
                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Min</th>
                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">P25</th>
                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">P75</th>
                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Max</th>
                    <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {scoreData.map((row) => (
                    <tr key={row.dimension} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-zinc-900">{row.dimension}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600 text-right font-semibold">{row.avg_score}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500 text-right">{row.min_score}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500 text-right">{row.p25_score}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500 text-right">{row.p75_score}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500 text-right">{row.max_score}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400 text-right">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Cohort Analytics Section */}
        <section className="pt-8 border-t border-zinc-200">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-zinc-600" />
              <h2 className="text-lg font-semibold">By Cohort</h2>
            </div>

            <div className="relative">
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                disabled={loadingCohorts}
                className="appearance-none bg-white border border-zinc-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Select a cohort...</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {loadingCohortData ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-zinc-100 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-zinc-400" />
              <p className="text-sm text-zinc-500 font-medium">Loading cohort analytics...</p>
            </div>
          ) : !selectedCohortId ? (
            <div className="py-12 text-center text-zinc-500 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
              Select a cohort to view detailed analytics.
            </div>
          ) : cohortAnalytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Completion Summary</h3>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-bold text-zinc-900">
                    {cohortAnalytics.completionRate.completedMembers} / {cohortAnalytics.completionRate.totalMembers}
                  </span>
                  <span className="text-sm font-medium text-zinc-500">completed</span>
                </div>
                <div className="w-full bg-zinc-50 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className="bg-green-500 h-full transition-all duration-500"
                    style={{ width: `${cohortAnalytics.completionRate.completionRate}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-500">{cohortAnalytics.completionRate.completionRate}% completion rate</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-6">Score Distribution</h3>
                <div className="flex items-end space-x-2 h-24">
                  {cohortAnalytics.scoreDistribution.map((item: any) => {
                    const maxCount = Math.max(...cohortAnalytics.scoreDistribution.map((i: any) => i.count));
                    const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={item.range} className="flex-1 flex flex-col items-center">
                        <div className="w-full bg-zinc-100 rounded-t-sm h-full relative flex items-end">
                          <div
                            className="w-full bg-zinc-900 rounded-t-sm transition-all duration-500"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-400 mt-2">{item.range}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
