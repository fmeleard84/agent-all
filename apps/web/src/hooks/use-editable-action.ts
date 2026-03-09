'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj))
  const keys = path.split('.')
  let current = clone
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    // Handle array indices
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      current = current[arrayMatch[1]][parseInt(arrayMatch[2])]
    } else {
      if (current[key] === undefined) current[key] = {}
      current = current[key]
    }
  }
  const lastKey = keys[keys.length - 1]
  const arrayMatch = lastKey.match(/^(\w+)\[(\d+)\]$/)
  if (arrayMatch) {
    current[arrayMatch[1]][parseInt(arrayMatch[2])] = value
  } else {
    current[lastKey] = value
  }
  return clone
}

export function useEditableAction<T>(workspaceId: string, actionType: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const latestDataRef = useRef<T | null>(null)

  // Load data on mount
  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('name, metadata')
        .eq('id', workspaceId)
        .single()

      if (ws) {
        setWorkspaceName(ws.name)
        const structured = (ws.metadata as any)?.actions?.[actionType]?.structured
        if (structured) {
          setData(structured as T)
          latestDataRef.current = structured as T
        }
      }
      setLoading(false)
    }
    load()
  }, [workspaceId, actionType])

  const save = useCallback(async (newData: T) => {
    setSaving(true)
    try {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('metadata')
        .eq('id', workspaceId)
        .single()

      const metadata = (ws?.metadata as any) || {}
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
      if (!prev) return prev
      const updated = setNestedValue(prev, path, value) as T
      latestDataRef.current = updated

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => save(updated), 1000)

      return updated
    })
  }, [save])

  const setFieldDirectly = useCallback((updater: (prev: T) => T) => {
    setData(prev => {
      if (!prev) return prev
      const updated = updater(prev)
      latestDataRef.current = updated

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => save(updated), 1000)

      return updated
    })
  }, [save])

  const forceSave = useCallback(() => {
    if (latestDataRef.current) save(latestDataRef.current)
  }, [save])

  return { data, setData, loading, saving, workspaceName, updateField, setFieldDirectly, forceSave }
}
