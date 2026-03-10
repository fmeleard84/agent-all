'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Mail, Phone, Calendar, Globe, Filter, Download } from 'lucide-react'

interface Contact {
  id: string
  workspace_id: string
  landing_slug: string
  form_type: 'newsletter' | 'contact'
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  message: string | null
  created_at: string
}

interface Workspace {
  id: string
  name: string
}

export default function ContactsCrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [workspaces, setWorkspaces] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'newsletter' | 'contact'>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load workspaces for this user
      const { data: wsList } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('user_id', user.id)

      const wsMap: Record<string, string> = {}
      const wsIds: string[] = []
      for (const ws of (wsList || [])) {
        wsMap[ws.id] = ws.name
        wsIds.push(ws.id)
      }
      setWorkspaces(wsMap)

      if (wsIds.length === 0) {
        setLoading(false)
        return
      }

      // Load contacts for all user workspaces
      const { data: contactsList } = await supabase
        .from('landing_contacts')
        .select('*')
        .in('workspace_id', wsIds)
        .order('created_at', { ascending: false })

      setContacts(contactsList || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = filter === 'all' ? contacts : contacts.filter(c => c.form_type === filter)
  const newsletterCount = contacts.filter(c => c.form_type === 'newsletter').length
  const contactCount = contacts.filter(c => c.form_type === 'contact').length

  function exportCsv() {
    const headers = ['Type', 'Nom', 'Prenom', 'Email', 'Telephone', 'Message', 'Landing', 'Workspace', 'Date']
    const rows = filtered.map(c => [
      c.form_type,
      c.last_name || '',
      c.first_name || '',
      c.email,
      c.phone || '',
      (c.message || '').replace(/"/g, '""'),
      c.landing_slug,
      workspaces[c.workspace_id] || c.workspace_id,
      new Date(c.created_at).toLocaleDateString('fr-FR'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts / CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tous les contacts recus via vos landing pages
          </p>
        </div>
        {contacts.length > 0 && (
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download className="h-4 w-4" /> Exporter CSV
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Total
          </div>
          <p className="mt-1 text-2xl font-semibold">{contacts.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            Newsletter
          </div>
          <p className="mt-1 text-2xl font-semibold">{newsletterCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            Contact
          </div>
          <p className="mt-1 text-2xl font-semibold">{contactCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(['all', 'newsletter', 'contact'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'newsletter' ? 'Newsletter' : 'Contact'}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun contact pour le moment. Les inscriptions et messages de vos landing pages apparaitront ici.
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Nom</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Telephone</th>
                <th className="text-left px-4 py-3 font-medium">Landing</th>
                <th className="text-left px-4 py-3 font-medium">Workspace</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.form_type === 'newsletter'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {c.form_type === 'newsletter' ? 'Newsletter' : 'Contact'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.first_name || c.last_name
                      ? `${c.first_name || ''} ${c.last_name || ''}`.trim()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      {c.landing_slug}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{workspaces[c.workspace_id] || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Messages */}
      {filter !== 'newsletter' && filtered.some(c => c.message) && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Messages</h2>
          {filtered.filter(c => c.message).map(c => (
            <div key={c.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">
                  {c.first_name} {c.last_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{c.message}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{c.email}</span>
                {c.phone && <span>{c.phone}</span>}
                <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{c.landing_slug}</span>
                <span>{workspaces[c.workspace_id] || ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
