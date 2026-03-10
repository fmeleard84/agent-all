'use client'

import { Bot, User, BarChart3 } from 'lucide-react'
import Link from 'next/link'

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  workspaceId?: string
}

function formatMarkdown(text: string): string {
  // Remove JSON code blocks entirely
  let cleaned = text.replace(/```json\s*\n[\s\S]*?\n```/g, '')
  // Remove trailing ===
  cleaned = cleaned.replace(/={3,}/g, '')

  // Bold **text**
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic *text*
  cleaned = cleaned.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
  // Headers ### -> bold
  cleaned = cleaned.replace(/^###\s+(.+)$/gm, '<strong class="text-base block mt-3 mb-1">$1</strong>')
  cleaned = cleaned.replace(/^##\s+(.+)$/gm, '<strong class="text-base block mt-3 mb-1">$1</strong>')
  // Bullet points
  cleaned = cleaned.replace(/^[-•]\s+(.+)$/gm, '<div class="flex items-start gap-2 ml-1"><span class="text-violet-500 mt-0.5 shrink-0">•</span><span>$1</span></div>')
  // Numbered list
  cleaned = cleaned.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="flex items-start gap-2 ml-1"><span class="text-violet-500 font-semibold shrink-0">$1.</span><span>$2</span></div>')

  return cleaned.trim()
}

function hasJsonBlock(content: string): boolean {
  return /```json\s*\n[\s\S]*?"scores"[\s\S]*?\n```/.test(content)
}

export function MessageBubble({ role, content, createdAt, workspaceId }: MessageBubbleProps) {
  const time = new Date(createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (role === 'user') {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[70%]">
          <div className="rounded-2xl rounded-br-sm bg-violet-600 px-4 py-2.5 text-white">
            <p className="whitespace-pre-wrap text-sm">{content}</p>
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">{time}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
          <User className="h-4 w-4" />
        </div>
      </div>
    )
  }

  const showReportButton = hasJsonBlock(content) && workspaceId
  const formatted = formatMarkdown(content)

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-bl-sm border bg-card px-4 py-2.5">
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed [&_strong]:font-semibold [&_em]:italic"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        </div>
        {showReportButton && (
          <Link
            href={`/dashboard/workspace/${workspaceId}/report`}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 px-3 py-2 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Voir le tableau de bord complet
          </Link>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}
