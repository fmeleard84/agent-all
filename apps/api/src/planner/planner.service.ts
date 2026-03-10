import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { getSupabaseServiceClient } from '@agent-all/database'
import { WorkflowEngine } from '@agent-all/workflow-engine'
import { getLLMProvider } from '@agent-all/llm'
import { AgentRegistry } from '@agent-all/agent-registry'
import { ToolsService } from '../tools/tools.service'

export interface PlanStep {
  id: string
  agentId: string
  goal: string
  dependsOn: string[]
}

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name)
  private db = getSupabaseServiceClient()
  private workflowEngine = new WorkflowEngine(this.db)

  constructor(
    @InjectQueue('agent-tasks') private agentQueue: Queue,
    private toolsService: ToolsService,
  ) {}

  async plan(goal: string, workspaceId: string, companyId: string): Promise<{
    plan: PlanStep[]
    workflowExecutionId: string
  }> {
    const llm = getLLMProvider('openai')

    // Get available agents and connected tools for context
    const agentRegistry = new AgentRegistry(this.db)
    const allAgents = agentRegistry.listAll()
    const connectedTools = await this.toolsService.registry.listConnected(companyId)

    // Get workspace context
    const { data: workspace } = await this.db
      .from('workspaces')
      .select('name, metadata')
      .eq('id', workspaceId)
      .single()

    const prompt = `Tu es un orchestrateur d'agents IA. L'utilisateur a un objectif. Tu dois decomposer cet objectif en etapes, chaque etape assignee a un agent.

AGENTS DISPONIBLES :
${allAgents.map(a => `- ${a.id}: ${a.name} — ${a.description} (capabilities: ${a.capabilities.join(', ')})`).join('\n')}

TOOLS CONNECTES :
${connectedTools.map(t => `- ${t.toolId}: ${t.name} — ${t.description}`).join('\n')}

CONTEXTE WORKSPACE :
Nom: ${workspace?.name || 'N/A'}

OBJECTIF UTILISATEUR :
${goal}

Genere un plan structure en JSON. Chaque etape a un id unique (step-1, step-2...), un agentId, un goal, et une liste de dependances (dependsOn).

Reponds UNIQUEMENT avec un JSON valide :
{
  "steps": [
    { "id": "step-1", "agentId": "lead-discovery", "goal": "...", "dependsOn": [] },
    { "id": "step-2", "agentId": "outreach", "goal": "...", "dependsOn": ["step-1"] }
  ]
}`

    const result = await llm.generateStructured<{ steps: PlanStep[] }>(prompt, {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              agentId: { type: 'string' },
              goal: { type: 'string' },
              dependsOn: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    })

    this.logger.log(`Generated plan with ${result.steps.length} steps`)
    return { plan: result.steps, workflowExecutionId: '' }
  }

  async executePlan(
    plan: PlanStep[],
    workspaceId: string,
    companyId: string,
    goal: string,
  ): Promise<string> {
    // Create workflow execution
    const { data: execution } = await this.db
      .from('workflow_executions')
      .insert({
        workflow_id: 'dynamic-plan',
        company_id: companyId,
        status: 'running',
        trigger_event: { type: 'USER_GOAL', goal, workspaceId },
      })
      .select()
      .single()

    if (!execution) throw new Error('Failed to create workflow execution')

    // Create task executions for each step
    const tasks = plan.map(step => ({
      workflow_execution_id: execution.id,
      task_def_id: step.id,
      agent_id: step.agentId,
      action: 'execute_goal',
      status: step.dependsOn.length === 0 ? 'pending' : 'blocked',
      input: { goal: step.goal, workspaceId },
    }))

    await this.db.from('task_executions').insert(tasks)

    // Dispatch ready tasks
    const readyTasks = await this.workflowEngine.getReadyTasks(execution.id)
    for (const task of readyTasks) {
      await this.workflowEngine.updateTaskStatus(task.id, 'running')
      await this.agentQueue.add('execute-task', {
        taskExecutionId: task.id,
        workflowExecutionId: execution.id,
        agentId: task.agentId,
        action: task.action,
        input: task.input,
      })
    }

    this.logger.log(`Launched workflow execution ${execution.id} with ${readyTasks.length} initial tasks`)
    return execution.id
  }

  async getExecutionStatus(workflowExecutionId: string) {
    const { data: execution } = await this.db
      .from('workflow_executions')
      .select('*')
      .eq('id', workflowExecutionId)
      .single()

    const { data: tasks } = await this.db
      .from('task_executions')
      .select('*')
      .eq('workflow_execution_id', workflowExecutionId)
      .order('created_at')

    const { data: steps } = await this.db
      .from('task_execution_steps')
      .select('*')
      .in('task_execution_id', (tasks || []).map(t => t.id))
      .order('created_at')

    return { execution, tasks, steps }
  }

  async approveTask(taskExecutionId: string, workflowExecutionId: string) {
    await this.workflowEngine.updateTaskStatus(taskExecutionId, 'running')
    await this.agentQueue.add('execute-task', {
      taskExecutionId,
      workflowExecutionId,
      agentId: '',
      action: 'resume_after_approval',
      input: {},
    })
  }
}
