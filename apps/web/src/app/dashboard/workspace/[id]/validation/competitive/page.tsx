'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  Swords,
  Shield,
  Target,
  AlertTriangle,
  TrendingUp,
  Download,
  Loader2,
  ExternalLink,
} from 'lucide-react'

interface CompetitorData {
  name: string
  website?: string
  positioning: string
  pricing: string
  strengths: string[]
  weaknesses: string[]
  threatLevel: 'haute' | 'moyenne' | 'faible'
}

interface DifferentiationAxis {
  axis: string
  description: string
  strengthScore: number
  competitors: string
}

interface Opportunity {
  title: string
  description: string
  actionable: string
}

interface Risk {
  title: string
  description: string
  probability: 'haute' | 'moyenne' | 'faible'
  impact: 'fort' | 'moyen' | 'faible'
  mitigation: string
}

interface SwotSummary {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

interface CompetitiveAnalysis {
  competitors: CompetitorData[]
  differentiationAxes: DifferentiationAxis[]
  opportunities: Opportunity[]
  risks: Risk[]
  swotSummary: SwotSummary
}

const threatColors = {
  haute: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  faible: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const impactColors = {
  fort: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  moyen: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  faible: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

export default function CompetitiveDashboard() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<CompetitiveAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('')
  const dashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('name, metadata')
        .eq('id', params.id)
        .single()

      if (ws) {
        setWorkspaceName(ws.name)
        const structured = ws.metadata?.actions?.competitive?.structured
        if (structured) setData(structured as CompetitiveAnalysis)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleExportPdf() {
    const html2pdf = (await import('html2pdf.js')).default
    if (!dashboardRef.current) return
    html2pdf()
      .set({
        margin: [10, 10],
        filename: `analyse-concurrentielle-${workspaceName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(dashboardRef.current)
      .save()
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Swords className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune analyse concurrentielle generee.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour a la validation
        </Link>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Analyse concurrentielle</h1>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
        </div>
        <button
          onClick={handleExportPdf}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" /> Telecharger en PDF
        </button>
      </div>

      <div ref={dashboardRef} className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Swords className="h-5 w-5 text-red-500" /> Concurrents ({data.competitors.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.competitors.map((c, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${threatColors[c.threatLevel]}`}>
                    Menace {c.threatLevel}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{c.positioning}</p>
                <p className="text-xs font-medium">Prix : {c.pricing}</p>
                {c.website && (
                  <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> {c.website}
                  </a>
                )}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase mb-1">Forces</p>
                    {c.strengths.map((s, j) => (
                      <p key={j} className="text-xs text-muted-foreground">• {s}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase mb-1">Faiblesses</p>
                    {c.weaknesses.map((w, j) => (
                      <p key={j} className="text-xs text-muted-foreground">• {w}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-500" /> Axes de differenciation
          </h2>
          <div className="space-y-3">
            {data.differentiationAxes.map((a, i) => (
              <div key={i} className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{a.axis}</h3>
                  <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{a.strengthScore}/10</span>
                </div>
                <div className="h-2 rounded-full bg-muted mb-3">
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${a.strengthScore * 10}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">{a.description}</p>
                <p className="text-xs text-muted-foreground/70 mt-1 italic">Concurrents : {a.competitors}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" /> Opportunites
            </h2>
            <div className="space-y-3">
              {data.opportunities.map((o, i) => (
                <div key={i} className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                  <h3 className="font-medium text-emerald-700 dark:text-emerald-400">{o.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{o.description}</p>
                  <p className="text-xs mt-2 font-medium">Action : {o.actionable}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Risques
            </h2>
            <div className="space-y-3">
              {data.risks.map((r, i) => (
                <div key={i} className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{r.title}</h3>
                    <div className="flex gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${threatColors[r.probability]}`}>
                        P: {r.probability}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${impactColors[r.impact]}`}>
                        I: {r.impact}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  <p className="text-xs mt-2 font-medium text-muted-foreground">Mitigation : {r.mitigation}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" /> Synthese SWOT
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-2">Forces</h3>
              {data.swotSummary.strengths.map((s, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {s}</p>
              ))}
            </div>
            <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase mb-2">Faiblesses</h3>
              {data.swotSummary.weaknesses.map((w, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {w}</p>
              ))}
            </div>
            <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-5">
              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase mb-2">Opportunites</h3>
              {data.swotSummary.opportunities.map((o, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {o}</p>
              ))}
            </div>
            <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-5">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase mb-2">Menaces</h3>
              {data.swotSummary.threats.map((t, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {t}</p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
