'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Users, Mail, Phone, Calendar, Globe, Filter } from 'lucide-react'

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

export default function ContactsPage() {
  const params = useParams<{ id: string }>()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'newsletter' | 'contact'>('all')

  useEffect(() => {
    async function load() {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) return

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.agent-all.ialla.fr'
      const res = await fetch(`${apiUrl}/landing/contacts/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setContacts(data)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  const filtered = filter === 'all' ? contacts : contacts.filter(c => c.form_type === filter)
  const newsletterCount = contacts.filter(c => c.form_type === 'newsletter').length
  const contactCount = contacts.filter(c => c.form_type === 'contact').length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inscriptions et messages recus via vos landing pages
        </p>
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
          Aucun contact pour le moment.
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
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.form_type === 'newsletter'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
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

      {/* Message detail for contact submissions */}
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
