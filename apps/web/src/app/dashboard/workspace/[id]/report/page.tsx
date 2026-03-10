'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Users,
  DollarSign,
  BarChart3,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Handshake,
  ShieldAlert,
  BookOpen,
  Calendar,
  MessageCircle,
  Lightbulb,
  ClipboardCheck,
  Beaker,
  UserPlus,
  Shield,
  Tag,
  Gauge,
  Package,
  Globe,
  Rocket,
} from 'lucide-react'

interface ScoreItem {
  score: number
  label: string
  justification: string
}

interface Competitor {
  name: string
  positioning: string
  pricing: string
  threat: string
  advice?: string
}

interface Weakness {
  text: string
  severity: string
}

interface KPI {
  name: string
  m3: string
  m6: string
  m12: string
}

interface Channel {
  name: string
  budget: string
  expected: string
  method?: string
}

interface Partnership {
  type: string
  examples: string
  approach: string
  value: string
}

interface Risk {
  risk: string
  probability: string
  impact: string
  mitigation: string
}

interface Resource {
  type: string
  name: string
  why: string
}

interface TimelineItem {
  period: string
  actions: string
}

interface ClientValidation {
  targetCount: number
  questions: string[]
  validationScore: number
  interpretation: string
}

interface CriticalHypothesis {
  hypothesis: string
  testMethod: string
  successCriteria: string
  timeframe: string
}

interface FirstTenStep {
  step: number
  action: string
  channel: string
  script: string
}

interface MoatDimension {
  score: number
  explanation: string
}

interface MoatAnalysis {
  networkEffect: MoatDimension
  brand: MoatDimension
  technology: MoatDimension
  data: MoatDimension
  switchingCost: MoatDimension
  overall: string
}

interface PricingBenchmarkItem {
  competitor: string
  price: string
  includes: string
  positioning: string
}

interface SimplicityIndex {
  score: number
  complexity: string
  simplification: string
}

interface MvpPlan {
  coreFeatures: string[]
  niceToHave: string[]
  notNow: string[]
  techStack: string
  timeline: string
  budget: string
}

interface LandingPageTest {
  title: string
  pitch: string
  cta: string
  metrics: string
}

interface DashboardData {
  summary: string
  verdict: 'excellent' | 'prometteur' | 'moyen' | 'faible'
  verdictMessage?: string
  topAdvice?: string
  scores: Record<string, ScoreItem>
  scoreTotal: number
  competitors?: Competitor[]
  market?: { tam: string; sam: string; som: string; growth?: string }
  financials?: {
    initialInvestment: string
    monthlyBurn: string
    breakeven: string
    revenueM12: { low: string; mid: string; high: string }
  }
  strengths?: string[]
  weaknesses?: Weakness[]
  partnerships?: Partnership[]
  risks?: Risk[]
  kpis?: KPI[]
  channels?: Channel[]
  resources?: Resource[]
  timeline?: TimelineItem[]
  nextSteps?: string[]
  clientValidation?: ClientValidation
  criticalHypothesis?: CriticalHypothesis
  firstTenCustomers?: FirstTenStep[]
  moatAnalysis?: MoatAnalysis
  pricingBenchmark?: PricingBenchmarkItem[]
  simplicityIndex?: SimplicityIndex
  mvpPlan?: MvpPlan
  landingPageTest?: LandingPageTest
}

