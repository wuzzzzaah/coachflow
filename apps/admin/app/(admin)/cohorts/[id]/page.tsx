import React from 'react';
import { apiFetch } from '../../../../lib/api';
import CohortDetailClientPage from './_components/CohortDetailClientPage';

export default async function CohortDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>,
  searchParams: Promise<{ tenantId?: string }>
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const tenantId = resolvedSearchParams.tenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';
  const cohortId = resolvedParams.id;

  const [cohortRes, membersRes, allUsersRes] = await Promise.all([
    apiFetch(`/api/cohorts/${cohortId}?tenantId=${tenantId}`),
    apiFetch(`/api/cohorts/${cohortId}/members?tenantId=${tenantId}`),
    apiFetch(`/api/users?tenantId=${tenantId}`)
  ]);

  let cohort = null;
  if (cohortRes.ok) cohort = await cohortRes.json();

  let members = [];
  if (membersRes.ok) members = await membersRes.json();

  let allUsers = [];
  if (allUsersRes.ok) allUsers = await allUsersRes.json();

  if (!cohort) {
    return <div className="p-8">Cohort not found.</div>;
  }

  return (
    <CohortDetailClientPage
      cohort={cohort}
      initialMembers={members}
      allUsers={allUsers}
      tenantId={tenantId}
    />
  );
}
