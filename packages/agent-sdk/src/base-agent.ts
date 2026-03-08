import type {
  AgentDefinition,
  AgentResult,
  AgentContext,
  AgentEvent,
  ActionLog,
  TaskExecution,
} from '@agent-all/types'
import { checkGuardrails } from './guardrails'

export abstract class BaseAgent {
  abstract readonly definition: AgentDefinition

  get id(): string { return this.definition.id }
  get name(): string { return this.definition.name }
  get capabilities(): string[] { return this.definition.capabilities }
  get allowedActions(): string[] { return this.definition.allowedActions }

  abstract canHandle(event: AgentEvent): boolean

  abstract execute(task: TaskExecution, context: AgentContext): Promise<AgentResult>

  protected async checkAction(
    action: string,
    context: AgentContext,
    amount?: number,
    confidence?: number,
  ): Promise<{ allowed: boolean; reason?: string }> {
    return checkGuardrails(action, this.definition, context, amount, confidence)
  }

  protected makeResult(
    output: Record<string, any>,
    confidence: number,
    actions: ActionLog[],
    requiresHumanReview = false,
  ): AgentResult {
    return {
      status: 'success',
      output,
      confidence,
      requiresHumanReview,
      actions,
    }
  }

  protected makeFailure(error: string): AgentResult {
    return {
      status: 'failure',
      output: { error },
      confidence: 0,
      requiresHumanReview: true,
      actions: [],
    }
  }
}
