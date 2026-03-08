import { Badge } from '@/components/ui/badge'
import { Lightbulb, Rocket, Building2 } from 'lucide-react'

interface ContextPanelProps {
  workspace: {
    axe_type: string
    metadata: Record<string, unknown> | null
  }
}

const axeConfig: Record<string, { label: string; icon: typeof Lightbulb }> = {
  idea: { label: 'Idee', icon: Lightbulb },
  launch: { label: 'Lancement', icon: Rocket },
  existing: { label: 'Existant', icon: Building2 },
}

export function ContextPanel({ workspace }: ContextPanelProps) {
  const metadata = workspace.metadata ?? {}
  const qonto = metadata.qonto as Record<string, unknown> | undefined
  const otherKeys = Object.keys(metadata).filter((k) => k !== 'qonto')
  const config = axeConfig[workspace.axe_type] ?? { label: workspace.axe_type, icon: Lightbulb }
  const Icon = config.icon

  return (
    <div className="flex h-full w-64 flex-col border-l bg-neutral-50/50 p-4">
      <h3 className="text-sm font-medium mb-4">Contexte</h3>

      <div className="mb-4">
        <Badge variant="secondary" className="gap-1.5">
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      </div>

      {qonto && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <h4 className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qonto</h4>
          <div className="space-y-2">
            {Object.entries(qonto).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium truncate ml-2">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {otherKeys.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h4 className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Donnees</h4>
          <div className="space-y-2">
            {otherKeys.map((key) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium truncate ml-2">{String(metadata[key])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
