'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { EditableText } from './editable-text'

interface EditableListProps {
  items: string[]
  onChange: (items: string[]) => void
  renderPrefix?: string
  className?: string
  itemClassName?: string
  addLabel?: string
}

export function EditableList({
  items,
  onChange,
  renderPrefix = '• ',
  className = '',
  itemClassName = '',
  addLabel = 'Ajouter',
}: EditableListProps) {
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState('')

  function updateItem(index: number, value: string) {
    const updated = [...items]
    updated[index] = value
    onChange(updated)
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addItem() {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()])
      setNewItem('')
      setAdding(false)
    }
  }

  return (
    <div className={className}>
      {items.map((item, i) => (
        <div key={i} className={`group/item flex items-start gap-1 ${itemClassName}`}>
          {renderPrefix && (
            <span className="shrink-0 mt-0.5 text-sm">{renderPrefix}</span>
          )}
          <EditableText
            value={item}
            onChange={v => updateItem(i, v)}
            className="flex-1"
            as="span"
          />
          <button
            onClick={() => removeItem(i)}
            className="shrink-0 p-0.5 opacity-0 group-hover/item:opacity-60 hover:!opacity-100 text-red-500 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-2 mt-1">
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addItem()
              if (e.key === 'Escape') { setNewItem(''); setAdding(false) }
            }}
            onBlur={() => { if (!newItem.trim()) setAdding(false) }}
            autoFocus
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Nouveau..."
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      )}
    </div>
  )
}
