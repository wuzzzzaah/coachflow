'use client';

import React, { useEffect, useState } from 'react';
import { JourneyRow } from '@coachflow/shared';
import { apiFetch } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import JourneyPicker from './_components/JourneyPicker';
import ChatWindow from './_components/ChatWindow';

export default function ChatPage() {
  const [journeys, setJourneys] = useState<JourneyRow[]>([]);
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const tId =
        (user.app_metadata?.tenantId as string) ||
        process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ||
        'default';
      setTenantId(tId);
      setUserId(user.id);

      try {
        const [jRes, uRes] = await Promise.all([
          apiFetch(`/api/journeys?tenantId=${tId}`),
          apiFetch(`/api/users/me?tenantId=${tId}`),
        ]);

        if (jRes.ok) {
          setJourneys(await jRes.json());
        }
        if (uRes.ok) {
          const userData = await uRes.json();
          setActiveJourneyId(userData.current_journey_id ?? null);
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
    return (
      <div className="flex items-center justify-center h-full text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!activeJourneyId) {
    return (
      <JourneyPicker
        userId={userId}
        tenantId={tenantId}
        journeys={journeys}
        onEnrolled={() => setActiveJourneyId('enrolled')}
      />
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto border-x border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <ChatWindow userId={userId} tenantId={tenantId} />
    </div>
  );
}
