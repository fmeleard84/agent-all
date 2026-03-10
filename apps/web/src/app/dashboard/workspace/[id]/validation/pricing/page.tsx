'use client'

import { useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useEditableAction } from '@/hooks/use-editable-action'
import { EditableText } from '@/components/ui/editable-text'
import { EditableList } from '@/components/ui/editable-list'
import { exportDashboardPdf } from '@/lib/export-pdf'
import Link from 'next/link'
import {
  ArrowLeft,
  Tag,
  Download,
  Loader2,
  TrendingUp,
  Star,
  MessageSquare,
  FlaskConical,
  Calendar,
  Save,
  Copy,
  Check,
  Crown,
  Shield,
  Zap,
} from 'lucide-react'

interface BenchmarkItem {
  competitor: string
  price: string
  includes: string
  positioning: string
  strengths: string
  weaknesses: string
}

interface PricingOption {
  name: string
  price: string
  billing: string
  includes: string[]
  targetClient: string
  margin: string
  rationale: string
}

interface ObjectionItem {
  objection: string
  response: string
}

interface PricingData {
  benchmark: BenchmarkItem[]
  options: PricingOption[]
  recommended: {
    optionName: string
    reasoning: string
    framing: string
    objections: ObjectionItem[]
  }
  testPlan: {
    message: string
    landingPageTips: string
    vanWestendorp: string[]
    minResponses: string
  }
  evolution: {
    launchPrice: string
    targetPrice12m: string
    increaseStrategy: string
    grandfathering: string
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="shrink-0 rounded-lg p-1.5 hover:bg-accent transition-colors" title="Copier">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  )
}

