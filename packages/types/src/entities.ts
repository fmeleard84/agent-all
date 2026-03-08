export interface Company {
  id: string
  name: string
  settings: Record<string, any>
  createdAt: Date
}

export interface CompanyUser {
  id: string
  companyId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  invitedBy?: string
  createdAt: Date
}

export interface CompanyAgent {
  id: string
  companyId: string
  agentId: string
  autonomyLevel: 1 | 2 | 3 | 4
  config: Record<string, any>
  enabled: boolean
  createdAt: Date
}

export type DocumentType = 'invoice' | 'quote' | 'contract' | 'bank_statement' | 'other'
export type EmailCategory = 'invoice' | 'prospect' | 'support' | 'info' | 'spam'
export type PaymentStatus = 'pending' | 'paid' | 'overdue'

export interface Document {
  id: string
  companyId: string
  type: DocumentType
  originalName: string
  storagePath: string
  extractedData: Record<string, any>
  source: 'email' | 'upload' | 'api'
  createdAt: Date
}

export interface Email {
  id: string
  companyId: string
  fromAddress: string
  subject: string
  category?: EmailCategory
  rawContent: string
  attachments: Record<string, any>[]
  processed: boolean
  createdAt: Date
}

export interface AccountingEntry {
  id: string
  companyId: string
  documentId?: string
  category: string
  amount: number
  currency: string
  dueDate?: Date
  paymentStatus: PaymentStatus
  metadata: Record<string, any>
  createdAt: Date
}

export interface AuditLogEntry {
  id: string
  companyId: string
  workflowExecutionId?: string
  taskExecutionId?: string
  agentId: string
  action: string
  result: string
  confidence?: number
  humanOverride: boolean
  metadata: Record<string, any>
  createdAt: Date
}
