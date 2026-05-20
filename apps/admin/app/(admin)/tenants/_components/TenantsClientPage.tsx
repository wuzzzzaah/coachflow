'use client'

import React, { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { Tenant } from '@coachflow/shared'
import { Plus } from 'lucide-react'

interface TenantsClientPageProps {
  initialTenants: Tenant[]
}

export default function TenantsClientPage({ initialTenants }: TenantsClientPageProps) {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({ name: '', phone_number_id: '' })
  const [token, setToken] = useState('')

  const fetchTenants = async () => {
    try {
      const res = await apiFetch('/api/tenants')
      if (res.ok) {
        const data = await res.json()
        setTenants(data)
      }
    } catch (err) {
      console.error('Failed to fetch tenants', err)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await apiFetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone_number_id: formData.phone_number_id || undefined,
        }),
      })
      if (res.ok) {
        setShowNewModal(false)
        setFormData({ name: '', phone_number_id: '' })
        await fetchTenants()
      }
    } catch (err) {
      console.error('Failed to create tenant', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenant) return
    setLoading(true)
    try {
      const res = await apiFetch(`/api/tenants/${selectedTenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone_number_id: formData.phone_number_id || undefined,
        }),
      })
      if (res.ok) {
        setShowEditModal(false)
        setSelectedTenant(null)
        setFormData({ name: '', phone_number_id: '' })
        await fetchTenants()
      }
    } catch (err) {
      console.error('Failed to update tenant', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSetToken = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTenant) return
    setLoading(true)
    try {
      const res = await apiFetch(`/api/tenants/${selectedTenant.id}/whatsapp-token`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        setShowTokenModal(false)
        setSelectedTenant(null)
        setToken('')
        await fetchTenants()
      }
    } catch (err) {
      console.error('Failed to set token', err)
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setFormData({ name: tenant.name, phone_number_id: tenant.phone_number_id || '' })
    setShowEditModal(true)
  }

  const openTokenModal = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setToken('')
    setShowTokenModal(true)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenant Management</h1>
        <button
          onClick={() => {
            setFormData({ name: '', phone_number_id: '' })
            setShowNewModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Tenant
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                Phone Number ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {tenant.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    {tenant.phone_number_id || '-'}
                    {tenant.whatsapp_token_secret_id && (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full border border-green-200 dark:border-green-800">
                        Token set ✓
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400 text-sm">
                  {new Date(tenant.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                  <button
                    onClick={() => openEditModal(tenant)}
                    className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => openTokenModal(tenant)}
                    className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-300"
                  >
                    Set WhatsApp Token
                  </button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                  No tenants found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {(showNewModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full p-6 border dark:border-zinc-800">
            <h2 className="text-xl font-bold mb-4">
              {showNewModal ? 'Create New Tenant' : 'Edit Tenant'}
            </h2>
            <form onSubmit={showNewModal ? handleCreate : handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number ID (Optional)</label>
                <input
                  type="text"
                  value={formData.phone_number_id}
                  onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewModal(false)
                    setShowEditModal(false)
                  }}
                  className="px-4 py-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : showNewModal ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTokenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full p-6 border dark:border-zinc-800">
            <h2 className="text-xl font-bold mb-1">Set WhatsApp Token</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Enter the permanent access token for {selectedTenant?.name}.
            </p>
            <form onSubmit={handleSetToken} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Token</label>
                <input
                  type="password"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                  placeholder="EAA..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-4 py-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Setting...' : 'Set Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
