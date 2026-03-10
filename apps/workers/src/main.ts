import 'dotenv/config'
import { AgentRegistry } from '@agent-all/agent-registry'
import { ToolRegistry, GmailTool, ApifyTool, GoogleSearchTool, SheetsTool, DriveTool } from '@agent-all/tool-registry'
import { getSupabaseServiceClient } from '@agent-all/database'
import { TaskProcessor } from './task-processor'
import { EmailAgent } from './agents/email/email-agent'
import { DocumentAgent } from './agents/document/document-agent'
import { AccountingAgent } from './agents/accounting/accounting-agent'
import { LeadDiscoveryAgent } from './agents/lead-discovery/lead-discovery-agent'
import { OutreachAgent } from './agents/outreach/outreach-agent'
import { AnalysisAgent } from './agents/analysis/analysis-agent'

async function main() {
  console.log('Starting Agent All Workers...')

  const db = getSupabaseServiceClient()
  const registry = new AgentRegistry(db)

  // Register all agents
  registry.register(new EmailAgent())
  registry.register(new DocumentAgent())
  registry.register(new AccountingAgent())
  registry.register(new LeadDiscoveryAgent())
  registry.register(new OutreachAgent())
  registry.register(new AnalysisAgent())
  console.log('Registered 6 agents: email, document, accounting, lead-discovery, outreach, analysis')

  // Register all tools
  const toolRegistry = new ToolRegistry(db)
  toolRegistry.register(new GmailTool())
  toolRegistry.register(new ApifyTool())
  toolRegistry.register(new GoogleSearchTool())
  toolRegistry.register(new SheetsTool())
  toolRegistry.register(new DriveTool())
  console.log(`Registered ${toolRegistry.listAll().length} tools`)

  const processor = new TaskProcessor(registry, toolRegistry, {
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
