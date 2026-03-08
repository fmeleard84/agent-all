'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, FileText, Calculator, AlertCircle, ArrowRight } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  axe_type: 'idea' | 'launch' | 'existing'
  status: string
  created_at: string
}

const axeLabels: Record<string, { label: string; icon: string; color: string }> = {
  idea: { label: 'Idee', icon: '\u{1F4A1}', color: 'border-amber-500/50' },
  launch: { label: 'Lancement', icon: '\u{1F680}', color: 'border-blue-500/50' },
  existing: { label: 'Existant', icon: '\u{1F3E2}', color: 'border-emerald-500/50' },
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState({
    emails: 0,
    documents: 0,
    invoices: 0,
    pendingValidations: 0,
  })
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [checkingWorkspaces, setCheckingWorkspaces] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check for workspaces
      const { data: userWorkspaces } = await supabase
        .from('workspaces')
        .select('id, name, axe_type, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!userWorkspaces || userWorkspaces.length === 0) {
        router.push('/dashboard/onboarding')
        return
      }

      setWorkspaces(userWorkspaces)
      setCheckingWorkspaces(false)

      // Get current user's company
      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)

      const cId = companyUsers?.[0]?.company_id
      if (!cId) return
      setCompanyId(cId)

      // Fetch stats
      const [emailsRes, docsRes, entriesRes, pendingRes] = await Promise.all([
        supabase.from('emails').select('id', { count: 'exact', head: true }).eq('company_id', cId),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('company_id', cId),
        supabase.from('accounting_entries').select('id', { count: 'exact', head: true }).eq('company_id', cId),
        supabase.from('task_executions').select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ])

      setStats({
        emails: emailsRes.count || 0,
        documents: docsRes.count || 0,
        invoices: entriesRes.count || 0,
        pendingValidations: pendingRes.count || 0,
      })
    }

    loadData()
  }, [router])

  if (checkingWorkspaces) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400 animate-pulse">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Vue d ensemble de votre entreprise</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Emails traites" value={stats.emails} icon={Mail} color="blue" />
        <KpiCard title="Documents classes" value={stats.documents} icon={FileText} color="green" />
        <KpiCard title="Ecritures comptables" value={stats.invoices} icon={Calculator} color="purple" />
        <KpiCard title="En attente" value={stats.pendingValidations} icon={AlertCircle} color="amber" />
      </div>

      {/* Mes workspaces section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mes workspaces</CardTitle>
          <Link
            href="/dashboard/onboarding"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            + Nouveau workspace
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => {
              const axe = axeLabels[ws.axe_type] || { label: ws.axe_type, icon: '', color: 'border-gray-500/50' }
              return (
                <Link key={ws.id} href={`/dashboard/workspace/${ws.id}`}>
                  <Card
                    className={`border ${axe.color} bg-gray-900/50 hover:bg-gray-800/50 transition-all duration-200 hover:scale-[1.02] cursor-pointer`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{axe.icon}</span>
                            <h3 className="font-medium text-gray-100">
                              {ws.name || `Workspace ${axe.label}`}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(ws.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-500" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activite recente</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed companyId={companyId || undefined} />
        </CardContent>
      </Card>
    </div>
  )
}
