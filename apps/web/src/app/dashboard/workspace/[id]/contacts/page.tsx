'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Mail,
  Phone,
  Globe,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  Star,
  MessageCircle,
  Send,
  Loader2,
  Search,
  X,
} from 'lucide-react'

// --- Types ---

interface Lead {
  id: string
  workspace_id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  website: string | null
  score: number
  status: string
  source: string | null
  tags: string[] | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface Interaction {
  id: string
  lead_id: string
  type: string
  subject: string | null
  content: string | null
  classification: string | null
  sentiment: string | null
  created_at: string
}

// --- Helpers ---

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'new', label: 'Nouveau' },
  { value: 'contacted', label: 'Contacte' },
  { value: 'replied', label: 'A repondu' },
  { value: 'interested', label: 'Interesse' },
  { value: 'not_interested', label: 'Pas interesse' },
  { value: 'converted', label: 'Converti' },
]

function getStatusColor(status: string): string {
  switch (status) {
    case 'new':
      return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
    case 'contacted':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'replied':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    case 'interested':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'not_interested':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'converted':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
    default:
      return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
  }
}

function getStatusLabel(status: string): string {
  const opt = STATUS_OPTIONS.find((o) => o.value === status)
  return opt ? opt.label : status
}

function getScoreColor(score: number): string {
  if (score <= 30) return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
  if (score <= 50) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (score <= 70) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// --- Components ---

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tracking-tight mt-1">{value}</p>
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InteractionTimeline({ leadId }: { leadId: string }) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('interactions')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      setInteractions(data ?? [])
      setLoading(false)
    }
    load()
  }, [leadId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (interactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Aucune interaction enregistree.
      </p>
    )
  }

  return (
    <div className="relative pl-6 space-y-4 py-2">
      {/* Vertical timeline line */}
      <div className="absolute left-[11px] top-4 bottom-4 w-px bg-neutral-200 dark:bg-neutral-700" />

      {interactions.map((interaction) => {
        const isReply = interaction.type === 'email_reply'
        const Icon = isReply ? MessageCircle : Send
        const iconColor = isReply
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-blue-600 dark:text-blue-400'

        return (
          <div key={interaction.id} className="relative flex gap-3">
            <div className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background border ${iconColor}`}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {interaction.subject && (
                    <p className="text-sm font-medium truncate">{interaction.subject}</p>
                  )}
                  {interaction.content && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {interaction.content}
                    </p>
                  )}
                  {interaction.classification && (
                    <Badge
                      className={`mt-1 text-[10px] ${
                        interaction.sentiment === 'positive'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : interaction.sentiment === 'negative'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}
                    >
                      {interaction.classification}
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                  {formatDateTime(interaction.created_at)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Lead Row ---

function LeadRow({
  lead,
  isExpanded,
  onToggle,
}: {
  lead: Lead
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
      >
        <TableCell className="w-8 pr-0">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{lead.name}</span>
            {lead.company && (
              <span className="text-xs text-muted-foreground">{lead.company}</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {lead.email ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[180px]">{lead.email}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <Badge className={`text-[11px] font-medium ${getScoreColor(lead.score)}`}>
            {lead.score}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge className={`text-[11px] font-medium ${getStatusColor(lead.status)}`}>
            {getStatusLabel(lead.status)}
          </Badge>
        </TableCell>
        <TableCell>
          {lead.source ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              <span>{lead.source}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {(lead.tags ?? []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            {(lead.tags ?? []).length > 3 && (
              <Badge variant="secondary" className="text-[10px]">
                +{(lead.tags ?? []).length - 3}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right text-xs text-muted-foreground">
          {formatDate(lead.created_at)}
        </TableCell>
      </TableRow>

      {/* Expanded interaction timeline */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 px-8 py-4">
            <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {lead.phone}
                </span>
              )}
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Globe className="h-3 w-3" />
                  {lead.website}
                </a>
              )}
            </div>
            <h4 className="text-sm font-medium mb-2">Historique d&apos;interactions</h4>
            <InteractionTimeline leadId={lead.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// --- Main Page ---

export default function LeadsPage() {
  const params = useParams<{ id: string }>()
  const workspaceId = params.id

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('')
  const [hasEmailFilter, setHasEmailFilter] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch leads
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      setLeads(data ?? [])
      setLoading(false)
    }
    load()
  }, [workspaceId])

  // Unique sources for filter
  const sources = useMemo(() => {
    const s = new Set(leads.map((l) => l.source).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [leads])

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false
      if (sourceFilter && lead.source !== sourceFilter) return false
      if (hasEmailFilter && !lead.email) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          lead.name?.toLowerCase().includes(q) ||
          lead.email?.toLowerCase().includes(q) ||
          lead.company?.toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [leads, statusFilter, sourceFilter, hasEmailFilter, searchQuery])

  // Stats
  const stats = useMemo(() => {
    return {
      total: leads.length,
      contacted: leads.filter((l) => l.status === 'contacted').length,
      replied: leads.filter((l) => l.status === 'replied').length,
      interested: leads.filter((l) => l.status === 'interested').length,
    }
  }, [leads])

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = ['Nom', 'Email', 'Telephone', 'Entreprise', 'Score', 'Statut', 'Source', 'Tags', 'Date']
    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.email ?? '',
      lead.phone ?? '',
      lead.company ?? '',
      String(lead.score),
      lead.status,
      lead.source ?? '',
      (lead.tags ?? []).join('; '),
      formatDate(lead.created_at),
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${workspaceId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredLeads, workspaceId])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads CRM</h1>
            <p className="text-sm text-muted-foreground">
              Leads decouverts par vos agents avec historique d&apos;interactions.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={exportCSV}
          disabled={filteredLeads.length === 0}
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total leads"
          value={stats.total}
          icon={Users}
          color="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
        />
        <StatCard
          label="Contactes"
          value={stats.contacted}
          icon={Send}
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label="Ont repondu"
          value={stats.replied}
          icon={MessageCircle}
          color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          label="Interesses"
          value={stats.interested}
          icon={Star}
          color="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="h-8 w-48 pl-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status */}
            <select
              className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Source */}
            {sources.length > 0 && (
              <select
                className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="">Toutes les sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {/* Has email */}
            <Button
              variant={hasEmailFilter ? 'default' : 'outline'}
              size="sm"
              className={`h-8 text-xs gap-1.5 ${hasEmailFilter ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}
              onClick={() => setHasEmailFilter(!hasEmailFilter)}
            >
              <Mail className="h-3 w-3" />
              Avec email
            </Button>

            {/* Reset */}
            {(statusFilter !== 'all' || sourceFilter || hasEmailFilter || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1 text-muted-foreground"
                onClick={() => {
                  setStatusFilter('all')
                  setSourceFilter('')
                  setHasEmailFilter(false)
                  setSearchQuery('')
                }}
              >
                <X className="h-3 w-3" />
                Reinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement des leads...</span>
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {leads.length === 0
                ? 'Aucun lead pour ce workspace.'
                : 'Aucun lead ne correspond aux filtres.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const isExpanded = expandedId === lead.id
                return (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : lead.id)}
                  />
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Count footer */}
      {!loading && filteredLeads.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {filteredLeads.length} lead{filteredLeads.length > 1 ? 's' : ''} affiche{filteredLeads.length > 1 ? 's' : ''}
          {filteredLeads.length !== leads.length && ` sur ${leads.length}`}
        </p>
      )}
    </div>
  )
}
