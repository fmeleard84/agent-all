import { BaseAgent } from '@agent-all/agent-sdk'
import type {
  AgentDefinition,
  AgentResult,
  AgentContext,
  AgentEvent,
  TaskExecution,
  ActionLog,
} from '@agent-all/types'
import { CATEGORIZE_EXPENSE_PROMPT, MATCH_INVOICE_PROMPT } from './prompts'

export class AccountingAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'accounting-agent',
    name: 'Accounting Agent',
    description: 'Categorizes expenses, matches invoices, and tracks due dates',
    capabilities: ['categorize_expense', 'match_invoice', 'detect_due_date'],
    allowedActions: ['create_entry', 'generate_export', 'notify_payment'],
    autonomyLevel: 1,
    tools: ['llm', 'database'],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'INVOICE_CREATED'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    switch (task.action) {
      case 'categorize_expense':
        return this.categorizeExpense(task, context)
      case 'match_invoice':
        return this.matchInvoice(task, context)
      case 'detect_due_date':
        return this.detectDueDate(task, context)
      default:
        return this.makeFailure(`Unknown action: ${task.action}`)
    }
  }

  private async categorizeExpense(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const extractedData = input.extractedData || {}

    // Build custom categories from company memory
    const customCats = context.memory.company.customCategories || []
    const customCategoriesStr = customCats.length > 0
      ? `Company custom categories:\n${customCats.join('\n')}`
      : ''

    const prompt = CATEGORIZE_EXPENSE_PROMPT
      .replace('{vendor}', extractedData.vendor || 'Unknown')
      .replace('{amount}', String(extractedData.amount || 0))
      .replace('{currency}', extractedData.currency || 'EUR')
      .replace('{description}', extractedData.description || '')
      .replace('{items}', JSON.stringify(extractedData.items || []))
      .replace('{customCategories}', customCategoriesStr)

    try {
      const result = await context.llm.generateStructured<{
        category: string
        subcategory?: string
        confidence: number
        reason: string
        taxDeductible: boolean
      }>(prompt, {
        type: 'object',
        properties: {
          category: { type: 'string' },
          subcategory: { type: 'string' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
          taxDeductible: { type: 'boolean' },
        },
      })

      // Check guardrails for amount
      const amount = extractedData.amount || 0
      const guardrail = await this.checkAction('create_entry', context, amount, result.confidence)

      return this.makeResult(
        {
          category: result.category,
          subcategory: result.subcategory,
          confidence: result.confidence,
          reason: result.reason,
          taxDeductible: result.taxDeductible,
          amount,
          currency: extractedData.currency || 'EUR',
          documentId: input.documentId || input.id,
        },
        result.confidence,
        [{
          action: 'categorize_expense',
          input: { vendor: extractedData.vendor, amount },
          output: result,
          timestamp: new Date(),
        }],
        !guardrail.allowed || result.confidence < 0.7,
      )
    } catch (err: any) {
      return this.makeFailure(`Expense categorization failed: ${err.message}`)
    }
  }

  private async matchInvoice(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const extractedData = input.extractedData || {}

    // This is a simplified version - in production would query existing entries
    const actions: ActionLog[] = [{
      action: 'match_invoice',
      input: { vendor: extractedData.vendor, amount: extractedData.amount },
      output: { matched: false, reason: 'No existing entries to match against' },
      timestamp: new Date(),
    }]

    return this.makeResult(
      {
        matched: false,
        reason: 'No existing entries to match against',
        invoiceNumber: extractedData.invoiceNumber,
      },
      0.9,
      actions,
    )
  }

  private async detectDueDate(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const input = task.input || {}
    const extractedData = input.extractedData || {}

    const dueDate = extractedData.dueDate || null
    const invoiceDate = extractedData.date || null

    let computedDueDate = dueDate
    if (!computedDueDate && invoiceDate) {
      // Default: 30 days from invoice date
      const date = new Date(invoiceDate)
      date.setDate(date.getDate() + 30)
      computedDueDate = date.toISOString().split('T')[0]
    }

    const now = new Date()
    const isOverdue = computedDueDate ? new Date(computedDueDate) < now : false

    return this.makeResult(
      {
        dueDate: computedDueDate,
        invoiceDate,
        isOverdue,
        daysUntilDue: computedDueDate
          ? Math.ceil((new Date(computedDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null,
        documentId: input.documentId || input.id,
      },
      computedDueDate ? 0.95 : 0.5,
      [{
        action: 'detect_due_date',
        input: { invoiceDate, dueDate },
        output: { computedDueDate, isOverdue },
        timestamp: new Date(),
      }],
      !computedDueDate,
    )
  }
}
