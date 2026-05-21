import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LearnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-black overflow-hidden">
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  )
}
