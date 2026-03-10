import { Injectable, Logger } from '@nestjs/common'
import { google } from 'googleapis'
import {
  ToolRegistry, GmailTool, ApifyTool, GoogleSearchTool, SheetsTool, DriveTool,
} from '@agent-all/tool-registry'
import { getSupabaseServiceClient } from '@agent-all/database'

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name)
  readonly registry: ToolRegistry

  constructor() {
    const db = getSupabaseServiceClient()
    this.registry = new ToolRegistry(db)

    // Register all V1 tools
    this.registry.register(new GmailTool())
    this.registry.register(new ApifyTool())
    this.registry.register(new GoogleSearchTool())
    this.registry.register(new SheetsTool())
    this.registry.register(new DriveTool())

    this.logger.log(`Registered ${this.registry.listAll().length} tools`)
  }

  listAll() {
    return this.registry.listAll()
  }

  async listConnected(companyId: string) {
    return this.registry.listConnected(companyId)
  }

  async getConnectionStatus(companyId: string) {
    const all = this.registry.listAll()
    const connected = await this.registry.listConnected(companyId)
    const connectedIds = new Set(connected.map(t => t.toolId))

    return all.map(tool => ({
      ...tool,
      status: connectedIds.has(tool.toolId) ? 'connected' : 'not_connected',
    }))
  }

  getGoogleAuthUrl(toolId: string, companyId: string) {
    const tool = this.registry.resolve(toolId)
    if (!tool || tool.definition.authType !== 'oauth2') return null

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.API_URL}/tools/callback`,
    )

    const scopes = tool.definition.oauthConfig?.scopes || []
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: JSON.stringify({ toolId, companyId }),
      prompt: 'consent',
    })
  }

  async handleGoogleCallback(code: string, state: string) {
    const { toolId, companyId } = JSON.parse(state)

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.API_URL}/tools/callback`,
    )

    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    // Get user info for display
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
    const userInfo = await oauth2Api.userinfo.get()

    await this.registry.saveConnection(
      companyId,
      toolId,
      {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
      },
      { email: userInfo.data.email, name: userInfo.data.name },
    )

    return { toolId, email: userInfo.data.email }
  }

  async saveApiKey(companyId: string, toolId: string, apiKey: string) {
    await this.registry.saveConnection(
      companyId,
      toolId,
      { apiKey },
      { type: 'api_key' },
    )
  }

  async disconnect(companyId: string, toolId: string) {
    await this.registry.revokeConnection(companyId, toolId)
  }
}
