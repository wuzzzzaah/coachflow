'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { Users, Timer, Map, CheckCircle } from 'lucide-react';

interface Stats {
  totalUsers: number;
  activeSessions: number;
  totalJourneys: number;
  avgCompletionRate: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

        const [completionRes, healthRes, journeysRes] = await Promise.all([
          apiFetch(`/api/analytics/completion?tenantId=${tenantId}`),
          apiFetch('/health'),
          apiFetch(`/api/journeys?tenantId=${tenantId}`)
        ]);

        const completionData = completionRes.ok ? await completionRes.json() : { total_users: 0, completion_rate_pct: 0 };
        const healthData = healthRes.ok ? await healthRes.json() : { activeSessions: 0 };
        const journeysData = journeysRes.ok ? await journeysRes.json() : [];

        setStats({
          totalUsers: completionData.total_users || 0,
          activeSessions: healthData.activeSessions || 0,
          totalJourneys: journeysData.length || 0,
          avgCompletionRate: completionData.completion_rate_pct || 0,
        });
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const cards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Active Sessions',
      value: stats?.activeSessions ?? 0,
      icon: Timer,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Total Journeys',
      value: stats?.totalJourneys ?? 0,
      icon: Map,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Avg Completion Rate',
      value: `${stats?.avgCompletionRate ?? 0}%`,
      icon: CheckCircle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 w-24 bg-zinc-100 rounded"></div>
                <div className="h-10 w-10 bg-zinc-50 rounded-lg"></div>
              </div>
              <div className="h-8 w-16 bg-zinc-100 rounded"></div>
            </div>
          ))
        ) : (
          cards.map((card) => (
            <div key={card.title} className="bg-white p-6 rounded-xl shadow-sm border border-zinc-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-zinc-500">{card.title}</span>
                <div className={`${card.bg} p-2 rounded-lg`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900">{card.value}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
