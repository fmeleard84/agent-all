'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Zap,
  Eye,
  XCircle,
  Send,
  RotateCcw,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://agent-all.ialla.fr/api'
const COMPANY_ID = 'test-company'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanStep {
  stepNumber: number
  agentName: string
  goal: string
  dependencies: number[]
  toolsNeeded: string[]
}

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval'

interface ExecutionTask {
  id: string
  stepNumber: number
  agentName: string
  goal: string
  status: TaskStatus
  dependencies: number[]
  result?: Record<string, unknown>
  previewData?: Record<string, unknown>
  error?: string
}

interface ExecutionStep {
  id: string
  taskId: string
  toolName: string
  action: string
  status: 'success' | 'error'
  durationMs: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  createdAt: string
}

interface ExecutionData {
  execution: {
    id: string
    status: 'running' | 'completed' | 'failed' | 'paused'
    createdAt: string
  }
  tasks: ExecutionTask[]
  steps: ExecutionStep[]
}

type PageState = 'initial' | 'planning' | 'plan_ready' | 'executing' | 'completed' | 'error'

// ─── Status helpers ──────────────────────────────────────────────────────────

const statusConfig: Record<TaskStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'En attente', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400', icon: Clock },
  running: { label: 'En cours', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Loader2 },
  completed: { label: 'Termine', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  failed: { label: 'Echoue', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  awaiting_approval: { label: 'Validation requise', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Eye },
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <Badge variant="secondary" className={`${config.color} gap-1 text-xs font-medium`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  )
}

// ─── Step Number Circle ──────────────────────────────────────────────────────

function StepCircle({ number, status }: { number: number; status?: TaskStatus }) {
  const colorMap: Record<string, string> = {
    pending: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
    running: 'bg-blue-500 text-white',
    completed: 'bg-green-500 text-white',
    failed: 'bg-red-500 text-white',
    awaiting_approval: 'bg-amber-500 text-white',
  }
  const color = status ? colorMap[status] : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'

  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${color}`}>
      {number}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const params = useParams<{ id: string }>()
  const workspaceId = params.id as string

  const [goal, setGoal] = useState('')
  const [pageState, setPageState] = useState<PageState>('initial')
  const [plan, setPlan] = useState<PlanStep[]>([])
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [executionData, setExecutionData] = useState<ExecutionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({})
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
  const [approvingTasks, setApprovingTasks] = useState<Record<string, boolean>>({})
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Generate plan ────────────────────────────────────────────────────────

  const handleGeneratePlan = async () => {
    if (!goal.trim()) return
    setPageState('planning')
    setError(null)
    setPlan([])

    try {
      const res = await fetch(`${API_URL}/agents/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, workspaceId, companyId: COMPANY_ID }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `Erreur ${res.status}`)
      }
      const data = await res.json()
      setPlan(data.plan)
      setPageState('plan_ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setPageState('error')
    }
  }

  // ── Launch execution ─────────────────────────────────────────────────────

  const handleLaunchExecution = async () => {
    setPageState('executing')
    setError(null)

    try {
      const res = await fetch(`${API_URL}/agents/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, workspaceId, companyId: COMPANY_ID, goal }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `Erreur ${res.status}`)
      }
      const data = await res.json()
      setExecutionId(data.workflowExecutionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setPageState('error')
    }
  }

  // ── Poll execution status ────────────────────────────────────────────────

  const fetchExecution = useCallback(async (exId: string) => {
    try {
      const res = await fetch(`${API_URL}/agents/execution/${exId}`)
      if (!res.ok) return
      const data: ExecutionData = await res.json()
      setExecutionData(data)

      if (data.execution.status === 'completed' || data.execution.status === 'failed') {
        setPageState('completed')
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    } catch {
      // silent — retry on next poll
    }
  }, [])

  useEffect(() => {
    if (executionId && pageState === 'executing') {
      fetchExecution(executionId)
      pollingRef.current = setInterval(() => fetchExecution(executionId), 3000)
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [executionId, pageState, fetchExecution])

  // ── Approve task ─────────────────────────────────────────────────────────

  const handleApprove = async (taskId: string) => {
    if (!executionId) return
    setApprovingTasks((prev) => ({ ...prev, [taskId]: true }))

    try {
      const res = await fetch(`${API_URL}/agents/execution/${executionId}/approve/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Erreur lors de la validation')
      // Force a poll to get updated status
      await fetchExecution(executionId)
    } catch (err) {
      console.error('Approve error:', err)
    } finally {
      setApprovingTasks((prev) => ({ ...prev, [taskId]: false }))
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setGoal('')
    setPlan([])
    setExecutionId(null)
    setExecutionData(null)
    setError(null)
    setExpandedSteps({})
    setExpandedLogs({})
    setPageState('initial')
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  // ── Toggle helpers ───────────────────────────────────────────────────────

  const toggleStep = (key: string) =>
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }))

  const toggleLog = (key: string) =>
    setExpandedLogs((prev) => ({ ...prev, [key]: !prev[key] }))

  // ── Get execution steps for a task ───────────────────────────────────────

  const getStepsForTask = (taskId: string): ExecutionStep[] => {
    if (!executionData) return []
    return executionData.steps.filter((s) => s.taskId === taskId)
  }

  // ── Merge plan + execution tasks ─────────────────────────────────────────

  const getTaskStatus = (stepNumber: number): TaskStatus => {
    if (!executionData) return 'pending'
    const task = executionData.tasks.find((t) => t.stepNumber === stepNumber)
    return task?.status ?? 'pending'
  }

  const getTask = (stepNumber: number): ExecutionTask | undefined => {
    return executionData?.tasks.find((t) => t.stepNumber === stepNumber)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Orchestrez vos agents pour accomplir des objectifs complexes.
            </p>
          </div>
        </div>
      </div>

      {/* Goal Input Card */}
      <Card className="border rounded-xl shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-600" />
            Objectif
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            className="w-full min-h-[100px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none transition-colors"
            placeholder="Decrivez votre objectif... (ex: Trouver 50 cavistes independants en France et envoyer un email pilote)"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={pageState !== 'initial' && pageState !== 'error'}
          />

          <div className="flex items-center gap-3">
            {(pageState === 'initial' || pageState === 'error') && (
              <Button
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                disabled={!goal.trim()}
                onClick={handleGeneratePlan}
              >
                <Zap className="h-4 w-4" />
                Generer un plan
              </Button>
            )}

            {pageState === 'planning' && (
              <Button disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generation du plan...
              </Button>
            )}

            {pageState !== 'initial' && pageState !== 'planning' && (
              <Button variant="outline" className="gap-2" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Nouveau plan
              </Button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Display */}
      {plan.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Plan d&apos;execution</h2>
              <p className="text-sm text-muted-foreground">
                {plan.length} etape{plan.length > 1 ? 's' : ''} generee{plan.length > 1 ? 's' : ''}
              </p>
            </div>

            {pageState === 'plan_ready' && (
              <Button
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                onClick={handleLaunchExecution}
              >
                <Play className="h-4 w-4" />
                Lancer l&apos;execution
              </Button>
            )}

            {pageState === 'executing' && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Execution en cours...
              </Badge>
            )}

            {pageState === 'completed' && executionData?.execution.status === 'completed' && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1.5">
                <CheckCircle className="h-3 w-3" />
                Termine
              </Badge>
            )}

            {pageState === 'completed' && executionData?.execution.status === 'failed' && (
              <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1.5">
                <XCircle className="h-3 w-3" />
                Echoue
              </Badge>
            )}
          </div>

          {/* Step Cards */}
          <div className="space-y-3">
            {plan.map((step) => {
              const status = getTaskStatus(step.stepNumber)
              const task = getTask(step.stepNumber)
              const taskSteps = task ? getStepsForTask(task.id) : []
              const stepKey = `step-${step.stepNumber}`
              const isExpanded = expandedSteps[stepKey]
              const isAwaiting = status === 'awaiting_approval'

              return (
                <Card key={step.stepNumber} className={`border rounded-xl shadow-sm overflow-hidden transition-all ${isAwaiting ? 'ring-2 ring-amber-400/50' : ''}`}>
                  {/* Step gradient bar */}
                  <div className={`h-0.5 ${
                    status === 'completed' ? 'bg-green-500' :
                    status === 'running' ? 'bg-blue-500' :
                    status === 'failed' ? 'bg-red-500' :
                    status === 'awaiting_approval' ? 'bg-amber-500' :
                    'bg-neutral-200 dark:bg-neutral-700'
                  }`} />

                  <CardContent className="p-4">
                    {/* Main row */}
                    <div className="flex items-center gap-4">
                      <StepCircle number={step.stepNumber} status={pageState === 'executing' || pageState === 'completed' ? status : undefined} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold">{step.agentName}</span>
                          {step.dependencies.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              (apres etape{step.dependencies.length > 1 ? 's' : ''} {step.dependencies.join(', ')})
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{step.goal}</p>
                        {step.toolsNeeded.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {step.toolsNeeded.map((tool) => (
                              <span key={tool} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                                {tool}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(pageState === 'executing' || pageState === 'completed') && (
                          <StatusBadge status={status} />
                        )}
                        {taskSteps.length > 0 && (
                          <button
                            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            onClick={() => toggleStep(stepKey)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Approval prompt */}
                    {isAwaiting && task?.previewData && (
                      <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 mb-3">
                          <Eye className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Validation requise</span>
                        </div>
                        <pre className="text-xs bg-white dark:bg-neutral-900 rounded-md p-3 border overflow-x-auto mb-3 max-h-60 overflow-y-auto">
                          {JSON.stringify(task.previewData, null, 2)}
                        </pre>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white gap-1.5 text-xs"
                            disabled={approvingTasks[task.id]}
                            onClick={() => handleApprove(task.id)}
                          >
                            {approvingTasks[task.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3 w-3" />
                            )}
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                          >
                            <XCircle className="h-3 w-3" />
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Task error */}
                    {status === 'failed' && task?.error && (
                      <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                        <p className="text-xs text-red-700 dark:text-red-400">{task.error}</p>
                      </div>
                    )}

                    {/* Expanded execution steps */}
                    {isExpanded && taskSteps.length > 0 && (
                      <div className="mt-4 border-t pt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Journal d&apos;execution
                        </p>
                        {taskSteps.map((logEntry) => {
                          const logKey = `log-${logEntry.id}`
                          const logExpanded = expandedLogs[logKey]

                          return (
                            <div
                              key={logEntry.id}
                              className="rounded-lg border bg-neutral-50 dark:bg-neutral-900 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`h-2 w-2 rounded-full shrink-0 ${
                                    logEntry.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                                />
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <Zap className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-xs font-medium truncate">{logEntry.toolName}</span>
                                  <span className="text-xs text-muted-foreground truncate">{logEntry.action}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                                  {(logEntry.durationMs / 1000).toFixed(1)}s
                                </span>
                                {(logEntry.input || logEntry.output) && (
                                  <button
                                    className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                    onClick={() => toggleLog(logKey)}
                                  >
                                    {logExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    )}
                                  </button>
                                )}
                              </div>

                              {logExpanded && (
                                <div className="mt-2 space-y-2">
                                  {logEntry.input && (
                                    <div>
                                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Input</p>
                                      <pre className="text-[11px] bg-white dark:bg-neutral-950 rounded p-2 border overflow-x-auto max-h-40 overflow-y-auto">
                                        {JSON.stringify(logEntry.input, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {logEntry.output && (
                                    <div>
                                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Output</p>
                                      <pre className="text-[11px] bg-white dark:bg-neutral-950 rounded p-2 border overflow-x-auto max-h-40 overflow-y-auto">
                                        {JSON.stringify(logEntry.output, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Completed task result summary */}
                    {status === 'completed' && task?.result && (
                      <div className="mt-3">
                        <button
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => toggleStep(stepKey)}
                        >
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Voir le resultat
                        </button>
                        {isExpanded && !taskSteps.length && (
                          <pre className="mt-2 text-xs bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 border overflow-x-auto max-h-60 overflow-y-auto">
                            {JSON.stringify(task.result, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Completion Summary */}
      {pageState === 'completed' && executionData && (
        <Card className="border rounded-xl shadow-sm overflow-hidden">
          <div className={`h-1 ${executionData.execution.status === 'completed' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`} />
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              {executionData.execution.status === 'completed' ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold">
                  {executionData.execution.status === 'completed' ? 'Execution terminee' : 'Execution echouee'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {executionData.tasks.filter((t) => t.status === 'completed').length} / {executionData.tasks.length} taches terminees
                  {' '}&middot;{' '}
                  {executionData.steps.length} operation{executionData.steps.length !== 1 ? 's' : ''} executee{executionData.steps.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <Button variant="outline" className="gap-2" onClick={handleReset}>
              <Send className="h-4 w-4" />
              Nouvel objectif
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
