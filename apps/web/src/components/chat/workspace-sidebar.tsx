'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Lightbulb, Rocket, Building2, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  axe_type: string
  status: string
}

interface WorkspaceSidebarProps {
  workspaces: Workspace[]
}

const axeIcons: Record<string, typeof Lightbulb> = {
  idea: Lightbulb,
  launch: Rocket,
  existing: Building2,
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function WorkspaceSidebar({ workspaces: initialWorkspaces }: WorkspaceSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setWorkspaces(initialWorkspaces)
  }, [initialWorkspaces])

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renaming])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) {
      setRenaming(null)
      return
    }
    const token = await getToken()
    await fetch(`${API_URL}/workspaces/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === id ? { ...ws, name: renameValue.trim() } : ws)),
    )
    setRenaming(null)
  }

  async function handleDelete(id: string) {
    const token = await getToken()
    await fetch(`${API_URL}/workspaces/${id}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== id))
    if (pathname.includes(id)) {
      const remaining = workspaces.filter((ws) => ws.id !== id)
      if (remaining.length > 0) {
        router.push(`/dashboard/workspace/${remaining[0].id}`)
      } else {
        router.push('/dashboard/onboarding')
      }
    }
  }

  return (
    <div className="flex h-full w-60 flex-col border-r bg-gradient-to-b from-violet-50/60 via-background to-background dark:from-violet-950/20 dark:via-background dark:to-background">
      <div className="p-4 pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspaces</h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {workspaces.map((ws) => {
          const isActive = pathname.includes(ws.id)
          const Icon = axeIcons[ws.axe_type] ?? Lightbulb
          const isRenaming = renaming === ws.id

          return (
            <div key={ws.id} className="group relative">
              {isRenaming ? (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2">
                  <Icon className="h-4 w-4 shrink-0 text-violet-500" />
                  <input
                    ref={renameRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(ws.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(ws.id)
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    className="flex-1 bg-transparent text-sm border-b border-violet-300 focus:outline-none focus:border-violet-500 py-0"
                  />
                </div>
              ) : (
                <Link
                  href={`/dashboard/workspace/${ws.id}`}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
                    isActive
                      ? 'bg-violet-100/80 text-violet-700 font-medium dark:bg-violet-900/30 dark:text-violet-300'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-violet-500' : ''}`} />
                  <span className="truncate flex-1">{ws.name}</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setMenuOpen(menuOpen === ws.id ? null : ws.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-0.5 hover:bg-violet-200/60 dark:hover:bg-violet-800/40 transition-opacity"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </Link>
              )}

              {menuOpen === ws.id && (
                <div
                  ref={menuRef}
                  className="absolute right-2 top-9 z-50 w-36 rounded-lg border bg-popover p-1 shadow-lg"
                >
                  <button
                    onClick={() => {
                      setRenameValue(ws.name)
                      setRenaming(ws.id)
                      setMenuOpen(null)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Renommer
                  </button>
                  <button
                    onClick={() => {
                      handleDelete(ws.id)
                      setMenuOpen(null)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="p-3">
        <Link
          href="/dashboard/onboarding"
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-violet-200 dark:border-violet-800 px-3 py-2 text-sm text-muted-foreground transition-all hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
        >
          <Plus className="h-4 w-4" />
          Nouveau workspace
        </Link>
      </div>
    </div>
  )
}
