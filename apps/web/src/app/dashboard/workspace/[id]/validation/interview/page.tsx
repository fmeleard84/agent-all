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
  Users,
  Download,
  Loader2,
  MessageCircleQuestion,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ClipboardList,
  Target,
  Save,
  Copy,
  Check,
} from 'lucide-react'

interface QuestionItem {
  question: string
  why: string
  greenFlags: string[]
  redFlags: string[]
  followUp: string
}

interface PitfallItem {
  title: string
  description: string
}

interface CriterionItem {
  name: string
  description: string
  weight: number
}

interface InterviewData {
  intro: {
    targetProfile: string
    whereToFind: string
    approachScript: string
    framing: string
  }
  questions: QuestionItem[]
  pitfalls: PitfallItem[] | string[]
  scoringGrid: {
    criteria: CriterionItem[]
    threshold: number
    thresholdExplanation: string
    minInterviews: number
    stopRule: string
  }
  debrief: {
    fields: string[]
    synthesisTemplate: string
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

export default function InterviewDashboard() {
  const params = useParams<{ id: string }>()
  const { data, loading, saving, workspaceName, updateField } = useEditableAction<InterviewData>(params.id, 'interview')
  const dashboardRef = useRef<HTMLDivElement>(null)

  async function handleExportPdf() {
    if (!dashboardRef.current) return
    await exportDashboardPdf(dashboardRef.current, `interview-clients-${workspaceName}.pdf`)
  }

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  if (!data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Users className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucun script d&apos;interview genere.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Retour</Link>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500 shadow-lg shadow-violet-500/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Interviews clients</h1>
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
        {/* Introduction / Approche */}
        {data.intro && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="h-5 w-5 text-violet-500" /> Approche & Cadrage</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border bg-gradient-to-br from-violet-50/50 to-white dark:from-violet-950/20 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Profil cible</p>
                <EditableText value={data.intro.targetProfile} onChange={v => updateField('intro.targetProfile', v)} as="p" multiline className="text-sm font-medium" />
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Ou les trouver</p>
                <EditableText value={data.intro.whereToFind} onChange={v => updateField('intro.whereToFind', v)} as="p" multiline className="text-sm font-medium" />
              </div>
              <div className="rounded-2xl border bg-card p-5 md:col-span-2 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Script d&apos;accroche</p>
                  <CopyButton text={data.intro.approachScript} />
                </div>
                <EditableText value={data.intro.approachScript} onChange={v => updateField('intro.approachScript', v)} as="p" multiline className="text-sm italic bg-violet-50/50 dark:bg-violet-950/20 rounded-xl p-4" />
              </div>
              <div className="rounded-2xl border bg-card p-5 md:col-span-2 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Cadrage de l&apos;interview</p>
                <EditableText value={data.intro.framing} onChange={v => updateField('intro.framing', v)} as="p" multiline className="text-sm" />
              </div>
            </div>
          </section>
        )}

        {/* Questions */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><MessageCircleQuestion className="h-5 w-5 text-blue-500" /> Questions ({data.questions?.length || 0})</h2>
          </div>
          <div className="space-y-4">
            {data.questions?.map((q, i) => (
              <div key={i} className="rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 text-sm font-bold text-blue-600 dark:text-blue-400">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <EditableText value={q.question} onChange={v => updateField(`questions[${i}].question`, v)} as="p" className="font-semibold text-sm" />
                      <EditableText value={q.why} onChange={v => updateField(`questions[${i}].why`, v)} as="p" className="text-xs text-muted-foreground mt-1 italic" />
                    </div>
                    <CopyButton text={q.question} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-card p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Green flags</p>
                      <EditableList items={q.greenFlags} onChange={v => updateField(`questions[${i}].greenFlags`, v)} className="space-y-1" itemClassName="text-xs text-muted-foreground" addLabel="+" />
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-card p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2 flex items-center gap-1"><XCircle className="h-3 w-3" /> Red flags</p>
                      <EditableList items={q.redFlags} onChange={v => updateField(`questions[${i}].redFlags`, v)} className="space-y-1" itemClassName="text-xs text-muted-foreground" addLabel="+" />
                    </div>
                  </div>

                  {q.followUp && (
                    <div className="rounded-xl bg-muted/30 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Relance</p>
                      <EditableText value={q.followUp} onChange={v => updateField(`questions[${i}].followUp`, v)} as="p" className="text-xs text-muted-foreground italic" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pieges a eviter */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Pieges a eviter</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.pitfalls?.map((p, i) => {
              const isString = typeof p === 'string'
              return (
                <div key={i} className="rounded-2xl border bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/10 dark:to-card p-5 hover:shadow-md transition-all">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  {isString ? (
                    <EditableText value={p as string} onChange={v => updateField(`pitfalls[${i}]`, v)} as="p" className="text-sm" multiline />
                  ) : (
                    <>
                      <EditableText value={(p as PitfallItem).title} onChange={v => updateField(`pitfalls[${i}].title`, v)} as="p" className="font-semibold text-sm mb-1" />
                      <EditableText value={(p as PitfallItem).description} onChange={v => updateField(`pitfalls[${i}].description`, v)} as="p" className="text-xs text-muted-foreground" multiline />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Grille de scoring */}
        {data.scoringGrid && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="h-5 w-5 text-emerald-500" /> Grille de scoring</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-card p-5 text-center">
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{data.scoringGrid.threshold}<span className="text-lg text-muted-foreground">/10</span></p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">Seuil de validation</p>
                </div>
                <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-card p-5 text-center">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{data.scoringGrid.minInterviews}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-1">Interviews minimum</p>
                </div>
                <div className="rounded-2xl border bg-card p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Regle d&apos;arret</p>
                  <EditableText value={data.scoringGrid.stopRule} onChange={v => updateField('scoringGrid.stopRule', v)} as="p" className="text-sm" multiline />
                </div>
              </div>

              {data.scoringGrid.criteria?.length > 0 && (
                <div className="rounded-2xl border bg-card overflow-hidden">
                  <div className="p-4 border-b bg-muted/20">
                    <div className="grid grid-cols-12 gap-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <div className="col-span-3">Critere</div>
                      <div className="col-span-7">Description</div>
                      <div className="col-span-2 text-center">Poids</div>
                    </div>
                  </div>
                  {data.scoringGrid.criteria.map((c, i) => (
                    <div key={i} className="p-4 border-b last:border-0 hover:bg-muted/10 transition-colors">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-3">
                          <EditableText value={c.name} onChange={v => updateField(`scoringGrid.criteria[${i}].name`, v)} as="p" className="text-sm font-medium" />
                        </div>
                        <div className="col-span-7">
                          <EditableText value={c.description} onChange={v => updateField(`scoringGrid.criteria[${i}].description`, v)} as="p" className="text-xs text-muted-foreground" />
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 text-sm font-bold text-violet-600 dark:text-violet-400">
                            x{c.weight}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border bg-card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Interpretation du seuil</p>
                <EditableText value={data.scoringGrid.thresholdExplanation} onChange={v => updateField('scoringGrid.thresholdExplanation', v)} as="p" className="text-sm text-muted-foreground" multiline />
              </div>
            </div>
          </section>
        )}

        {/* Debrief */}
        {data.debrief && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-500" />
              <h2 className="text-lg font-semibold">Template de debrief</h2>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border bg-gradient-to-br from-pink-50/50 to-white dark:from-pink-950/10 dark:to-card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Champs a remplir apres chaque interview</p>
                <EditableList items={data.debrief.fields} onChange={v => updateField('debrief.fields', v)} className="space-y-2" itemClassName="rounded-xl bg-white dark:bg-card border px-4 py-2.5 text-sm" addLabel="+ Ajouter un champ" />
              </div>
              <div className="rounded-2xl border bg-card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Synthese des resultats</p>
                <EditableText value={data.debrief.synthesisTemplate} onChange={v => updateField('debrief.synthesisTemplate', v)} as="p" className="text-sm text-muted-foreground" multiline />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
