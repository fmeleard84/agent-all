'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'

interface AuditEntry {
  id: string
  agent_id: string
  action: string
  result: string
  confidence: number | null
  created_at: string
}

export function ActivityFeed({ companyId, limit = 10 }: { companyId?: string; limit?: number }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchActivity() {
      let query = supabase
        .from('audit_log')
        .select('id, agent_id, action, result, confidence, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (companyId) {
        query = query.eq('company_id', companyId)
      }

      const { data } = await query
      setEntries(data || [])
      setLoading(false)
    }

    fetchActivity()
  }, [companyId, limit])

  if (loading) return <div className="text-sm text-muted-foreground">Chargement...</div>
  if (entries.length === 0) return <div className="text-sm text-muted-foreground">Aucune activite recente</div>

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className={`w-2 h-2 rounded-full ${entry.result === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {entry.agent_id} — {entry.action}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(entry.created_at).toLocaleString('fr-FR')}
            </p>
          </div>
          {entry.confidence !== null && (
            <Badge variant={entry.confidence >= 0.7 ? 'default' : 'secondary'}>
              {Math.round(entry.confidence * 100)}%
            </Badge>
          )}
        </div>
      ))}
    </div>
  )
}
