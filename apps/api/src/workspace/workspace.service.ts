import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseServiceClient } from '@agent-all/database'
import type { Workspace, ChatMessage, AxeType } from '@agent-all/types'

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name)
  private db = getSupabaseServiceClient()

  async create(userId: string, axeType: AxeType, name?: string): Promise<Workspace> {
    const { data, error } = await this.db
      .from('workspaces')
      .insert({
        user_id: userId,
        axe_type: axeType,
        name: name || `New ${axeType} workspace`,
      })
      .select()
      .single()

    if (error || !data) throw new Error(`Failed to create workspace: ${error?.message}`)
    this.logger.log(`Created workspace ${data.id} for user ${userId}`)
    return data as unknown as Workspace
  }

  async findByUser(userId: string): Promise<Workspace[]> {
    const { data, error } = await this.db
      .from('workspaces')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch workspaces: ${error.message}`)
    return (data || []) as unknown as Workspace[]
  }

  async findById(workspaceId: string): Promise<Workspace | null> {
    const { data } = await this.db
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    return (data as unknown as Workspace) || null
  }

  async getMessages(workspaceId: string, limit: number = 50): Promise<ChatMessage[]> {
    const { data, error } = await this.db
      .from('chat_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`)
    return (data || []) as unknown as ChatMessage[]
  }

  async addMessage(
    workspaceId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    extractedData?: Record<string, any>,
  ): Promise<ChatMessage> {
    const { data, error } = await this.db
      .from('chat_messages')
      .insert({
        workspace_id: workspaceId,
        role,
        content,
        extracted_data: extractedData || null,
      })
      .select()
      .single()

    if (error || !data) throw new Error(`Failed to add message: ${error?.message}`)
    return data as unknown as ChatMessage
  }

  async updateMetadata(workspaceId: string, metadata: Record<string, any>): Promise<Workspace> {
    // Fetch existing metadata first to merge
    const existing = await this.findById(workspaceId)
    const merged = { ...(existing?.metadata || {}), ...metadata }

    const { data, error } = await this.db
      .from('workspaces')
      .update({ metadata: merged })
      .eq('id', workspaceId)
      .select()
      .single()

    if (error || !data) throw new Error(`Failed to update metadata: ${error?.message}`)
    return data as unknown as Workspace
  }
}
