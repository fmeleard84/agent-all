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
  UserPlus,
  Download,
  Loader2,
  User,
  Megaphone,
  Mail,
  MessageSquare,
  Calendar,
  BarChart3,
  Save,
  Copy,
  Check,
  Linkedin,
  Globe,
  Users,
  Zap,
} from 'lucide-react'

interface PersonaData {
  name: string
  age: string
  role: string
  company: string
  dailyPain: string
  searchBehavior: string
  triggerToBuy: string
}

interface ChannelItem {
  name: string
  type: string
  why: string
  reachableProspects: string
  cost: string
  expectedConversion: string
}

interface TemplateItem {
  channel: string
  label: string
  subject: string
  body: string
  tips: string
}

interface SequenceItem {
  day: string
  action: string
  channel: string
  message: string
}

interface ProspectsData {
  persona: PersonaData
  channels: ChannelItem[]
  templates: TemplateItem[]
  sequence: SequenceItem[]
  metrics: {
    responseRateByChannel: string
    dailyContacts: string
    targetTimeline: string
    pivotSignal: string
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

/** Safely convert a value to string — handles objects the AI might return instead of strings */
function str(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(str).join(', ')
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join('\n')
  return String(v)
}

const channelIcons: Record<string, typeof Globe> = {
  linkedin: Linkedin,
  email: Mail,
  community: Users,
  event: Calendar,
  ads: Megaphone,
}

export default function ProspectsDashboard() {
  const params = useParams<{ id: string }>()
  const { data, loading, saving, workspaceName, updateField } = useEditableAction<ProspectsData>(params.id, 'prospects')
  const dashboardRef = useRef<HTMLDivElement>(null)

  async function handleExportPdf() {
    if (!dashboardRef.current) return
    await exportDashboardPdf(dashboardRef.current, `premiers-clients-${workspaceName}.pdf`)
  }

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  if (!data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <UserPlus className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucun plan d&apos;acquisition genere.</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Premiers clients</h1>
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
        {/* Persona */}
        {data.persona && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-emerald-500" /> Persona client ideal</h2>
            </div>
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30">
                    <User className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <EditableText value={str(data.persona.name)} onChange={v => updateField('persona.name', v)} as="p" className="text-lg font-bold" />
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                      <EditableText value={str(data.persona.age)} onChange={v => updateField('persona.age', v)} as="span" className="text-sm text-muted-foreground" />
                      <span>·</span>
                      <EditableText value={str(data.persona.role)} onChange={v => updateField('persona.role', v)} as="span" className="text-sm text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Entreprise type</p>
                    <EditableText value={str(data.persona.company)} onChange={v => updateField('persona.company', v)} as="p" className="text-sm" />
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Declencheur d&apos;achat</p>
                    <EditableText value={str(data.persona.triggerToBuy)} onChange={v => updateField('persona.triggerToBuy', v)} as="p" className="text-sm" />
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Douleur au quotidien</p>
                    <EditableText value={str(data.persona.dailyPain)} onChange={v => updateField('persona.dailyPain', v)} as="p" className="text-sm" multiline />
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Comportement de recherche</p>
                    <EditableText value={str(data.persona.searchBehavior)} onChange={v => updateField('persona.searchBehavior', v)} as="p" className="text-sm" multiline />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Canaux */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="h-5 w-5 text-blue-500" /> Canaux d&apos;acquisition</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.channels?.map((ch, i) => {
              const ChIcon = channelIcons[ch.type] || Globe
              return (
                <div key={i} className="rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all">
                  <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                        <ChIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <EditableText value={str(ch.name)} onChange={v => updateField(`channels[${i}].name`, v)} as="p" className="font-semibold text-sm" />
                        <span className="inline-block rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 mt-0.5">{str(ch.type)}</span>
                      </div>
                    </div>
                    <EditableText value={str(ch.why)} onChange={v => updateField(`channels[${i}].why`, v)} as="p" className="text-xs text-muted-foreground" multiline />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/30 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground">Prospects</p>
                        <EditableText value={str(ch.reachableProspects)} onChange={v => updateField(`channels[${i}].reachableProspects`, v)} as="p" className="text-sm font-medium" />
                      </div>
                      <div className="rounded-lg bg-muted/30 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground">Cout</p>
                        <EditableText value={str(ch.cost)} onChange={v => updateField(`channels[${i}].cost`, v)} as="p" className="text-sm font-medium" />
                      </div>
                    </div>
                    {ch.expectedConversion && (
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Conversion attendue</p>
                        <EditableText value={str(ch.expectedConversion)} onChange={v => updateField(`channels[${i}].expectedConversion`, v)} as="p" className="text-sm font-medium text-emerald-700 dark:text-emerald-400" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Templates de messages */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><MessageSquare className="h-5 w-5 text-orange-500" /> Templates de messages</h2>
          </div>
          <div className="space-y-4">
            {data.templates?.map((t, i) => (
              <div key={i} className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-all">
                <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1 text-xs font-medium text-orange-700 dark:text-orange-400">
                        {str(t.channel)}
                      </span>
                      <EditableText value={str(t.label)} onChange={v => updateField(`templates[${i}].label`, v)} as="span" className="font-semibold text-sm" />
                    </div>
                    <CopyButton text={t.subject ? `Objet: ${str(t.subject)}\n\n${str(t.body)}` : str(t.body)} />
                  </div>
                  {t.subject && (
                    <div className="mb-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Objet : </span>
                      <EditableText value={str(t.subject)} onChange={v => updateField(`templates[${i}].subject`, v)} as="span" className="text-sm font-medium" />
                    </div>
                  )}
                  <div className="rounded-xl bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-950/10 dark:to-card border p-4 mb-3">
                    <EditableText value={str(t.body)} onChange={v => updateField(`templates[${i}].body`, v)} as="p" className="text-sm whitespace-pre-line" multiline />
                  </div>
                  {t.tips && (
                    <div className="flex items-start gap-2">
                      <Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <EditableText value={str(t.tips)} onChange={v => updateField(`templates[${i}].tips`, v)} as="p" className="text-xs text-muted-foreground italic" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sequence de relance */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-violet-500 to-purple-500" />
            <h2 className="text-lg font-semibold flex items-center gap-2"><Calendar className="h-5 w-5 text-violet-500" /> Sequence de relance</h2>
          </div>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500 to-purple-500 opacity-20" />
            <div className="space-y-4">
              {data.sequence?.map((s, i) => (
                <div key={i} className="relative flex items-start gap-4 pl-2">
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30 border-2 border-white dark:border-card">
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{str(s.day)}</span>
                  </div>
                  <div className="flex-1 rounded-2xl border bg-card p-4 hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                        {str(s.channel)}
                      </span>
                    </div>
                    <EditableText value={str(s.action)} onChange={v => updateField(`sequence[${i}].action`, v)} as="p" className="text-sm font-medium mb-1" />
                    <EditableText value={str(s.message)} onChange={v => updateField(`sequence[${i}].message`, v)} as="p" className="text-xs text-muted-foreground italic" multiline />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Metriques */}
        {data.metrics && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-6 rounded-full bg-gradient-to-r from-pink-500 to-rose-500" />
              <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-pink-500" /> Objectifs & Metriques</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border bg-gradient-to-br from-pink-50/50 to-white dark:from-pink-950/10 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Taux de reponse par canal</p>
                <EditableText value={str(data.metrics.responseRateByChannel)} onChange={v => updateField('metrics.responseRateByChannel', v)} as="p" className="text-sm font-medium" multiline />
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/10 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Contacts par jour</p>
                <EditableText value={str(data.metrics.dailyContacts)} onChange={v => updateField('metrics.dailyContacts', v)} as="p" className="text-sm font-medium" />
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/10 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Objectif 10 clients</p>
                <EditableText value={str(data.metrics.targetTimeline)} onChange={v => updateField('metrics.targetTimeline', v)} as="p" className="text-sm font-medium" />
              </div>
              <div className="rounded-2xl border bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/10 dark:to-card p-5 hover:shadow-md transition-all">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Signal de pivot</p>
                <EditableText value={str(data.metrics.pivotSignal)} onChange={v => updateField('metrics.pivotSignal', v)} as="p" className="text-sm font-medium" multiline />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
