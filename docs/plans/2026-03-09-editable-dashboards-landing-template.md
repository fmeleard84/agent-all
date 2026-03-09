# Editable Dashboards + Landing Page Template — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the 3 existing dashboards (competitive, wording, identity) editable inline, and replace the current AI-generated HTML landing page with a fixed Next.js template where AI only fills content fields.

**Architecture:** Frontend-only edits via Supabase direct update on `metadata.actions.<type>.structured`. Landing page becomes a structured Next.js page with 7 toggleable sections, inline text editing, and image upload to Supabase Storage.

**Tech Stack:** Next.js 14, Tailwind, shadcn/ui, Lucide, Supabase (Storage + DB), existing OpenAI action generation

---

## Part A: Editable Dashboards

### Task 1: Create shared `useEditableAction` hook

**Files:**
- Create: `apps/web/src/hooks/use-editable-action.ts`

**What it does:**
A React hook that manages inline editing of action structured data. It:
- Takes `workspaceId` and `actionType` as params
- Provides `data`, `updateField(path, value)`, `saving` state
- Debounces saves (1s) to Supabase via direct update
- Shows optimistic UI (instant field update, background save)
- Provides a `save()` for manual trigger

```typescript
import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj))
  const keys = path.split('.')
  let current = clone
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) current[keys[i]] = {}
    current = current[keys[i]]
  }
  current[keys[keys.length - 1]] = value
  return clone
}

export function useEditableAction<T>(workspaceId: string, actionType: string) {
  const [data, setData] = useState<T | null>(null)
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const latestDataRef = useRef<T | null>(null)

  const save = useCallback(async (newData: T) => {
    setSaving(true)
    try {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('metadata')
        .eq('id', workspaceId)
        .single()

      const metadata = ws?.metadata || {}
      const actions = metadata.actions || {}
      actions[actionType] = { ...actions[actionType], structured: newData }

      await supabase
        .from('workspaces')
        .update({ metadata: { ...metadata, actions } })
        .eq('id', workspaceId)
    } finally {
      setSaving(false)
    }
  }, [workspaceId, actionType])

  const updateField = useCallback((path: string, value: any) => {
    setData(prev => {
      const updated = setNestedValue(prev, path, value) as T
      latestDataRef.current = updated

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => save(updated), 1000)

      return updated
    })
  }, [save])

  return { data, setData, updateField, saving, save: () => latestDataRef.current && save(latestDataRef.current) }
}
```

---

### Task 2: Create shared `EditableText` component

**Files:**
- Create: `apps/web/src/components/ui/editable-text.tsx`

**What it does:**
A component that renders text normally, but on click switches to an input/textarea for editing. On blur or Enter, calls `onChange` with new value.

```typescript
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

export function EditableText({ value, onChange, className = '', as: Tag = 'p', multiline = false, placeholder }: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as any}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
          className={`w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y ${className}`}
          rows={3}
        />
      )
    }
    return (
      <input
        ref={inputRef as any}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className={`w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${className}`}
      />
    )
  }

  return (
    <Tag
      className={`group/edit cursor-pointer rounded-md px-1 -mx-1 hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => setEditing(true)}
      title="Cliquer pour editer"
    >
      {value || <span className="text-muted-foreground/50 italic">{placeholder || 'Cliquer pour editer'}</span>}
      <Pencil className="inline-block ml-1.5 h-3 w-3 opacity-0 group-hover/edit:opacity-40 transition-opacity" />
    </Tag>
  )
}
```

---

### Task 3: Create `EditableList` component

**Files:**
- Create: `apps/web/src/components/ui/editable-list.tsx`

**What it does:**
Renders a list of strings with ability to edit each item, remove items, and add new ones.

```typescript
'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { EditableText } from './editable-text'

interface EditableListProps {
  items: string[]
  onChange: (items: string[]) => void
  renderPrefix?: string  // e.g. "• "
  className?: string
  itemClassName?: string
  addLabel?: string
}

