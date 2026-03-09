'use client'

import { useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useEditableAction } from '@/hooks/use-editable-action'
import { EditableText } from '@/components/ui/editable-text'
import { EditableList } from '@/components/ui/editable-list'
import { uploadLandingImage } from '@/lib/upload-image'
import { exportDashboardPdf } from '@/lib/export-pdf'
import Link from 'next/link'
import {
  ArrowLeft,
  Globe,
  Download,
  Loader2,
  Eye,
  EyeOff,
  Upload,
  Save,
  ExternalLink,
  Palette,
  Plus,
  X,
  Image as ImageIcon,
} from 'lucide-react'

interface LandingSection {
  enabled: boolean
}

interface HeroSection extends LandingSection {
  headline: string
  subheadline: string
  ctaText: string
  imageUrl?: string
}

interface ProblemSection extends LandingSection {
  title: string
  painPoints: string[]
}

interface SolutionSection extends LandingSection {
  title: string
  description: string
  features: { title: string; description: string }[]
  imageUrl?: string
}

interface BenefitsSection extends LandingSection {
  title: string
  items: { icon: string; title: string; description: string }[]
}

interface TestimonialSection extends LandingSection {
  quote: string
  author: string
  role: string
  company: string
  avatarUrl?: string
}

interface CtaSection extends LandingSection {
  title: string
  subtitle: string
  ctaText: string
}

interface EmailCaptureSection extends LandingSection {
  title: string
  subtitle: string
  placeholder: string
  buttonText: string
  reassurance: string
}

interface LandingData {
  sections: {
    hero: HeroSection
    problem: ProblemSection
    solution: SolutionSection
    benefits: BenefitsSection
    testimonial: TestimonialSection
    cta: CtaSection
    emailCapture: EmailCaptureSection
  }
  branding: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    headingFont: string
    bodyFont: string
  }
}

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero',
  problem: 'Probleme',
  solution: 'Solution',
  benefits: 'Benefices',
  testimonial: 'Temoignage',
  cta: 'Appel a l\'action',
  emailCapture: 'Capture email',
}

const ICON_OPTIONS = ['zap', 'shield', 'clock', 'star', 'target', 'heart', 'rocket', 'check', 'trending-up', 'users']

function SectionToggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        enabled
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {enabled ? 'Active' : 'Desactive'}
    </button>
  )
}

function ImageUploadSlot({
  imageUrl,
  onUpload,
  uploading,
  label,
}: {
  imageUrl?: string
  onUpload: (file: File) => void
  uploading: boolean
  label: string
}) {
  function handleClick() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) onUpload(file)
    }
    input.click()
  }

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer rounded-lg border-2 border-dashed hover:border-violet-400 transition-colors overflow-hidden"
    >
      {uploading ? (
        <div className="flex items-center justify-center h-32 bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : imageUrl ? (
        <div className="relative group">
          <img src={imageUrl} alt={label} className="w-full h-32 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Upload className="h-5 w-5 text-white" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-32 bg-muted/20 gap-2">
          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      )}
    </div>
  )
}

