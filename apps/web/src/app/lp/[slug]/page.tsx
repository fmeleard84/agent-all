'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Zap, Shield, Clock, Star, Target, Heart, Rocket, Check, TrendingUp, Users,
  Loader2, Quote,
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

const SOCIAL_LABELS: Record<string, string> = {
  facebook: 'F', instagram: 'I', linkedin: 'in', twitter: 'X', tiktok: 'T', youtube: 'Y',
}

export default function PublicLandingPage() {
  const params = useParams<{ slug: string }>()
  const [data, setData] = useState<LandingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      // Find workspace by slug in metadata
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('metadata')

      if (workspaces) {
        for (const ws of workspaces) {
          const landing = (ws.metadata as any)?.actions?.landing?.structured
          if (landing?.slug === params.slug && landing?.published) {
            setData(landing as LandingData)
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
                <div key={i} className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
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
        <section id="email-capture" className="px-6 py-20 bg-gray-50">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: hFont }}>{s.emailCapture.title}</h2>
            <p className="mt-4 text-gray-600">{s.emailCapture.subtitle}</p>
            <form action="https://formspree.io/f/placeholder" method="POST" className="mt-8 flex gap-3">
              <input type="email" name="email" required placeholder={s.emailCapture.placeholder}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': primary } as React.CSSProperties} />
              <button type="submit" className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-105" style={{ backgroundColor: primary }}>
                {s.emailCapture.buttonText}
              </button>
            </form>
            <p className="mt-3 text-xs text-gray-400">{s.emailCapture.reassurance}</p>
          </div>
        </section>
      )}

      {/* Contact Form */}
      {s.contactForm?.enabled && (
        <section className="px-6 py-20">
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-center" style={{ fontFamily: hFont }}>{s.contactForm.title}</h2>
            <p className="mt-4 text-gray-600 text-center">{s.contactForm.subtitle}</p>
            <form action="https://formspree.io/f/placeholder" method="POST" className="mt-8 space-y-4">
              {s.contactForm.fields.map((field, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea name={field.name} required={field.required} rows={4}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                  ) : (
                    <input type={field.type} name={field.name} required={field.required}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties} />
                  )}
                </div>
              ))}
              <button type="submit" className="w-full rounded-xl px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-105" style={{ backgroundColor: primary }}>
                {s.contactForm.buttonText}
              </button>
            </form>
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
                  className="flex items-center justify-center h-11 w-11 rounded-full text-sm font-bold transition-transform hover:scale-110"
                  style={{ backgroundColor: `${primary}15`, color: primary }}
                  title={link.platform}
                >
                  {SOCIAL_LABELS[link.platform] || link.platform.charAt(0).toUpperCase()}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AI Badge */}
      <div className="fixed bottom-4 right-4 rounded-full bg-gray-900/80 backdrop-blur-sm px-4 py-2 text-xs text-white/70 shadow-lg">
        Page de test generee par IA
      </div>
    </div>
  )
}
