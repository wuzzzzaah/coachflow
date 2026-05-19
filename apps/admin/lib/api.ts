import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function apiFetch(path: string, init?: RequestInit) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const headers = new Headers(init?.headers)

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  // Ensure path starts with slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return fetch(`${API_URL}${normalizedPath}`, {
    ...init,
    headers,
  })
}
