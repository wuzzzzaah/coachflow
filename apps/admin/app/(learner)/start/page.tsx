'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function LearnerLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Check your email for the magic link!' });
    }
    setLoading(false);
  };

  const handleGuestAccess = async () => {
    setGuestLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      router.push('/chat');
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message });
      setGuestLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
        {/* Logo / Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-900 dark:bg-white mb-3">
            <span className="text-white dark:text-zinc-900 font-bold text-xl">C</span>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">CoachFlow</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Your AI leadership coach</p>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 text-sm rounded-lg border ${
              message.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/50'
                : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/50'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Demo / Guest Access */}
        {DEMO_MODE && (
          <>
            <button
              onClick={handleGuestAccess}
              disabled={guestLoading}
              className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold py-3 px-4 rounded-md hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base mb-4"
            >
              {guestLoading ? 'Starting...' : '✨ Try a Demo Journey'}
            </button>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-400">
                  or sign in with email
                </span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              htmlFor="email"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              placeholder="you@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium py-2 px-4 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending link...' : 'Send Magic Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
