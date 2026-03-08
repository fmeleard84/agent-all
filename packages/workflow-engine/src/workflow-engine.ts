import type {
  WorkflowDefinition,
  WorkflowExecution,
  TaskExecution,
  AgentEvent,
  TaskStatus,
} from '@agent-all/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WorkflowRegistry } from './workflow-registry'
import { DependencyResolver } from './dependency-resolver'

export class WorkflowEngine {
  public readonly registry: WorkflowRegistry
  public readonly resolver: DependencyResolver

  constructor(private db: SupabaseClient) {
    this.registry = new WorkflowRegistry(db)
    this.resolver = new DependencyResolver()
  }

  async startWorkflow(event: AgentEvent): Promise<WorkflowExecution | null> {
    const definition = await this.registry.resolve(event.type, event.companyId)
    if (!definition) return null

    // Create workflow execution
    const { data: execution, error } = await this.db
      .from('workflow_executions')
      .insert({
        workflow_id: definition.id,
        company_id: event.companyId,
        status: 'running',
        trigger_event: event,
      })
      .select()
      .single()

    if (error || !execution) throw new Error(`Failed to create workflow execution: ${error?.message}`)

    // Create task executions
    const tasks = definition.tasks.map(taskDef => ({
      workflow_execution_id: execution.id,
      task_def_id: taskDef.id,
      agent_id: taskDef.agentId,
      action: taskDef.action,
      status: (taskDef.dependsOn?.length ? 'blocked' : 'pending') as TaskStatus,
      input: taskDef.input || {},
    }))

    await this.db.from('task_executions').insert(tasks)

    return execution as WorkflowExecution
  }

  async getReadyTasks(workflowExecutionId: string): Promise<TaskExecution[]> {
    const { data: tasks } = await this.db
      .from('task_executions')
      .select('*')
      .eq('workflow_execution_id', workflowExecutionId)

    if (!tasks) return []

    const { data: execution } = await this.db
      .from('workflow_executions')
      .select('workflow_id')
      .eq('id', workflowExecutionId)
      .single()

    const { data: workflow } = await this.db
      .from('workflows')
      .select('definition')
      .eq('id', execution?.workflow_id)
      .single()

    const definition = workflow?.definition as WorkflowDefinition
    return this.resolver.getReadyTasks(
      tasks as TaskExecution[],
      definition.tasks,
    )
  }

  async completeTask(
    taskExecutionId: string,
    output: Record<string, any>,
    confidence: number,
  ): Promise<void> {
    await this.db
      .from('task_executions')
      .update({
        status: 'completed',
        output,
        confidence,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskExecutionId)

    const { data: task } = await this.db
      .from('task_executions')
      .select('workflow_execution_id')
      .eq('id', taskExecutionId)
      .single()

    if (task) {
      await this.checkWorkflowCompletion(task.workflow_execution_id)
    }
  }

  async failTask(taskExecutionId: string, error: string): Promise<void> {
    const { data: task } = await this.db
      .from('task_executions')
      .select('*')
      .eq('id', taskExecutionId)
      .single()

    if (!task) return

    const { data: execution } = await this.db
      .from('workflow_executions')
      .select('workflow_id')
      .eq('id', task.workflow_execution_id)
      .single()

    const { data: workflow } = await this.db
      .from('workflows')
      .select('definition')
      .eq('id', execution?.workflow_id)
      .single()

    const definition = workflow?.definition as WorkflowDefinition
    const taskDef = definition.tasks.find(t => t.id === task.task_def_id)
    const maxRetries = taskDef?.retryPolicy?.maxRetries || 0

    if (task.attempts < maxRetries) {
      await this.db
        .from('task_executions')
        .update({
          status: 'retrying',
          attempts: task.attempts + 1,
          output: { error },
        })
        .eq('id', taskExecutionId)
    } else {
      await this.db
        .from('task_executions')
        .update({
          status: 'failed',
          output: { error },
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskExecutionId)

      await this.checkWorkflowCompletion(task.workflow_execution_id)
    }
  }

  async updateTaskStatus(taskExecutionId: string, status: TaskStatus): Promise<void> {
    const update: Record<string, any> = { status }
    if (status === 'running') update.started_at = new Date().toISOString()
    await this.db.from('task_executions').update(update).eq('id', taskExecutionId)
  }

  private async checkWorkflowCompletion(workflowExecutionId: string): Promise<void> {
    const { data: tasks } = await this.db
      .from('task_executions')
      .select('status')
      .eq('workflow_execution_id', workflowExecutionId)

    if (!tasks) return

    const allDone = tasks.every(
      (t: any) => t.status === 'completed' || t.status === 'failed',
    )

    if (allDone) {
      const hasFailed = tasks.some((t: any) => t.status === 'failed')
      await this.db
        .from('workflow_executions')
        .update({
          status: hasFailed ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', workflowExecutionId)
    }
  }
}
