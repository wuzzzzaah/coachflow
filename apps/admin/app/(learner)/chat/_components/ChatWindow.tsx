'use client'

import { useEffect, useRef } from 'react'
import { useChat } from './useChat'
import MessageInput from './MessageInput'

interface ChatWindowProps {
  userId: string
  tenantId: string
}

export default function ChatWindow({ userId, tenantId }: ChatWindowProps) {
  const { messages, sendMessage } = useChat(userId, tenantId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-400 text-sm italic">
            Send a message to begin
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  msg.sender === 'user'
                    ? 'bg-zinc-900 text-white rounded-tr-none'
                    : 'bg-zinc-100 text-zinc-900 rounded-tl-none'
                }`}
              >
                <div>{msg.text}</div>
                {msg.sender === 'user' && msg.status === 'sending' && (
                  <div className="text-[10px] text-zinc-400 mt-1 text-right">
                    Sending...
                  </div>
                )}
                {msg.sender === 'user' && msg.status === 'error' && (
                  <div className="text-[10px] text-red-400 mt-1 text-right">
                    Failed to send
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <MessageInput onSendMessage={sendMessage} />
    </div>
  )
}