const positionColors: Record<string, string> = {
  premium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  mid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const optionIcons = [Crown, Star, Shield]
const optionGradients = [
  'from-amber-500 to-orange-500',
  'from-violet-500 to-purple-500',
  'from-blue-500 to-cyan-500',
]

export default function PricingDashboard() {
  const params = useParams<{ id: string }>()
  const { data, loading, saving, workspaceName, updateField } = useEditableAction<PricingData>(params.id, 'pricing')
  const dashboardRef = useRef<HTMLDivElement>(null)

  async function handleExportPdf() {
    if (!dashboardRef.current) return
    await exportDashboardPdf(dashboardRef.current, `pricing-strategy-${workspaceName}.pdf`)
  }

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  if (!data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Tag className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune strategie de pricing generee.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Retour</Link>
      </div>
    )
  }

  const recommendedIdx = data.options?.findIndex(o => o.name === data.recommended?.optionName)

  return (
    <div className="px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-xl border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500 shadow-lg shadow-pink-500/20">
              <Tag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Strategie de pricing</h1>
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
        {/* Benchmark concurrentiel */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-pink-500" /> Benchmark concurrentiel</h2>
          </div>
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left p-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Concurrent</th>
                    <th className="text-left p-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prix</th>
                    <th className="text-left p-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inclus</th>
                    <th className="text-center p-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {data.benchmark?.map((b, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="p-4">
                        <EditableText value={b.competitor} onChange={v => updateField(`benchmark[${i}].competitor`, v)} as="p" className="font-semibold text-sm" />
                      </td>
                      <td className="p-4">
                        <EditableText value={b.price} onChange={v => updateField(`benchmark[${i}].price`, v)} as="p" className="text-sm font-medium" />
                      </td>
                      <td className="p-4">
                        <EditableText value={b.includes} onChange={v => updateField(`benchmark[${i}].includes`, v)} as="p" className="text-xs text-muted-foreground" />
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${positionColors[b.positioning] || positionColors.mid}`}>
                          {b.positioning}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Options de pricing */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-violet-500 to-purple-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><Star className="h-5 w-5 text-violet-500" /> Options de prix</h2>
          </div>
          <div className={`grid gap-5 ${data.options?.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
            {data.options?.map((opt, i) => {
              const isRecommended = i === recommendedIdx || opt.name === data.recommended?.optionName
              const Icon = optionIcons[i % optionIcons.length]
              const gradient = optionGradients[i % optionGradients.length]
              return (
                <div key={i} className={`relative rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all ${isRecommended ? 'ring-2 ring-violet-500 shadow-lg shadow-violet-500/10' : ''}`}>
                  {isRecommended && (
                    <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-violet-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
                      <Zap className="h-3 w-3" /> Recommande
                    </div>
                  )}
                  <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <EditableText value={opt.name} onChange={v => updateField(`options[${i}].name`, v)} as="p" className="font-bold text-sm" />
                        <span className="text-[10px] text-muted-foreground">{opt.billing}</span>
                      </div>
                    </div>

                    <div className="text-center py-3">
                      <EditableText value={opt.price} onChange={v => updateField(`options[${i}].price`, v)} as="p" className="text-3xl font-bold" />
                    </div>

                    <div className="space-y-2">
                      <EditableList items={opt.includes} onChange={v => updateField(`options[${i}].includes`, v)} className="space-y-1.5"
                        itemClassName="text-sm text-muted-foreground flex items-start gap-2 before:content-['✓'] before:text-emerald-500 before:font-bold before:shrink-0" addLabel="+" />
                    </div>

                    <div className="rounded-xl bg-muted/30 p-3 space-y-2">
                      <div>
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground">Client cible</p>
                        <EditableText value={opt.targetClient} onChange={v => updateField(`options[${i}].targetClient`, v)} as="p" className="text-xs" />
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground">Marge</p>
                        <EditableText value={opt.margin} onChange={v => updateField(`options[${i}].margin`, v)} as="p" className="text-xs font-medium" />
                      </div>
                    </div>

                    <EditableText value={opt.rationale} onChange={v => updateField(`options[${i}].rationale`, v)} as="p" className="text-xs text-muted-foreground italic" multiline />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Recommandation */}
        {data.recommended && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><Zap className="h-5 w-5 text-emerald-500" /> Recommandation</h2>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Raisonnement</p>
                <EditableText value={data.recommended.reasoning} onChange={v => updateField('recommended.reasoning', v)} as="p" className="text-sm" multiline />
              </div>
              <div className="rounded-2xl border bg-card p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Comment presenter le prix</p>
                  <CopyButton text={data.recommended.framing} />
                </div>
                <EditableText value={data.recommended.framing} onChange={v => updateField('recommended.framing', v)} as="p" className="text-sm font-medium bg-violet-50/50 dark:bg-violet-950/20 rounded-xl p-4" multiline />
              </div>

              {data.recommended.objections?.length > 0 && (
                <div className="rounded-2xl border bg-card overflow-hidden">
                  <div className="p-4 border-b bg-muted/20">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Objections & Reponses</p>
                  </div>
                  {data.recommended.objections.map((obj, i) => (
                    <div key={i} className="p-4 border-b last:border-0">
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mt-0.5">
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400">?</span>
                        </div>
                        <div className="flex-1">
                          <EditableText value={obj.objection} onChange={v => updateField(`recommended.objections[${i}].objection`, v)} as="p" className="text-sm font-medium" />
                          <div className="flex items-start gap-2 mt-2">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mt-0.5">
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <EditableText value={obj.response} onChange={v => updateField(`recommended.objections[${i}].response`, v)} as="p" className="text-xs text-muted-foreground" multiline />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Test de willingness-to-pay */}
        {data.testPlan && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><FlaskConical className="h-5 w-5 text-blue-500" /> Test de prix</h2>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Message de test</p>
                  <CopyButton text={data.testPlan.message} />
                </div>
                <EditableText value={data.testPlan.message} onChange={v => updateField('testPlan.message', v)} as="p" multiline className="text-sm bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-4 whitespace-pre-line" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-card p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Conseils landing page</p>
                  <EditableText value={data.testPlan.landingPageTips} onChange={v => updateField('testPlan.landingPageTips', v)} as="p" className="text-sm" multiline />
                </div>
                <div className="rounded-2xl border bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-card p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Reponses minimum</p>
                  <EditableText value={data.testPlan.minResponses} onChange={v => updateField('testPlan.minResponses', v)} as="p" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              {data.testPlan.vanWestendorp?.length > 0 && (
                <div className="rounded-2xl border bg-card p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Questions Van Westendorp</p>
                  <div className="space-y-2">
                    {data.testPlan.vanWestendorp.map((q, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl bg-muted/30 px-4 py-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400">{i + 1}</span>
                        <EditableText value={q} onChange={v => {
                          const newArr = [...data.testPlan.vanWestendorp]
                          newArr[i] = v
                          updateField('testPlan.vanWestendorp', newArr)
                        }} as="p" className="text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Evolution */}
        {data.evolution && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-amber-500" /> Strategie d&apos;evolution</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/10 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Prix de lancement</p>
                <EditableText value={data.evolution.launchPrice} onChange={v => updateField('evolution.launchPrice', v)} as="p" className="text-2xl font-bold" />
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/10 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Prix cible a 12 mois</p>
                <EditableText value={data.evolution.targetPrice12m} onChange={v => updateField('evolution.targetPrice12m', v)} as="p" className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="rounded-2xl border bg-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Strategie d&apos;augmentation</p>
                <EditableText value={data.evolution.increaseStrategy} onChange={v => updateField('evolution.increaseStrategy', v)} as="p" className="text-sm" multiline />
              </div>
              <div className="rounded-2xl border bg-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Grandfathering (early adopters)</p>
                <EditableText value={data.evolution.grandfathering} onChange={v => updateField('evolution.grandfathering', v)} as="p" className="text-sm" multiline />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
