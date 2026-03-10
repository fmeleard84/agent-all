'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { exportDashboardPdf } from '@/lib/export-pdf'
import { useEditableAction } from '@/hooks/use-editable-action'
import { EditableText } from '@/components/ui/editable-text'
import { EditableList } from '@/components/ui/editable-list'
import Link from 'next/link'
import {
  ArrowLeft,
  MessageSquareQuote,
  Download,
  Loader2,
  Copy,
  Check,
  Target,
  Mic,
  BookOpen,
  Ban,
  CheckCircle2,
  Plus,
  X,
  Save,
} from 'lucide-react'

interface WordingData {
  positioning: { territory: string; promise: string; enemy: string; belief: string }
  personality: {
    traits: { trait: string; example: string }[]
    toneOfVoice: string
    toneExamples: string[]
    doesSay: string[]
    neverSays: string[]
  }
  taglines: { text: string; rationale: string }[]
  pitches: { thirtySeconds: string; email: string; keyPhrases: string[] }
  lexicon: { useWords: string[]; avoidWords: string[] }
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

export default function WordingDashboard() {
  const params = useParams<{ id: string }>()
  const { data, loading, saving, workspaceName, updateField, setFieldDirectly } = useEditableAction<WordingData>(params.id, 'wording')
  const dashboardRef = useRef<HTMLDivElement>(null)

  async function handleExportPdf() {
    if (!dashboardRef.current) return
    await exportDashboardPdf(dashboardRef.current, `wording-posture-${workspaceName}.pdf`)
  }

  function addTrait() {
    setFieldDirectly(prev => ({ ...prev, personality: { ...prev.personality, traits: [...prev.personality.traits, { trait: 'Nouveau trait', example: 'Exemple...' }] } }))
  }
  function removeTrait(index: number) {
    setFieldDirectly(prev => ({ ...prev, personality: { ...prev.personality, traits: prev.personality.traits.filter((_, i) => i !== index) } }))
  }
  function addTagline() {
    setFieldDirectly(prev => ({ ...prev, taglines: [...prev.taglines, { text: 'Nouvelle tagline', rationale: 'Justification...' }] }))
  }
  function removeTagline(index: number) {
    setFieldDirectly(prev => ({ ...prev, taglines: prev.taglines.filter((_, i) => i !== index) }))
  }

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  if (!data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <MessageSquareQuote className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucun wording genere.</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/20">
              <MessageSquareQuote className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Wording & Posture de marque</h1>
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
        {/* Positionnement */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-violet-500 to-purple-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="h-5 w-5 text-violet-500" /> Positionnement</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { label: 'Territoire de marque', path: 'positioning.territory' as const, value: data.positioning.territory, gradient: 'from-violet-50 to-white dark:from-violet-950/20 dark:to-card' },
              { label: 'Promesse centrale', path: 'positioning.promise' as const, value: data.positioning.promise, gradient: 'from-blue-50 to-white dark:from-blue-950/20 dark:to-card' },
              { label: "L'ennemi", path: 'positioning.enemy' as const, value: data.positioning.enemy, gradient: 'from-red-50 to-white dark:from-red-950/20 dark:to-card' },
              { label: 'Le belief', path: 'positioning.belief' as const, value: data.positioning.belief, gradient: 'from-amber-50 to-white dark:from-amber-950/20 dark:to-card' },
            ]).map((item, i) => (
              <div key={i} className={`rounded-2xl border bg-gradient-to-br ${item.gradient} p-5 hover:shadow-md transition-all`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{item.label}</p>
                <EditableText value={item.value} onChange={v => updateField(item.path, v)} as="p" multiline className="text-sm font-medium" />
              </div>
            ))}
          </div>
        </section>

        {/* Personnalite */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><Mic className="h-5 w-5 text-orange-500" /> Personnalite & Ton</h2>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-5">
              <EditableText value={data.personality.toneOfVoice} onChange={v => updateField('personality.toneOfVoice', v)} as="p" multiline className="text-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.personality.traits.map((t, i) => (
                <div key={i} className="group/trait rounded-2xl border bg-card p-4 relative hover:shadow-md transition-all">
                  <button onClick={() => removeTrait(i)} className="absolute top-2 right-2 p-0.5 opacity-0 group-hover/trait:opacity-60 hover:!opacity-100 text-red-500 transition-opacity"><X className="h-3.5 w-3.5" /></button>
                  <EditableText value={t.trait} onChange={v => updateField(`personality.traits[${i}].trait`, v)} as="p" className="font-medium text-sm" />
                  <EditableText value={t.example} onChange={v => updateField(`personality.traits[${i}].example`, v)} as="p" className="text-xs text-muted-foreground mt-1 italic" />
                </div>
              ))}
              <button onClick={addTrait} className="rounded-2xl border border-dashed bg-card p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                <Plus className="h-4 w-4" /> Ajouter un trait
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> La marque dit</p>
                <EditableList items={data.personality.doesSay} onChange={v => updateField('personality.doesSay', v)} className="space-y-1" itemClassName="text-sm text-muted-foreground" addLabel="+" />
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2 flex items-center gap-1"><Ban className="h-3 w-3" /> Ne dit jamais</p>
                <EditableList items={data.personality.neverSays} onChange={v => updateField('personality.neverSays', v)} className="space-y-1" itemClassName="text-sm text-muted-foreground" addLabel="+" />
              </div>
            </div>
          </div>
        </section>

        {/* Taglines */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-500" />
              <h2 className="text-lg font-semibold">Taglines</h2>
            </div>
            <button onClick={addTagline} className="flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Plus className="h-3 w-3" /> Ajouter
            </button>
          </div>
          <div className="space-y-3">
            {data.taglines.map((t, i) => (
              <div key={i} className="group/tagline rounded-2xl border bg-card p-5 flex items-start justify-between gap-4 hover:shadow-md transition-all">
                <div className="flex-1">
                  <EditableText value={t.text} onChange={v => updateField(`taglines[${i}].text`, v)} as="p" className="font-semibold text-lg" />
                  <EditableText value={t.rationale} onChange={v => updateField(`taglines[${i}].rationale`, v)} as="p" className="text-sm text-muted-foreground mt-1" />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <CopyButton text={t.text} />
                  <button onClick={() => removeTagline(i)} className="rounded-lg p-1.5 opacity-0 group-hover/tagline:opacity-60 hover:!opacity-100 text-red-500 transition-opacity"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pitches */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-500" /> Pitches</h2>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pitch 30 secondes</p>
                <CopyButton text={data.pitches.thirtySeconds} />
              </div>
              <EditableText value={data.pitches.thirtySeconds} onChange={v => updateField('pitches.thirtySeconds', v)} as="p" multiline className="text-sm" />
            </div>
            <div className="rounded-2xl border bg-card p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pitch email</p>
                <CopyButton text={data.pitches.email} />
              </div>
              <EditableText value={data.pitches.email} onChange={v => updateField('pitches.email', v)} as="p" multiline className="text-sm whitespace-pre-line" />
            </div>
            <div className="rounded-2xl border bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Phrases cles</p>
              <EditableList items={data.pitches.keyPhrases} onChange={v => updateField('pitches.keyPhrases', v)} renderPrefix=""
                className="space-y-2" itemClassName="rounded-xl bg-muted/50 px-4 py-2.5 text-sm" addLabel="Ajouter une phrase" />
            </div>
          </div>
        </section>

        {/* Lexique */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            <h2 className="text-lg font-semibold">Lexique</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-3">Mots a utiliser</p>
              <EditableList items={data.lexicon.useWords} onChange={v => updateField('lexicon.useWords', v)} renderPrefix=""
                className="flex flex-wrap gap-2" itemClassName="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-400" addLabel="+" />
            </div>
            <div className="rounded-2xl border bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-3">Mots a eviter</p>
              <EditableList items={data.lexicon.avoidWords} onChange={v => updateField('lexicon.avoidWords', v)} renderPrefix=""
                className="flex flex-wrap gap-2" itemClassName="rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-400" addLabel="+" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
