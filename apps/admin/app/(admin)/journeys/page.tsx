import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { JourneyRow } from '@coachflow/shared';
import JourneysClientPage from './_components/JourneysClientPage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// We must provide an async parameter object for Page components in Next.js 15+
export default async function JourneysPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>;
}) {
  const params = await searchParams;
  const tenantId = params.tenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  // Use the server-side Supabase client so we have a valid session token
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

  const [res, templatesRes] = await Promise.all([
    fetch(`${API_URL}/api/journeys?tenantId=${tenantId}&includeAll=true`, { headers }),
    fetch(`${API_URL}/api/templates?tenantId=${tenantId}`, { headers }),
  ]);

  let journeys: JourneyRow[] = [];
  let templates: JourneyRow[] = [];

  if (res.ok) {
    journeys = await res.json();
  } else {
    console.error('Failed to fetch journeys', res.status, await res.text().catch(() => ''));
  }

  if (templatesRes.ok) {
    templates = await templatesRes.json();
  } else {
    console.error('Failed to fetch templates', templatesRes.status);
  }

  return (
    <JourneysClientPage
      initialJourneys={journeys}
      initialTemplates={templates}
      tenantId={tenantId}
    />
  );
}
