'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../../../lib/api';
import { Send, Loader2, AlertCircle } from 'lucide-react';

interface StuckUser {
  userId: string;
  userName: string;
  whatsappNumber: string;
  journeyTitle: string;
  hoursIdle: number;
}

export function StuckUserList() {
  const [users, setUsers] = useState<StuckUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  const fetchStuckUsers = async () => {
    try {
      const res = await apiFetch(`/api/metrics/stuck?tenantId=${tenantId}&threshold=24`);
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch stuck users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStuckUsers();
    const interval = setInterval(fetchStuckUsers, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const handleNudge = async (userId: string) => {
    setNudgingId(userId);
    try {
      const res = await apiFetch(`/api/users/${userId}/nudge?tenantId=${tenantId}`, {
        method: 'POST',
      });
      if (res.ok) {
        // Optimistically remove or refresh
        fetchStuckUsers();
      } else {
        alert('Failed to nudge user.');
      }
    } catch (err) {
      console.error('Nudge failed:', err);
      alert('An error occurred while nudging.');
    } finally {
      setNudgingId(null);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-12 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-4" />
        <p className="text-sm text-zinc-500 font-medium">Monitoring stuck users...</p>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
      <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Stuck Users</h2>
        </div>
        <span className="bg-orange-50 text-orange-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
          {users.length} total
        </span>
      </div>

      {users.length === 0 ? (
        <div className="p-12 text-center text-zinc-500">
          No stuck users detected. All journeys are moving!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Journey</th>
                <th className="px-6 py-3">Idle Time</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user) => (
                <tr key={user.userId} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-zinc-900">{user.userName}</span>
                      <span className="text-xs text-zinc-500">{user.whatsappNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-600">{user.journeyTitle}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-medium border border-orange-100">
                      {user.hoursIdle} hours
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleNudge(user.userId)}
                      disabled={nudgingId === user.userId}
                      className="inline-flex items-center gap-2 text-zinc-900 hover:text-blue-600 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {nudgingId === user.userId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Nudge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
