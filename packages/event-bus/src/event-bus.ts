import type { AgentEvent, EventType, EventHandler } from '@agent-all/types'

export interface EventBus {
  emit(event: AgentEvent): Promise<void>
  subscribe(eventType: EventType, handler: EventHandler): void
  start(): Promise<void>
  stop(): Promise<void>
}
