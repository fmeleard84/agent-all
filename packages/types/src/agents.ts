import type { AgentEvent } from './events'
import type { TaskExecution } from './workflows'
import type { PlatformMemory, CompanyMemory, AgentMemoryData } from './memory'

export type AutonomyLevel = 1 | 2 | 3 | 4

export interface AgentDefinition {
  id: string
  name: string
  description: string
  capabilities: string[]
  allowedActions: string[]
  autonomyLevel: AutonomyLevel
  tools: string[]
}

export interface AgentResult {
  status: 'success' | 'failure'
  output: Record<string, any>
  confidence: number
  requiresHumanReview: boolean
  actions: ActionLog[]
}

export interface ActionLog {
  action: string
  input: Record<string, any>
  output: Record<string, any>
  timestamp: Date
}

export interface AgentContext {
  llm: LLMProvider
  memory: {
    platform: PlatformMemory
    company: CompanyMemory
    agent: AgentMemoryData
  }
  company: CompanyInfo
  tools?: any       // ToolRegistry — optional for backward compat with existing agents
  credentials?: {   // CredentialStore helper
    get: (toolId: string) => Promise<any>
  }
  workspace?: { id: string; metadata: Record<string, any> }
}

export interface LLMProvider {
  generate(prompt: string, options?: LLMOptions): Promise<string>
  generateStructured<T>(prompt: string, schema: Record<string, any>, options?: LLMOptions): Promise<T>
}

export interface LLMOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  provider?: 'anthropic' | 'openai'
}

export interface CompanyInfo {
  id: string
  name: string
  settings: Record<string, any>
}
