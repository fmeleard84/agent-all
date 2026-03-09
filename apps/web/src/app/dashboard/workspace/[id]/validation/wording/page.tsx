'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
} from 'lucide-react'

interface WordingData {
  positioning: {
    territory: string
    promise: string
    enemy: string
    belief: string
  }
  personality: {
    traits: { trait: string; example: string }[]
    toneOfVoice: string
    toneExamples: string[]
    doesSay: string[]
    neverSays: string[]
  }
  taglines: { text: string; rationale: string }[]
  pitches: {
    thirtySeconds: string
    email: string
    keyPhrases: string[]
  }
  lexicon: {
    useWords: string[]
    avoidWords: string[]
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="shrink-0 rounded-md p-1.5 hover:bg-accent transition-colors"
      title="Copier"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  )
}

export default function WordingDashboard() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<WordingData | null>(null)
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
        const structured = ws.metadata?.actions?.wording?.structured
        if (structured) setData(structured as WordingData)
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
        filename: `wording-posture-${workspaceName}.pdf`,
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
        <MessageSquareQuote className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucun wording genere.</p>
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
            <h1 className="text-xl font-semibold tracking-tight">Wording & Posture de marque</h1>
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
            <Target className="h-5 w-5 text-violet-500" /> Positionnement
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Territoire de marque', value: data.positioning.territory, color: 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20' },
              { label: 'Promesse centrale', value: data.positioning.promise, color: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20' },
              { label: "L'ennemi", value: data.positioning.enemy, color: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' },
              { label: 'Le belief', value: data.positioning.belief, color: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border-2 ${item.color} p-5`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mic className="h-5 w-5 text-orange-500" /> Personnalite & Ton de voix
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm">{data.personality.toneOfVoice}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.personality.traits.map((t, i) => (
                <div key={i} className="rounded-xl border bg-card p-4">
                  <p className="font-medium text-sm">{t.trait}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{t.example}&rdquo;</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.personality.toneExamples.map((ex, i) => (
                <div key={i} className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Exemple {i + 1}</p>
                  <p className="text-sm italic">&ldquo;{ex}&rdquo;</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> La marque dit</p>
                {data.personality.doesSay.map((s, i) => (
                  <p key={i} className="text-sm text-muted-foreground">• {s}</p>
                ))}
              </div>
              <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2 flex items-center gap-1"><Ban className="h-3 w-3" /> La marque ne dit jamais</p>
                {data.personality.neverSays.map((s, i) => (
                  <p key={i} className="text-sm text-muted-foreground">• {s}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Taglines</h2>
          <div className="space-y-3">
            {data.taglines.map((t, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-lg">&ldquo;{t.text}&rdquo;</p>
                  <p className="text-sm text-muted-foreground mt-1">{t.rationale}</p>
                </div>
                <CopyButton text={t.text} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" /> Pitches
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pitch 30 secondes</p>
                <CopyButton text={data.pitches.thirtySeconds} />
              </div>
              <p className="text-sm">{data.pitches.thirtySeconds}</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pitch email</p>
                <CopyButton text={data.pitches.email} />
              </div>
              <p className="text-sm whitespace-pre-line">{data.pitches.email}</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Phrases cles</p>
              <div className="space-y-2">
                {data.pitches.keyPhrases.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                    <p className="text-sm">&ldquo;{p}&rdquo;</p>
                    <CopyButton text={p} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Lexique</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-3">Mots a utiliser</p>
              <div className="flex flex-wrap gap-2">
                {data.lexicon.useWords.map((w, i) => (
                  <span key={i} className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">{w}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-3">Mots a eviter</p>
              <div className="flex flex-wrap gap-2">
                {data.lexicon.avoidWords.map((w, i) => (
                  <span key={i} className="rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-400">{w}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
