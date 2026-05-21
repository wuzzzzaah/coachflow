'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../../../lib/api';
import { Activity, Clock, Loader2 } from 'lucide-react';

export function LiveMetrics() {
  const [data, setData] = useState<{ activeSessions: number; stuckUsers: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  const fetchData = async () => {
    try {
      const res = await apiFetch(`/api/metrics/live?tenantId=${tenantId}`);
      if (res.ok) {
        setData(await res.json());
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch live metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  if (loading && !data) {
    return (
      <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-500">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Active Sessions</span>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-400">
              <Clock className="w-3 h-3" />
              <span>{lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
        <div className="text-4xl font-bold text-zinc-900">{data?.activeSessions ?? 0}</div>
        <p className="text-xs text-zinc-500 mt-2">Users active in the last 30 minutes</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-500">
            <Activity className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Stuck Users</span>
          </div>
        </div>
        <div className="text-4xl font-bold text-zinc-900">{data?.stuckUsers ?? 0}</div>
        <p className="text-xs text-zinc-500 mt-2">Users idle for more than 24 hours</p>
      </div>
    </div>
  );
}
