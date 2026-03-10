'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Key, Link2, CreditCard, Building2, Mail, FileText } from 'lucide-react'

const connectors = [
  {
    name: 'Qonto',
    description: 'Connectez votre compte bancaire pour le suivi financier automatique.',
    icon: Building2,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    status: 'available' as const,
  },
  {
    name: 'Google Workspace',
    description: 'Synchronisez Gmail, Drive et Calendar avec vos agents.',
    icon: Mail,
    color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    status: 'coming' as const,
  },
  {
    name: 'Stripe',
    description: 'Suivez vos paiements, abonnements et revenus en temps reel.',
    icon: CreditCard,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    status: 'coming' as const,
  },
  {
    name: 'Notion',
    description: 'Importez vos documents et bases de donnees.',
    icon: FileText,
    color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
    status: 'coming' as const,
  },
  {
    name: 'Slack',
    description: 'Recevez les notifications et rapports dans vos channels.',
    icon: Link2,
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    status: 'coming' as const,
  },
  {
    name: 'API personnalisee',
    description: 'Connectez vos propres outils via cle API.',
    icon: Key,
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    status: 'coming' as const,
  },
]

export default function ConnectorsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connecteurs</h1>
        <p className="text-muted-foreground">Connectez vos outils pour enrichir vos agents.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connectors.map((c) => {
          const Icon = c.icon
          return (
            <Card key={c.name} className="hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold">{c.name}</h3>
                      {c.status === 'coming' ? (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Bientot</span>
                      ) : (
                        <button className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors">
                          Connecter
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
