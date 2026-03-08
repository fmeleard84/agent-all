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

interface Doc {
  id: string
  type: string
  original_name: string
  source: string
  extracted_data: Record<string, any>
  created_at: string
}

const typeColors: Record<string, string> = {
  invoice: 'default',
  quote: 'secondary',
  contract: 'outline',
  bank_statement: 'secondary',
  other: 'outline',
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setDocs(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Documents traites par les agents</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement...</div>
          ) : docs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Aucun document</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Donnees extraites</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.original_name}</TableCell>
                    <TableCell>
                      <Badge variant={typeColors[doc.type] as any || 'outline'}>
                        {doc.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{doc.source}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {doc.extracted_data?.vendor || doc.extracted_data?.amount
                        ? `${doc.extracted_data.vendor || ''} ${doc.extracted_data.amount ? `- ${doc.extracted_data.amount} ${doc.extracted_data.currency || 'EUR'}` : ''}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString('fr-FR')}
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
