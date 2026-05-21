import { createClient } from '@/lib/supabase/server';
import ChatWindow from './_components/ChatWindow';

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // In a real app, tenantId would come from user profile or URL
  // For now we assume a default or retrieved from user metadata
  const tenantId = user?.app_metadata?.tenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  if (!user) return null;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto border-x border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h1 className="font-semibold text-lg">CoachFlow Chat</h1>
        <div className="text-xs text-zinc-500">Logged in as {user.email}</div>
      </header>

      <ChatWindow userId={user.id} tenantId={tenantId} />
    </div>
  );
}
