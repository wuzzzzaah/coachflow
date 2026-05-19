import React from 'react';
import { apiFetch } from '../../../lib/api';
import { JourneyRow } from '@coachflow/shared';
import JourneysClientPage from './_components/JourneysClientPage';

// We must provide an async parameter object for Page components in Next.js 15+
export default async function JourneysPage({ searchParams }: { searchParams: Promise<{ tenantId?: string }> }) {
  const params = await searchParams;
  const tenantId = params.tenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  const res = await apiFetch(`/api/journeys?tenantId=${tenantId}`);
  let journeys: JourneyRow[] = [];

  if (res.ok) {
    journeys = await res.json();
  } else {
    console.error('Failed to fetch journeys');
  }

  return (
    <JourneysClientPage initialJourneys={journeys} tenantId={tenantId} />
  );
}
