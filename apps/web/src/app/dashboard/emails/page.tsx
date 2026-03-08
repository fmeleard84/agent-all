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

interface EmailRecord {
  id: string
  from_address: string
  subject: string
  category: string | null
  processed: boolean
  created_at: string
}

const categoryColors: Record<string, string> = {
  invoice: 'default',
  prospect: 'secondary',
  support: 'outline',
  info: 'secondary',
  spam: 'destructive',
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('emails')
        .select('id, from_address, subject, category, processed, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      setEmails(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="text-muted-foreground">Emails traites par les agents</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Aucun email</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>De</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="font-medium">{email.from_address}</TableCell>
                    <TableCell>{email.subject || '-'}</TableCell>
                    <TableCell>
                      {email.category ? (
                        <Badge variant={categoryColors[email.category] as any || 'outline'}>
                          {email.category}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={email.processed ? 'default' : 'secondary'}>
                        {email.processed ? 'Traite' : 'En attente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(email.created_at).toLocaleDateString('fr-FR')}
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
