export type EventType =
  | 'EMAIL_RECEIVED'
  | 'DOCUMENT_UPLOADED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'MANUAL_TRIGGER'

export interface AgentEvent {
  id: string
  type: EventType
  companyId: string
  payload: Record<string, any>
  source: 'email' | 'upload' | 'api' | 'webhook' | 'manual'
  timestamp: Date
}

export interface EventHandler {
  (event: AgentEvent): Promise<void>
}
