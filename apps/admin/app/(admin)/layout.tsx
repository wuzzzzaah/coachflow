import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from './SignOutButton'

export default async function AdminLayout({
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

  const navItems = [
    { name: 'Journeys', href: '/journeys' },
    { name: 'Cohorts', href: '/cohorts' },
    { name: 'Users', href: '/users' },
    { name: 'Analytics', href: '/analytics' },
    { name: 'Audit Log', href: '/audit-log' },
    { name: 'Prompts', href: '/prompts' },
    { name: 'Notifications', href: '/notifications' },
    { name: 'Alert Rules', href: '/settings/alerts' },
    { name: 'Slack', href: '/settings/slack' },
    { name: 'Webhooks', href: '/webhooks' },
    { name: 'Tenants', href: '/tenants' },
  ]

  return (
    <div className="flex h-screen bg-white dark:bg-black overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950 text-white flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-zinc-800">
          <span className="text-lg font-semibold tracking-tight">CoachFlow Admin</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="block px-4 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="px-4 py-2 mb-2 text-xs text-zinc-500 truncate">
            {user.email}
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-black">
        {children}
      </main>
    </div>
  )
}
