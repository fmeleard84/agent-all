import { BaseAgent } from '@agent-all/agent-sdk'
import { AgentDefinition, AgentResult, AgentContext, AgentEvent, TaskExecution, ActionLog } from '@agent-all/types'
import { getSupabaseServiceClient } from '@agent-all/database'

export class AnalysisAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'analysis',
    name: 'Analysis Agent',
    description: 'Analyse les retours et produit un rapport de validation marche',
    capabilities: ['classify_responses', 'identify_objections', 'synthesize_feedback', 'produce_report'],
    allowedActions: ['classify_responses', 'produce_report'],
    autonomyLevel: 3,
    tools: [],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'MANUAL_TRIGGER' && event.payload?.agentId === 'analysis'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const db = getSupabaseServiceClient()
    const workspaceId = task.input?.workspaceId || ''
    const actions: ActionLog[] = []

    try {
      // Load all interactions for this workspace
      const { data: interactions } = await db
        .from('interactions')
        .select('*, leads!inner(name, email, score)')
        .eq('workspace_id', workspaceId)

      const { data: leads } = await db
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)

      const totalLeads = leads?.length || 0
      const contacted = leads?.filter(l => l.status !== 'new').length || 0
      const replies = interactions?.filter(i => i.type === 'email_reply') || []
      const sent = interactions?.filter(i => i.type === 'email_sent') || []

      // Classify each reply with LLM
      for (const reply of replies) {
        if (reply.classification) continue // already classified

        const classification = await context.llm.generateStructured<{
          classification: string
          sentiment: number
          objections: string[]
          summary: string
        }>(
          `Classe cette reponse a un email de prospection.

Email envoye: ${sent.find(s => s.thread_id === reply.thread_id)?.content || 'N/A'}
Reponse recue: ${reply.content}

Reponds en JSON:
- classification: "positive" | "negative" | "objection" | "question" | "no_response"
- sentiment: -1 a 1
- objections: liste des objections identifiees
- summary: resume en une phrase`,
          {
            type: 'object',
            properties: {
              classification: { type: 'string' },
              sentiment: { type: 'number' },
              objections: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
            },
          },
        )

        await db.from('interactions').update({
          classification: classification.classification,
          sentiment_score: classification.sentiment,
          objections: classification.objections,
          metadata: { ...reply.metadata, summary: classification.summary },
        }).eq('id', reply.id)

        // Update lead status based on classification
        const newStatus = classification.classification === 'positive' ? 'interested'
          : classification.classification === 'negative' ? 'not_interested'
          : 'replied'
        await db.from('leads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', reply.lead_id)
      }

      actions.push({
        action: 'classify_responses',
        input: { replyCount: replies.length },
        output: { classified: replies.length },
        timestamp: new Date(),
      })

      // Generate validation report
      const responseRate = contacted > 0 ? (replies.length / contacted * 100).toFixed(1) : '0'
      const positive = replies.filter(r => r.classification === 'positive').length
      const allObjections = replies.flatMap(r => r.objections || [])

      const report = await context.llm.generateStructured<{
        summary: string
        verdict: string
        responseRate: string
        interested: number
        topObjections: string[]
        recommendation: string
        nextSteps: string[]
      }>(
        `Genere un rapport de validation marche base sur ces donnees:

- ${totalLeads} leads identifies
- ${contacted} contactes par email
- ${replies.length} reponses recues (${responseRate}% taux de reponse)
- ${positive} reponses positives
- Objections: ${allObjections.join(', ') || 'aucune'}

Reponds en JSON avec: summary, verdict (valide/a_approfondir/invalide), responseRate, interested, topObjections, recommendation, nextSteps`,
        {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            verdict: { type: 'string' },
            responseRate: { type: 'string' },
            interested: { type: 'number' },
            topObjections: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
            nextSteps: { type: 'array', items: { type: 'string' } },
          },
        },
      )

      // Store report in workspace metadata
      const { data: ws } = await db.from('workspaces').select('metadata').eq('id', workspaceId).single()
      const metadata = ws?.metadata || {}
      metadata.agentReports = { ...metadata.agentReports, validation: report }
      await db.from('workspaces').update({ metadata }).eq('id', workspaceId)

      actions.push({
        action: 'produce_report',
        input: {},
        output: report,
        timestamp: new Date(),
      })

      return this.makeResult(report, 0.85, actions)
    } catch (err: any) {
      return this.makeFailure(`Analysis failed: ${err.message}`)
    }
  }
}
