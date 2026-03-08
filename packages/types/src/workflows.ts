export type TaskStatus = 'pending' | 'blocked' | 'running' | 'completed' | 'failed' | 'retrying'
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface TaskInputRef {
  fromTask: string
  field: string
}

export interface RetryPolicy {
  maxRetries: number
  backoff: 'exponential' | 'linear'
}

export interface TaskDefinition {
  id: string
  agentId: string
  action: string
  dependsOn?: string[]
  input?: Record<string, any> | TaskInputRef
  retryPolicy?: RetryPolicy
  timeout?: number
}

export interface WorkflowDefinition {
  id: string
  name: string
  trigger: string
  companyId?: string
  tasks: TaskDefinition[]
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  companyId: string
  status: WorkflowStatus
  triggerEvent: Record<string, any>
  startedAt: Date
  completedAt?: Date
}

export interface TaskExecution {
  id: string
  workflowExecutionId: string
  taskDefId: string
  agentId: string
  action: string
  status: TaskStatus
  input?: Record<string, any>
  output?: Record<string, any>
  confidence?: number
  attempts: number
  startedAt?: Date
  completedAt?: Date
}
