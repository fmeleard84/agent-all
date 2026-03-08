'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MessageBubble } from './message-bubble'
import { Paperclip } from 'lucide-react'

interface Message {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

interface ChatPanelProps {
  workspaceId: string
  initialMessages: Message[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function ChatPanel({ workspaceId, initialMessages }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const hasSentGreeting = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (initialMessages.length === 0 && !hasSentGreeting.current) {
      hasSentGreeting.current = true
      sendMessage('Bonjour')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${API_URL}/chat/${workspaceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text.trim() }),
      })

      const data = await res.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response ?? 'Erreur: pas de réponse.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Erreur de connexion. Veuillez réessayer.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      return
    }

    // Upload to Supabase Storage
    const path = `workspace-docs/${workspaceId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, file)

    if (uploadError) {
      console.error(uploadError)
      setLoading(false)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Notify chat — reset loading so sendMessage can proceed
    setLoading(false)
    await sendMessage(`J'ai uploadé le fichier : ${file.name}`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-gray-950">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id ?? i}
            role={msg.role}
            content={msg.content}
            createdAt={msg.created_at}
          />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-gray-800 px-4 py-2">
              <p className="text-sm text-gray-400 animate-pulse">
                L&apos;agent réfléchit...
              </p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.txt,.png,.jpg,.jpeg"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Joindre un fichier"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Votre message..."
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}