export function EditableList({ items, onChange, renderPrefix = '• ', className = '', itemClassName = '', addLabel = 'Ajouter' }: EditableListProps) {
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
          {renderPrefix && <span className="shrink-0 mt-0.5">{renderPrefix}</span>}
          <EditableText value={item} onChange={v => updateItem(i, v)} className="flex-1" as="span" />
          <button onClick={() => removeItem(i)} className="shrink-0 p-0.5 opacity-0 group-hover/item:opacity-60 hover:!opacity-100 text-red-500 transition-opacity">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-2 mt-1">
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setAdding(false) }}
            onBlur={() => { if (!newItem.trim()) setAdding(false) }}
            autoFocus
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Nouveau..."
          />
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      )}
    </div>
  )
}
```

---

### Task 4: Make Identity dashboard editable

**Files:**
- Modify: `apps/web/src/app/dashboard/workspace/[id]/validation/identity/page.tsx`

**Changes:**
- Import `useEditableAction`, `EditableText`, `EditableList`
- Replace `useState<IdentityData>` with `useEditableAction<IdentityData>`
- Replace static text renders with `<EditableText>` components
- Add color picker for hex values (simple `<input type="color">`)
- Add "Sauvegarde..." indicator near PDF button when `saving` is true
- All mood keywords become `<EditableList>`
- Logo principles/avoid become `<EditableList>`

Key editable fields:
- Color swatches: hex (color picker), name, usage, rationale
- Typography: headingFont, bodyFont, style, hierarchy values, rationale
- Visual direction: moodKeywords (list), references (brand/why/takeaway), atmosphere
- Logo guidelines: direction, type, principles (list), avoid (list)

---

### Task 5: Make Wording dashboard editable

**Files:**
- Modify: `apps/web/src/app/dashboard/workspace/[id]/validation/wording/page.tsx`

**Changes:**
- Import `useEditableAction`, `EditableText`, `EditableList`
- Replace data loading with `useEditableAction<WordingData>`
- Positioning fields → `<EditableText multiline>`
- Personality traits → editable trait + example, add/remove
- Tone examples → `<EditableList>`
- doesSay / neverSays → `<EditableList>`
- Taglines → editable text + rationale, add/remove
- Pitches → `<EditableText multiline>`
- Key phrases → `<EditableList>`
- Lexicon → `<EditableList>` for both useWords/avoidWords
- Save indicator

---

### Task 6: Make Competitive dashboard editable

**Files:**
- Modify: `apps/web/src/app/dashboard/workspace/[id]/validation/competitive/page.tsx`

**Changes:**
- Import `useEditableAction`, `EditableText`, `EditableList`
- Replace data loading with `useEditableAction<CompetitiveAnalysis>`
- Competitor cards: name, positioning, pricing, website → `<EditableText>`
- Competitor strengths/weaknesses → `<EditableList>`
- Threat level → `<select>` dropdown
- Add "Ajouter un concurrent" button
- Differentiation axes: axis, description, competitors → `<EditableText>`, strengthScore → `<input type="number">`
- Opportunities: title, description, actionable → `<EditableText>`, add/remove
- Risks: title, description, mitigation → `<EditableText>`, probability/impact → dropdown, add/remove
- SWOT: all 4 quadrants → `<EditableList>`
- Save indicator

---

## Part B: Landing Page Template

### Task 7: Rewrite landing page AI prompt to generate structured JSON (not HTML)

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts` (the `landing` prompt in `buildActionPrompt`)

**Changes:**
Replace the current landing prompt that generates full HTML. New prompt generates ONLY a structured JSON matching this schema:

```json
{
  "sections": {
    "hero": { "enabled": true, "headline": "...", "subheadline": "...", "ctaText": "..." },
    "problem": { "enabled": true, "title": "...", "painPoints": ["...", "...", "..."] },
    "solution": { "enabled": true, "title": "...", "description": "...", "features": [{"title": "...", "description": "..."}] },
    "benefits": { "enabled": true, "title": "...", "items": [{"icon": "zap|shield|clock|star|target|heart", "title": "...", "description": "..."}] },
    "testimonial": { "enabled": true, "quote": "...", "author": "...", "role": "...", "company": "..." },
    "cta": { "enabled": true, "title": "...", "subtitle": "..." , "ctaText": "..."},
    "emailCapture": { "enabled": true, "title": "...", "subtitle": "...", "placeholder": "...", "buttonText": "...", "reassurance": "..." }
  },
  "branding": {
    "primaryColor": "#7c3aed",
    "accentColor": "#...",
    "headingFont": "Inter",
    "bodyFont": "Inter"
  },
  "status": "generated"
}
```

