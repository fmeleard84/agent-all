import { Bot, User } from 'lucide-react'

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export function MessageBubble({ role, content, createdAt }: MessageBubbleProps) {
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

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[70%]">
        <div className="rounded-2xl rounded-bl-sm border bg-card px-4 py-2.5">
          <p className="whitespace-pre-wrap text-sm">{content}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}
