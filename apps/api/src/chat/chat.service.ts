import { Injectable, Logger } from '@nestjs/common'
import { WorkspaceService } from '../workspace/workspace.service'
import { getLLMProvider } from '@agent-all/llm'
import { indexDocument, search, COLLECTIONS } from '@agent-all/rag'
import { SYSTEM_PROMPTS } from './prompts'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(private readonly workspaceService: WorkspaceService) {}

  async chat(workspaceId: string, userMessage: string, userId: string): Promise<string> {
    // 1. Get workspace
    const workspace = await this.workspaceService.findById(workspaceId)
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    // 2. Store user message + get history in parallel
    const [, messages] = await Promise.all([
      this.workspaceService.addMessage(workspaceId, 'user', userMessage),
      this.workspaceService.getMessages(workspaceId, 20),
    ])

    // 3. Search RAG only if enough conversation history (skip for first few messages)
    let ragContext = ''
    if (messages.length > 6) {
      try {
        const results = await search(COLLECTIONS.CONVERSATIONS, userMessage, workspaceId, 3)
        if (results.length > 0) {
          ragContext = '\n\nContexte pertinent:\n' + results.map((r: { content: string }) => r.content).join('\n---\n')
        }
      } catch (err) {
        this.logger.warn(`RAG search failed: ${err}`)
      }
    }

    // 4. Build prompt
    const axeType = workspace.axeType || (workspace as any).axe_type || 'idea'
    const systemPrompt = SYSTEM_PROMPTS[axeType] || SYSTEM_PROMPTS['idea']

    const conversationHistory = messages
      .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
      .join('\n')

    const fullPrompt = `${systemPrompt}${ragContext}\n\nHistorique:\n${conversationHistory}\n\nUtilisateur: ${userMessage}\n\nAssistant:`

    // 5. Generate response via LLM
    const llm = getLLMProvider('openai')
    const response = await llm.generate(fullPrompt, {
      temperature: 0.7,
      maxTokens: 500,
    })

    // 6. Store response (blocking) + index both messages in RAG (non-blocking)
    await this.workspaceService.addMessage(workspaceId, 'assistant', response)

    // Fire-and-forget RAG indexing
    this.indexInBackground(workspaceId, userId, userMessage, response)

    return response
  }

  private indexInBackground(workspaceId: string, userId: string, userMessage: string, response: string) {
    Promise.all([
      indexDocument(
        COLLECTIONS.CONVERSATIONS,
        { content: userMessage, metadata: { role: 'user' } },
        workspaceId,
        userId,
      ),
      indexDocument(
        COLLECTIONS.CONVERSATIONS,
        { content: response, metadata: { role: 'assistant' } },
        workspaceId,
        userId,
      ),
    ]).catch((err) => {
      this.logger.warn(`Background RAG indexing failed: ${err}`)
    })
  }
}
