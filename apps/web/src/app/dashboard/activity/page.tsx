'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface AuditEntry {
  id: string
  agent_id: string
  action: string
  result: string
  confidence: number | null
  human_override: boolean
  metadata: Record<string, any>
  created_at: string
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    async function fetchActivity() {
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setEntries(data || [])
      setLoading(false)
    }
    fetchActivity()
  }, [])

  const filtered = entries.filter(e =>
    e.agent_id.toLowerCase().includes(filter.toLowerCase()) ||
    e.action.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activite des agents</h1>
        <p className="text-muted-foreground">Historique des actions executees par les agents</p>
      </div>

      <Input
        placeholder="Filtrer par agent ou action..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Aucune activite</div>
          ) : (
            <div className="divide-y">
              {filtered.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 p-4">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    entry.result === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{entry.agent_id}</span>
                      <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(entry.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.confidence !== null && (
                      <Badge variant={entry.confidence >= 0.7 ? 'default' : 'secondary'}>
                        {Math.round(entry.confidence * 100)}%
                      </Badge>
                    )}
                    {entry.human_override && (
                      <Badge variant="outline">Corrige</Badge>
                    )}
                    <Badge variant={entry.result === 'success' ? 'default' : 'destructive'}>
                      {entry.result}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
