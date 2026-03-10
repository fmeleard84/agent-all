import { BaseAgent } from '@agent-all/agent-sdk'
import { AgentDefinition, AgentResult, AgentContext, AgentEvent, TaskExecution, ActionLog } from '@agent-all/types'
import { getSupabaseServiceClient } from '@agent-all/database'

export class OutreachAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'outreach',
    name: 'Outreach Agent',
    description: 'Envoi d\'emails personnalises et suivi des reponses',
    capabilities: ['generate_sequence', 'send_email', 'read_replies', 'classify_reply'],
    allowedActions: ['send_email', 'read_replies', 'update_lead_status'],
    autonomyLevel: 2,
    tools: ['gmail'],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'MANUAL_TRIGGER' && event.payload?.agentId === 'outreach'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const db = getSupabaseServiceClient()
    const goal = task.input?.goal || ''
    const workspaceId = task.input?.workspaceId || ''
    const actions: ActionLog[] = []

    const gmailTool = context.tools?.resolve('gmail')
    if (!gmailTool) return this.makeFailure('Gmail tool not available')

    const gmailCreds = await context.credentials?.get('gmail')
    if (!gmailCreds) return this.makeFailure('Gmail not connected — please connect via OAuth')

    try {
      // Load leads to contact
      const { data: leads } = await db
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'new')
        .not('email', 'is', null)
        .limit(50)

      if (!leads?.length) return this.makeFailure('No leads with email found')

      // Load workspace context for personalization
      const { data: workspace } = await db
        .from('workspaces')
        .select('name, metadata')
        .eq('id', workspaceId)
        .single()

      const wording = workspace?.metadata?.actions?.wording?.structured
      const identity = workspace?.metadata?.actions?.identity?.structured

      // Generate email template via LLM
      const template = await context.llm.generateStructured<{
        subject: string
        bodyTemplate: string
      }>(
        `Tu es un expert en cold emailing. Genere un email de validation d'idee.

Objectif: ${goal}
Nom du projet: ${workspace?.name || 'Mon projet'}
${wording ? `Ton de voix: ${wording.personality?.toneOfVoice || ''}` : ''}
${wording ? `Pitch: ${wording.pitches?.thirtySeconds || ''}` : ''}

L'email doit :
- Etre court (5-7 lignes max)
- Poser une question ouverte
- Ne pas vendre, juste valider un besoin
- Etre personnalise avec {{name}} et {{company}}

Reponds en JSON: { "subject": "...", "bodyTemplate": "..." }`,
        {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            bodyTemplate: { type: 'string' },
          },
        },
      )

      // Request approval before sending (autonomy level 2)
      const guardCheck = await this.checkAction('send_external_email_first_time', context)
      if (!guardCheck.allowed) {
        // Store preview for approval
        await db
          .from('task_executions')
          .update({
            status: 'awaiting_approval',
            approval_data: {
              reason: 'Validation requise avant envoi du premier email',
              preview: {
                subject: template.subject,
                body: template.bodyTemplate.replace('{{name}}', leads[0].contact_name || leads[0].name).replace('{{company}}', leads[0].name),
                to: leads[0].email,
                totalLeads: leads.length,
              },
            },
          })
          .eq('id', task.id)

        return this.makeResult(
          { status: 'awaiting_approval', templatePreview: template, leadsCount: leads.length },
          0.9,
          actions,
          true,
        )
      }

      // Send emails
      let sent = 0
      for (const lead of leads) {
        const body = template.bodyTemplate
          .replace(/\{\{name\}\}/g, lead.contact_name || lead.name || '')
          .replace(/\{\{company\}\}/g, lead.name || '')

        const start = Date.now()
        const result = await gmailTool.execute('send_email', {
          to: lead.email,
          subject: template.subject,
          body,
        }, gmailCreds)

        // Log step
        await db.from('task_execution_steps').insert({
          task_execution_id: task.id,
          step_number: sent + 1,
          agent_id: this.id,
          tool_id: 'gmail',
          action_id: 'send_email',
          input: { to: lead.email, subject: template.subject },
          output: result.data,
          status: result.success ? 'success' : 'error',
          duration_ms: Date.now() - start,
        })

        if (result.success) {
          sent++
          // Create interaction
          await db.from('interactions').insert({
            lead_id: lead.id,
            workspace_id: workspaceId,
            type: 'email_sent',
            direction: 'outbound',
            subject: template.subject,
            content: body,
            external_id: result.data.messageId,
            thread_id: result.data.threadId,
          })
          // Update lead status
          await db.from('leads').update({ status: 'contacted', updated_at: new Date().toISOString() }).eq('id', lead.id)
        }
      }

      actions.push({
        action: 'send_email',
        input: { totalLeads: leads.length },
        output: { sent, failed: leads.length - sent },
        timestamp: new Date(),
      })

      return this.makeResult(
        { emailsSent: sent, totalLeads: leads.length, subject: template.subject },
        0.9,
        actions,
      )
    } catch (err: any) {
      return this.makeFailure(`Outreach failed: ${err.message}`)
    }
  }
}
