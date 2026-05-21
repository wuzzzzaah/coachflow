'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../../../lib/api';
import { JourneyRow } from '@coachflow/shared';
import { BarChart3, ChevronDown, Loader2 } from 'lucide-react';

interface DropOffStep {
  stepIndex: number;
  reached: number;
  dropped: number;
  dropRate: number;
}

export function DropOffFunnel() {
  const [journeys, setJourneys] = useState<JourneyRow[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [data, setData] = useState<DropOffStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  useEffect(() => {
    async function fetchJourneys() {
      try {
        const res = await apiFetch(`/api/journeys?tenantId=${tenantId}`);
        if (res.ok) {
          const journeysData = await res.json();
          setJourneys(journeysData);
          if (journeysData.length > 0) {
            setSelectedJourneyId(journeysData[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch journeys:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchJourneys();
  }, [tenantId]);

  useEffect(() => {
    if (!selectedJourneyId) return;

    async function fetchDropOff() {
      setLoadingMetrics(true);
      try {
        const res = await apiFetch(`/api/metrics/dropoff/${selectedJourneyId}?tenantId=${tenantId}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch drop-off metrics:', err);
      } finally {
        setLoadingMetrics(false);
      }
    }
    fetchDropOff();
    const interval = setInterval(fetchDropOff, 30000);
    return () => clearInterval(interval);
  }, [selectedJourneyId, tenantId]);

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-xl border border-zinc-100 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-4" />
        <p className="text-sm text-zinc-500 font-medium">Loading journeys...</p>
      </div>
    );
  }

  const maxReached = data.length > 0 ? Math.max(...data.map(d => d.reached)) : 0;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-zinc-100 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Drop-off Funnel</h2>
        </div>

        <div className="relative">
          <select
            value={selectedJourneyId}
            onChange={(e) => setSelectedJourneyId(e.target.value)}
            className="appearance-none bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        </div>
      </div>

      {loadingMetrics && data.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full bg-zinc-50 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="py-12 text-center text-zinc-500">No data available for this journey.</div>
      ) : (
        <div className="space-y-6">
          {data.map((step) => {
            const percentage = maxReached > 0 ? (step.reached / maxReached) * 100 : 0;
            return (
              <div key={step.stepIndex} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-zinc-700">
                    Step {step.stepIndex + 1}
                  </span>
                  <span className="text-zinc-500">
                    {step.reached} users reached ({step.dropRate}% drop rate)
                  </span>
                </div>
                <div className="h-8 w-full bg-zinc-50 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                  {step.dropRate > 20 && (
                    <div
                      className="absolute top-0 bottom-0 bg-red-400/20"
                      style={{
                        left: `${percentage}%`,
                        width: `${(step.dropped / maxReached) * 100}%`
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
