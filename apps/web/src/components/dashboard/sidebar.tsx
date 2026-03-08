'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Activity,
  Bot,
  FileText,
  Mail,
  Calculator,
  CheckSquare,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/activity', label: 'Activite', icon: Activity },
  { href: '/dashboard/agents', label: 'Agents', icon: Bot },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText },
  { href: '/dashboard/emails', label: 'Emails', icon: Mail },
  { href: '/dashboard/accounting', label: 'Comptabilite', icon: Calculator },
  { href: '/dashboard/validations', label: 'Validations', icon: CheckSquare },
  { href: '/dashboard/settings', label: 'Parametres', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <aside className="w-60 min-h-screen border-r bg-card flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-lg font-semibold tracking-tight">Agent All</h1>
        <p className="text-xs text-muted-foreground mt-0.5">AI Operating System</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t space-y-0.5">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground w-full transition-colors"
        >
          <Sun className="w-4 h-4 dark:hidden" />
          <Moon className="w-4 h-4 hidden dark:block" />
          <span className="dark:hidden">Mode sombre</span>
          <span className="hidden dark:block">Mode clair</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Deconnexion
        </button>
      </div>
    </aside>
  )
}
