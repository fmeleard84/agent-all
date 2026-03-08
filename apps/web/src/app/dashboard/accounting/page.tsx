'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface AccountingRecord {
  id: string
  category: string
  amount: number
  currency: string
  due_date: string | null
  payment_status: string
  created_at: string
}

const statusColors: Record<string, string> = {
  pending: 'secondary',
  paid: 'default',
  overdue: 'destructive',
}

export default function AccountingPage() {
  const [entries, setEntries] = useState<AccountingRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('accounting_entries')
        .select('id, category, amount, currency, due_date, payment_status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      setEntries(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comptabilite</h1>
        <p className="text-muted-foreground">Ecritures comptables generees par les agents</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Aucune ecriture</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categorie</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Echeance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.category}</TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {entry.currency}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.due_date ? new Date(entry.due_date).toLocaleDateString('fr-FR') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[entry.payment_status] as any || 'secondary'}>
                        {entry.payment_status === 'paid' ? 'Paye' :
                         entry.payment_status === 'overdue' ? 'En retard' : 'En attente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
