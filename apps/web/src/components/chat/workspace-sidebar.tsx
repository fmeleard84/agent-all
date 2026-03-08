'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lightbulb, Rocket, Building2, Plus } from 'lucide-react'

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

export function WorkspaceSidebar({ workspaces }: WorkspaceSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-60 flex-col border-r bg-neutral-50/50">
      <div className="border-b p-4">
        <h2 className="text-sm font-medium text-foreground">Workspaces</h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {workspaces.map((ws) => {
          const isActive = pathname.includes(ws.id)
          const Icon = axeIcons[ws.axe_type] ?? Lightbulb

          return (
            <Link
              key={ws.id}
              href={`/dashboard/workspace/${ws.id}`}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{ws.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/dashboard/onboarding"
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-violet-300 hover:text-violet-600"
        >
          <Plus className="h-4 w-4" />
          Nouveau workspace
        </Link>
      </div>
    </div>
  )
}
