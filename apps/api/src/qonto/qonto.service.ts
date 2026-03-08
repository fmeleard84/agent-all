import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseServiceClient } from '@agent-all/database'
import {
  createQontoClient,
  fetchAllTransactions,
  indexDocument,
  COLLECTIONS,
} from '@agent-all/rag'
import type { QontoTransaction } from '@agent-all/types'
import { WorkspaceService } from '../workspace/workspace.service'

@Injectable()
export class QontoService {
  private readonly logger = new Logger(QontoService.name)
  private db = getSupabaseServiceClient()

  constructor(private readonly workspaceService: WorkspaceService) {}

  async connectAndSync(
    workspaceId: string,
    userId: string,
    login: string,
    apiKey: string,
  ) {
    // 1. Test connection
    const client = createQontoClient(login, apiKey)
    const org = await client.getOrganization()
    this.logger.log(`Connected to Qonto org: ${org.legal_name}`)

    // 2. Store credentials in workspace metadata
    await this.workspaceService.updateMetadata(workspaceId, {
      qonto: {
        login,
        apiKey,
        orgName: org.legal_name,
        connectedAt: new Date().toISOString(),
      },
    })

    // 3. Fetch all transactions
    const transactions = await fetchAllTransactions(login, apiKey)
    this.logger.log(`Fetched ${transactions.length} transactions from Qonto`)

    let totalCredit = 0
    let totalDebit = 0

    // 4 & 5. Store each transaction and index in RAG
    for (const txn of transactions) {
      const isDebit = txn.side === 'debit'
      const amount = isDebit ? -Math.abs(txn.amount) : Math.abs(txn.amount)
      const category = txn.category || txn.operationType || 'non_catégorisé'
      const currency = txn.currency || 'EUR'
      const dueDate = txn.settledAt || txn.emittedAt
      const paymentStatus = txn.status === 'completed' ? 'paid' : 'pending'

      if (isDebit) {
        totalDebit += Math.abs(txn.amount)
      } else {
        totalCredit += Math.abs(txn.amount)
      }

      // Store in accounting_entries
      const { error } = await this.db.from('accounting_entries').insert({
        category,
        amount,
        currency,
        due_date: dueDate,
        payment_status: paymentStatus,
        metadata: {
          workspace_id: workspaceId,
          qonto_transaction_id: txn.transactionId,
          label: txn.label,
          side: txn.side,
          operation_type: txn.operationType,
          reference: txn.reference,
        },
      })

      if (error) {
        this.logger.warn(
          `Failed to insert transaction ${txn.transactionId}: ${error.message}`,
        )
      }

      // Index in RAG
      const sideLabel = isDebit ? 'Dépense' : 'Revenu'
      const content = `${sideLabel} de ${Math.abs(txn.amount).toFixed(2)} ${currency} — ${txn.label} — ${txn.operationType} — ${dueDate}`

      try {
        await indexDocument(
          COLLECTIONS.DOCUMENTS,
          {
            content,
            metadata: {
              type: 'qonto_transaction',
              transaction_id: txn.transactionId,
              category,
              amount,
              currency,
              side: txn.side,
            },
          },
          workspaceId,
          userId,
        )
      } catch (err: any) {
        this.logger.warn(
          `Failed to index transaction ${txn.transactionId}: ${err.message}`,
        )
      }
    }

    return {
      organization: org.legal_name,
      transactionCount: transactions.length,
      totalCredit,
      totalDebit,
    }
  }
}
