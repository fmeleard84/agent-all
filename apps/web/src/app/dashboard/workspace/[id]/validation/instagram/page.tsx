'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Instagram,
  Copy,
  Check,
  Clock,
  TrendingUp,
  Hash,
  Film,
  LayoutGrid,
  Image as ImageIcon,
  MessageCircle,
} from 'lucide-react'

interface InstaPublication {
  type: string
  caption: string
  slides?: { title: string; text: string }[]
  reelScript?: { hook: string; content: string; cta: string; duration: string }
  visualDescription: string
  colorScheme?: { primary: string; secondary: string; text: string }
  hashtags: string[]
  bestTime: string
  estimatedReach: string
}

interface InstaData {
  publications: InstaPublication[]
  strategy?: {
    postingFrequency: string
    contentPillars: string[]
    hashtagStrategy: string
    growthTips: string[]
  }
}

const typeIcons: Record<string, typeof Film> = {
  reel: Film,
  carousel: LayoutGrid,
  post: ImageIcon,
  story: MessageCircle,
}

const typeColors: Record<string, string> = {
  reel: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  carousel: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  post: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  story: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

export default function InstagramPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<InstaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('metadata')
        .eq('id', params.id)
        .single()

      const structured = (ws?.metadata as any)?.actions?.instagram?.structured
      if (structured) setData(structured as InstaData)
      setLoading(false)
    }
    load()
  }, [params.id])

  function copyPost(idx: number) {
    const pub = data?.publications[idx]
    if (!pub) return
    const text = `${pub.caption}\n\n${pub.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || !data.publications?.length) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Instagram className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune publication generee.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
      </div>
    )
  }

  const reachColors: Record<string, string> = {
    forte: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    faible: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-xl border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/20">
              <Instagram className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Publications Instagram</h1>
              <p className="text-sm text-muted-foreground">{data.publications.length} publications pretes</p>
            </div>
          </div>
        </div>
      </div>

      {data.strategy && (
        <div className="rounded-2xl border bg-gradient-to-br from-pink-50/50 to-purple-50/50 dark:from-pink-950/20 dark:to-purple-950/20 p-5 space-y-2 hover:shadow-md transition-all">
          <h3 className="text-sm font-semibold">Strategie recommandee</h3>
          <p className="text-sm text-muted-foreground">Frequence : {data.strategy.postingFrequency}</p>
          {data.strategy.contentPillars?.length > 0 && (
            <p className="text-sm text-muted-foreground">Piliers : {data.strategy.contentPillars.join(', ')}</p>
          )}
          {data.strategy.growthTips?.length > 0 && (
            <ul className="text-sm text-muted-foreground space-y-1">
              {data.strategy.growthTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <TrendingUp className="h-3.5 w-3.5 mt-0.5 text-pink-500 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-4">
        {data.publications.map((pub, idx) => {
          const TypeIcon = typeIcons[pub.type] || ImageIcon
          return (
            <div key={idx} className="rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all">
              <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-500" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[pub.type] || typeColors.post}`}>
                      <TypeIcon className="h-3 w-3" /> {pub.type}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${reachColors[pub.estimatedReach] || reachColors.moyenne}`}>
                      <TrendingUp className="h-3 w-3" /> {pub.estimatedReach}
                    </span>
                  </div>
                  <button
                    onClick={() => copyPost(idx)}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    {copiedIdx === idx ? <><Check className="h-3 w-3 text-emerald-500" /> Copie</> : <><Copy className="h-3 w-3" /> Copier</>}
                  </button>
                </div>

                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{pub.caption}</p>

                {/* Carousel slides */}
                {pub.slides && pub.slides.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Slides du carousel :</div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {pub.slides.map((sl, si) => (
                        <div key={si} className="shrink-0 w-40 rounded-lg border p-3"
                          style={pub.colorScheme ? { borderColor: pub.colorScheme.primary + '40' } : undefined}>
                          <div className="text-xs font-bold mb-1" style={pub.colorScheme ? { color: pub.colorScheme.primary } : undefined}>
                            {si + 1}. {sl.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-3">{sl.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reel script */}
                {pub.reelScript && (
                  <div className="mt-4 rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Script Reel ({pub.reelScript.duration}) :</div>
                    <p className="text-xs"><span className="font-semibold">Hook :</span> {pub.reelScript.hook}</p>
                    <p className="text-xs"><span className="font-semibold">Contenu :</span> {pub.reelScript.content}</p>
                    <p className="text-xs"><span className="font-semibold">CTA :</span> {pub.reelScript.cta}</p>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {pub.hashtags?.slice(0, 8).map((h, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 text-xs text-pink-600 dark:text-pink-400">
                      <Hash className="h-3 w-3" />{h.replace('#', '')}
                    </span>
                  ))}
                  {pub.hashtags?.length > 8 && (
                    <span className="text-xs text-muted-foreground">+{pub.hashtags.length - 8}</span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {pub.bestTime}</span>
                  {pub.visualDescription && <span className="line-clamp-1">Visuel : {pub.visualDescription}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
