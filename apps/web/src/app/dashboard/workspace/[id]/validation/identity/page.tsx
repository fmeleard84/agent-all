'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  Palette,
  Download,
  Loader2,
  Type,
  Eye,
  PenTool,
} from 'lucide-react'

interface ColorEntry {
  hex: string
  name: string
  usage: string
  rationale: string
}

interface IdentityData {
  colorPalette: {
    primary: ColorEntry
    secondary: ColorEntry
    accent: ColorEntry
    neutral: ColorEntry
    background: ColorEntry
  }
  typography: {
    headingFont: string
    bodyFont: string
    style: string
    hierarchy: {
      h1: string
      h2: string
      body: string
      caption: string
    }
    rationale: string
  }
  visualDirection: {
    moodKeywords: string[]
    references: { brand: string; why: string; takeaway: string }[]
    atmosphere: string
  }
  logoGuidelines: {
    direction: string
    type: string
    principles: string[]
    avoid: string[]
  }
}

function ColorSwatch({ color, label }: { color: ColorEntry; label: string }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="h-24 w-full" style={{ backgroundColor: color.hex }} />
      <div className="p-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <code className="text-xs font-mono text-muted-foreground">{color.hex}</code>
        </div>
        <p className="font-medium text-sm">{color.name}</p>
        <p className="text-xs text-muted-foreground">{color.usage}</p>
        <p className="text-xs text-muted-foreground/70 italic">{color.rationale}</p>
      </div>
    </div>
  )
}

export default function IdentityDashboard() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<IdentityData | null>(null)
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
        const structured = ws.metadata?.actions?.identity?.structured
        if (structured) setData(structured as IdentityData)
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
        filename: `identite-visuelle-${workspaceName}.pdf`,
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
        <Palette className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune identite visuelle generee.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour a la validation
        </Link>
      </div>
    )
  }

  const colorEntries: { label: string; key: keyof IdentityData['colorPalette'] }[] = [
    { label: 'Primaire', key: 'primary' },
    { label: 'Secondaire', key: 'secondary' },
    { label: 'Accent', key: 'accent' },
    { label: 'Neutre', key: 'neutral' },
    { label: 'Fond', key: 'background' },
  ]

  return (
    <div className="px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Identite visuelle</h1>
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
            <Palette className="h-5 w-5 text-purple-500" /> Palette de couleurs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {colorEntries.map(({ label, key }) => (
              <ColorSwatch key={key} color={data.colorPalette[key]} label={label} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Type className="h-5 w-5 text-blue-500" /> Typographie
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font titres</p>
                <p className="text-2xl font-bold mt-1">{data.typography.headingFont}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font texte</p>
                <p className="text-lg mt-1">{data.typography.bodyFont}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Style</p>
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1">{data.typography.style}</span>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hierarchie</p>
              {Object.entries(data.typography.hierarchy).map(([level, desc]) => (
                <div key={level} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                  <code className="text-xs font-mono font-semibold">{level}</code>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Justification</p>
            <p className="text-sm text-muted-foreground">{data.typography.rationale}</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-emerald-500" /> Direction artistique
          </h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {data.visualDirection.moodKeywords.map((kw, i) => (
                <span key={i} className="rounded-full border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 px-4 py-1.5 text-sm font-medium">{kw}</span>
              ))}
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Atmosphere</p>
              <p className="text-sm">{data.visualDirection.atmosphere}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.visualDirection.references.map((ref, i) => (
                <div key={i} className="rounded-xl border bg-card p-5">
                  <p className="font-semibold text-sm">{ref.brand}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ref.why}</p>
                  <p className="text-xs font-medium mt-2">A retenir : {ref.takeaway}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PenTool className="h-5 w-5 text-pink-500" /> Guidelines logo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Direction</p>
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1">{data.logoGuidelines.direction}</span>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1">{data.logoGuidelines.type}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">Principes</p>
                {data.logoGuidelines.principles.map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {p}</p>
                ))}
              </div>
              <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2">A eviter</p>
                {data.logoGuidelines.avoid.map((a, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {a}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
