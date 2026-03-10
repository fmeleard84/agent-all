import { ToolDefinition, ToolResult, ToolCredentials } from './types'

export abstract class BaseTool {
  abstract readonly definition: ToolDefinition

  get toolId(): string { return this.definition.toolId }
  get name(): string { return this.definition.name }
  get actions(): string[] { return this.definition.actions.map(a => a.actionId) }

  abstract execute(
    actionId: string,
    input: Record<string, any>,
    credentials: ToolCredentials,
  ): Promise<ToolResult>

  protected makeResult(data: Record<string, any>): ToolResult {
    return { success: true, data }
  }

  protected makeError(error: string): ToolResult {
    return { success: false, data: {}, error }
  }
}
