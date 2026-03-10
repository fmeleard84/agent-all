'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, Lightbulb, Rocket, Building2, Loader2, Check } from 'lucide-react'
import { DashboardSummary } from './dashboard-summary'

interface ContextPanelProps {
  workspace: {
    id: string
    axe_type: string
    metadata: Record<string, unknown> | null
  }
}

const axeConfig: Record<string, { label: string; icon: typeof Lightbulb; color: string }> = {
  idea: { label: 'Challenge Idee', icon: Lightbulb, color: 'text-amber-500' },
  launch: { label: 'Lancement', icon: Rocket, color: 'text-violet-500' },
  existing: { label: 'Optimisation', icon: Building2, color: 'text-emerald-500' },
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function ContextPanel({ workspace }: ContextPanelProps) {
  const config = axeConfig[workspace.axe_type] ?? { label: workspace.axe_type, icon: Lightbulb, color: 'text-muted-foreground' }
  const Icon = config.icon
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const metadata = workspace.metadata ?? {}
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>((metadata.dashboard as Record<string, unknown>) || null)

  useEffect(() => {
    if (dashboard) return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('workspaces')
        .select('metadata')
        .eq('id', workspace.id)
        .single()
      if (data?.metadata?.dashboard) {
        setDashboard(data.metadata.dashboard)
        clearInterval(interval)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [workspace.id, dashboard])

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }, [])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    setUploading(true)
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('file', file)

      await fetch(`${API_URL}/chat/${workspace.id}/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })
      setUploadedFiles((prev) => [...prev, file.name])
    } catch {
      // silent fail
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex h-full w-80 flex-col border-l bg-gradient-to-b from-neutral-50/80 via-background to-background dark:from-neutral-900/30 dark:via-background dark:to-background">
      {/* Workspace type badge */}
      <div className="p-4 pb-3 border-b">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {config.label}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Dashboard summary if available */}
        {'scores' in (dashboard || {}) && (
          <DashboardSummary data={dashboard as never} workspaceId={workspace.id} />
        )}

        {/* Upload documents */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Documents</h4>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.txt,.png,.jpg,.jpeg,.pptx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-violet-200 dark:border-violet-800 px-3 py-2.5 text-sm text-muted-foreground transition-all hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'Upload...' : 'Ajouter un document'}
          </button>

          {uploadedFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {uploadedFiles.map((name, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground bg-accent/40">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{name}</span>
                  <Check className="h-3 w-3 shrink-0 text-emerald-500 ml-auto" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
