'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { AuditLog } from '@coachflow/shared'

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLogs() {
      try {
        const tenantId = localStorage.getItem('coachflow_tenant_id') || ''
        const res = await apiFetch(`/api/audit-log?tenantId=${tenantId}&limit=100`)
        if (!res.ok) throw new Error('Failed to fetch audit log')
        const data = await res.json()
        setLogs(data)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [])

  function getBadgeColor(action: string) {
    if (action.endsWith('.create')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    if (action.endsWith('.update') || action.endsWith('.clone')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    if (action.endsWith('.delete')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Audit Log</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-white"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md text-red-800 dark:text-red-400">
          {error}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Actor</th>
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Resource</th>
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Resource ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-zinc-900 dark:text-white font-medium">{log.actor_email || 'Unknown'}</div>
                      <div className="text-zinc-500 text-xs truncate w-32">{log.actor_id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-900 dark:text-white capitalize">
                      {log.resource}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                      {log.resource_id || '-'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                      No audit log entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
