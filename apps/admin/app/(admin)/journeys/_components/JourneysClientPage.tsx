'use client';

import React, { useState } from 'react';
import { apiFetch } from '../../../../lib/api';
import { JourneyRow } from '@coachflow/shared';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function JourneysClientPage({ initialJourneys, tenantId }: { initialJourneys: JourneyRow[], tenantId: string }) {
  const [journeys, setJourneys] = useState<JourneyRow[]>(initialJourneys);
  const [showModal, setShowModal] = useState(false);
  const [newJourney, setNewJourney] = useState({ title: '', description: '', estimated_minutes: 0 });
  const router = useRouter();

  const fetchJourneys = async () => {
    try {
      const res = await apiFetch(`/api/journeys?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setJourneys(data);
      } else {
        console.error('Failed to fetch journeys');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`/api/journeys?tenantId=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          title: newJourney.title,
          description: newJourney.description,
          estimated_minutes: newJourney.estimated_minutes
        })
      });

      if (res.ok) {
        setShowModal(false);
        setNewJourney({ title: '', description: '', estimated_minutes: 0 });
        await fetchJourneys();
        router.refresh();
      } else {
        console.error('Failed to create journey');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Journeys</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <Plus size={16} /> New Journey
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Time</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {journeys.map(journey => (
              <tr key={journey.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/journeys/${journey.id}`} className="text-blue-600 hover:underline">{journey.title}</Link>
                </td>
                <td className="px-6 py-4">{journey.description}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{journey.estimated_minutes} min</td>
              </tr>
            ))}
            {journeys.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">No journeys found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Create New Journey</h2>
            <form onSubmit={handleCreateJourney}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newJourney.title}
                  onChange={e => setNewJourney({...newJourney, title: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newJourney.description}
                  onChange={e => setNewJourney({...newJourney, description: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Minutes</label>
                <input
                  type="number"
                  min="0"
                  value={newJourney.estimated_minutes}
                  onChange={e => setNewJourney({...newJourney, estimated_minutes: parseInt(e.target.value) || 0})}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
