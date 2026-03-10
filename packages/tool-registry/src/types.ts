export interface ToolAction {
  actionId: string
  description: string
  inputSchema: Record<string, any>
  outputSchema: Record<string, any>
}

export interface ToolDefinition {
  toolId: string
  name: string
  description: string
  service: string
  actions: ToolAction[]
  authType: 'oauth2' | 'api_key' | 'none'
  oauthConfig?: {
    scopes: string[]
    provider: string
  }
}

export interface ToolResult {
  success: boolean
  data: Record<string, any>
  error?: string
}

export interface ToolCredentials {
  accessToken?: string
  refreshToken?: string
  apiKey?: string
  expiresAt?: string
  [key: string]: any
}
