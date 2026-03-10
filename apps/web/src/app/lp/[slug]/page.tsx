'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Zap, Shield, Clock, Star, Target, Heart, Rocket, Check, TrendingUp, Users,
  Loader2, Quote, CheckCircle, Mail, Phone, MapPin,
} from 'lucide-react'

interface LandingData {
  sections: {
    hero: { enabled: boolean; headline: string; subheadline: string; ctaText: string; imageUrl?: string }
    problem: { enabled: boolean; title: string; painPoints: string[] }
    solution: { enabled: boolean; title: string; description: string; features: { title: string; description: string }[]; imageUrl?: string }
    benefits: { enabled: boolean; title: string; items: { icon: string; title: string; description: string }[] }
    testimonial: { enabled: boolean; quote: string; author: string; role: string; company: string; avatarUrl?: string }
    cta: { enabled: boolean; title: string; subtitle: string; ctaText: string }
    emailCapture: { enabled: boolean; title: string; subtitle: string; placeholder: string; buttonText: string; reassurance: string }
    contactForm?: { enabled: boolean; title: string; subtitle: string; fields: { name: string; label: string; type: string; required: boolean }[]; buttonText: string; successMessage: string }
    social?: { enabled: boolean; title: string; links: { platform: string; url: string }[] }
    footer?: { enabled: boolean; companyName: string; email: string; phone: string; address: string }
  }
  branding: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    headingFont: string
    bodyFont: string
  }
}

const ICONS: Record<string, typeof Zap> = {
  zap: Zap, shield: Shield, clock: Clock, star: Star, target: Target,
  heart: Heart, rocket: Rocket, check: Check, 'trending-up': TrendingUp, users: Users,
}

