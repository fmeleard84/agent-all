import type { DocumentType } from './entities'
import type { WorkflowDefinition } from './workflows'

export interface PlatformMemory {
  documentTaxonomy: DocumentType[]
  defaultWorkflows: WorkflowDefinition[]
  globalRules: Rule[]
}

export interface CompanyMemory {
  id: string
  companyId: string
  preferences: Record<string, any>
  connectedServices: ConnectedService[]
  internalRules: CompanyRule[]
  customCategories: string[]
}

export interface AgentMemoryData {
  id: string
  agentId: string
  companyId: string
  decisions: Decision[]
  corrections: HumanCorrection[]
  stats: AgentStats
}

export interface Rule {
  id: string
  condition: string
  action: string
}

export interface CompanyRule {
  id: string
  type: 'approval_threshold' | 'blocked_action' | 'rate_limit' | 'custom'
  config: Record<string, any>
}

export interface ConnectedService {
  type: 'gmail' | 'storage' | 'accounting' | 'crm'
  config: Record<string, any>
  enabled: boolean
}

export interface Decision {
  taskId: string
  action: string
  output: Record<string, any>
  confidence: number
  timestamp: Date
}

export interface HumanCorrection {
  taskId: string
  originalOutput: Record<string, any>
  correctedOutput: Record<string, any>
  timestamp: Date
}

export interface AgentStats {
  totalTasks: number
  successRate: number
  avgConfidence: number
  avgDurationMs: number
}
