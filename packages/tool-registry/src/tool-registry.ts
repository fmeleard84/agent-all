import { SupabaseClient } from '@supabase/supabase-js'
import { BaseTool } from './base-tool'
import { ToolDefinition, ToolCredentials } from './types'

export class ToolRegistry {
  private tools = new Map<string, BaseTool>()

  constructor(private db: SupabaseClient) {}

  register(tool: BaseTool): void {
    this.tools.set(tool.toolId, tool)
  }

  resolve(toolId: string): BaseTool | undefined {
    return this.tools.get(toolId)
  }

  listAll(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition)
  }

  async listConnected(companyId: string): Promise<ToolDefinition[]> {
    const { data } = await this.db
      .from('tool_connections')
      .select('tool_id')
      .eq('company_id', companyId)
      .eq('status', 'connected')

    if (!data) return []

    const connectedIds = new Set(data.map(r => r.tool_id))
    return this.listAll().filter(t => connectedIds.has(t.toolId))
  }

  async getCredentials(companyId: string, toolId: string): Promise<ToolCredentials | null> {
    const { data } = await this.db
      .from('tool_connections')
      .select('credentials')
      .eq('company_id', companyId)
      .eq('tool_id', toolId)
      .eq('status', 'connected')
      .single()

    return data?.credentials || null
  }

  async saveConnection(
    companyId: string,
    toolId: string,
    credentials: ToolCredentials,
    accountInfo: Record<string, any>,
    workspaceId?: string,
    expiresAt?: string,
  ): Promise<void> {
    await this.db.from('tool_connections').upsert({
      company_id: companyId,
      workspace_id: workspaceId || null,
      tool_id: toolId,
      status: 'connected',
      credentials,
      account_info: accountInfo,
      connected_at: new Date().toISOString(),
      expires_at: expiresAt || null,
    }, { onConflict: 'company_id,tool_id' })
  }

  async revokeConnection(companyId: string, toolId: string): Promise<void> {
    await this.db
      .from('tool_connections')
      .update({ status: 'revoked', credentials: {} })
      .eq('company_id', companyId)
      .eq('tool_id', toolId)
  }
}
