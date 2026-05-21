'use client'

import React, { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { TenantWebhook } from '@coachflow/shared'
import { Plus, Trash2 } from 'lucide-react'

interface WebhooksClientPageProps {
  initialWebhooks: TenantWebhook[]
  tenantId?: string
}

const AVAILABLE_EVENTS = [
  { id: 'user_created', label: 'User Created' },
  { id: 'first_message', label: 'First Message' },
  { id: 'step_completed', label: 'Step Completed' },
  { id: 'journey_completed', label: 'Journey Completed' },
  { id: 'step_scored', label: 'Step Scored' },
]

export default function WebhooksClientPage({ initialWebhooks, tenantId }: WebhooksClientPageProps) {
  const [webhooks, setWebhooks] = useState<TenantWebhook[]>(initialWebhooks)
  const [showNewModal, setShowNewModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    url: '',
    secret: '',
    events: [] as string[],
  })

  const fetchWebhooks = async () => {
    try {
      const res = await apiFetch(`/api/webhooks${tenantId ? `?tenantId=${tenantId}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data)
      }
    } catch (err) {
      console.error('Failed to fetch webhooks', err)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.events.length === 0) {
      alert('Please select at least one event.')
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch(`/api/webhooks${tenantId ? `?tenantId=${tenantId}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setShowNewModal(false)
        setFormData({ url: '', secret: '', events: [] })
        await fetchWebhooks()
      } else {
        const err = await res.json()
        alert(`Error: ${err.error || 'Failed to create webhook'}`)
      }
    } catch (err) {
      console.error('Failed to create webhook', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return
    try {
      const res = await apiFetch(`/api/webhooks/${id}${tenantId ? `?tenantId=${tenantId}` : ''}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchWebhooks()
      }
    } catch (err) {
      console.error('Failed to delete webhook', err)
    }
  }

  const toggleEvent = (eventId: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }))
  }

  const zapierUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/webhooks/test${tenantId ? `?tenantId=${tenantId}` : ''}`

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Standardized outbound events for Zapier and other integrations.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Add Webhook
        </button>
      </div>

      <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-400">Zapier Integration</h3>
          <p className="text-xs text-blue-700 dark:text-blue-500 mt-1">
            Use this polling URL in Zapier to fetch sample events during trigger setup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="px-2 py-1 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/50 rounded text-[10px] text-zinc-600 dark:text-zinc-400 break-all">
            {zapierUrl}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(zapierUrl)
              alert('Zapier URL copied to clipboard')
            }}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Copy URL
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                Events
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {webhooks.map((webhook) => (
              <tr key={webhook.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {webhook.url}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map((e) => (
                      <span
                        key={e}
                        className="px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-700"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      webhook.enabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {webhook.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {webhooks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                  No webhooks configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full p-6 border dark:border-zinc-800">
            <h2 className="text-xl font-bold mb-4">Add New Webhook</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payload URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://your-api.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Signing Secret</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. whsec_..."
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Events to send</label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label key={event.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="rounded border-zinc-300 dark:border-zinc-700"
                      />
                      {event.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
