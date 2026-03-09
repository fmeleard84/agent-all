'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  Globe,
  Users,
  UserPlus,
  Tag,
  BarChart3,
  Loader2,
  Rocket,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Palette,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ActionData {
  content?: string
  html?: string
  structured?: Record<string, unknown>
  generatedAt?: string
  status?: string
}

interface ActionConfig {
  key: string
  title: string
  description: string
  why: string
  icon: typeof Globe
  color: string
  bgColor: string
  borderColor: string
}

const ACTIONS: ActionConfig[] = [
  {
    key: 'branding',
    title: 'Definir ton identite & positionnement',
    description: 'Analyse concurrentielle, posture de marque, wording et arguments differenciants.',
    why: 'Sans positionnement clair, ta landing page et tes messages seront generiques — et personne ne s\'en souviendra.',
    icon: Palette,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    key: 'landing',
    title: 'Creer une landing page',
    description: 'Genere une page web pour tester l\'interet autour de ton idee.',
    why: 'Valide si des gens cliquent et laissent leur email — c\'est le signal le plus fort.',
    icon: Globe,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    key: 'interview',
    title: 'Preparer les interviews clients',
    description: 'Genere un script d\'interview "Mom Test" pour valider le probleme.',
    why: 'Parler a 5 personnes reelles vaut plus que 100 heures d\'analyse.',
    icon: Users,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/20',
    borderColor: 'border-violet-200 dark:border-violet-800',
  },
  {
    key: 'prospects',
    title: 'Trouver les premiers prospects',
    description: 'Plan concret pour identifier et contacter tes 10 premiers clients.',
    why: 'Pas de clients = pas de business. C\'est l\'etape la plus critique.',
    icon: UserPlus,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  {
    key: 'pricing',
    title: 'Tester le pricing',
    description: 'Strategie de prix + message de test pour valider la willingness-to-pay.',
    why: 'Le prix n\'est pas un detail — c\'est ce qui definit ton marche.',
    icon: Tag,
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-50 dark:bg-pink-950/20',
    borderColor: 'border-pink-200 dark:border-pink-800',
  },
  {
    key: 'tracker',
    title: 'Suivre la validation',
    description: 'Metriques, objectifs et criteres go/no-go pour ta phase de validation.',
    why: 'Sans metriques, tu ne sais pas si tu avances ou si tu tournes en rond.',
    icon: BarChart3,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
]

function formatMarkdown(text: string): string {
  let html = text
  // Remove json/html code blocks for display
  html = html.replace(/```(?:json|html)\s*\n[\s\S]*?\n```/g, '')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="text-lg font-semibold mt-5 mb-2">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
  // Bullet lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$2</li>')
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p class="text-sm leading-relaxed mb-3">')
  html = '<p class="text-sm leading-relaxed mb-3">' + html + '</p>'
  // Clean empty paragraphs
  html = html.replace(/<p class="text-sm leading-relaxed mb-3">\s*<\/p>/g, '')
  return html
}

function ActionCard({ config, action, onGenerate, generating }: {
  config: ActionConfig
  action?: ActionData
  onGenerate: () => void
  generating: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const Icon = config.icon
  const isGenerated = action?.status === 'generated'

  function handleCopy() {
    if (!action?.content) return
    navigator.clipboard.writeText(action.content.replace(/```(?:json|html)\s*\n[\s\S]*?\n```/g, '').trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`rounded-xl border-2 ${isGenerated ? config.borderColor : 'border-border'} bg-card overflow-hidden transition-all`}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.bgColor}`}>
            <Icon className={`h-6 w-6 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{config.title}</h3>
              {isGenerated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Genere
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
            <p className="text-xs text-muted-foreground/70 mt-1.5 italic">{config.why}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {!isGenerated ? (
            <button
              onClick={onGenerate}
              disabled={generating}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                generating
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generation en cours...</>
              ) : (
                <><Rocket className="h-4 w-4" /> Lancer l&apos;agent</>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {expanded ? 'Masquer' : 'Voir le resultat'}
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
                title="Copier"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
              {config.key === 'landing' && action?.html && (
                <button
                  onClick={() => {
                    const w = window.open('', '_blank')
                    if (w) { w.document.write(action.html!); w.document.close() }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
                  title="Voir la landing page"
                >
                  <ExternalLink className="h-4 w-4" /> Preview
                </button>
              )}
              <button
                onClick={onGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
                title="Regenerer"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Regenerer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && isGenerated && action?.content && (
        <div className={`border-t ${config.bgColor} p-6`}>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(action.content) }}
          />
        </div>
      )}
    </div>
  )
}

export default function ValidationPage() {
  const params = useParams<{ id: string }>()
  const [workspaceName, setWorkspaceName] = useState('')
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null)
  const [actions, setActions] = useState<Record<string, ActionData>>({})
  const [loading, setLoading] = useState(true)
  const [generatingAction, setGeneratingAction] = useState<string | null>(null)
  const [streamContent, setStreamContent] = useState('')

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }, [])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('workspaces')
        .select('name, metadata')
        .eq('id', params.id)
        .single()

      if (data) {
        setWorkspaceName(data.name)
        if (data.metadata?.dashboard) setDashboard(data.metadata.dashboard)
        if (data.metadata?.actions) setActions(data.metadata.actions)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleGenerate(actionType: string) {
    setGeneratingAction(actionType)
    setStreamContent('')

    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/chat/${params.id}/actions/${actionType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      })

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let content = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              content += parsed.content
              setStreamContent(content)
            }
          } catch { /* ignore */ }
        }
      }

      // Refresh actions from server
      const { data } = await supabase
        .from('workspaces')
        .select('metadata')
        .eq('id', params.id)
        .single()

      if (data?.metadata?.actions) {
        setActions(data.metadata.actions)
      }
    } catch (err) {
      console.error('Action generation failed:', err)
    } finally {
      setGeneratingAction(null)
      setStreamContent('')
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Rocket className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Lance d&apos;abord l&apos;analyse de ton idee.</p>
        <Link href={`/dashboard/workspace/${params.id}`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour au workspace
        </Link>
      </div>
    )
  }

  const completedCount = ACTIONS.filter(a => actions[a.key]?.status === 'generated').length
  const progressPct = (completedCount / ACTIONS.length) * 100

  return (
    <div className="px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/workspace/${params.id}/report`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{workspaceName}</h1>
          <p className="text-sm text-muted-foreground">Prochaines etapes pour valider ton idee</p>
        </div>
      </div>

      {/* Progress banner */}
      <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-violet-500" />
            <span className="font-semibold">Validation en cours</span>
          </div>
          <span className="text-sm text-muted-foreground">{completedCount}/{ACTIONS.length} actions completees</span>
        </div>
        <div className="h-2 rounded-full bg-violet-100 dark:bg-violet-900/40">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {completedCount === 0 && 'Commence par generer ta landing page ou preparer tes interviews client.'}
          {completedCount > 0 && completedCount < ACTIONS.length && `Bien joue ! Continue avec les actions restantes.`}
          {completedCount === ACTIONS.length && 'Toutes les actions sont generees. Tu as tout ce qu\'il faut pour valider ton idee !'}
        </p>
      </div>

      {/* Streaming preview */}
      {generatingAction && streamContent && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-sm font-medium text-violet-600 dark:text-violet-400">L&apos;agent travaille...</span>
          </div>
          <div
            className="prose prose-sm max-w-none dark:prose-invert max-h-60 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(streamContent) }}
          />
        </div>
      )}

      {/* Action cards */}
      <div className="space-y-4">
        {ACTIONS.map((config) => (
          <ActionCard
            key={config.key}
            config={config}
            action={actions[config.key]}
            onGenerate={() => handleGenerate(config.key)}
            generating={generatingAction === config.key}
          />
        ))}
      </div>

      {/* Philosophy */}
      <div className="rounded-xl bg-muted/30 border border-dashed p-6 text-center space-y-2">
        <p className="text-sm font-medium">Idee → Analyse → Action → Validation</p>
        <p className="text-xs text-muted-foreground">Le but n&apos;est pas de planifier pendant 6 mois. C&apos;est de tester vite, apprendre vite, et ajuster.</p>
      </div>

      {/* Back */}
      <div className="flex justify-center gap-4 pb-8">
        <Link href={`/dashboard/workspace/${params.id}/report`} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="h-4 w-4" /> Rapport d&apos;analyse
        </Link>
        <Link href={`/dashboard/workspace/${params.id}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors">
          Continuer la discussion
        </Link>
      </div>
    </div>
  )
}
