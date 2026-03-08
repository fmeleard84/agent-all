import { BaseAgent } from '@agent-all/agent-sdk'
import type {
  AgentDefinition,
  AgentResult,
  AgentContext,
  AgentEvent,
  TaskExecution,
  ActionLog,
} from '@agent-all/types'
import { CLASSIFY_EMAIL_PROMPT, DRAFT_REPLY_PROMPT } from './prompts'

export class EmailAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'email-agent',
    name: 'Email Agent',
    description: 'Classifies emails, extracts attachments, and drafts replies',
    capabilities: ['classify_email', 'extract_attachments', 'draft_reply'],
    allowedActions: ['reply_email', 'forward_to_agent', 'archive_email', 'create_task'],
    autonomyLevel: 2,
    tools: ['llm'],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'EMAIL_RECEIVED'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    switch (task.action) {
      case 'classify_email':
        return this.classifyEmail(task, context)
      case 'extract_attachments':
        return this.extractAttachments(task, context)
      case 'draft_reply':
        return this.draftReply(task, context)
      default:
        return this.makeFailure(`Unknown action: ${task.action}`)
    }
  }

  private async classifyEmail(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const prompt = CLASSIFY_EMAIL_PROMPT
      .replace('{subject}', input.subject || '')
      .replace('{from}', input.from_address || input.fromAddress || '')
      .replace('{content}', input.raw_content || input.rawContent || '')

    try {
      const result = await context.llm.generateStructured<{
        category: string
        confidence: number
        reason: string
      }>(prompt, {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['invoice', 'prospect', 'support', 'info', 'spam'] },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
      })

      const actions: ActionLog[] = [{
        action: 'classify_email',
        input: { subject: input.subject, from: input.from_address },
        output: result,
        timestamp: new Date(),
      }]

      return this.makeResult(
        {
          category: result.category,
          confidence: result.confidence,
          reason: result.reason,
          emailId: input.id,
        },
        result.confidence,
        actions,
        result.confidence < 0.7,
      )
    } catch (err: any) {
      return this.makeFailure(`Email classification failed: ${err.message}`)
    }
  }

  private async extractAttachments(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const attachments = input.attachments || []

    const extracted = attachments.map((att: any) => ({
      filename: att.filename || att.name,
      contentType: att.content_type || att.contentType,
      size: att.size,
    }))

    const actions: ActionLog[] = [{
      action: 'extract_attachments',
      input: { emailId: input.id || input.emailId },
      output: { count: extracted.length, attachments: extracted },
      timestamp: new Date(),
    }]

    return this.makeResult(
      {
        attachments: extracted,
        hasInvoice: extracted.some((a: any) =>
          a.filename?.toLowerCase().includes('facture') ||
          a.filename?.toLowerCase().includes('invoice') ||
          a.contentType === 'application/pdf',
        ),
      },
      0.9,
      actions,
    )
  }

  private async draftReply(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const prompt = DRAFT_REPLY_PROMPT
      .replace('{from}', input.from_address || input.fromAddress || '')
      .replace('{subject}', input.subject || '')
      .replace('{content}', input.raw_content || input.rawContent || '')
      .replace('{companyName}', context.company.name)

    try {
      const result = await context.llm.generateStructured<{
        subject: string
        body: string
        tone: string
      }>(prompt, {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
          tone: { type: 'string' },
        },
      })

      // Draft reply always requires human review
      return this.makeResult(
        { draft: result, emailId: input.id },
        0.8,
        [{
          action: 'draft_reply',
          input: { subject: input.subject },
          output: result,
          timestamp: new Date(),
        }],
        true, // always requires review
      )
    } catch (err: any) {
      return this.makeFailure(`Draft reply failed: ${err.message}`)
    }
  }
}
