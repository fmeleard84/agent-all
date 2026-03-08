export type AxeType = 'idea' | 'launch' | 'existing'
export type WorkspaceStatus = 'onboarding' | 'active' | 'archived'

export interface Workspace {
  id: string
  userId: string
  companyId: string
  axeType: AxeType
  name: string
  status: WorkspaceStatus
  metadata: Record<string, any>
  createdAt: Date
}

export interface ChatMessage {
  id: string
  workspaceId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  extractedData?: Record<string, any>
  createdAt: Date
}

export interface WorkspaceDocument {
  id: string
  workspaceId: string
  fileName: string
  storagePath: string
  docType: 'bank_statement' | 'invoice' | 'contract' | 'other'
  extractedData?: Record<string, any>
  createdAt: Date
}

export interface QontoCredentials {
  apiKey: string
  login: string
}

export interface QontoTransaction {
  transactionId: string
  amount: number
  amountCents: number
  currency: string
  side: 'credit' | 'debit'
  operationType: string
  label: string
  settledAt: string
  emittedAt: string
  status: string
  reference?: string
  category?: string
}
