'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  Linkedin,
  Copy,
  Check,
  Clock,
  TrendingUp,
  Hash,
} from 'lucide-react'

interface LinkedInPost {
  type: string
  hook: string
  body: string
  cta: string
  hashtags: string[]
  bestTime: string
  visualSuggestion: string
  estimatedReach: string
}

interface LinkedInData {
  posts: LinkedInPost[]
  strategy?: {
    postingFrequency: string
    bestDays: string[]
    contentMix: string
    growthTips: string[]
  }
}

export default function LinkedInPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<LinkedInData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('metadata')
        .eq('id', params.id)
        .single()

      const structured = (ws?.metadata as any)?.actions?.linkedin?.structured
      if (structured) setData(structured as LinkedInData)
      setLoading(false)
    }
    load()
  }, [params.id])

  function copyPost(idx: number) {
    const post = data?.posts[idx]
    if (!post) return
    const text = `${post.hook}\n\n${post.body}\n\n${post.cta}\n\n${post.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}`
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

  if (!data || !data.posts?.length) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Linkedin className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucun post genere.</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 shadow-lg shadow-sky-500/20">
              <Linkedin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Posts LinkedIn</h1>
              <p className="text-sm text-muted-foreground">{data.posts.length} posts prets a publier</p>
            </div>
          </div>
        </div>
      </div>

      {data.strategy && (
        <div className="rounded-2xl border bg-gradient-to-br from-sky-50/50 to-white dark:from-sky-950/20 dark:to-card p-5 space-y-2 hover:shadow-md transition-all">
          <h3 className="text-sm font-semibold">Strategie recommandee</h3>
          <p className="text-sm text-muted-foreground">Frequence : {data.strategy.postingFrequency}</p>
          {data.strategy.bestDays?.length > 0 && (
            <p className="text-sm text-muted-foreground">Meilleurs jours : {data.strategy.bestDays.join(', ')}</p>
          )}
          {data.strategy.growthTips?.length > 0 && (
            <ul className="text-sm text-muted-foreground space-y-1">
              {data.strategy.growthTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <TrendingUp className="h-3.5 w-3.5 mt-0.5 text-sky-500 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-4">
        {data.posts.map((post, idx) => (
          <div key={idx} className="rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:shadow-black/5 transition-all">
            <div className="h-1 bg-gradient-to-r from-sky-500 to-blue-500" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 dark:bg-sky-900/30 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-400">
                    <Linkedin className="h-3 w-3" /> {post.type}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${reachColors[post.estimatedReach] || reachColors.moyenne}`}>
                    <TrendingUp className="h-3 w-3" /> {post.estimatedReach}
                  </span>
                </div>
                <button
                  onClick={() => copyPost(idx)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                >
                  {copiedIdx === idx ? <><Check className="h-3 w-3 text-emerald-500" /> Copie</> : <><Copy className="h-3 w-3" /> Copier</>}
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold leading-snug" style={{ color: '#0077B5' }}>{post.hook}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{post.body}</p>
                {post.cta && <p className="text-sm font-medium">{post.cta}</p>}
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                {post.hashtags?.map((h, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 text-xs text-sky-600 dark:text-sky-400">
                    <Hash className="h-3 w-3" />{h.replace('#', '')}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {post.bestTime}</span>
                {post.visualSuggestion && <span className="line-clamp-1">Visuel : {post.visualSuggestion}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
