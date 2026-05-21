'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  status?: 'sending' | 'sent' | 'error';
  timestamp: number;
}

export function useChat(userId: string, tenantId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPolling, setIsPolling] = useState(true);

  const poll = useCallback(async () => {
    try {
      const res = await apiFetch(`/channel/web/poll/${userId}?tenantId=${tenantId}`);
      if (res.ok) {
        const newTexts: string[] = await res.json();
        if (newTexts.length > 0) {
          const newMessages: Message[] = newTexts.map((text) => ({
            id: crypto.randomUUID(),
            text,
            sender: 'bot',
            timestamp: Date.now(),
          }));
          setMessages((prev) => [...prev, ...newMessages]);
        }
      }
    } catch (err) {
      console.error('Polling failed:', err);
    }
  }, [userId, tenantId]);

  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [isPolling, poll]);

  const sendMessage = async (text: string) => {
    const tempId = crypto.randomUUID();
    const userMsg: Message = {
      id: tempId,
      text,
      sender: 'user',
      status: 'sending',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await apiFetch('/channel/web/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text, tenantId }),
      });

      if (res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'sent' } : m)));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m)));
      }
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'error' } : m)));
    }
  };

  return {
    messages,
    sendMessage,
    isPolling,
    setIsPolling,
  };
}
