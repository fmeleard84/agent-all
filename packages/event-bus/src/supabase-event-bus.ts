import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentEvent, EventType, EventHandler } from '@agent-all/types'
import type { EventBus } from './event-bus'
import { randomUUID } from 'crypto'

export class SupabaseEventBus implements EventBus {
  private handlers = new Map<EventType, EventHandler[]>()
  private channel: any = null

  constructor(private db: SupabaseClient) {}

  async emit(event: AgentEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || []
    for (const handler of handlers) {
      await handler(event)
    }
  }

  subscribe(eventType: EventType, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  async start(): Promise<void> {
    this.channel = this.db
      .channel('db-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, async (payload) => {
        const event: AgentEvent = {
          id: randomUUID(),
          type: 'EMAIL_RECEIVED',
          companyId: payload.new.company_id,
          payload: payload.new,
          source: 'email',
          timestamp: new Date(),
        }
        await this.emit(event)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' }, async (payload) => {
        const event: AgentEvent = {
          id: randomUUID(),
          type: 'DOCUMENT_UPLOADED',
          companyId: payload.new.company_id,
          payload: payload.new,
          source: payload.new.source || 'upload',
          timestamp: new Date(),
        }
        await this.emit(event)
      })
      .subscribe()
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.db.removeChannel(this.channel)
      this.channel = null
    }
  }
}
