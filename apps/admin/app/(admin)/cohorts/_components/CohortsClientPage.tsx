'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

export default function CohortsClientPage({ initialCohorts, journeys, tenantId }: { initialCohorts: any[], journeys: any[], tenantId: string }) {
  const [cohorts, setCohorts] = useState(initialCohorts);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCohort, setNewCohort] = useState({ name: '', journeyId: '', startsAt: '', endsAt: '' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch('/api/cohorts', {
      method: 'POST',
      body: JSON.stringify({ ...newCohort, tenantId }),
    });

    if (res.ok) {
      const created = await res.json();
      // Refresh list
      const updatedRes = await apiFetch(`/api/cohorts?tenantId=${tenantId}`);
      if (updatedRes.ok) {
        setCohorts(await updatedRes.json());
      }
      setIsModalOpen(false);
      setNewCohort({ name: '', journeyId: '', startsAt: '', endsAt: '' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cohort?')) return;
    const res = await apiFetch(`/api/cohorts/${id}?tenantId=${tenantId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setCohorts(cohorts.filter(c => c.id !== id));
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Cohorts</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors"
        >
          New Cohort
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Journey</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Members</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Avg Progress</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Start / End</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {cohorts.map((cohort) => (
              <tr key={cohort.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/cohorts/${cohort.id}?tenantId=${tenantId}`} className="text-zinc-900 font-medium hover:underline">
                    {cohort.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">{cohort.journey_title}</td>
                <td className="px-6 py-4 text-sm text-zinc-600">{cohort.member_count}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-zinc-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full transition-all"
                        style={{ width: `${cohort.avg_progress || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {cohort.avg_progress || 0}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">
                  {cohort.starts_at ? new Date(cohort.starts_at).toLocaleDateString() : '-'} / {cohort.ends_at ? new Date(cohort.ends_at).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDelete(cohort.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {cohorts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                  No cohorts found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Cohort</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  value={newCohort.name}
                  onChange={e => setNewCohort({ ...newCohort, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Journey</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  value={newCohort.journeyId}
                  onChange={e => setNewCohort({ ...newCohort, journeyId: e.target.value })}
                >
                  <option value="">Select a journey</option>
                  {journeys.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Starts At</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    value={newCohort.startsAt}
                    onChange={e => setNewCohort({ ...newCohort, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Ends At</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    value={newCohort.endsAt}
                    onChange={e => setNewCohort({ ...newCohort, endsAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-zinc-600 hover:text-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800"
                >
                  Create Cohort
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
