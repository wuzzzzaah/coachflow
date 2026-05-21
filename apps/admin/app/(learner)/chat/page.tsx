'use client';

import React, { useEffect, useState } from 'react';
import { JourneyRow } from '@coachflow/shared';
import { apiFetch } from '@/lib/api';
import JourneyPicker from './_components/JourneyPicker';

export default function ChatPage() {
  const [journeys, setJourneys] = useState<JourneyRow[]>([]);
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    async function init() {
      // In a real app, these would come from auth/context
      const tId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'default-tenant';
      setTenantId(tId);

      try {
        const [jRes, uRes] = await Promise.all([
          apiFetch(`/api/journeys?tenantId=${tId}`),
          apiFetch(`/api/users/me?tenantId=${tId}`) // Assuming an endpoint to get current user
        ]);

        if (jRes.ok) {
          const data = await jRes.json();
          setJourneys(data);
        }

        if (uRes.ok) {
          const user = await uRes.json();
          setUserId(user.id);
          setActiveJourneyId(user.current_journey_id);
        } else {
          // Fallback for demo/dev
          setUserId('demo-user');
        }
      } catch (err) {
        console.error('Failed to initialize chat:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  if (!activeJourneyId) {
    return (
      <JourneyPicker
        userId={userId}
        tenantId={tenantId}
        journeys={journeys}
        onEnrolled={() => {
          // In a real app, we might poll or wait for a webhook/message
          // For now, we'll just toggle the state to show "ChatWindow" would take over
          setActiveJourneyId('enrolled');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full items-center justify-center text-gray-500">
      <p>ChatWindow would be here.</p>
      <p className="text-sm mt-2">Active Journey: {activeJourneyId}</p>
    </div>
  );
}