function SocialIcon({ platform, color }: { platform: string; color: string }) {
  const size = 18
  const props = { width: size, height: size, fill: color }
  switch (platform) {
    case 'facebook':
      return <svg {...props} viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    case 'instagram':
      return <svg {...props} viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
    case 'linkedin':
      return <svg {...props} viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    case 'twitter':
      return <svg {...props} viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    case 'tiktok':
      return <svg {...props} viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
    case 'youtube':
      return <svg {...props} viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    default:
      return <span className="text-sm font-bold">{platform.charAt(0).toUpperCase()}</span>
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.agent-all.ialla.fr'

export default function PublicLandingPage() {
  const params = useParams<{ slug: string }>()
  const [data, setData] = useState<LandingData | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [newsletterSent, setNewsletterSent] = useState(false)
  const [contactSent, setContactSent] = useState(false)
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, metadata')

      if (workspaces) {
        for (const ws of workspaces) {
          const landing = (ws.metadata as any)?.actions?.landing?.structured
          if (landing?.slug === params.slug && landing?.published) {
            setData(landing as LandingData)
            setWorkspaceId(ws.id)
            setLoading(false)
            return
          }
        }
      }
      setNotFound(true)
      setLoading(false)
    }
    load()
  }, [params.slug])

  async function handleNewsletterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await fetch(`${API_URL}/landing/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          landing_slug: params.slug,
          email: formData.get('email'),
        }),
      })
      setNewsletterSent(true)
    } catch { /* ignore */ }
    setFormLoading(false)
  }

  async function handleContactSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      await fetch(`${API_URL}/landing/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          landing_slug: params.slug,
          first_name: formData.get('firstName') || formData.get('first_name') || formData.get('prenom') || '',
          last_name: formData.get('lastName') || formData.get('last_name') || formData.get('nom') || '',
          email: formData.get('email'),
          phone: formData.get('phone') || formData.get('tel') || formData.get('telephone') || '',
          message: formData.get('message') || '',
        }),
      })
      setContactSent(true)
    } catch { /* ignore */ }
    setFormLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-white gap-3">
        <p className="text-2xl font-bold text-gray-800">Page introuvable</p>
        <p className="text-gray-500">Cette page n&apos;existe pas ou n&apos;est pas publiee.</p>
      </div>
    )
  }

  const { sections: s, branding: b } = data
  const primary = b.primaryColor || '#7c3aed'
  const secondary = b.secondaryColor || '#a78bfa'
  const accent = b.accentColor || secondary
  const hFont = `${b.headingFont || 'Inter'}, system-ui, sans-serif`
  const bFont = `${b.bodyFont || 'Inter'}, system-ui, sans-serif`

  return (
    <div style={{ fontFamily: bFont }} className="bg-white text-gray-900 min-h-screen">
      {/* Hero */}
      {s.hero.enabled && (
        <section
          className="relative px-6 py-24 md:py-32 text-center overflow-hidden"
          style={{
            background: s.hero.imageUrl
              ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${s.hero.imageUrl}) center/cover`
              : `linear-gradient(135deg, ${primary}10, ${accent}15)`,
            color: s.hero.imageUrl ? 'white' : undefined,
          }}
        >
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight" style={{ fontFamily: hFont }}>
              {s.hero.headline}
            </h1>
            <p className={`mt-6 text-lg md:text-xl ${s.hero.imageUrl ? 'text-white/80' : 'text-gray-600'} max-w-2xl mx-auto`}>
              {s.hero.subheadline}
            </p>
            <a href="#email-capture" className="mt-8 inline-block rounded-xl px-8 py-4 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: primary }}>
              {s.hero.ctaText}
            </a>
          </div>
        </section>
      )}

      {/* Problem */}
      {s.problem.enabled && (
        <section className="px-6 py-20 bg-gray-50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: hFont }}>{s.problem.title}</h2>
            <div className="mt-8 space-y-4">
              {s.problem.painPoints.map((point, i) => (
                <p key={i} className="text-gray-600 text-lg leading-relaxed">{point}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Solution */}
      {s.solution.enabled && (
        <section className="px-6 py-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: hFont }}>{s.solution.title}</h2>
              <p className="mt-4 text-gray-600 text-lg max-w-2xl mx-auto">{s.solution.description}</p>
            </div>
            {s.solution.imageUrl && (
              <div className="mt-10 flex justify-center">
                <img src={s.solution.imageUrl} alt="Solution" className="rounded-2xl shadow-lg max-h-80 object-cover" />
              </div>
            )}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              {s.solution.features.map((f, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${primary}15` }}>
                    <Check className="h-5 w-5" style={{ color: primary }} />
                  </div>
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                  <p className="mt-2 text-gray-600 text-sm">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Benefits */}
      {s.benefits.enabled && (
        <section className="px-6 py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: hFont }}>{s.benefits.title}</h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
              {s.benefits.items.map((item, i) => {
                const Icon = ICONS[item.icon] || Star
                return (
                  <div key={i} className="text-center">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={{ backgroundColor: `${primary}15` }}>
                      <Icon className="h-7 w-7" style={{ color: primary }} />
                    </div>
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    <p className="mt-2 text-gray-600 text-sm">{item.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Testimonial */}
      {s.testimonial.enabled && (
        <section className="px-6 py-20">
          <div className="max-w-3xl mx-auto text-center">
            <Quote className="h-10 w-10 mx-auto mb-6" style={{ color: `${primary}40` }} />
            <blockquote className="text-xl md:text-2xl font-medium italic text-gray-800 leading-relaxed">
              &ldquo;{s.testimonial.quote}&rdquo;
            </blockquote>
            <div className="mt-6 flex items-center justify-center gap-3">
              {s.testimonial.avatarUrl ? (
                <img src={s.testimonial.avatarUrl} alt={s.testimonial.author} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: primary }}>
                  {s.testimonial.author.charAt(0)}
                </div>
              )}
              <div className="text-left">
                <p className="font-semibold">{s.testimonial.author}</p>
                <p className="text-sm text-gray-500">{s.testimonial.role}, {s.testimonial.company}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {s.cta.enabled && (
        <section className="px-6 py-20" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
          <div className="max-w-3xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{s.cta.title}</h2>
            <p className="mt-4 text-lg text-white/80">{s.cta.subtitle}</p>
            <a href="#email-capture" className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-lg font-semibold shadow-lg transition-transform hover:scale-105" style={{ color: primary }}>
              {s.cta.ctaText}
            </a>
          </div>
        </section>
      )}

      {/* Email Capture */}
      {s.emailCapture.enabled && (
        <section id="email-capture" className="px-6 py-20 bg-white">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: hFont }}>{s.emailCapture.title}</h2>
            <p className="mt-4 text-gray-600">{s.emailCapture.subtitle}</p>
            {newsletterSent ? (
              <div className="mt-8 flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Merci pour votre inscription !</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="mt-8 flex gap-3">
                <input type="email" name="email" required placeholder={s.emailCapture.placeholder}
                  className="flex-1 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                <button type="submit" disabled={formLoading} className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-105 disabled:opacity-50" style={{ backgroundColor: primary }}>
                  {formLoading ? '...' : s.emailCapture.buttonText}
                </button>
              </form>
            )}
            <p className="mt-3 text-xs text-gray-400">{s.emailCapture.reassurance}</p>
          </div>
        </section>
      )}

      {/* Contact Form */}
      {s.contactForm?.enabled && (
        <section className="px-6 py-20 bg-white">
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-center" style={{ fontFamily: hFont }}>{s.contactForm.title}</h2>
            <p className="mt-4 text-gray-600 text-center">{s.contactForm.subtitle}</p>
            {contactSent ? (
              <div className="mt-8 flex flex-col items-center gap-2 text-green-600">
                <CheckCircle className="h-8 w-8" />
                <span className="font-medium text-lg">{s.contactForm.successMessage || 'Merci ! Votre message a bien ete envoye.'}</span>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="mt-8 space-y-4">
                {s.contactForm.fields.map((field, i) => (
                  <div key={i}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea name={field.name} required={field.required} rows={4}
                        className="w-full rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 text-sm focus:outline-none focus:ring-2"
                        style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                    ) : (
                      <input type={field.type} name={field.name} required={field.required}
                        className="w-full rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 text-sm focus:outline-none focus:ring-2"
                        style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                    )}
                  </div>
                ))}
                <button type="submit" disabled={formLoading} className="w-full rounded-xl px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-105 disabled:opacity-50" style={{ backgroundColor: primary }}>
                  {formLoading ? '...' : s.contactForm.buttonText}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* Social */}
      {s.social?.enabled && s.social.links?.length > 0 && (
        <section className="px-6 py-12 border-t border-gray-200">
          <div className="max-w-3xl mx-auto text-center">
            {s.social.title && <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: hFont }}>{s.social.title}</h3>}
            <div className="flex items-center justify-center gap-4">
              {s.social.links.filter(l => l.url).map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center h-11 w-11 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: `${primary}15`, color: primary }}
                  title={link.platform}
                >
                  <SocialIcon platform={link.platform} color={primary} />
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      {s.footer?.enabled && (s.footer.email || s.footer.phone || s.footer.address || s.footer.companyName) && (
        <footer className="px-6 py-12 bg-gray-900 text-white">
          <div className="max-w-3xl mx-auto">
            {s.footer.companyName && (
              <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: hFont }}>{s.footer.companyName}</h3>
            )}
            <div className="flex flex-wrap gap-6 text-sm text-gray-400">
              {s.footer.email && (
                <a href={`mailto:${s.footer.email}`} className="flex items-center gap-2 hover:text-white transition-colors">
                  <Mail className="h-4 w-4" /> {s.footer.email}
                </a>
              )}
              {s.footer.phone && (
                <a href={`tel:${s.footer.phone}`} className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone className="h-4 w-4" /> {s.footer.phone}
                </a>
              )}
              {s.footer.address && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {s.footer.address}
                </span>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
