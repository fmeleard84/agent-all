'use client'

import Link from 'next/link'
import { ArrowRight, TrendingUp, TrendingDown, Minus, Target, Zap } from 'lucide-react'

interface DashboardData {
  summary: string
  verdict: 'excellent' | 'prometteur' | 'moyen' | 'faible'
  scores: Record<string, { score: number; label: string }>
  scoreTotal: number
  market?: { tam: string; sam: string; som: string }
  financials?: { initialInvestment: string; breakeven: string }
  strengths?: string[]
  weaknesses?: { text: string; severity: string }[]
  nextSteps?: string[]
}

interface DashboardSummaryProps {
  data: DashboardData
  workspaceId: string
}

const verdictConfig = {
  excellent: { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', icon: TrendingUp },
  prometteur: { label: 'Prometteur', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: TrendingUp },
  moyen: { label: 'Moyen', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: Minus },
  faible: { label: 'Faible', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: TrendingDown },
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = (score / 10) * 100
  const color = score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground truncate pr-2">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums">{score}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function DashboardSummary({ data, workspaceId }: DashboardSummaryProps) {
  const verdict = verdictConfig[data.verdict] || verdictConfig.moyen
  const VerdictIcon = verdict.icon

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className={`rounded-lg border ${verdict.border} ${verdict.bg} p-3`}>
        <div className="flex items-center gap-2 mb-1">
          <VerdictIcon className={`h-4 w-4 ${verdict.color}`} />
          <span className={`text-sm font-semibold ${verdict.color}`}>{verdict.label}</span>
          <span className="ml-auto text-lg font-bold tabular-nums">{data.scoreTotal}/80</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{data.summary}</p>
      </div>

      {/* Scores */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Scores</h4>
        <div className="space-y-2">
          {Object.values(data.scores).map((s) => (
            <ScoreBar key={s.label} score={s.score} label={s.label} />
          ))}
        </div>
      </div>

      {/* Market */}
      {data.market && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Marche</h4>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'TAM', value: data.market.tam },
              { label: 'SAM', value: data.market.sam },
              { label: 'SOM', value: data.market.som },
            ].map((m) => (
              <div key={m.label} className="rounded-md bg-accent/40 p-2 text-center">
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                <div className="text-xs font-semibold">{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick strengths/weaknesses */}
      {data.strengths && data.strengths.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Points cles</h4>
          <div className="space-y-1">
            {data.strengths.slice(0, 3).map((s, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-emerald-500 mt-0.5">+</span>
                <span className="text-muted-foreground">{s}</span>
              </div>
            ))}
            {data.weaknesses?.slice(0, 2).map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                <span className="text-red-500 mt-0.5">-</span>
                <span className="text-muted-foreground">{w.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to full report */}
      <Link
        href={`/dashboard/workspace/${workspaceId}/report`}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
      >
        <Target className="h-4 w-4" />
        Voir le rapport complet
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      {/* Link to validation */}
      <Link
        href={`/dashboard/workspace/${workspaceId}/validation`}
        className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-700"
      >
        <Zap className="h-4 w-4" />
        Passer a l&apos;action
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
