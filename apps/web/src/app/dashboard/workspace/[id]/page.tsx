'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { WorkspaceSidebar } from '@/components/chat/workspace-sidebar'
import { ChatPanel } from '@/components/chat/chat-panel'
import { ContextPanel } from '@/components/chat/context-panel'

interface Workspace {
  id: string
  name: string
  axe_type: string
  status: string
  metadata: Record<string, unknown> | null
  user_id: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export default function WorkspacePage() {
  const params = useParams<{ id: string }>()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', params.id)
        .single()

      if (!ws) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const { data: allWs } = await supabase
        .from('workspaces')
        .select('*')
        .eq('user_id', user.id)

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('workspace_id', params.id)
        .order('created_at')

      setWorkspace(ws)
      setAllWorkspaces(allWs ?? [])
      setMessages(msgs ?? [])
      setLoading(false)
    }

    load()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <p className="animate-pulse text-gray-400">Chargement...</p>
      </div>
    )
  }

  if (notFound || !workspace) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <p className="text-gray-400">Workspace introuvable.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <WorkspaceSidebar workspaces={allWorkspaces} />
      <ChatPanel workspaceId={workspace.id} initialMessages={messages} />
      <ContextPanel workspace={workspace} />
    </div>
  )
}
