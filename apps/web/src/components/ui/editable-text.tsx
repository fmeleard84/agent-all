'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil } from 'lucide-react'

interface EditableTextProps {
  value: string
  onChange: (value: string) => void
  className?: string
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'span' | 'code'
  multiline?: boolean
  placeholder?: string
}

export function EditableText({
  value,
  onChange,
  className = '',
  as: Tag = 'p',
  multiline = false,
  placeholder,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    if (draft.trim() !== value) onChange(draft.trim())
  }

  if (editing) {
    const baseClass = 'w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Escape') { setDraft(value); setEditing(false) }
          }}
          className={`${baseClass} resize-y ${className}`}
          rows={3}
        />
      )
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        className={`${baseClass} ${className}`}
      />
    )
  }

  return (
    <Tag
      className={`group/edit cursor-pointer rounded px-1 -mx-1 hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="Cliquer pour editer"
    >
      {value || (
        <span className="text-muted-foreground/50 italic">
          {placeholder || 'Cliquer pour editer'}
        </span>
      )}
      <Pencil className="inline-block ml-1.5 h-3 w-3 opacity-0 group-hover/edit:opacity-40 transition-opacity" />
    </Tag>
  )
}
