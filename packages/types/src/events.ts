export type EventType =
  | 'EMAIL_RECEIVED'
  | 'DOCUMENT_UPLOADED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'MANUAL_TRIGGER'
  | 'WORKSPACE_CREATED'
  | 'CHAT_MESSAGE_SENT'
  | 'DOCUMENT_UPLOADED_WORKSPACE'
  | 'QONTO_SYNC_REQUESTED'

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
