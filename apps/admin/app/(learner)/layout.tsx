import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignOutButton } from '../(admin)/SignOutButton';

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black overflow-hidden">
      {/* Top Nav */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex-shrink-0">
        <div className="flex items-center gap-8">
          <span className="text-lg font-bold tracking-tight">CoachFlow</span>
          <nav className="flex items-center gap-6">
            <Link
              href="/chat"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              Chat
            </Link>
            <Link
              href="/progress"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              Progress
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 hidden sm:inline-block">{user.email}</span>
          <div className="flex items-center">
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-black">
        <div className="max-w-4xl mx-auto py-8 px-6">{children}</div>
      </main>
    </div>
  );
}
