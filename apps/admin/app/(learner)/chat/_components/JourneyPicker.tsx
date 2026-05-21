'use client';

import React from 'react';
import { JourneyRow } from '@coachflow/shared';
import { enrollInJourney } from '../actions';

interface JourneyPickerProps {
  userId: string;
  tenantId: string;
  journeys: JourneyRow[];
  onEnrolled: () => void;
}

export default function JourneyPicker({ userId, tenantId, journeys, onEnrolled }: JourneyPickerProps) {
  const [isPending, setIsPending] = React.useState(false);

  const handleEnroll = async (journeyId: string) => {
    setIsPending(true);
    try {
      await enrollInJourney(userId, tenantId, journeyId);
      onEnrolled();
    } catch (err) {
      console.error('Enrollment failed:', err);
      alert('Failed to start journey. Please try again.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Welcome to your AI leadership coach</h2>
      <p className="text-gray-600 mb-8">Choose a journey below to begin. Each journey is designed to help you develop specific leadership skills.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {journeys.map((journey) => (
          <div
            key={journey.id}
            className="border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
          >
            <h3 className="text-xl font-semibold mb-2">{journey.title}</h3>
            <p className="text-gray-600 mb-4 flex-grow">{journey.description}</p>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-sm font-medium text-gray-500">
                ⏱️ {journey.estimated_minutes} mins
              </span>
              <button
                onClick={() => handleEnroll(journey.id)}
                disabled={isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Starting...' : 'Start Journey'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {journeys.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No journeys are currently available for selection.
        </div>
      )}
    </div>
  );
}
