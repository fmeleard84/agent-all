import { BaseAgent } from '@agent-all/agent-sdk'
import type {
  AgentDefinition,
  AgentResult,
  AgentContext,
  AgentEvent,
  TaskExecution,
  ActionLog,
} from '@agent-all/types'
import { DETECT_TYPE_PROMPT, EXTRACT_DATA_PROMPT } from './prompts'

export class DocumentAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'document-agent',
    name: 'Document Agent',
    description: 'Classifies documents, extracts structured data, and manages storage',
    capabilities: ['detect_type', 'extract_data', 'rename_document'],
    allowedActions: ['store_document', 'notify_accounting'],
    autonomyLevel: 2,
    tools: ['llm', 'storage'],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'DOCUMENT_UPLOADED'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    switch (task.action) {
      case 'detect_type':
        return this.detectType(task, context)
      case 'extract_data':
        return this.extractData(task, context)
      case 'rename_document':
        return this.renameDocument(task, context)
      default:
        return this.makeFailure(`Unknown action: ${task.action}`)
    }
  }

  private async detectType(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const prompt = DETECT_TYPE_PROMPT
      .replace('{filename}', input.original_name || input.originalName || '')
      .replace('{content}', input.content || 'Not available')

    try {
      const result = await context.llm.generateStructured<{
        type: string
        confidence: number
        reason: string
      }>(prompt, {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['invoice', 'quote', 'contract', 'bank_statement', 'other'] },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
      })

      return this.makeResult(
        {
          documentType: result.type,
          confidence: result.confidence,
          reason: result.reason,
          documentId: input.id || input.documentId,
        },
        result.confidence,
        [{
          action: 'detect_type',
          input: { filename: input.original_name },
          output: result,
          timestamp: new Date(),
        }],
        result.confidence < 0.7,
      )
    } catch (err: any) {
      return this.makeFailure(`Document type detection failed: ${err.message}`)
    }
  }

  private async extractData(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const documentType = input.documentType || input.type || 'other'
    const prompt = EXTRACT_DATA_PROMPT
      .replace('{documentType}', documentType)
      .replace('{filename}', input.original_name || input.originalName || '')
      .replace('{content}', input.content || 'Not available')

    try {
      const result = await context.llm.generateStructured<Record<string, any>>(prompt, {
        type: 'object',
      })

      return this.makeResult(
        {
          extractedData: result,
          documentType,
          documentId: input.id || input.documentId,
        },
        0.85,
        [{
          action: 'extract_data',
          input: { documentType, filename: input.original_name },
          output: result,
          timestamp: new Date(),
        }],
      )
    } catch (err: any) {
      return this.makeFailure(`Data extraction failed: ${err.message}`)
    }
  }

  private async renameDocument(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const documentType = input.documentType || 'document'
    const extractedData = input.extractedData || {}

    // Generate standardized name
    const date = extractedData.date || new Date().toISOString().split('T')[0]
    const vendor = extractedData.vendor || 'unknown'
    const sanitizedVendor = vendor.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    const newName = `${date}_${documentType}_${sanitizedVendor}${this.getExtension(input.original_name || '')}`

    return this.makeResult(
      {
        originalName: input.original_name,
        newName,
        documentId: input.id || input.documentId,
      },
      0.95,
      [{
        action: 'rename_document',
        input: { originalName: input.original_name },
        output: { newName },
        timestamp: new Date(),
      }],
    )
  }

  private getExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : ''
  }
}
