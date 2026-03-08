'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bot, Mail, FileText, Calculator } from 'lucide-react'

interface CompanyAgent {
  id: string
  agent_id: string
  autonomy_level: number
  enabled: boolean
  config: Record<string, any>
}

const agentMeta: Record<string, { name: string; description: string; icon: any }> = {
  'email-agent': {
    name: 'Email Agent',
    description: 'Classe les emails, extrait les pieces jointes, redige des reponses',
    icon: Mail,
  },
  'document-agent': {
    name: 'Document Agent',
    description: 'Classe les documents, extrait les donnees structurees',
    icon: FileText,
  },
  'accounting-agent': {
    name: 'Accounting Agent',
    description: 'Categorise les depenses, suit les paiements',
    icon: Calculator,
  },
}

const autonomyLabels: Record<number, string> = {
  1: 'Suggestion',
  2: 'Auto simple',
  3: 'Auto avec garde-fous',
  4: 'Autonomie complete',
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<CompanyAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAgents() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: cu } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)

      const cId = cu?.[0]?.company_id
      if (!cId) { setLoading(false); return }
      setCompanyId(cId)

      const { data } = await supabase
        .from('company_agents')
        .select('*')
        .eq('company_id', cId)
      setAgents(data || [])
      setLoading(false)
    }
    fetchAgents()
  }, [])

  async function toggleAgent(agentId: string, currentEnabled: boolean) {
    if (!companyId) return
    await supabase
      .from('company_agents')
      .upsert({
        company_id: companyId,
        agent_id: agentId,
        enabled: !currentEnabled,
        autonomy_level: 1,
      }, { onConflict: 'company_id,agent_id' })

    // Refresh
    const { data } = await supabase
      .from('company_agents')
      .select('*')
      .eq('company_id', companyId)
    setAgents(data || [])
  }

  async function changeAutonomy(agentId: string, level: number) {
    if (!companyId) return
    await supabase
      .from('company_agents')
      .update({ autonomy_level: level })
      .eq('company_id', companyId)
      .eq('agent_id', agentId)

    setAgents(prev => prev.map(a =>
      a.agent_id === agentId ? { ...a, autonomy_level: level } : a
    ))
  }

  const allAgentIds = ['email-agent', 'document-agent', 'accounting-agent']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-muted-foreground">Configurez vos agents et leur niveau d autonomie</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Chargement...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allAgentIds.map((agentId) => {
            const meta = agentMeta[agentId] || { name: agentId, description: '', icon: Bot }
            const companyAgent = agents.find(a => a.agent_id === agentId)
            const isEnabled = companyAgent?.enabled ?? false
            const level = companyAgent?.autonomy_level ?? 1
            const Icon = meta.icon

            return (
              <Card key={agentId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Icon className="w-5 h-5" />
                      </div>
                      <CardTitle className="text-base">{meta.name}</CardTitle>
                    </div>
                    <Badge variant={isEnabled ? 'default' : 'secondary'}>
                      {isEnabled ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{meta.description}</p>

                  {isEnabled && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Autonomie</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((l) => (
                          <Button
                            key={l}
                            size="sm"
                            variant={level >= l ? 'default' : 'outline'}
                            className="flex-1 text-xs"
                            onClick={() => changeAutonomy(agentId, l)}
                          >
                            {l}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{autonomyLabels[level]}</p>
                    </div>
                  )}

                  <Button
                    variant={isEnabled ? 'outline' : 'default'}
                    size="sm"
                    className="w-full"
                    onClick={() => toggleAgent(agentId, isEnabled)}
                  >
                    {isEnabled ? 'Desactiver' : 'Activer'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
