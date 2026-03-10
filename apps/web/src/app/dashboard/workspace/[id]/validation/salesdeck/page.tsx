'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Presentation,
  ChevronLeft,
  ChevronRight,
  Users,
  Briefcase,
  FileDown,
  ImageIcon,
} from 'lucide-react'

interface Slide {
  title: string
  subtitle?: string
  content: string[]
  notes?: string
  visualType?: string
  imageUrl?: string
  imagePlaceholder?: string
}

interface DeckData {
  salesDeck: { title: string; slides: Slide[] }
  pitchDeck: { title: string; slides: Slide[] }
  branding: {
    primaryColor: string
    secondaryColor: string
    accentColor?: string
    headingFont: string
    bodyFont: string
  }
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function darkenHex(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex)
  const d = (v: number) => Math.max(0, Math.round(v * (1 - amount)))
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`
}

function lightenHex(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex)
  const l = (v: number) => Math.min(255, Math.round(v + (255 - v) * amount))
  return `rgb(${l(r)}, ${l(g)}, ${l(b)})`
}

function getSlideStyle(slide: Slide, index: number, primary: string, secondary: string, totalSlides: number): {
  bg: string
  color: string
  accentColor: string
  layout: 'cover' | 'dark' | 'accent' | 'light' | 'split' | 'closing' | 'image'
} {
  const isFirst = index === 0
  const isLast = index === totalSlides - 1
  const vt = slide.visualType?.toLowerCase() || ''
  const hasImage = !!slide.imageUrl

  if (isFirst) return {
    bg: `linear-gradient(135deg, ${primary} 0%, ${darkenHex(primary, 0.3)} 100%)`,
    color: 'white',
    accentColor: 'rgba(255,255,255,0.3)',
    layout: 'cover',
  }
  if (isLast || vt === 'cta' || vt === 'closing') return {
    bg: `linear-gradient(135deg, ${darkenHex(primary, 0.15)} 0%, ${primary} 100%)`,
    color: 'white',
    accentColor: 'rgba(255,255,255,0.3)',
    layout: 'closing',
  }
  if (hasImage) return {
    bg: 'white',
    color: '#1a1a2e',
    accentColor: primary,
    layout: 'image',
  }
  if (vt === 'pricing' || vt === 'financial' || vt === 'projections') return {
    bg: `linear-gradient(180deg, ${primary} 0%, ${darkenHex(primary, 0.2)} 100%)`,
    color: 'white',
    accentColor: 'rgba(255,255,255,0.2)',
    layout: 'dark',
  }
  if (vt === 'team' || vt === 'traction' || vt === 'testimonials') return {
    bg: `linear-gradient(135deg, ${lightenHex(primary, 0.92)} 0%, ${lightenHex(primary, 0.85)} 100%)`,
    color: '#1a1a2e',
    accentColor: primary,
    layout: 'accent',
  }
  if (index % 3 === 0) return {
    bg: '#f8f9fc',
    color: '#1a1a2e',
    accentColor: primary,
    layout: 'light',
  }
  if (index % 3 === 1) return {
    bg: 'white',
    color: '#1a1a2e',
    accentColor: primary,
    layout: 'split',
  }
  return {
    bg: `linear-gradient(135deg, ${lightenHex(secondary, 0.92)} 0%, white 100%)`,
    color: '#1a1a2e',
    accentColor: primary,
    layout: 'light',
  }
}

function SlideRenderer({ slide, index, primary, secondary, totalSlides, hFont, bFont }: {
  slide: Slide
  index: number
  primary: string
  secondary: string
  totalSlides: number
  hFont: string
  bFont: string
}) {
  const style = getSlideStyle(slide, index, primary, secondary, totalSlides)
  const hasImage = !!slide.imageUrl
  const hasPlaceholder = !!slide.imagePlaceholder && !hasImage

  return (
    <div
      className="aspect-[16/9] relative overflow-hidden select-none"
      style={{ background: style.bg, color: style.color, fontFamily: bFont }}
    >
      {/* Decorative elements */}
      {style.layout === 'cover' && (
        <>
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-10"
            style={{ background: `radial-gradient(circle at 70% 30%, white 0%, transparent 60%)` }} />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-5"
            style={{ background: 'white', transform: 'translate(-30%, 30%)' }} />
          <div className="absolute top-8 right-8 w-24 h-24 rounded-full opacity-10"
            style={{ background: secondary }} />
        </>
      )}
      {style.layout === 'closing' && (
        <div className="absolute inset-0 opacity-10"
          style={{ background: `radial-gradient(circle at 50% 50%, white 0%, transparent 70%)` }} />
      )}
      {(style.layout === 'light' || style.layout === 'split' || style.layout === 'image') && (
        <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: primary }} />
      )}
      {style.layout === 'accent' && (
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ backgroundColor: primary, transform: 'translate(30%, 30%)' }} />
      )}
      {style.layout === 'dark' && (
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5"
          style={{ background: 'white', transform: 'translate(20%, -20%)' }} />
      )}

      {/* Content */}
      <div className={`relative h-full flex ${
        style.layout === 'image' ? 'flex-row' :
        style.layout === 'cover' || style.layout === 'closing'
          ? 'flex-col items-center justify-center text-center px-16'
          : 'flex-col justify-center px-16 pl-20'
      }`}>
        {/* Slide number badge */}
        {style.layout !== 'cover' && (
          <div className="absolute top-6 right-8 text-[11px] font-medium opacity-40 tracking-wide">
            {String(index + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
          </div>
        )}

        {/* Image layout: text left, image right */}
        {style.layout === 'image' ? (
          <>
            <div className="flex-1 flex flex-col justify-center pl-20 pr-8 py-8">
              <h2
                className="text-2xl md:text-3xl font-bold tracking-tight leading-tight mb-2"
                style={{ fontFamily: hFont }}
              >
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className="text-base opacity-70 max-w-xl mb-4">{slide.subtitle}</p>
              )}
              {slide.content.length > 0 && (
                <div className="space-y-2.5 mt-2">
                  {slide.content.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1.5 h-2.5 w-2.5 rounded-sm shrink-0 rotate-45"
                        style={{ backgroundColor: primary }} />
                      <span className="text-[14px] leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="w-[45%] relative">
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </>
        ) : (
          <>
            {/* Title */}
            <h2
              className={`font-bold tracking-tight leading-tight ${
                style.layout === 'cover' ? 'text-4xl md:text-5xl mb-4' : 'text-2xl md:text-3xl mb-2'
              }`}
              style={{ fontFamily: hFont }}
            >
              {slide.title}
            </h2>

            {/* Subtitle */}
            {slide.subtitle && (
              <p className={`leading-relaxed mb-6 ${
                style.layout === 'cover' ? 'text-xl opacity-80 max-w-2xl' : 'text-base opacity-70 max-w-xl'
              }`}>
                {slide.subtitle}
              </p>
            )}

            {/* Content with optional placeholder image */}
            <div className={`flex gap-8 mt-4 ${style.layout === 'cover' || style.layout === 'closing' ? 'max-w-3xl flex-col' : ''}`}>
              <div className={`space-y-3 ${hasPlaceholder ? 'flex-1' : 'max-w-3xl'}`}>
                {slide.content.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="mt-1.5 h-2.5 w-2.5 rounded-sm shrink-0 rotate-45"
                      style={{
                        backgroundColor: style.layout === 'cover' || style.layout === 'closing' || style.layout === 'dark'
                          ? 'rgba(255,255,255,0.5)'
                          : primary,
                      }}
                    />
                    <span className="text-[15px] leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>

              {/* Image placeholder */}
              {hasPlaceholder && style.layout !== 'cover' && style.layout !== 'closing' && (
                <div className="w-48 h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 opacity-30 shrink-0"
                  style={{ borderColor: style.layout === 'dark' ? 'rgba(255,255,255,0.3)' : primary }}>
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-[10px] text-center px-2 leading-tight">{slide.imagePlaceholder}</span>
                </div>
              )}
            </div>

            {/* Cover decorative line */}
            {style.layout === 'cover' && (
              <div className="mt-8 flex items-center gap-2 opacity-40">
                <div className="h-px w-12 bg-current" />
                <div className="h-1.5 w-1.5 rounded-full bg-current" />
                <div className="h-px w-12 bg-current" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function exportToPptx(
  deck: { title: string; slides: Slide[] },
  branding: DeckData['branding'],
  deckType: string
) {
  const pptxgen = (await import('pptxgenjs')).default
  const pres = new pptxgen()

  pres.layout = 'LAYOUT_WIDE'
  pres.author = 'Agent All'
  pres.subject = deck.title

  const pHex = (branding.primaryColor || '#7c3aed').replace('#', '')
  const sHex = (branding.secondaryColor || '#a78bfa').replace('#', '')
  const aHex = (branding.accentColor || '#f59e0b').replace('#', '')
  const headingFont = branding.headingFont || 'Arial'
  const bodyFont = branding.bodyFont || 'Arial'

  // Pre-fetch images
  const imageCache: Record<number, string> = {}
  for (let i = 0; i < deck.slides.length; i++) {
    if (deck.slides[i].imageUrl) {
      const b64 = await fetchImageAsBase64(deck.slides[i].imageUrl!)
      if (b64) imageCache[i] = b64
    }
  }

  for (let i = 0; i < deck.slides.length; i++) {
    const s = deck.slides[i]
    const pptSlide = pres.addSlide()
    const isFirst = i === 0
    const isLast = i === deck.slides.length - 1
    const vt = s.visualType?.toLowerCase() || ''
    const isDark = isFirst || isLast || vt === 'pricing' || vt === 'financial' || vt === 'projections' || vt === 'cta' || vt === 'closing'
    const hasImage = !!imageCache[i]

    // Background
    if (isDark) {
      pptSlide.background = { color: pHex }
    } else {
      pptSlide.background = { color: 'FFFFFF' }
    }

    // Decorative elements
    if (!isDark && !hasImage) {
      // Left accent bar
      pptSlide.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: 0.1, h: '100%',
        fill: { color: pHex },
      })
    }
    if (isDark && !isFirst && !isLast) {
      // Subtle circle decoration
      pptSlide.addShape(pres.ShapeType.ellipse, {
        x: 10.5, y: -0.5, w: 3, h: 3,
        fill: { color: 'FFFFFF', transparency: 92 },
      })
    }
    if (isFirst) {
      // Cover decorations
      pptSlide.addShape(pres.ShapeType.ellipse, {
        x: 9, y: 0.5, w: 2, h: 2,
        fill: { color: sHex, transparency: 85 },
      })
      pptSlide.addShape(pres.ShapeType.ellipse, {
        x: -1.5, y: 5, w: 4, h: 4,
        fill: { color: 'FFFFFF', transparency: 92 },
      })
    }

    const textColor = isDark ? 'FFFFFF' : '1A1A2E'
    const subtitleColor = isDark ? 'CCCCCC' : '666666'
    const contentWidth = hasImage ? 6.5 : (isDark ? 10 : 10)
    const leftMargin = isDark ? (isFirst ? 1 : 1.5) : 1.6

    // Title
    pptSlide.addText(s.title, {
      x: isFirst ? 1 : leftMargin,
      y: isFirst ? 1.8 : 0.7,
      w: isFirst ? 11.3 : contentWidth,
      h: 1,
      fontSize: isFirst ? 36 : 24,
      fontFace: headingFont,
      color: textColor,
      bold: true,
      align: isFirst ? 'center' : 'left',
    })

    // Subtitle
    if (s.subtitle) {
      pptSlide.addText(s.subtitle, {
        x: isFirst ? 1 : leftMargin,
        y: isFirst ? 2.9 : 1.6,
        w: isFirst ? 11.3 : contentWidth,
        h: 0.5,
        fontSize: isFirst ? 16 : 13,
        fontFace: bodyFont,
        color: subtitleColor,
        align: isFirst ? 'center' : 'left',
      })
    }

    // Content bullets
    if (s.content.length > 0) {
      const startY = s.subtitle ? (isFirst ? 3.8 : 2.3) : (isFirst ? 3.2 : 1.9)
      const bulletRows = s.content.map(item => ({
        text: item,
        options: {
          fontSize: 13,
          fontFace: bodyFont,
          color: textColor,
          bullet: { type: 'bullet' as const, color: isDark ? sHex : pHex },
          paraSpaceAfter: 8,
        },
      }))

      pptSlide.addText(bulletRows, {
        x: isFirst ? 2.5 : leftMargin,
        y: startY,
        w: isFirst ? 8.3 : contentWidth,
        h: 4,
        valign: 'top',
      })
    }

    // Image (real or placeholder)
    if (hasImage) {
      pptSlide.addImage({
        data: imageCache[i],
        x: 7.8, y: 0.5, w: 5.2, h: 6.5,
        rounding: true,
      })
    } else if (s.imagePlaceholder && !isDark && !isFirst && !isLast) {
      // Visual placeholder with brand color
      pptSlide.addShape(pres.ShapeType.roundRect, {
        x: 8.5, y: 1.5, w: 4, h: 4,
        fill: { color: pHex, transparency: 90 },
        line: { color: pHex, dashType: 'dash', width: 1.5 },
        rectRadius: 0.2,
      })
      pptSlide.addText(s.imagePlaceholder, {
        x: 8.5, y: 2.8, w: 4, h: 1.5,
        fontSize: 10,
        fontFace: bodyFont,
        color: pHex,
        align: 'center',
        valign: 'middle',
      })
    }

    // Slide number
    if (!isFirst) {
      pptSlide.addText(`${i + 1}`, {
        x: 12, y: 6.8, w: 0.8, h: 0.4,
        fontSize: 9,
        fontFace: bodyFont,
        color: isDark ? '999999' : 'AAAAAA',
        align: 'right',
      })
    }

    // Bottom accent bar for non-dark slides
    if (!isDark && !hasImage) {
      pptSlide.addShape(pres.ShapeType.rect, {
        x: 0, y: 7.35, w: '100%', h: 0.15,
        fill: { color: pHex, transparency: 85 },
      })
    }

    // Notes
    if (s.notes) {
      pptSlide.addNotes(s.notes)
    }
  }

  const fileName = `${deckType}-${deck.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pptx`
  await pres.writeFile({ fileName })
}

export default function SalesDeckPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<DeckData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeDeck, setActiveDeck] = useState<'sales' | 'pitch'>('sales')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('metadata')
        .eq('id', params.id)
        .single()

      const structured = (ws?.metadata as any)?.actions?.salesdeck?.structured
      if (structured) setData(structured as DeckData)
      setLoading(false)
    }
    load()
  }, [params.id])

  const handleExport = useCallback(async () => {
    if (!data || exporting) return
    setExporting(true)
    try {
      const deck = activeDeck === 'sales' ? data.salesDeck : data.pitchDeck
      await exportToPptx(deck, data.branding, activeDeck === 'sales' ? 'sales-deck' : 'pitch-deck')
    } finally {
      setExporting(false)
    }
  }, [data, activeDeck, exporting])

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
        <Presentation className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucun deck genere.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour a la validation
        </Link>
      </div>
    )
  }

  const deck = activeDeck === 'sales' ? data.salesDeck : data.pitchDeck
  const slides = deck?.slides || []
  const slide = slides[currentSlide]
  const primary = data.branding?.primaryColor || '#7c3aed'
  const secondary = data.branding?.secondaryColor || '#a78bfa'
  const hFont = `${data.branding?.headingFont || 'Inter'}, system-ui, sans-serif`
  const bFont = `${data.branding?.bodyFont || 'Inter'}, system-ui, sans-serif`

  function prevSlide() { setCurrentSlide(Math.max(0, currentSlide - 1)) }
  function nextSlide() { setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1)) }
  function switchDeck(d: 'sales' | 'pitch') { setActiveDeck(d); setCurrentSlide(0) }

  return (
    <div className="px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-xl border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
              <Presentation className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Decks de presentation</h1>
              <p className="text-sm text-muted-foreground">
                {data.branding?.headingFont && data.branding.headingFont !== 'Inter'
                  ? `Font: ${data.branding.headingFont} — Couleur: `
                  : 'Couleur: '}
                <span className="inline-block w-3 h-3 rounded-full align-middle" style={{ backgroundColor: primary }} />
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: primary }}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Telecharger PowerPoint
        </button>
      </div>

      {/* Deck tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => switchDeck('sales')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeDeck === 'sales' ? 'text-white shadow-md' : 'border hover:bg-accent text-muted-foreground'
          }`}
          style={activeDeck === 'sales' ? { backgroundColor: primary } : undefined}
        >
          <Briefcase className="h-4 w-4" /> Sales Deck Client
        </button>
        <button
          onClick={() => switchDeck('pitch')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeDeck === 'pitch' ? 'text-white shadow-md' : 'border hover:bg-accent text-muted-foreground'
          }`}
          style={activeDeck === 'pitch' ? { backgroundColor: primary } : undefined}
        >
          <Users className="h-4 w-4" /> Pitch Deck Investisseur
        </button>
      </div>

      {/* Slide viewer */}
      {slide && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-black/5">
            <SlideRenderer
              slide={slide}
              index={currentSlide}
              primary={primary}
              secondary={secondary}
              totalSlides={slides.length}
              hFont={hFont}
              bFont={bFont}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-1">
            <button onClick={prevSlide} disabled={currentSlide === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" /> Precedent
            </button>
            <div className="flex gap-1.5">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)}
                  className={`rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 h-2.5' : 'w-2.5 h-2.5 opacity-40 hover:opacity-70'}`}
                  style={{ backgroundColor: i === currentSlide ? primary : '#9ca3af' }} />
              ))}
            </div>
            <button onClick={nextSlide} disabled={currentSlide === slides.length - 1}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors disabled:opacity-30">
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Speaker notes */}
          {slide.notes && (
            <div className="rounded-xl border bg-muted/30 p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes du presentateur</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{slide.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* All slides overview */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Toutes les slides</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {slides.map((s, i) => {
            const thumbStyle = getSlideStyle(s, i, primary, secondary, slides.length)
            return (
              <button key={i} onClick={() => setCurrentSlide(i)}
                className={`rounded-xl overflow-hidden border text-left hover:shadow-lg transition-all ${i === currentSlide ? 'ring-2 ring-offset-2 shadow-md' : ''}`}
                style={{ '--tw-ring-color': primary } as React.CSSProperties}>
                <div className="aspect-[16/9] p-3 flex flex-col justify-center relative"
                  style={{ background: thumbStyle.bg, color: thumbStyle.color }}>
                  {s.imageUrl && (
                    <div className="absolute inset-0 opacity-20">
                      <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="relative text-[9px] font-bold leading-tight line-clamp-2 opacity-90">{s.title}</div>
                  {s.content.length > 0 && (
                    <div className="relative mt-1 space-y-0.5">
                      {s.content.slice(0, 2).map((_, ci) => (
                        <div key={ci} className="h-[3px] rounded-full opacity-30" style={{ backgroundColor: 'currentColor', width: `${70 - ci * 15}%` }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-2.5 py-2 bg-card">
                  <div className="text-[10px] font-medium text-muted-foreground">Slide {i + 1}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
