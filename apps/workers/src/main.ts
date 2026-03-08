import 'dotenv/config'
import { AgentRegistry } from '@agent-all/agent-registry'
import { getSupabaseServiceClient } from '@agent-all/database'
import { TaskProcessor } from './task-processor'

async function main() {
  console.log('Starting Agent All Workers...')

  const db = getSupabaseServiceClient()
  const registry = new AgentRegistry(db)

  // Agents will be registered here (Tasks 13-15)
  // registry.register(new EmailAgent())
  // registry.register(new DocumentAgent())
  // registry.register(new AccountingAgent())

  const processor = new TaskProcessor(registry, {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  })

  processor.start()

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...')
    await processor.stop()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('Shutting down...')
    await processor.stop()
    process.exit(0)
  })
}

main().catch(console.error)