export default function LandingEditor() {
  const params = useParams<{ id: string }>()
  const { data, loading, saving, workspaceName, updateField, setFieldDirectly } =
    useEditableAction<LandingData>(params.id, 'landing')
  const dashboardRef = useRef<HTMLDivElement>(null)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)

  async function handleImageUpload(slot: string, path: string, file: File) {
    setUploadingSlot(slot)
    try {
      const url = await uploadLandingImage(params.id, file, slot)
      updateField(path, url)
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      setUploadingSlot(null)
    }
  }

  async function handleExportPdf() {
    if (!dashboardRef.current) return
    await exportDashboardPdf(dashboardRef.current, `landing-page-${workspaceName}.pdf`)
  }

  async function importBranding() {
    const { data: ws } = await (await import('@/lib/supabase')).supabase
      .from('workspaces')
      .select('metadata')
      .eq('id', params.id)
      .single()

    const identity = (ws?.metadata as any)?.actions?.identity?.structured
    if (identity) {
      setFieldDirectly(prev => ({
        ...prev,
        branding: {
          ...prev.branding,
          primaryColor: identity.colorPalette?.primary?.hex || prev.branding.primaryColor,
          secondaryColor: identity.colorPalette?.secondary?.hex || prev.branding.secondaryColor,
          accentColor: identity.colorPalette?.accent?.hex || prev.branding.accentColor,
          headingFont: identity.typography?.headingFont || prev.branding.headingFont,
          bodyFont: identity.typography?.bodyFont || prev.branding.bodyFont,
        },
      }))
    }
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
        <Globe className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune landing page generee.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour a la validation
        </Link>
      </div>
    )
  }

  const sections = data.sections

  return (
    <div className="px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Landing page</h1>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Save className="h-3 w-3 animate-pulse" /> Sauvegarde...
            </span>
          )}
          <button
            onClick={importBranding}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Palette className="h-4 w-4" /> Importer l&apos;identite
          </button>
          <Link
            href={`/dashboard/workspace/${params.id}/validation/landing/preview`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> Preview
          </Link>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      {/* Branding bar */}
      <div className="rounded-xl border bg-card p-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Primaire</span>
          <input
            type="color"
            value={data.branding.primaryColor}
            onChange={e => updateField('branding.primaryColor', e.target.value)}
            className="h-8 w-8 rounded-md border cursor-pointer"
          />
          <code className="text-xs text-muted-foreground">{data.branding.primaryColor}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Secondaire</span>
          <input
            type="color"
            value={data.branding.secondaryColor}
            onChange={e => updateField('branding.secondaryColor', e.target.value)}
            className="h-8 w-8 rounded-md border cursor-pointer"
          />
          <code className="text-xs text-muted-foreground">{data.branding.secondaryColor}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Accent</span>
          <input
            type="color"
            value={data.branding.accentColor}
            onChange={e => updateField('branding.accentColor', e.target.value)}
            className="h-8 w-8 rounded-md border cursor-pointer"
          />
          <code className="text-xs text-muted-foreground">{data.branding.accentColor}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Font titres</span>
          <EditableText value={data.branding.headingFont} onChange={v => updateField('branding.headingFont', v)} as="span" className="text-sm font-medium" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Font texte</span>
          <EditableText value={data.branding.bodyFont} onChange={v => updateField('branding.bodyFont', v)} as="span" className="text-sm" />
        </div>
      </div>

      <div ref={dashboardRef} className="space-y-6">
        {/* Hero */}
        <SectionCard
          title="Hero"
          enabled={sections.hero.enabled}
          onToggle={() => updateField('sections.hero.enabled', !sections.hero.enabled)}
        >
          <EditableText value={sections.hero.headline} onChange={v => updateField('sections.hero.headline', v)} as="h2" className="text-2xl font-bold" />
          <EditableText value={sections.hero.subheadline} onChange={v => updateField('sections.hero.subheadline', v)} as="p" className="text-sm text-muted-foreground mt-2" multiline />
          <EditableText value={sections.hero.ctaText} onChange={v => updateField('sections.hero.ctaText', v)} as="span" className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white" />
          <ImageUploadSlot
            imageUrl={sections.hero.imageUrl}
            onUpload={f => handleImageUpload('hero', 'sections.hero.imageUrl', f)}
            uploading={uploadingSlot === 'hero'}
            label="Image hero (optionnel)"
          />
        </SectionCard>

        {/* Problem */}
        <SectionCard
          title="Probleme"
          enabled={sections.problem.enabled}
          onToggle={() => updateField('sections.problem.enabled', !sections.problem.enabled)}
        >
          <EditableText value={sections.problem.title} onChange={v => updateField('sections.problem.title', v)} as="h3" className="text-lg font-semibold" />
          <EditableList
            items={sections.problem.painPoints}
            onChange={v => updateField('sections.problem.painPoints', v)}
            className="mt-3 space-y-1"
            itemClassName="text-sm text-muted-foreground"
          />
        </SectionCard>

        {/* Solution */}
        <SectionCard
          title="Solution"
          enabled={sections.solution.enabled}
          onToggle={() => updateField('sections.solution.enabled', !sections.solution.enabled)}
        >
          <EditableText value={sections.solution.title} onChange={v => updateField('sections.solution.title', v)} as="h3" className="text-lg font-semibold" />
          <EditableText value={sections.solution.description} onChange={v => updateField('sections.solution.description', v)} as="p" className="text-sm text-muted-foreground mt-2" multiline />
          <div className="mt-4 space-y-3">
            {sections.solution.features.map((f, i) => (
              <div key={i} className="group/feat flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                <div className="flex-1">
                  <EditableText value={f.title} onChange={v => {
                    setFieldDirectly(prev => {
                      const features = [...prev.sections.solution.features]
                      features[i] = { ...features[i], title: v }
                      return { ...prev, sections: { ...prev.sections, solution: { ...prev.sections.solution, features } } }
                    })
                  }} as="p" className="text-sm font-medium" />
                  <EditableText value={f.description} onChange={v => {
                    setFieldDirectly(prev => {
                      const features = [...prev.sections.solution.features]
                      features[i] = { ...features[i], description: v }
                      return { ...prev, sections: { ...prev.sections, solution: { ...prev.sections.solution, features } } }
                    })
                  }} as="p" className="text-xs text-muted-foreground mt-1" />
                </div>
                <button onClick={() => {
                  setFieldDirectly(prev => ({
                    ...prev,
                    sections: { ...prev.sections, solution: { ...prev.sections.solution, features: prev.sections.solution.features.filter((_, j) => j !== i) } }
                  }))
                }} className="opacity-0 group-hover/feat:opacity-60 hover:!opacity-100 text-red-500 p-1">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button onClick={() => {
              setFieldDirectly(prev => ({
                ...prev,
                sections: { ...prev.sections, solution: { ...prev.sections.solution, features: [...prev.sections.solution.features, { title: 'Nouvelle feature', description: 'Description' }] } }
              }))
            }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3 w-3" /> Ajouter une feature
            </button>
          </div>
          <ImageUploadSlot
            imageUrl={sections.solution.imageUrl}
            onUpload={f => handleImageUpload('solution', 'sections.solution.imageUrl', f)}
            uploading={uploadingSlot === 'solution'}
            label="Illustration (optionnel)"
          />
        </SectionCard>

        {/* Benefits */}
        <SectionCard
          title="Benefices"
          enabled={sections.benefits.enabled}
          onToggle={() => updateField('sections.benefits.enabled', !sections.benefits.enabled)}
        >
          <EditableText value={sections.benefits.title} onChange={v => updateField('sections.benefits.title', v)} as="h3" className="text-lg font-semibold" />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {sections.benefits.items.map((item, i) => (
              <div key={i} className="group/ben rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <select
                    value={item.icon}
                    onChange={e => {
                      setFieldDirectly(prev => {
                        const items = [...prev.sections.benefits.items]
                        items[i] = { ...items[i], icon: e.target.value }
                        return { ...prev, sections: { ...prev.sections, benefits: { ...prev.sections.benefits, items } } }
                      })
                    }}
                    className="rounded border bg-background px-2 py-1 text-xs"
                  >
                    {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <button onClick={() => {
                    setFieldDirectly(prev => ({
                      ...prev,
                      sections: { ...prev.sections, benefits: { ...prev.sections.benefits, items: prev.sections.benefits.items.filter((_, j) => j !== i) } }
                    }))
                  }} className="opacity-0 group-hover/ben:opacity-60 hover:!opacity-100 text-red-500 p-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <EditableText value={item.title} onChange={v => {
                  setFieldDirectly(prev => {
                    const items = [...prev.sections.benefits.items]
                    items[i] = { ...items[i], title: v }
                    return { ...prev, sections: { ...prev.sections, benefits: { ...prev.sections.benefits, items } } }
                  })
                }} as="p" className="text-sm font-medium" />
                <EditableText value={item.description} onChange={v => {
                  setFieldDirectly(prev => {
                    const items = [...prev.sections.benefits.items]
                    items[i] = { ...items[i], description: v }
                    return { ...prev, sections: { ...prev.sections, benefits: { ...prev.sections.benefits, items } } }
                  })
                }} as="p" className="text-xs text-muted-foreground" />
              </div>
            ))}
          </div>
          <button onClick={() => {
            setFieldDirectly(prev => ({
              ...prev,
              sections: { ...prev.sections, benefits: { ...prev.sections.benefits, items: [...prev.sections.benefits.items, { icon: 'star', title: 'Nouveau benefice', description: 'Description' }] } }
            }))
          }} className="flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3 w-3" /> Ajouter un benefice
          </button>
        </SectionCard>

        {/* Testimonial */}
        <SectionCard
          title="Temoignage"
          enabled={sections.testimonial.enabled}
          onToggle={() => updateField('sections.testimonial.enabled', !sections.testimonial.enabled)}
        >
          <EditableText value={sections.testimonial.quote} onChange={v => updateField('sections.testimonial.quote', v)} as="p" className="text-sm italic" multiline />
          <div className="mt-3 flex items-center gap-4">
            <ImageUploadSlot
              imageUrl={sections.testimonial.avatarUrl}
              onUpload={f => handleImageUpload('testimonial-avatar', 'sections.testimonial.avatarUrl', f)}
              uploading={uploadingSlot === 'testimonial-avatar'}
              label="Avatar"
            />
            <div className="flex-1 space-y-1">
              <EditableText value={sections.testimonial.author} onChange={v => updateField('sections.testimonial.author', v)} as="p" className="text-sm font-medium" />
              <EditableText value={sections.testimonial.role} onChange={v => updateField('sections.testimonial.role', v)} as="p" className="text-xs text-muted-foreground" />
              <EditableText value={sections.testimonial.company} onChange={v => updateField('sections.testimonial.company', v)} as="p" className="text-xs text-muted-foreground" />
            </div>
          </div>
        </SectionCard>

        {/* CTA */}
        <SectionCard
          title="Appel a l'action"
          enabled={sections.cta.enabled}
          onToggle={() => updateField('sections.cta.enabled', !sections.cta.enabled)}
        >
          <EditableText value={sections.cta.title} onChange={v => updateField('sections.cta.title', v)} as="h3" className="text-lg font-semibold" />
          <EditableText value={sections.cta.subtitle} onChange={v => updateField('sections.cta.subtitle', v)} as="p" className="text-sm text-muted-foreground mt-2" />
          <EditableText value={sections.cta.ctaText} onChange={v => updateField('sections.cta.ctaText', v)} as="span" className="mt-3 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white" />
        </SectionCard>

        {/* Email Capture */}
        <SectionCard
          title="Capture email"
          enabled={sections.emailCapture.enabled}
          onToggle={() => updateField('sections.emailCapture.enabled', !sections.emailCapture.enabled)}
        >
          <EditableText value={sections.emailCapture.title} onChange={v => updateField('sections.emailCapture.title', v)} as="h3" className="text-lg font-semibold" />
          <EditableText value={sections.emailCapture.subtitle} onChange={v => updateField('sections.emailCapture.subtitle', v)} as="p" className="text-sm text-muted-foreground mt-2" />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/30 p-3">
            <EditableText value={sections.emailCapture.placeholder} onChange={v => updateField('sections.emailCapture.placeholder', v)} as="span" className="flex-1 text-sm text-muted-foreground" />
            <EditableText value={sections.emailCapture.buttonText} onChange={v => updateField('sections.emailCapture.buttonText', v)} as="span" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white" />
          </div>
          <EditableText value={sections.emailCapture.reassurance} onChange={v => updateField('sections.emailCapture.reassurance', v)} as="p" className="text-xs text-muted-foreground mt-2 italic" />
        </SectionCard>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string
  enabled: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border bg-card p-6 transition-opacity ${!enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <SectionToggle enabled={enabled} onToggle={onToggle} label={title} />
      </div>
      {children}
    </div>
  )
}
