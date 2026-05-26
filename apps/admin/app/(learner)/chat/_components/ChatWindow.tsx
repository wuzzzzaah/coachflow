'use client';

import { useEffect, useRef } from 'react';
import { useChat } from './useChat';
import MessageInput from './MessageInput';

interface ChatWindowProps {
  userId: string;
  tenantId: string;
}

/** Render text with markdown-lite: bold (*text*), italic (_text_), newlines → <br> */
function renderText(text: string) {
  const parts = text.split(/(\*[^*]+\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    // Split on newlines and insert <br> tags
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

export default function ChatWindow({ userId, tenantId }: ChatWindowProps) {
  const { messages, sendMessage } = useChat(userId, tenantId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-sm italic">
            Starting your journey...
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-zinc-900 text-white rounded-tr-none'
                    : 'bg-zinc-100 text-zinc-900 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{renderText(msg.text)}</div>
                {msg.sender === 'user' && msg.status === 'sending' && (
                  <div className="text-[10px] text-zinc-400 mt-1 text-right">Sending...</div>
                )}
                {msg.sender === 'user' && msg.status === 'error' && (
                  <div className="text-[10px] text-red-400 mt-1 text-right">Failed to send</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <MessageInput onSendMessage={sendMessage} />
    </div>
  );
}
