'use client'

import { useRef } from 'react'
import { useParams } from 'next/navigation'
import { exportDashboardPdf } from '@/lib/export-pdf'
import { useEditableAction } from '@/hooks/use-editable-action'
import { EditableText } from '@/components/ui/editable-text'
import { EditableList } from '@/components/ui/editable-list'
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
  Plus,
  X,
  Save,
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
  const { data, loading, saving, workspaceName, updateField, setFieldDirectly } =
    useEditableAction<CompetitiveAnalysis>(params.id, 'competitive')
  const dashboardRef = useRef<HTMLDivElement>(null)

  async function handleExportPdf() {
    if (!dashboardRef.current) return
    await exportDashboardPdf(dashboardRef.current, `analyse-concurrentielle-${workspaceName}.pdf`)
  }

  function addCompetitor() {
    setFieldDirectly(prev => ({
      ...prev,
      competitors: [...prev.competitors, { name: 'Nouveau concurrent', positioning: '', pricing: '', strengths: [], weaknesses: [], threatLevel: 'moyenne' as const }],
    }))
  }

  function removeCompetitor(index: number) {
    setFieldDirectly(prev => ({ ...prev, competitors: prev.competitors.filter((_, i) => i !== index) }))
  }

  function addAxis() {
    setFieldDirectly(prev => ({
      ...prev,
      differentiationAxes: [...prev.differentiationAxes, { axis: 'Nouvel axe', description: '', strengthScore: 5, competitors: '' }],
    }))
  }

  function removeAxis(index: number) {
    setFieldDirectly(prev => ({ ...prev, differentiationAxes: prev.differentiationAxes.filter((_, i) => i !== index) }))
  }

  function addOpportunity() {
    setFieldDirectly(prev => ({
      ...prev,
      opportunities: [...prev.opportunities, { title: 'Nouvelle opportunite', description: '', actionable: '' }],
    }))
  }

  function removeOpportunity(index: number) {
    setFieldDirectly(prev => ({ ...prev, opportunities: prev.opportunities.filter((_, i) => i !== index) }))
  }

  function addRisk() {
    setFieldDirectly(prev => ({
      ...prev,
      risks: [...prev.risks, { title: 'Nouveau risque', description: '', probability: 'moyenne' as const, impact: 'moyen' as const, mitigation: '' }],
    }))
  }

  function removeRisk(index: number) {
    setFieldDirectly(prev => ({ ...prev, risks: prev.risks.filter((_, i) => i !== index) }))
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
    <div className="px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-xl border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500 shadow-lg shadow-red-500/20">
              <Swords className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Analyse concurrentielle</h1>
              <p className="text-sm text-muted-foreground">{workspaceName}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Save className="h-3.5 w-3.5 animate-pulse" /> Sauvegarde...</span>}
          <button onClick={handleExportPdf} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors">
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      <div ref={dashboardRef} className="space-y-8">
        {/* Competitors */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-red-500 to-rose-500" />
            <h2 className="text-lg font-semibold">Concurrents ({data.competitors.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.competitors.map((c, i) => (
              <div key={i} className="group/card relative rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all">
                <div className="h-1.5 bg-gradient-to-r from-red-500 to-rose-500 opacity-60" />
                <button onClick={() => removeCompetitor(i)} className="absolute top-5 right-4 p-1 rounded-lg opacity-0 group-hover/card:opacity-60 hover:!opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all">
                  <X className="h-4 w-4" />
                </button>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <EditableText value={c.name} onChange={v => updateField(`competitors[${i}].name`, v)} as="h3" className="font-semibold text-base" />
                    <select value={c.threatLevel} onChange={e => updateField(`competitors[${i}].threatLevel`, e.target.value)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border-0 cursor-pointer ${threatColors[c.threatLevel]}`}>
                      <option value="haute">Menace haute</option>
                      <option value="moyenne">Menace moyenne</option>
                      <option value="faible">Menace faible</option>
                    </select>
                  </div>
                  <EditableText value={c.positioning} onChange={v => updateField(`competitors[${i}].positioning`, v)} as="p" className="text-sm text-muted-foreground" multiline placeholder="Positionnement..." />
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium shrink-0">Prix :</span>
                    <EditableText value={c.pricing} onChange={v => updateField(`competitors[${i}].pricing`, v)} as="span" className="text-xs" placeholder="Tarification..." />
                  </div>
                  {c.website && (
                    <div className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 text-primary shrink-0" />
                      <EditableText value={c.website || ''} onChange={v => updateField(`competitors[${i}].website`, v)} as="span" className="text-xs text-primary" placeholder="https://..." />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Forces</p>
                      <EditableList items={c.strengths} onChange={v => setFieldDirectly(prev => { const competitors = [...prev.competitors]; competitors[i] = { ...competitors[i], strengths: v }; return { ...prev, competitors } })} itemClassName="text-xs text-muted-foreground" addLabel="+" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase mb-1">Faiblesses</p>
                      <EditableList items={c.weaknesses} onChange={v => setFieldDirectly(prev => { const competitors = [...prev.competitors]; competitors[i] = { ...competitors[i], weaknesses: v }; return { ...prev, competitors } })} itemClassName="text-xs text-muted-foreground" addLabel="+" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addCompetitor} className="rounded-2xl border-2 border-dashed border-muted-foreground/20 p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-red-300 hover:text-red-500 transition-colors min-h-[200px]">
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">Ajouter un concurrent</span>
            </button>
          </div>
        </section>

        {/* Differentiation Axes */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-violet-500 to-purple-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="h-5 w-5 text-violet-500" /> Axes de differenciation</h2>
          </div>
          <div className="space-y-3">
            {data.differentiationAxes.map((a, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5 group/axis relative hover:shadow-md transition-all">
                <button onClick={() => removeAxis(i)} className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover/axis:opacity-60 hover:!opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all">
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center justify-between mb-2 gap-4">
                  <EditableText value={a.axis} onChange={v => updateField(`differentiationAxes[${i}].axis`, v)} as="h3" className="font-medium" />
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="number" min={1} max={10} value={a.strengthScore}
                      onChange={e => updateField(`differentiationAxes[${i}].strengthScore`, Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-14 rounded-lg border bg-background px-2 py-0.5 text-sm text-center font-semibold text-violet-600 dark:text-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <span className="text-sm text-muted-foreground">/10</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-muted mb-3 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all" style={{ width: `${a.strengthScore * 10}%` }} />
                </div>
                <EditableText value={a.description} onChange={v => updateField(`differentiationAxes[${i}].description`, v)} as="p" className="text-sm text-muted-foreground" multiline placeholder="Description..." />
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground/70 italic shrink-0">Concurrents :</span>
                  <EditableText value={a.competitors} onChange={v => updateField(`differentiationAxes[${i}].competitors`, v)} as="span" className="text-xs text-muted-foreground/70 italic" placeholder="..." />
                </div>
              </div>
            ))}
            <button onClick={addAxis} className="w-full rounded-2xl border-2 border-dashed border-muted-foreground/20 p-4 flex items-center justify-center gap-2 text-muted-foreground hover:border-violet-300 hover:text-violet-500 transition-colors">
              <Plus className="h-4 w-4" /> <span className="text-sm font-medium">Ajouter un axe</span>
            </button>
          </div>
        </section>

        {/* Opportunities & Risks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-500" /> Opportunites</h2>
            </div>
            <div className="space-y-3">
              {data.opportunities.map((o, i) => (
                <div key={i} className="rounded-2xl border bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-card p-5 group/opp relative hover:shadow-md transition-all">
                  <button onClick={() => removeOpportunity(i)} className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover/opp:opacity-60 hover:!opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all">
                    <X className="h-4 w-4" />
                  </button>
                  <EditableText value={o.title} onChange={v => updateField(`opportunities[${i}].title`, v)} as="h3" className="font-medium text-emerald-700 dark:text-emerald-400" />
                  <EditableText value={o.description} onChange={v => updateField(`opportunities[${i}].description`, v)} as="p" className="text-sm text-muted-foreground mt-1" multiline placeholder="Description..." />
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs font-medium shrink-0">Action :</span>
                    <EditableText value={o.actionable} onChange={v => updateField(`opportunities[${i}].actionable`, v)} as="span" className="text-xs" placeholder="..." />
                  </div>
                </div>
              ))}
              <button onClick={addOpportunity} className="w-full rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-emerald-500 transition-colors">
                <Plus className="h-4 w-4" /> <span className="text-sm font-medium">Ajouter</span>
              </button>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> Risques</h2>
            </div>
            <div className="space-y-3">
              {data.risks.map((r, i) => (
                <div key={i} className="rounded-2xl border bg-card p-5 group/risk relative hover:shadow-md transition-all">
                  <button onClick={() => removeRisk(i)} className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover/risk:opacity-60 hover:!opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all">
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <EditableText value={r.title} onChange={v => updateField(`risks[${i}].title`, v)} as="h3" className="font-medium" />
                    <div className="flex gap-1.5 shrink-0">
                      <select value={r.probability} onChange={e => updateField(`risks[${i}].probability`, e.target.value)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 cursor-pointer ${threatColors[r.probability]}`}>
                        <option value="haute">P: haute</option><option value="moyenne">P: moyenne</option><option value="faible">P: faible</option>
                      </select>
                      <select value={r.impact} onChange={e => updateField(`risks[${i}].impact`, e.target.value)} className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 cursor-pointer ${impactColors[r.impact]}`}>
                        <option value="fort">I: fort</option><option value="moyen">I: moyen</option><option value="faible">I: faible</option>
                      </select>
                    </div>
                  </div>
                  <EditableText value={r.description} onChange={v => updateField(`risks[${i}].description`, v)} as="p" className="text-sm text-muted-foreground" multiline placeholder="Description..." />
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">Mitigation :</span>
                    <EditableText value={r.mitigation} onChange={v => updateField(`risks[${i}].mitigation`, v)} as="span" className="text-xs text-muted-foreground" placeholder="..." />
                  </div>
                </div>
              ))}
              <button onClick={addRisk} className="w-full rounded-2xl border-2 border-dashed border-muted-foreground/20 p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-red-500 transition-colors">
                <Plus className="h-4 w-4" /> <span className="text-sm font-medium">Ajouter</span>
              </button>
            </div>
          </section>
        </div>

        {/* SWOT */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-5 w-5 text-blue-500" /> Synthese SWOT</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'strengths' as const, label: 'Forces', gradient: 'from-emerald-50 to-white dark:from-emerald-950/20 dark:to-card', textColor: 'text-emerald-700 dark:text-emerald-400' },
              { key: 'weaknesses' as const, label: 'Faiblesses', gradient: 'from-red-50 to-white dark:from-red-950/20 dark:to-card', textColor: 'text-red-700 dark:text-red-400' },
              { key: 'opportunities' as const, label: 'Opportunites', gradient: 'from-blue-50 to-white dark:from-blue-950/20 dark:to-card', textColor: 'text-blue-700 dark:text-blue-400' },
              { key: 'threats' as const, label: 'Menaces', gradient: 'from-amber-50 to-white dark:from-amber-950/20 dark:to-card', textColor: 'text-amber-700 dark:text-amber-400' },
            ].map(({ key, label, gradient, textColor }) => (
              <div key={key} className={`rounded-2xl border bg-gradient-to-br ${gradient} p-5`}>
                <h3 className={`text-sm font-semibold ${textColor} uppercase mb-3`}>{label}</h3>
                <EditableList
                  items={data.swotSummary[key]}
                  onChange={v => setFieldDirectly(prev => ({ ...prev, swotSummary: { ...prev.swotSummary, [key]: v } }))}
                  itemClassName="text-sm text-muted-foreground"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
