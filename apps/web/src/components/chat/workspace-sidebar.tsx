'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Workspace {
  id: string
  name: string
  axe_type: string
  status: string
}

interface WorkspaceSidebarProps {
  workspaces: Workspace[]
}

const axeIcons: Record<string, string> = {
  tresorerie: '💡',
  growth: '🚀',
  admin: '🏢',
}

export function WorkspaceSidebar({ workspaces }: WorkspaceSidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-800 bg-gray-950">
      <div className="border-b border-gray-800 p-4">
        <h2 className="text-sm font-semibold text-gray-300">Workspaces</h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {workspaces.map((ws) => {
          const isActive = pathname.includes(ws.id)
          const icon = axeIcons[ws.axe_type] ?? '💡'

          return (
            <Link
              key={ws.id}
              href={`/dashboard/workspace/${ws.id}`}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
              }`}
            >
              <span>{icon}</span>
              <span className="truncate">{ws.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-800 p-3">
        <Link
          href="/dashboard/onboarding"
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-700 px-3 py-2 text-sm text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
        >
          + Nouveau workspace
        </Link>
      </div>
    </div>
  )
}
