'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Users,
  UserPlus,
  Tag,
  BarChart3,
  Loader2,
  Rocket,
  Presentation,
  CheckCircle2,
  Palette,
  Swords,
  MessageSquareQuote,
  Upload,
  Linkedin,
  Instagram,
  Sparkles,
  Briefcase,
  TrendingUp,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
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
  icon: typeof Globe
  gradient: string
  iconBg: string
  iconColor: string
  dashboardUrl?: string
}

interface TabConfig {
  key: string
  label: string
  icon: typeof Globe
  actions: ActionConfig[]
}

const TABS: TabConfig[] = [
  {
    key: 'identity',
    label: 'Identite',
    icon: Sparkles,
    actions: [
      {
        key: 'competitive',
        title: 'Analyse concurrentielle',
        description: 'Cartographie tes concurrents, identifie tes axes de differenciation et tes opportunites.',
        icon: Swords,
        gradient: 'from-red-500 to-rose-600',
        iconBg: 'bg-red-500',
        iconColor: 'text-white',
        dashboardUrl: 'competitive',
      },
      {
        key: 'wording',
        title: 'Wording & Posture',
        description: 'Cree ton univers de marque : taglines, ton de voix, lexique et pitches percutants.',
        icon: MessageSquareQuote,
        gradient: 'from-orange-500 to-amber-600',
        iconBg: 'bg-orange-500',
        iconColor: 'text-white',
        dashboardUrl: 'wording',
      },
      {
        key: 'identity',
        title: 'Identite visuelle',
        description: 'Palette de couleurs, typographie, direction artistique et guidelines de ta marque.',
        icon: Palette,
        gradient: 'from-purple-500 to-violet-600',
        iconBg: 'bg-purple-500',
        iconColor: 'text-white',
        dashboardUrl: 'identity',
      },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    actions: [
      {
        key: 'landing',
        title: 'Landing Page',
        description: 'Genere une page web optimisee pour capter des leads et tester l\'interet reel.',
        icon: Globe,
        gradient: 'from-blue-500 to-cyan-600',
        iconBg: 'bg-blue-500',
        iconColor: 'text-white',
        dashboardUrl: 'landing',
      },
      {
        key: 'linkedin',
        title: 'Posts LinkedIn',
        description: '10 posts strategiques prets a publier pour construire ta visibilite professionnelle.',
        icon: Linkedin,
        gradient: 'from-sky-500 to-blue-600',
        iconBg: 'bg-[#0077B5]',
        iconColor: 'text-white',
        dashboardUrl: 'linkedin',
      },
      {
        key: 'instagram',
        title: 'Publications Instagram',
        description: 'Carousels, reels et posts visuels alignes avec ta charte graphique.',
        icon: Instagram,
        gradient: 'from-pink-500 to-rose-600',
        iconBg: 'bg-gradient-to-br from-purple-600 to-pink-500',
        iconColor: 'text-white',
        dashboardUrl: 'instagram',
      },
    ],
  },
  {
    key: 'business',
    label: 'Business',
    icon: Briefcase,
    actions: [
      {
        key: 'interview',
        title: 'Interviews clients',
        description: 'Script d\'interview "Mom Test" pour valider le probleme avec de vrais utilisateurs.',
        icon: Users,
        gradient: 'from-violet-500 to-indigo-600',
        iconBg: 'bg-violet-500',
        iconColor: 'text-white',
        dashboardUrl: 'interview',
      },
      {
        key: 'prospects',
        title: 'Premiers clients',
        description: 'Plan d\'action concret pour identifier et contacter tes 10 premiers clients.',
        icon: UserPlus,
        gradient: 'from-emerald-500 to-green-600',
        iconBg: 'bg-emerald-500',
        iconColor: 'text-white',
        dashboardUrl: 'prospects',
      },
      {
        key: 'pricing',
        title: 'Strategie de pricing',
        description: 'Benchmark, options de prix et methode de test pour valider ta willingness-to-pay.',
        icon: Tag,
        gradient: 'from-pink-500 to-fuchsia-600',
        iconBg: 'bg-pink-500',
        iconColor: 'text-white',
        dashboardUrl: 'pricing',
      },
      {
        key: 'salesdeck',
        title: 'Deck de vente',
        description: 'Sales deck client et pitch deck investisseur, prets a etre presentes.',
        icon: Presentation,
        gradient: 'from-indigo-500 to-blue-600',
        iconBg: 'bg-indigo-500',
        iconColor: 'text-white',
        dashboardUrl: 'salesdeck',
      },
    ],
  },
  {
    key: 'tracking',
    label: 'Suivi',
    icon: TrendingUp,
    actions: [
      {
        key: 'tracker',
        title: 'Tableau de bord',
        description: 'Metriques cles, objectifs et criteres go/no-go pour piloter ta validation.',
        icon: BarChart3,
        gradient: 'from-amber-500 to-orange-600',
        iconBg: 'bg-amber-500',
        iconColor: 'text-white',
      },
    ],
  },
]

const ALL_ACTIONS = TABS.flatMap(t => t.actions)

function formatMarkdown(text: string): string {
  let html = text
  html = html.replace(/```(?:json|html)\s*\n[\s\S]*?\n```/g, '')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="text-lg font-semibold mt-5 mb-2">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$2</li>')
  html = html.replace(/\n\n/g, '</p><p class="text-sm leading-relaxed mb-3">')
  html = '<p class="text-sm leading-relaxed mb-3">' + html + '</p>'
  html = html.replace(/<p class="text-sm leading-relaxed mb-3">\s*<\/p>/g, '')
  return html
}

function ActionCard({ config, action, onGenerate, onUpload, generating, uploading, workspaceId }: {
  config: ActionConfig
  action?: ActionData
  onGenerate: () => void
  onUpload: (file: File) => void
  generating: boolean
  uploading: boolean
  workspaceId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const Icon = config.icon
  const isGenerated = action?.status === 'generated'
  const isWorking = generating || uploading

  function handleCopy() {
    if (!action?.content) return
    navigator.clipboard.writeText(action.content.replace(/```(?:json|html)\s*\n[\s\S]*?\n```/g, '').trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleFileSelect() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.txt,.csv,.doc,.docx'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) onUpload(file)
    }
    input.click()
  }

  return (
    <div className="group relative rounded-2xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5">
      {/* Top gradient bar */}
      <div className={`h-1.5 bg-gradient-to-r ${config.gradient} ${isGenerated ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'} transition-opacity`} />

      <div className="p-6">
        {/* Icon + status */}
        <div className="flex items-start justify-between mb-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${config.iconBg} shadow-lg`}>
            <Icon className={`h-7 w-7 ${config.iconColor}`} />
          </div>
          {isGenerated && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Pret</span>
            </div>
          )}
        </div>

        {/* Title + description */}
        <h3 className="text-lg font-semibold tracking-tight mb-1.5">{config.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">{config.description}</p>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Generate CTA */}
          <button
            onClick={onGenerate}
            disabled={isWorking}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              isWorking
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isGenerated
                  ? 'border-2 border-border text-foreground hover:bg-accent'
                  : `bg-gradient-to-r ${config.gradient} text-white shadow-md hover:shadow-lg hover:scale-[1.02]`
            }`}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generation...</>
            ) : (
              <><Rocket className="h-4 w-4" /> {isGenerated ? 'Regenerer' : 'Generer'}</>
            )}
          </button>

          {/* View result */}
          {isGenerated && config.dashboardUrl && (
            <Link
              href={`/dashboard/workspace/${workspaceId}/validation/${config.dashboardUrl}`}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground/5 px-4 py-2.5 text-sm font-medium hover:bg-foreground/10 transition-colors"
            >
              Voir le resultat <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          {/* Expand for non-dashboard */}
          {isGenerated && !config.dashboardUrl && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-2 rounded-xl bg-foreground/5 px-4 py-2.5 text-sm font-medium hover:bg-foreground/10 transition-colors"
            >
              {expanded ? 'Masquer' : 'Voir le resultat'}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}

          {/* Copy */}
          {isGenerated && !config.dashboardUrl && (
            <button
              onClick={handleCopy}
              className="inline-flex items-center rounded-xl border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
          )}

          {/* Upload */}
          <button
            onClick={handleFileSelect}
            disabled={isWorking}
            className="inline-flex items-center rounded-xl border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
            title="Uploader un document"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && isGenerated && action?.content && !config.dashboardUrl && (
        <div className="border-t bg-muted/20 p-6">
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
  const searchParams = useSearchParams()
  const isAutoMode = searchParams.get('mode') === 'auto'
  const autoStarted = useRef(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null)
  const [actions, setActions] = useState<Record<string, ActionData>>({})
  const [loading, setLoading] = useState(true)
  const [generatingAction, setGeneratingAction] = useState<string | null>(null)
  const [uploadingAction, setUploadingAction] = useState<string | null>(null)
  const [streamContent, setStreamContent] = useState('')
  const [autoProgress, setAutoProgress] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('identity')

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

  useEffect(() => {
    if (!isAutoMode || loading || !dashboard || autoStarted.current) return
    autoStarted.current = true

    async function runAll() {
      const { data: freshWs } = await supabase
        .from('workspaces').select('metadata').eq('id', params.id).single()
      const freshActions = (freshWs?.metadata as any)?.actions || {}

      for (const config of ALL_ACTIONS) {
        if (freshActions[config.key]?.status === 'generated') continue
        setAutoProgress(config.title)
        await handleGenerateAsync(config.key)
        const { data: updatedWs } = await supabase
          .from('workspaces').select('metadata').eq('id', params.id).single()
        if (updatedWs?.metadata?.actions) {
          Object.assign(freshActions, updatedWs.metadata.actions)
          setActions({ ...updatedWs.metadata.actions })
        }
      }
      setAutoProgress(null)
    }
    runAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoMode, loading, dashboard])

  async function handleGenerateAsync(actionType: string) {
    setGeneratingAction(actionType)
    setStreamContent('')
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/chat/${params.id}/actions/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
            if (parsed.content) { content += parsed.content; setStreamContent(content) }
          } catch { /* ignore */ }
        }
      }
      const { data } = await supabase.from('workspaces').select('metadata').eq('id', params.id).single()
      if (data?.metadata?.actions) setActions(data.metadata.actions)
    } catch (err) {
      console.error('Action generation failed:', err)
    } finally {
      setGeneratingAction(null)
      setStreamContent('')
    }
  }

  async function handleUpload(actionType: string, file: File) {
    setUploadingAction(actionType)
    setStreamContent('')
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/chat/${params.id}/actions/${actionType}/upload`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
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
            if (parsed.content) { content += parsed.content; setStreamContent(content) }
          } catch { /* ignore */ }
        }
      }
      const { data } = await supabase.from('workspaces').select('metadata').eq('id', params.id).single()
      if (data?.metadata?.actions) setActions(data.metadata.actions)
    } catch (err) {
      console.error('Upload generation failed:', err)
    } finally {
      setUploadingAction(null)
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

  const completedCount = ALL_ACTIONS.filter(a => actions[a.key]?.status === 'generated').length
  const totalCount = ALL_ACTIONS.length
  const progressPct = (completedCount / totalCount) * 100
  const currentTab = TABS.find(t => t.key === activeTab) || TABS[0]

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/workspace/${params.id}/report`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{workspaceName}</h1>
          <p className="text-sm text-muted-foreground">Construis ta strategie etape par etape</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-bold">{completedCount}<span className="text-muted-foreground font-normal text-sm">/{totalCount}</span></div>
          </div>
          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Auto mode banner */}
      {isAutoMode && autoProgress && (
        <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
            <div>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Mode automatique</span>
              <p className="text-sm text-muted-foreground mt-0.5">Generation : {autoProgress}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generation progress */}
      {(generatingAction || uploadingAction) && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {uploadingAction ? 'Analyse du document...' : `Generation : ${ALL_ACTIONS.find(a => a.key === generatingAction)?.title}`}
              </p>
              <p className="text-xs text-muted-foreground">L&apos;agent travaille</p>
            </div>
            {streamContent && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                En cours
              </div>
            )}
          </div>
          {streamContent && (
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 animate-pulse" style={{ width: '60%' }} />
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-2xl bg-muted/50 p-1.5">
        {TABS.map(tab => {
          const TabIcon = tab.icon
          const tabCompleted = tab.actions.filter(a => actions[a.key]?.status === 'generated').length
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white dark:bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tabCompleted > 0 && (
                <span className={`inline-flex items-center justify-center h-5 min-w-[20px] rounded-full text-[10px] font-bold ${
                  tabCompleted === tab.actions.length
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                }`}>
                  {tabCompleted}/{tab.actions.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Cards grid */}
      <div className={`grid gap-5 ${currentTab.actions.length === 1 ? 'grid-cols-1 max-w-xl' : currentTab.actions.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {currentTab.actions.map((config) => (
          <ActionCard
            key={config.key}
            config={config}
            action={actions[config.key]}
            onGenerate={() => handleGenerateAsync(config.key)}
            onUpload={(file) => handleUpload(config.key, file)}
            generating={generatingAction === config.key}
            uploading={uploadingAction === config.key}
            workspaceId={params.id}
          />
        ))}
      </div>

      {/* Back */}
      <div className="flex justify-center gap-4 pt-4 pb-8">
        <Link href={`/dashboard/workspace/${params.id}/report`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="h-4 w-4" /> Rapport d&apos;analyse
        </Link>
        <Link href={`/dashboard/workspace/${params.id}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          Continuer la discussion
        </Link>
      </div>
    </div>
  )
}
