'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ValidationCardProps {
  id: string
  agentId: string
  action: string
  input: Record<string, any>
  output: Record<string, any>
  confidence: number | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export function ValidationCard({
  id, agentId, action, input, output, confidence, onApprove, onReject,
}: ValidationCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">{agentId}</span>
              <Badge variant="outline">{action}</Badge>
              {confidence !== null && (
                <Badge variant={confidence >= 0.7 ? 'default' : 'secondary'}>
                  {Math.round(confidence * 100)}%
                </Badge>
              )}
            </div>
            {output && Object.keys(output).length > 0 && (
              <div className="text-sm text-muted-foreground">
                {Object.entries(output).slice(0, 3).map(([key, value]) => (
                  <div key={key}>
                    <span className="font-medium">{key}:</span>{' '}
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={() => onApprove(id)}>
              Approuver
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onReject(id)}>
              Rejeter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