const verdictConfig = {
  excellent: { label: 'Excellent — Fonce !', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-300 dark:border-emerald-800', gradient: 'from-emerald-500 to-emerald-600', icon: TrendingUp },
  prometteur: { label: 'Prometteur — A ajuster', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800', gradient: 'from-blue-500 to-blue-600', icon: TrendingUp },
  moyen: { label: 'Moyen — Pivot necessaire', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300 dark:border-amber-800', gradient: 'from-amber-500 to-amber-600', icon: Minus },
  faible: { label: 'Faible — A reconsiderer', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800', gradient: 'from-red-500 to-red-600', icon: TrendingDown },
}

function ScoreRadial({ score, label, justification }: ScoreItem) {
  const pct = (score / 10) * 100
  const color = score >= 7 ? 'text-emerald-500' : score >= 5 ? 'text-amber-500' : 'text-red-500'
  const barColor = score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-2xl font-bold tabular-nums ${color}`}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{justification}</p>
    </div>
  )
}

function ThreatBadge({ level }: { level: string }) {
  const cls = level === 'haute' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : level === 'moyenne' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${cls}`}>{level}</span>
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, string> = {
    critique: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    important: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    mineur: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  }
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${config[severity] || config.mineur}`}>{severity}</span>
}

const resourceIcons: Record<string, string> = {
  Newsletter: '📬',
  Podcast: '🎙️',
  Livre: '📖',
  Communaute: '👥',
  Outil: '🛠️',
  Article: '📰',
  Etude: '📊',
}

export default function ReportPage() {
  const params = useParams<{ id: string }>()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('workspaces')
        .select('name, metadata')
        .eq('id', params.id)
        .single()

      if (data?.metadata?.dashboard) {
        setDashboard(data.metadata.dashboard as unknown as DashboardData)
        setWorkspaceName(data.name)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

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
        <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Pas encore d&apos;analyse disponible.</p>
        <p className="text-sm text-muted-foreground/60">Continue la conversation pour generer le tableau de bord.</p>
        <Link href={`/dashboard/workspace/${params.id}`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour au workspace
        </Link>
      </div>
    )
  }

  const verdict = verdictConfig[dashboard.verdict] || verdictConfig.moyen
  const VerdictIcon = verdict.icon

  return (
    <div className="px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/workspace/${params.id}`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{workspaceName}</h1>
          <p className="text-sm text-muted-foreground">Rapport d&apos;analyse strategique</p>
        </div>
      </div>

      {/* Verdict banner */}
      <div className={`rounded-xl border-2 ${verdict.border} ${verdict.bg} p-6`}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${verdict.gradient} text-white`}>
              <VerdictIcon className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h2 className={`text-xl font-bold ${verdict.color}`}>{verdict.label}</h2>
              <p className="text-sm text-muted-foreground">{dashboard.summary}</p>
              {dashboard.verdictMessage && (
                <p className="text-sm leading-relaxed mt-2 italic">&ldquo;{dashboard.verdictMessage}&rdquo;</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-5xl font-bold tabular-nums ${verdict.color}`}>{dashboard.scoreTotal}</div>
            <div className="text-sm text-muted-foreground">/80</div>
          </div>
        </div>
      </div>

      {/* Top advice callout */}
      {dashboard.topAdvice && (
        <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-5 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
            <Lightbulb className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-1">Conseil numero 1</div>
            <p className="text-sm leading-relaxed">{dashboard.topAdvice}</p>
          </div>
        </div>
      )}

      {/* Scores grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-violet-500" />
          <h3 className="text-lg font-semibold">Scoring strategique</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.values(dashboard.scores).map((s) => (
            <ScoreRadial key={s.label} {...s} />
          ))}
        </div>
      </div>

      {/* Market + Financials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dashboard.market && (
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Potentiel de marche</h3>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'TAM', value: dashboard.market.tam, desc: 'Marche total' },
                { label: 'SAM', value: dashboard.market.sam, desc: 'Marche accessible' },
                { label: 'SOM', value: dashboard.market.som, desc: 'Objectif 12 mois' },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{m.value}</div>
                  <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                </div>
              ))}
            </div>
            {dashboard.market.growth && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-muted-foreground">Croissance :</span>
                <span className="font-semibold text-emerald-600">{dashboard.market.growth}</span>
              </div>
            )}
          </div>
        )}

        {dashboard.financials && (
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold">Projection financiere</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b"><span className="text-sm text-muted-foreground">Investissement initial</span><span className="font-semibold">{dashboard.financials.initialInvestment}</span></div>
              <div className="flex justify-between items-center py-2 border-b"><span className="text-sm text-muted-foreground">Burn rate mensuel</span><span className="font-semibold">{dashboard.financials.monthlyBurn}</span></div>
              <div className="flex justify-between items-center py-2 border-b"><span className="text-sm text-muted-foreground">Point de rentabilite</span><span className="font-semibold text-emerald-600">{dashboard.financials.breakeven}</span></div>
              <div className="pt-2">
                <div className="text-xs text-muted-foreground mb-2">CA a 12 mois</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-2 text-center"><div className="text-[10px] text-muted-foreground">Pessimiste</div><div className="text-sm font-semibold text-red-600">{dashboard.financials.revenueM12.low}</div></div>
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-2 text-center"><div className="text-[10px] text-muted-foreground">Realiste</div><div className="text-sm font-semibold text-amber-600">{dashboard.financials.revenueM12.mid}</div></div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 p-2 text-center"><div className="text-[10px] text-muted-foreground">Optimiste</div><div className="text-sm font-semibold text-emerald-600">{dashboard.financials.revenueM12.high}</div></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Competitors with advice */}
      {dashboard.competitors && dashboard.competitors.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-orange-500" />
            <h3 className="font-semibold">Concurrents a surveiller</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">Concurrent</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">Positionnement</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">Pricing</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">Menace</th>
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase">Conseil</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.competitors.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium whitespace-nowrap">{c.name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.positioning}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{c.pricing}</td>
                    <td className="py-3 pr-4"><ThreatBadge level={c.threat} /></td>
                    <td className="py-3 text-xs text-muted-foreground italic">{c.advice || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dashboard.strengths && dashboard.strengths.length > 0 && (
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><h3 className="font-semibold">Forces</h3></div>
            <div className="space-y-2.5">
              {dashboard.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2.5"><div className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" /><span className="text-sm">{s}</span></div>
              ))}
            </div>
          </div>
        )}
        {dashboard.weaknesses && dashboard.weaknesses.length > 0 && (
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4"><AlertTriangle className="h-5 w-5 text-amber-500" /><h3 className="font-semibold">Faiblesses & Risques</h3></div>
            <div className="space-y-2.5">
              {dashboard.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5"><div className="mt-1.5 h-2 w-2 rounded-full bg-red-500 shrink-0" /><span className="text-sm">{w.text}</span></div>
                  <SeverityBadge severity={w.severity} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Client Validation */}
      {dashboard.clientValidation && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><ClipboardCheck className="h-5 w-5 text-cyan-500" /><h3 className="font-semibold">Test de validation client</h3></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Questions a poser a {dashboard.clientValidation.targetCount} prospects</div>
              {dashboard.clientValidation.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-[10px] font-bold text-cyan-600 dark:text-cyan-400">{i + 1}</div>
                  <span className="text-sm">{q}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="rounded-xl bg-cyan-50 dark:bg-cyan-950/20 p-5 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Score de validation</div>
                <div className={`text-4xl font-bold tabular-nums ${dashboard.clientValidation.validationScore >= 7 ? 'text-emerald-500' : dashboard.clientValidation.validationScore >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                  {dashboard.clientValidation.validationScore}<span className="text-lg text-muted-foreground">/10</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{dashboard.clientValidation.interpretation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Critical Hypothesis */}
      {dashboard.criticalHypothesis && (
        <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-6">
          <div className="flex items-center gap-2 mb-4"><Beaker className="h-5 w-5 text-amber-500" /><h3 className="font-semibold">Hypothese critique a tester</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Hypothese</div>
                <p className="text-sm font-medium">{dashboard.criticalHypothesis.hypothesis}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Methode de test</div>
                <p className="text-sm text-muted-foreground">{dashboard.criticalHypothesis.testMethod}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Critere de succes</div>
                <p className="text-sm text-muted-foreground">{dashboard.criticalHypothesis.successCriteria}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Delai</div>
                <p className="text-sm font-medium">{dashboard.criticalHypothesis.timeframe}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* First 10 Customers Plan */}
      {dashboard.firstTenCustomers && dashboard.firstTenCustomers.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><UserPlus className="h-5 w-5 text-violet-500" /><h3 className="font-semibold">Plan : tes 10 premiers clients</h3></div>
          <div className="space-y-4">
            {dashboard.firstTenCustomers.map((s) => (
              <div key={s.step} className="flex items-start gap-4 rounded-lg border p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40 text-sm font-bold text-violet-600 dark:text-violet-400">
                  {s.step}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="font-medium text-sm">{s.action}</div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">Canal : <span className="font-medium text-foreground">{s.channel}</span></span>
                  </div>
                  <div className="text-xs text-muted-foreground italic border-l-2 border-violet-300 dark:border-violet-700 pl-3 mt-2">&ldquo;{s.script}&rdquo;</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Moat Analysis */}
      {dashboard.moatAnalysis && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Shield className="h-5 w-5 text-indigo-500" /><h3 className="font-semibold">Analyse des barrieres a l&apos;entree (Moat)</h3></div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[
              { key: 'networkEffect', label: 'Effet reseau', data: dashboard.moatAnalysis.networkEffect },
              { key: 'brand', label: 'Marque', data: dashboard.moatAnalysis.brand },
              { key: 'technology', label: 'Technologie', data: dashboard.moatAnalysis.technology },
              { key: 'data', label: 'Donnees', data: dashboard.moatAnalysis.data },
              { key: 'switchingCost', label: 'Cout de switch', data: dashboard.moatAnalysis.switchingCost },
            ].map((m) => {
              const color = m.data.score >= 7 ? 'text-emerald-500' : m.data.score >= 4 ? 'text-amber-500' : 'text-red-500'
              const barColor = m.data.score >= 7 ? 'bg-emerald-500' : m.data.score >= 4 ? 'bg-amber-500' : 'bg-red-500'
              return (
                <div key={m.key} className="rounded-lg border p-3 text-center space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</div>
                  <div className={`text-2xl font-bold tabular-nums ${color}`}>{m.data.score}<span className="text-xs text-muted-foreground">/10</span></div>
                  <div className="h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${m.data.score * 10}%` }} /></div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{m.data.explanation}</p>
                </div>
              )
            })}
          </div>
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">Synthese</div>
            <p className="text-sm">{dashboard.moatAnalysis.overall}</p>
          </div>
        </div>
      )}

      {/* Pricing Benchmark */}
      {dashboard.pricingBenchmark && dashboard.pricingBenchmark.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Tag className="h-5 w-5 text-pink-500" /><h3 className="font-semibold">Benchmark pricing</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">Concurrent</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">Prix</th>
                  <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">Inclus</th>
                  <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase">Positionnement</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.pricingBenchmark.map((p) => (
                  <tr key={p.competitor} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium whitespace-nowrap">{p.competitor}</td>
                    <td className="py-3 pr-4 font-semibold">{p.price}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.includes}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${
                        p.positioning === 'premium' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                        : p.positioning === 'mid' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }`}>{p.positioning}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Simplicity Index */}
      {dashboard.simplicityIndex && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Gauge className="h-5 w-5 text-teal-500" /><h3 className="font-semibold">Indice de simplicite</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl bg-teal-50 dark:bg-teal-950/20 p-5 text-center">
              <div className={`text-5xl font-bold tabular-nums ${dashboard.simplicityIndex.score >= 7 ? 'text-emerald-500' : dashboard.simplicityIndex.score >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                {dashboard.simplicityIndex.score}<span className="text-lg text-muted-foreground">/10</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{dashboard.simplicityIndex.score >= 7 ? 'Simple a lancer' : dashboard.simplicityIndex.score >= 5 ? 'Complexite moderee' : 'Complexe — simplifie !'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ou est la complexite</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{dashboard.simplicityIndex.complexity}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-2">Comment simplifier</div>
              <p className="text-sm leading-relaxed">{dashboard.simplicityIndex.simplification}</p>
            </div>
          </div>
        </div>
      )}

      {/* MVP Plan */}
      {dashboard.mvpPlan && (
        <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Package className="h-5 w-5 text-violet-500" /><h3 className="font-semibold">Plan MVP</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">Indispensable</div>
              <div className="space-y-2">
                {dashboard.mvpPlan.coreFeatures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" /><span className="text-sm">{f}</span></div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Nice to have (V2)</div>
              <div className="space-y-2">
                {dashboard.mvpPlan.niceToHave.map((f, i) => (
                  <div key={i} className="flex items-start gap-2"><Minus className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" /><span className="text-sm text-muted-foreground">{f}</span></div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-3">Pas maintenant</div>
              <div className="space-y-2">
                {dashboard.mvpPlan.notNow.map((f, i) => (
                  <div key={i} className="flex items-start gap-2"><span className="text-red-400 shrink-0 mt-0.5 text-sm">✕</span><span className="text-sm text-muted-foreground line-through">{f}</span></div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center"><div className="text-[10px] text-muted-foreground uppercase">Stack</div><div className="text-sm font-medium mt-1">{dashboard.mvpPlan.techStack}</div></div>
            <div className="rounded-lg bg-muted/50 p-3 text-center"><div className="text-[10px] text-muted-foreground uppercase">Delai</div><div className="text-sm font-medium mt-1">{dashboard.mvpPlan.timeline}</div></div>
            <div className="rounded-lg bg-muted/50 p-3 text-center"><div className="text-[10px] text-muted-foreground uppercase">Budget</div><div className="text-sm font-medium mt-1">{dashboard.mvpPlan.budget}</div></div>
          </div>
        </div>
      )}

      {/* Landing Page Test */}
      {dashboard.landingPageTest && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Globe className="h-5 w-5 text-blue-500" /><h3 className="font-semibold">Test landing page</h3></div>
          <div className="rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10 p-6 text-center space-y-3">
            <h4 className="text-xl font-bold">{dashboard.landingPageTest.title}</h4>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">{dashboard.landingPageTest.pitch}</p>
            <div className="inline-flex items-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground">{dashboard.landingPageTest.cta}</div>
          </div>
          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Metriques a suivre</div>
            <p className="text-sm">{dashboard.landingPageTest.metrics}</p>
          </div>
        </div>
      )}

      {/* Partnerships */}
      {dashboard.partnerships && dashboard.partnerships.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Handshake className="h-5 w-5 text-blue-500" /><h3 className="font-semibold">Partenariats potentiels</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {dashboard.partnerships.map((p, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <div className="font-medium text-sm">{p.type}</div>
                <div className="text-xs"><span className="text-muted-foreground">Exemples : </span><span className="font-medium">{p.examples}</span></div>
                <div className="text-xs"><span className="text-muted-foreground">Approche : </span>{p.approach}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">{p.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks with mitigation */}
      {dashboard.risks && dashboard.risks.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><ShieldAlert className="h-5 w-5 text-red-500" /><h3 className="font-semibold">Risques & Plans B</h3></div>
          <div className="space-y-3">
            {dashboard.risks.map((r, i) => (
              <div key={i} className="rounded-lg border p-4 flex flex-col md:flex-row md:items-start gap-3">
                <div className="flex-1">
                  <div className="font-medium text-sm mb-1">{r.risk}</div>
                  <div className="flex gap-2 mb-2">
                    <span className="text-[10px] text-muted-foreground">Probabilite : <ThreatBadge level={r.probability} /></span>
                    <span className="text-[10px] text-muted-foreground">Impact : <ThreatBadge level={r.impact} /></span>
                  </div>
                </div>
                <div className="md:w-1/2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Plan B</div>
                  <div className="text-xs">{r.mitigation}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs */}
      {dashboard.kpis && dashboard.kpis.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><BarChart3 className="h-5 w-5 text-violet-500" /><h3 className="font-semibold">KPIs a suivre</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">KPI</th>
              <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground uppercase">3 mois</th>
              <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground uppercase">6 mois</th>
              <th className="text-center py-2 px-4 text-xs font-medium text-muted-foreground uppercase">12 mois</th>
            </tr></thead>
            <tbody>
              {dashboard.kpis.map((k) => (
                <tr key={k.name} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{k.name}</td>
                  <td className="py-3 px-4 text-center tabular-nums">{k.m3}</td>
                  <td className="py-3 px-4 text-center tabular-nums">{k.m6}</td>
                  <td className="py-3 px-4 text-center tabular-nums font-semibold text-primary">{k.m12}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Channels with method */}
      {dashboard.channels && dashboard.channels.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Zap className="h-5 w-5 text-amber-500" /><h3 className="font-semibold">Canaux d&apos;acquisition</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard.channels.map((c) => (
              <div key={c.name} className="rounded-lg border p-4 space-y-2">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">Budget : {c.budget}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">{c.expected}</div>
                {c.method && <div className="text-xs text-muted-foreground border-t pt-2 mt-2">{c.method}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {dashboard.timeline && dashboard.timeline.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Calendar className="h-5 w-5 text-indigo-500" /><h3 className="font-semibold">Roadmap</h3></div>
          <div className="relative">
            <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-gradient-to-b from-violet-400 to-violet-100 dark:to-violet-900" />
            <div className="space-y-4">
              {dashboard.timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-4 pl-1">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-[10px] font-bold text-violet-600 dark:text-violet-400 z-10">
                    {i + 1}
                  </div>
                  <div className="pt-0.5">
                    <div className="text-xs font-semibold text-violet-600 dark:text-violet-400">{t.period}</div>
                    <div className="text-sm text-muted-foreground">{t.actions}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resources */}
      {dashboard.resources && dashboard.resources.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><BookOpen className="h-5 w-5 text-teal-500" /><h3 className="font-semibold">Ressources recommandees</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {dashboard.resources.map((r, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                <span className="text-lg shrink-0">{resourceIcons[r.type] || '📌'}</span>
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{r.type}</div>
                  <div className="text-xs text-muted-foreground">{r.why}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {dashboard.nextSteps && dashboard.nextSteps.length > 0 && (
        <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-6">
          <div className="flex items-center gap-2 mb-4"><Zap className="h-5 w-5 text-violet-500" /><h3 className="font-semibold">A faire cette semaine</h3></div>
          <div className="space-y-3">
            {dashboard.nextSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-xs font-bold text-violet-600 dark:text-violet-400">{i + 1}</div>
                <span className="text-sm pt-1">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transition to Validation */}
      <div className="rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-gradient-to-r from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/20 p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white">
            <Zap className="h-7 w-7" />
          </div>
        </div>
        <h3 className="text-xl font-bold">Passe a l&apos;action</h3>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          L&apos;analyse c&apos;est bien. Mais une idee ne vaut rien sans validation terrain.
          Lance les agents pour creer ta landing page, preparer tes interviews et trouver tes premiers clients.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href={`/dashboard/workspace/${params.id}/validation`}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-violet-300 dark:border-violet-600 px-6 py-3 text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
          >
            <Zap className="h-4 w-4" /> Mode manuel
          </Link>
          <Link
            href={`/dashboard/workspace/${params.id}/validation?mode=auto`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Rocket className="h-4 w-4" /> Mode automatique
          </Link>
        </div>
        <div className="flex justify-center gap-8 pt-2 text-xs text-muted-foreground">
          <span>Manuel : genere chaque element un par un</span>
          <span>Automatique : tout est genere d&apos;un coup</span>
        </div>
      </div>

      {/* Back */}
      <div className="flex justify-center gap-4 pb-8">
        <Link href={`/dashboard/workspace/${params.id}`} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="h-4 w-4" /> Retour au workspace
        </Link>
        <Link href={`/dashboard/workspace/${params.id}`} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">
          <MessageCircle className="h-4 w-4" /> Continuer la discussion
        </Link>
      </div>
    </div>
  )
}
