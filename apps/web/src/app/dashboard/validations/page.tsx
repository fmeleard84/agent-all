'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ValidationCard } from '@/components/dashboard/validation-card'

interface PendingTask {
  id: string
  agent_id: string
  action: string
  input: Record<string, any>
  output: Record<string, any>
  confidence: number | null
}

export default function ValidationsPage() {
  const [tasks, setTasks] = useState<PendingTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPending()
  }, [])

  async function fetchPending() {
    setLoading(true)
    const { data } = await supabase
      .from('task_executions')
      .select('id, agent_id, action, input, output, confidence')
      .eq('status', 'pending')
      .order('started_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function handleApprove(taskId: string) {
    await supabase
      .from('task_executions')
      .update({ status: 'completed' })
      .eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  async function handleReject(taskId: string) {
    await supabase
      .from('task_executions')
      .update({ status: 'failed', output: { error: 'Rejected by user' } })
      .eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Validations</h1>
        <p className="text-muted-foreground">Actions en attente de validation humaine</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Chargement...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucune action en attente de validation
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <ValidationCard
              key={task.id}
              id={task.id}
              agentId={task.agent_id}
              action={task.action}
              input={task.input}
              output={task.output}
              confidence={task.confidence}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
