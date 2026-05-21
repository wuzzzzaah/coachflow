'use client'

import { useState } from 'react'
import { SendHorizontal } from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (text: string) => void
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [text, setText] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      onSendMessage(text)
      setText('')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-white dark:bg-zinc-950"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border-none rounded-full text-sm focus:ring-2 focus:ring-zinc-500 outline-none"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full disabled:opacity-50 transition-opacity"
      >
        <SendHorizontal className="w-5 h-5" />
      </button>
    </form>
  )
}
