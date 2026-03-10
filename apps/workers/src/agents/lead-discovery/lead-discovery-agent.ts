import { BaseAgent } from '@agent-all/agent-sdk'
import { AgentDefinition, AgentResult, AgentContext, AgentEvent, TaskExecution, ActionLog } from '@agent-all/types'
import { getSupabaseServiceClient } from '@agent-all/database'

export class LeadDiscoveryAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'lead-discovery',
    name: 'Lead Discovery Agent',
    description: 'Recherche de prospects correspondant a un ICP via scraping et enrichissement',
    capabilities: ['define_icp', 'search_companies', 'enrich_contacts', 'structure_leads'],
    allowedActions: ['search_companies', 'enrich_contacts', 'create_leads'],
    autonomyLevel: 3,
    tools: ['apify', 'google-search'],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'MANUAL_TRIGGER' && event.payload?.agentId === 'lead-discovery'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const db = getSupabaseServiceClient()
    const goal = task.input?.goal || ''
    const workspaceId = task.input?.workspaceId || ''
    const actions: ActionLog[] = []

    try {
      // Step 1: Use LLM to define search parameters from the goal
      const searchParams = await context.llm.generateStructured<{
        query: string
        location: string
        maxResults: number
        actorId: string
      }>(
        `Tu es un expert en lead generation. A partir de cet objectif, definis les parametres de recherche Apify.

Objectif: ${goal}

Reponds en JSON avec:
- query: la requete de recherche Google Maps
- location: le pays/la region
- maxResults: nombre de resultats (max 100)
- actorId: l'actor Apify a utiliser. Utilise "apify/google-maps-scraper" pour des commerces locaux, "apify/google-search-scraper" pour des entreprises en ligne.`,
        {
          type: 'object',
          properties: {
            query: { type: 'string' },
            location: { type: 'string' },
            maxResults: { type: 'number' },
            actorId: { type: 'string' },
          },
        },
      )

      // Step 2: Run Apify scraper
      const apifyTool = context.tools?.resolve('apify')
      if (!apifyTool) return this.makeFailure('Apify tool not available')

      const apifyCreds = await context.credentials?.get('apify')
      if (!apifyCreds) return this.makeFailure('Apify not connected — please add your API key')

      const logStep = async (toolId: string, actionId: string, input: any, output: any, status: string, durationMs: number) => {
        await db.from('task_execution_steps').insert({
          task_execution_id: task.id,
          step_number: actions.length + 1,
          agent_id: this.id,
          tool_id: toolId,
          action_id: actionId,
          input,
          output: output?.data || output,
          status,
          duration_ms: durationMs,
        })
      }

      const start1 = Date.now()
      const scrapeResult = await apifyTool.execute('run_actor', {
        actorId: searchParams.actorId,
        input: {
          searchStringsArray: [searchParams.query],
          locationQuery: searchParams.location,
          maxCrawledPlacesPerSearch: searchParams.maxResults,
        },
      }, apifyCreds)
      await logStep('apify', 'run_actor', { query: searchParams.query }, scrapeResult, scrapeResult.success ? 'success' : 'error', Date.now() - start1)

      if (!scrapeResult.success) return this.makeFailure(`Apify scraping failed: ${scrapeResult.error}`)

      actions.push({
        action: 'search_companies',
        input: { query: searchParams.query, actorId: searchParams.actorId },
        output: { count: scrapeResult.data.count },
        timestamp: new Date(),
      })

      // Step 3: Structure leads and insert into CRM
      const items = scrapeResult.data.items || []
      const leads = items.map((item: any) => ({
        workspace_id: workspaceId,
        name: item.title || item.name || 'Unknown',
        contact_name: item.contactName || null,
        email: item.email || item.emailAddress || null,
        phone: item.phone || item.phoneNumber || null,
        website: item.website || item.url || null,
        source: 'apify',
        source_detail: { actorId: searchParams.actorId, query: searchParams.query },
        score: item.email ? 70 : 40,
        status: 'new',
        tags: [searchParams.query.split(' ')[0]?.toLowerCase()].filter(Boolean),
        raw_data: item,
      }))

      const { data: insertedLeads, error } = await db
        .from('leads')
        .insert(leads)
        .select('id')

      if (error) return this.makeFailure(`Failed to insert leads: ${error.message}`)

      actions.push({
        action: 'create_leads',
        input: { count: leads.length },
        output: { inserted: insertedLeads?.length || 0 },
        timestamp: new Date(),
      })

      const withEmail = leads.filter((l: any) => l.email).length

      return this.makeResult(
        {
          leadsCount: insertedLeads?.length || 0,
          withEmail,
          summary: `${insertedLeads?.length} leads trouves, ${withEmail} avec email`,
        },
        0.85,
        actions,
      )
    } catch (err: any) {
      return this.makeFailure(`Lead discovery failed: ${err.message}`)
    }
  }
}
