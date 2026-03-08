import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { WorkflowEngine } from '@agent-all/workflow-engine'
import { AgentRegistry } from '@agent-all/agent-registry'
import { SupabaseEventBus } from '@agent-all/event-bus'
import { getSupabaseServiceClient } from '@agent-all/database'
import type { AgentEvent, EventType } from '@agent-all/types'

@Injectable()
export class OrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(OrchestratorService.name)
  private workflowEngine: WorkflowEngine
  private eventBus: SupabaseEventBus

  constructor(
    @InjectQueue('agent-tasks') private agentQueue: Queue,
    private agentRegistry: AgentRegistry,
  ) {
    const db = getSupabaseServiceClient()
    this.workflowEngine = new WorkflowEngine(db)
    this.eventBus = new SupabaseEventBus(db)
  }

  async onModuleInit() {
    const eventTypes: EventType[] = [
      'EMAIL_RECEIVED',
      'DOCUMENT_UPLOADED',
      'INVOICE_CREATED',
      'PAYMENT_RECEIVED',
      'MANUAL_TRIGGER',
    ]

    for (const eventType of eventTypes) {
      this.eventBus.subscribe(eventType, (event) => this.handleEvent(event))
    }

    await this.eventBus.start()
    this.logger.log('Orchestrator started, listening for events')
  }

  async handleEvent(event: AgentEvent): Promise<void> {
    this.logger.log(`Received event: ${event.type} for company ${event.companyId}`)

    const execution = await this.workflowEngine.startWorkflow(event)
    if (!execution) {
      this.logger.warn(`No workflow found for event ${event.type}`)
      return
    }

    this.logger.log(`Started workflow execution ${execution.id}`)
    await this.dispatchReadyTasks(execution.id)
  }

  async dispatchReadyTasks(workflowExecutionId: string): Promise<void> {
    const readyTasks = await this.workflowEngine.getReadyTasks(workflowExecutionId)

    for (const task of readyTasks) {
      await this.workflowEngine.updateTaskStatus(task.id, 'running')
      await this.agentQueue.add('execute-task', {
        taskExecutionId: task.id,
        workflowExecutionId,
        agentId: task.agentId,
        action: task.action,
        input: task.input,
      })
      this.logger.log(`Dispatched task ${task.taskDefId} to agent ${task.agentId}`)
    }
  }

  async onTaskCompleted(
    taskExecutionId: string,
    workflowExecutionId: string,
    output: Record<string, any>,
    confidence: number,
  ): Promise<void> {
    await this.workflowEngine.completeTask(taskExecutionId, output, confidence)
    await this.dispatchReadyTasks(workflowExecutionId)
  }

  async onTaskFailed(taskExecutionId: string, error: string): Promise<void> {
    await this.workflowEngine.failTask(taskExecutionId, error)
  }

  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine
  }

  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry
  }
}
