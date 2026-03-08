'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, FileText, Calculator, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    emails: 0,
    documents: 0,
    invoices: 0,
    pendingValidations: 0,
  })
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
  }, [])

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
