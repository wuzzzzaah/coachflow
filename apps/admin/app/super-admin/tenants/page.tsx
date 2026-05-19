import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { Tenant } from '@coachflow/shared'
import TenantsClientPage from './_components/TenantsClientPage'

export default async function TenantsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.app_metadata.role !== 'super_admin') {
    redirect('/')
  }

  const res = await apiFetch('/api/tenants')
  let tenants: Tenant[] = []

  if (res.ok) {
    tenants = await res.json()
  } else {
    console.error('Failed to fetch tenants')
  }

  return (
    <TenantsClientPage initialTenants={tenants} />
  )
}