The prompt should also pull identity/wording data from workspace metadata if available (colors, fonts, taglines, positioning).

---

### Task 8: Create the landing page editor/template page

**Files:**
- Create: `apps/web/src/app/dashboard/workspace/[id]/validation/landing/page.tsx`

**What it does:**
A dedicated page that shows the landing page sections as editable cards. Each section card has:
- Toggle switch (enable/disable)
- Editable text fields
- Image upload slot (where applicable)
- Preview of how it looks

Layout: left panel = section editor cards stacked, right panel (or toggle) = live preview.

Uses `useEditableAction<LandingData>` for auto-save.

Key features:
- Section toggle: `enabled` boolean per section
- Text editing: `<EditableText>` for all fields
- Image upload: simple file input → Supabase Storage → store URL
- Brand data import: button "Importer l'identite visuelle" that reads identity/wording data and fills branding fields
- Save indicator

---

### Task 9: Create the landing page preview/render page

**Files:**
- Create: `apps/web/src/app/dashboard/workspace/[id]/validation/landing/preview/page.tsx`

**What it does:**
A standalone full-viewport page that renders the landing page template with the structured data. No sidebar, no header — just the landing page as a visitor would see it.

7 sections rendered with fixed Tailwind design:
- **Hero**: full-width gradient bg with headline, subheadline, CTA button
- **Problem**: centered text with pain points as styled cards
- **Solution**: split layout (text + image slot), feature cards
- **Benefits**: 3-column grid with icon + title + description
- **Testimonial**: centered quote card with avatar slot
- **CTA**: gradient banner with title + button
- **Email Capture**: simple form with input + button + reassurance text

Each section only renders if `enabled: true`.

Brand colors applied via inline style variables from `branding` field.

"Page de test generee par IA" badge: fixed bottom-right floating badge.

Image slots: show uploaded image or a placeholder gradient.

---

### Task 10: Add image upload to Supabase Storage

**Files:**
- Create: `apps/web/src/lib/upload-image.ts`

**What it does:**
Utility function to upload an image to Supabase Storage and return the public URL.

```typescript
import { supabase } from './supabase'

export async function uploadLandingImage(
  workspaceId: string,
  file: File,
  slot: string // e.g. "hero", "solution", "testimonial-avatar"
): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `landing/${workspaceId}/${slot}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('images')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage
    .from('images')
    .getPublicUrl(path)

  return data.publicUrl
}
```

Note: Requires creating a `images` bucket in Supabase Storage (public read access).

---

### Task 11: Wire landing page into validation page

**Files:**
- Modify: `apps/web/src/app/dashboard/workspace/[id]/validation/page.tsx`

**Changes:**
- Add `dashboardUrl: 'landing'` to the landing action config (line ~94)
- Remove the special "Preview" button for landing (lines 269-280) — now handled by the dashboard page
- The "Voir le resultat" link will point to `/validation/landing` editor page

---

### Task 12: Create Supabase Storage bucket for images

**Action:** Run Supabase SQL or use dashboard to create `images` bucket with public read access.

SQL:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);
```

Or via Supabase dashboard → Storage → New Bucket → "images" → Public.

---

### Task 13: Test, commit, and deploy

**Steps:**
1. Test all 3 editable dashboards — verify edits persist after page reload
2. Test landing page generation → editor → preview flow
3. Test image upload on landing page
4. Test section toggles
5. Test PDF export still works on editable dashboards
6. Commit all changes
7. Deploy: `cd docker && docker compose -f docker-compose.prod.yml up -d --build`
