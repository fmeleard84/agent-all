'use client'

import { useRef } from 'react'
import { useParams } from 'next/navigation'
import { useEditableAction } from '@/hooks/use-editable-action'
import { EditableText } from '@/components/ui/editable-text'
import { EditableList } from '@/components/ui/editable-list'
import { exportDashboardPdf } from '@/lib/export-pdf'
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

function ColorSwatch({
  color,
  label,
  pathPrefix,
  updateField,
}: {
  color: ColorEntry
  label: string
  pathPrefix: string
  updateField: (path: string, value: any) => void
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="h-24 w-full" style={{ backgroundColor: color.hex }} />
      <div className="p-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="flex items-center gap-1.5">
            <label
              className="relative h-5 w-5 rounded-full border cursor-pointer overflow-hidden shrink-0"
              style={{ backgroundColor: color.hex }}
              title="Changer la couleur"
            >
              <input
                type="color"
                value={color.hex}
                onChange={e => updateField(`${pathPrefix}.hex`, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <code className="text-xs font-mono text-muted-foreground">{color.hex}</code>
          </div>
        </div>
        <EditableText
          value={color.name}
          onChange={v => updateField(`${pathPrefix}.name`, v)}
          className="font-medium text-sm"
          as="p"
        />
        <EditableText
          value={color.usage}
          onChange={v => updateField(`${pathPrefix}.usage`, v)}
          className="text-xs text-muted-foreground"
          as="p"
        />
        <EditableText
          value={color.rationale}
          onChange={v => updateField(`${pathPrefix}.rationale`, v)}
          className="text-xs text-muted-foreground/70 italic"
          as="p"
        />
      </div>
    </div>
  )
}

export default function IdentityDashboard() {
  const params = useParams<{ id: string }>()
  const { data, loading, saving, workspaceName, updateField } = useEditableAction<IdentityData>(params.id, 'identity')
  const dashboardRef = useRef<HTMLDivElement>(null)

  async function handleExportPdf() {
    if (!dashboardRef.current) return
    await exportDashboardPdf(dashboardRef.current, `identite-visuelle-${workspaceName}.pdf`)
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
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-xs text-muted-foreground animate-pulse">Sauvegarde...</span>
          )}
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download className="h-4 w-4" /> Telecharger en PDF
          </button>
        </div>
      </div>

      <div ref={dashboardRef} className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-purple-500" /> Palette de couleurs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {colorEntries.map(({ label, key }) => (
              <ColorSwatch
                key={key}
                color={data.colorPalette[key]}
                label={label}
                pathPrefix={`colorPalette.${key}`}
                updateField={updateField}
              />
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
                <EditableText
                  value={data.typography.headingFont}
                  onChange={v => updateField('typography.headingFont', v)}
                  className="text-2xl font-bold mt-1"
                  as="p"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font texte</p>
                <EditableText
                  value={data.typography.bodyFont}
                  onChange={v => updateField('typography.bodyFont', v)}
                  className="text-lg mt-1"
                  as="p"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Style</p>
                <EditableText
                  value={data.typography.style}
                  onChange={v => updateField('typography.style', v)}
                  className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1"
                  as="span"
                />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hierarchie</p>
              {(Object.entries(data.typography.hierarchy) as [string, string][]).map(([level, desc]) => (
                <div key={level} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                  <code className="text-xs font-mono font-semibold">{level}</code>
                  <EditableText
                    value={desc}
                    onChange={v => updateField(`typography.hierarchy.${level}`, v)}
                    className="text-sm text-muted-foreground"
                    as="p"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Justification</p>
            <EditableText
              value={data.typography.rationale}
              onChange={v => updateField('typography.rationale', v)}
              className="text-sm text-muted-foreground"
              as="p"
              multiline
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-emerald-500" /> Direction artistique
          </h2>
          <div className="space-y-4">
            <EditableList
              items={data.visualDirection.moodKeywords}
              onChange={v => updateField('visualDirection.moodKeywords', v)}
              renderPrefix=""
              className="flex flex-wrap gap-2"
              itemClassName="rounded-full border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 px-4 py-1.5 text-sm font-medium"
              addLabel="Ajouter un mot-cle"
            />
            <div className="rounded-xl border bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Atmosphere</p>
              <EditableText
                value={data.visualDirection.atmosphere}
                onChange={v => updateField('visualDirection.atmosphere', v)}
                className="text-sm"
                as="p"
                multiline
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.visualDirection.references.map((ref, i) => (
                <div key={i} className="rounded-xl border bg-card p-5 space-y-1">
                  <EditableText
                    value={ref.brand}
                    onChange={v => updateField(`visualDirection.references[${i}].brand`, v)}
                    className="font-semibold text-sm"
                    as="p"
                  />
                  <EditableText
                    value={ref.why}
                    onChange={v => updateField(`visualDirection.references[${i}].why`, v)}
                    className="text-xs text-muted-foreground mt-1"
                    as="p"
                    multiline
                  />
                  <div className="flex items-start gap-1 mt-2">
                    <span className="text-xs font-medium shrink-0">A retenir :</span>
                    <EditableText
                      value={ref.takeaway}
                      onChange={v => updateField(`visualDirection.references[${i}].takeaway`, v)}
                      className="text-xs font-medium"
                      as="span"
                    />
                  </div>
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
                <EditableText
                  value={data.logoGuidelines.direction}
                  onChange={v => updateField('logoGuidelines.direction', v)}
                  className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1"
                  as="span"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                <EditableText
                  value={data.logoGuidelines.type}
                  onChange={v => updateField('logoGuidelines.type', v)}
                  className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1"
                  as="span"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">Principes</p>
                <EditableList
                  items={data.logoGuidelines.principles}
                  onChange={v => updateField('logoGuidelines.principles', v)}
                  itemClassName="text-xs text-muted-foreground"
                  addLabel="Ajouter"
                />
              </div>
              <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2">A eviter</p>
                <EditableList
                  items={data.logoGuidelines.avoid}
                  onChange={v => updateField('logoGuidelines.avoid', v)}
                  itemClassName="text-xs text-muted-foreground"
                  addLabel="Ajouter"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
