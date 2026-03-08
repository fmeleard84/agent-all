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
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-white">
          <p className="whitespace-pre-wrap text-sm">{content}</p>
          <p className="mt-1 text-right text-xs text-blue-200">{time}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[70%] rounded-2xl rounded-bl-sm bg-gray-800 px-4 py-2 text-gray-100">
        <p className="mb-1 text-xs font-semibold text-gray-400">Agent</p>
        <p className="whitespace-pre-wrap text-sm">{content}</p>
        <p className="mt-1 text-xs text-gray-500">{time}</p>
      </div>
    </div>
  )
}
