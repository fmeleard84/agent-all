'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  Table2,
  HardDrive,
  Bug,
  Search,
  Building2,
  CreditCard,
  FileText,
  Link2,
  Key,
  Loader2,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agent-all.ialla.fr/api'

// TODO: replace with real auth
const COMPANY_ID = 'test-company'

interface Tool {
  id: string
  name: string
  description: string
  authType: 'oauth' | 'api_key'
  status: 'connected' | 'not_connected'
  accountInfo?: string
}

const toolIconMap: Record<string, LucideIcon> = {
  gmail: Mail,
  sheets: Table2,
  drive: HardDrive,
  apify: Bug,
  google_search: Search,
}

const toolColorMap: Record<string, string> = {
  gmail: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  sheets: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  drive: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  apify: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  google_search: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
}

const comingSoonConnectors = [
  {
    name: 'Qonto',
    description: 'Connectez votre compte bancaire pour le suivi financier automatique.',
    icon: Building2,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  {
    name: 'Stripe',
    description: 'Suivez vos paiements, abonnements et revenus en temps reel.',
    icon: CreditCard,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  },
  {
    name: 'Notion',
    description: 'Importez vos documents et bases de donnees.',
    icon: FileText,
    color: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
  },
  {
    name: 'Slack',
    description: 'Recevez les notifications et rapports dans vos channels.',
    icon: Link2,
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  },
  {
    name: 'API personnalisee',
    description: 'Connectez vos propres outils via cle API.',
    icon: Key,
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  },
]

export default function ConnectorsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({})
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({})
  const [connectingOAuth, setConnectingOAuth] = useState<Record<string, boolean>>({})
  const [disconnecting, setDisconnecting] = useState<Record<string, boolean>>({})

  const fetchTools = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_URL}/tools/status/${COMPANY_ID}`)
      if (!res.ok) throw new Error('Impossible de charger les outils')
      const data = await res.json()
      setTools(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTools()
  }, [])

  const handleOAuthConnect = async (toolId: string) => {
    try {
      setConnectingOAuth((prev) => ({ ...prev, [toolId]: true }))
      const res = await fetch(`${API_URL}/tools/${toolId}/auth-url?companyId=${COMPANY_ID}`)
      if (!res.ok) throw new Error('Impossible de lancer la connexion OAuth')
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      console.error('OAuth error:', err)
    } finally {
      setConnectingOAuth((prev) => ({ ...prev, [toolId]: false }))
    }
  }

  const handleSaveApiKey = async (toolId: string) => {
    const apiKey = apiKeyInputs[toolId]
    if (!apiKey?.trim()) return

    try {
      setSavingKeys((prev) => ({ ...prev, [toolId]: true }))
      const res = await fetch(`${API_URL}/tools/${toolId}/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: COMPANY_ID, apiKey }),
      })
      if (!res.ok) throw new Error('Impossible de sauvegarder la cle API')
      setApiKeyInputs((prev) => ({ ...prev, [toolId]: '' }))
      await fetchTools()
    } catch (err) {
      console.error('API key save error:', err)
    } finally {
      setSavingKeys((prev) => ({ ...prev, [toolId]: false }))
    }
  }

  const handleDisconnect = async (toolId: string) => {
    try {
      setDisconnecting((prev) => ({ ...prev, [toolId]: true }))
      const res = await fetch(`${API_URL}/tools/${toolId}/${COMPANY_ID}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Impossible de deconnecter')
      await fetchTools()
    } catch (err) {
      console.error('Disconnect error:', err)
    } finally {
      setDisconnecting((prev) => ({ ...prev, [toolId]: false }))
    }
  }

  const getIcon = (toolId: string): LucideIcon => {
    return toolIconMap[toolId] || Key
  }

  const getColor = (toolId: string): string => {
    return toolColorMap[toolId] || 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connecteurs</h1>
        <p className="text-muted-foreground">
          Connectez vos outils pour enrichir vos agents.
        </p>
      </div>

      {/* Active tools from API */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement des outils...</span>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchTools}>
              Reessayer
            </Button>
          </CardContent>
        </Card>
      ) : tools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const Icon = getIcon(tool.id)
            const color = getColor(tool.id)
            const isConnected = tool.status === 'connected'

            return (
              <Card key={tool.id} className="hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold">{tool.name}</h3>
                        <Badge
                          variant={tool.authType === 'oauth' ? 'default' : 'secondary'}
                          className="text-[10px] shrink-0"
                        >
                          {tool.authType === 'oauth' ? 'OAuth' : 'API Key'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        {tool.description}
                      </p>

                      {isConnected ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            <span className="text-xs font-medium text-green-600 dark:text-green-400">
                              Connecte
                            </span>
                          </div>
                          {tool.accountInfo && (
                            <p className="text-xs text-muted-foreground truncate">
                              {tool.accountInfo}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8"
                            disabled={disconnecting[tool.id]}
                            onClick={() => handleDisconnect(tool.id)}
                          >
                            {disconnecting[tool.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : null}
                            Deconnecter
                          </Button>
                        </div>
                      ) : tool.authType === 'oauth' ? (
                        <Button
                          size="sm"
                          className="w-full text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white"
                          disabled={connectingOAuth[tool.id]}
                          onClick={() => handleOAuthConnect(tool.id)}
                        >
                          {connectingOAuth[tool.id] ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          Connecter
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="Cle API..."
                            className="h-8 text-xs"
                            value={apiKeyInputs[tool.id] || ''}
                            onChange={(e) =>
                              setApiKeyInputs((prev) => ({
                                ...prev,
                                [tool.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveApiKey(tool.id)
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs shrink-0 bg-violet-600 hover:bg-violet-700 text-white"
                            disabled={savingKeys[tool.id] || !apiKeyInputs[tool.id]?.trim()}
                            onClick={() => handleSaveApiKey(tool.id)}
                          >
                            {savingKeys[tool.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Sauver'
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      {/* Coming Soon section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Bientot disponible</h2>
          <p className="text-sm text-muted-foreground">
            Ces connecteurs seront disponibles prochainement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comingSoonConnectors.map((c) => {
            const Icon = c.icon
            return (
              <Card key={c.name} className="opacity-60">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold">{c.name}</h3>
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          Bientot
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {c.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
