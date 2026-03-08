import { Worker, Job } from 'bullmq'
import { AgentRegistry } from '@agent-all/agent-registry'
import { WorkflowEngine } from '@agent-all/workflow-engine'
import { getLLMProvider } from '@agent-all/llm'
import { getSupabaseServiceClient } from '@agent-all/database'
import type { AgentContext, AgentMemoryData, CompanyMemory, PlatformMemory, TaskExecution } from '@agent-all/types'

interface TaskJobData {
  taskExecutionId: string
  workflowExecutionId: string
  agentId: string
  action: string
  input: Record<string, any>
}

export class TaskProcessor {
  private worker: Worker | null = null
  private db = getSupabaseServiceClient()
  private workflowEngine: WorkflowEngine

  constructor(
    private agentRegistry: AgentRegistry,
    private redisConnection: { host: string; port: number },
  ) {
    this.workflowEngine = new WorkflowEngine(this.db)
  }

  start(): void {
    this.worker = new Worker(
      'agent-tasks',
      async (job: Job<TaskJobData>) => {
        await this.processTask(job.data)
      },
      {
        connection: this.redisConnection,
        concurrency: 5,
      },
    )

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err.message)
    })

    console.log('Task processor started, waiting for jobs...')
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close()
      this.worker = null
    }
  }

  private async processTask(data: TaskJobData): Promise<void> {
    const { taskExecutionId, workflowExecutionId, agentId, action, input } = data

    console.log(`Processing task ${taskExecutionId}: agent=${agentId} action=${action}`)

    // Resolve agent
    const agent = this.agentRegistry.resolve(agentId)
    if (!agent) {
      await this.workflowEngine.failTask(taskExecutionId, `Agent ${agentId} not found`)
      return
    }

    // Build context
    const context = await this.buildAgentContext(agentId, workflowExecutionId)

    // Get task execution record
    const { data: taskRecord } = await this.db
      .from('task_executions')
      .select('*')
      .eq('id', taskExecutionId)
      .single()

    if (!taskRecord) {
      await this.workflowEngine.failTask(taskExecutionId, 'Task execution not found')
      return
    }

    try {
      // Execute agent
      const result = await agent.execute(taskRecord as TaskExecution, context)

      if (result.status === 'success') {
        await this.workflowEngine.completeTask(taskExecutionId, result.output, result.confidence)

        // Log to audit
        await this.db.from('audit_log').insert({
          company_id: context.company.id,
          workflow_execution_id: workflowExecutionId,
          task_execution_id: taskExecutionId,
          agent_id: agentId,
          action,
          result: 'success',
          confidence: result.confidence,
          human_override: false,
          metadata: { actions: result.actions },
        })

        // Dispatch next ready tasks
        await this.dispatchReadyTasks(workflowExecutionId)
      } else {
        await this.workflowEngine.failTask(taskExecutionId, result.output.error || 'Agent execution failed')

        await this.db.from('audit_log').insert({
          company_id: context.company.id,
          workflow_execution_id: workflowExecutionId,
          task_execution_id: taskExecutionId,
          agent_id: agentId,
          action,
          result: 'failure',
          confidence: 0,
          human_override: false,
          metadata: { error: result.output.error },
        })
      }
    } catch (err: any) {
      console.error(`Agent ${agentId} error:`, err.message)
      await this.workflowEngine.failTask(taskExecutionId, err.message)
    }
  }

  private async dispatchReadyTasks(workflowExecutionId: string): Promise<void> {
    // Re-use the BullMQ queue to dispatch next tasks
    const { Queue } = await import('bullmq')
    const queue = new Queue('agent-tasks', { connection: this.redisConnection })

    const readyTasks = await this.workflowEngine.getReadyTasks(workflowExecutionId)
    for (const task of readyTasks) {
      await this.workflowEngine.updateTaskStatus(task.id, 'running')
      await queue.add('execute-task', {
        taskExecutionId: task.id,
        workflowExecutionId,
        agentId: task.agentId,
        action: task.action,
        input: task.input,
      })
    }
    await queue.close()
  }

  private async buildAgentContext(agentId: string, workflowExecutionId: string): Promise<AgentContext> {
    // Get company from workflow execution
    const { data: execution } = await this.db
      .from('workflow_executions')
      .select('company_id')
      .eq('id', workflowExecutionId)
      .single()

    const companyId = execution?.company_id

    // Get company info
    const { data: company } = await this.db
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    // Get company memory
    const { data: companyMemory } = await this.db
      .from('company_memory')
      .select('*')
      .eq('company_id', companyId)
      .single()

    // Get agent memory
    const { data: agentMemory } = await this.db
      .from('agent_memory')
      .select('*')
      .eq('agent_id', agentId)
      .eq('company_id', companyId)
      .single()

    const platformMemory: PlatformMemory = {
      documentTaxonomy: ['invoice', 'quote', 'contract', 'bank_statement', 'other'],
      defaultWorkflows: [],
      globalRules: [],
    }

    const memoryData: CompanyMemory = companyMemory ? {
      id: companyMemory.id,
      companyId: companyMemory.company_id,
      preferences: companyMemory.preferences || {},
      connectedServices: companyMemory.connected_services || [],
      internalRules: companyMemory.internal_rules || [],
      customCategories: companyMemory.custom_categories || [],
    } : {
      id: '',
      companyId: companyId || '',
      preferences: {},
      connectedServices: [],
      internalRules: [],
      customCategories: [],
    }

    const agentMemoryData: AgentMemoryData = agentMemory ? {
      id: agentMemory.id,
      agentId: agentMemory.agent_id,
      companyId: agentMemory.company_id,
      decisions: agentMemory.decisions || [],
      corrections: agentMemory.corrections || [],
      stats: agentMemory.stats || { totalTasks: 0, successRate: 0, avgConfidence: 0, avgDurationMs: 0 },
    } : {
      id: '',
      agentId,
      companyId: companyId || '',
      decisions: [],
      corrections: [],
      stats: { totalTasks: 0, successRate: 0, avgConfidence: 0, avgDurationMs: 0 },
    }

    return {
      llm: getLLMProvider('anthropic'),
      memory: {
        platform: platformMemory,
        company: memoryData,
        agent: agentMemoryData,
      },
      company: {
        id: company?.id || '',
        name: company?.name || '',
        settings: company?.settings || {},
      },
    }
  }
}
