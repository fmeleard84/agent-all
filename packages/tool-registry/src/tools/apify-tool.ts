import { ApifyClient } from 'apify-client'
import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'

export class ApifyTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'apify',
    name: 'Apify',
    description: 'Web scraping et extraction de donnees via Apify actors',
    service: 'apify',
    actions: [
      {
        actionId: 'run_actor',
        description: 'Lancer un actor Apify et attendre les resultats',
        inputSchema: { actorId: 'string', input: 'object' },
        outputSchema: { items: 'array', count: 'number' },
      },
      {
        actionId: 'get_results',
        description: 'Recuperer les resultats d\'un run precedent',
        inputSchema: { runId: 'string' },
        outputSchema: { items: 'array', count: 'number' },
      },
    ],
    authType: 'api_key',
  }

  async execute(actionId: string, input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const client = new ApifyClient({ token: credentials.apiKey })

    try {
      switch (actionId) {
        case 'run_actor': return this.runActor(client, input)
        case 'get_results': return this.getResults(client, input)
        default: return this.makeError(`Unknown action: ${actionId}`)
      }
    } catch (err: any) {
      return this.makeError(`Apify error: ${err.message}`)
    }
  }

  private async runActor(client: ApifyClient, input: Record<string, any>): Promise<ToolResult> {
    const run = await client.actor(input.actorId).call(input.input || {})
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return this.makeResult({ items, count: items.length, runId: run.id })
  }

  private async getResults(client: ApifyClient, input: Record<string, any>): Promise<ToolResult> {
    const run = await client.run(input.runId).get()
    if (!run) return this.makeError('Run not found')
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return this.makeResult({ items, count: items.length })
  }
}
