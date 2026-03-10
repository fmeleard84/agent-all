'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, FileText, Calculator, AlertCircle, ArrowRight, Lightbulb, Rocket, Building2, Plus, Loader2, BarChart3 } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  axe_type: 'idea' | 'launch' | 'existing'
  status: string
  created_at: string
  metadata?: { dashboard?: { scoreTotal?: number; verdict?: string } } | null
}

const axeConfig: Record<string, { label: string; icon: typeof Lightbulb }> = {
  idea: { label: 'Idee', icon: Lightbulb },
  launch: { label: 'Lancement', icon: Rocket },
  existing: { label: 'Existant', icon: Building2 },
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
      if (!user) {
        setCheckingWorkspaces(false)
        return
      }

      const { data: userWorkspaces } = await supabase
        .from('workspaces')
        .select('id, name, axe_type, status, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!userWorkspaces || userWorkspaces.length === 0) {
        router.push('/dashboard/onboarding')
        return
      }

      setWorkspaces(userWorkspaces)
      setCheckingWorkspaces(false)

      const { data: companyUsers } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)

      const cId = companyUsers?.[0]?.company_id
      if (!cId) return
      setCompanyId(cId)

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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de votre entreprise</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Emails traites" value={stats.emails} icon={Mail} color="blue" />
        <KpiCard title="Documents classes" value={stats.documents} icon={FileText} color="green" />
        <KpiCard title="Ecritures comptables" value={stats.invoices} icon={Calculator} color="purple" />
        <KpiCard title="En attente" value={stats.pendingValidations} icon={AlertCircle} color="amber" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Mes workspaces</h2>
          <Link
            href="/dashboard/onboarding"
            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            Nouveau
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => {
            const config = axeConfig[ws.axe_type] || { label: ws.axe_type, icon: Lightbulb }
            const Icon = config.icon
            return (
              <Link key={ws.id} href={`/dashboard/workspace/${ws.id}`}>
                <Card className="hover:shadow-md hover:border-violet-200 transition-all duration-200 cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium">
                            {ws.name || `Workspace ${config.label}`}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ws.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      {ws.metadata?.dashboard?.scoreTotal ? (
                        <div className="flex items-center gap-2">
                          <div className={`text-right ${
                            ws.metadata.dashboard.scoreTotal >= 60 ? 'text-emerald-600' :
                            ws.metadata.dashboard.scoreTotal >= 45 ? 'text-blue-600' :
                            ws.metadata.dashboard.scoreTotal >= 30 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            <div className="text-lg font-bold tabular-nums leading-none">{ws.metadata.dashboard.scoreTotal}</div>
                            <div className="text-[10px] text-muted-foreground">/80</div>
                          </div>
                          <Link
                            href={`/dashboard/workspace/${ws.id}/report`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Link>
                        </div>
                      ) : (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

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
