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

    // 2. Store user message
    await this.workspaceService.addMessage(workspaceId, 'user', userMessage)

    // 3. Index user message in RAG
    try {
      await indexDocument(
        COLLECTIONS.CONVERSATIONS,
        { content: userMessage, metadata: { role: 'user' } },
        workspaceId,
        userId,
      )
    } catch (err) {
      this.logger.warn(`Failed to index user message in RAG: ${err}`)
    }

    // 4. Get conversation history (last 20 messages)
    const messages = await this.workspaceService.getMessages(workspaceId, 20)

    // 5. Search RAG for relevant context
    let ragContext = ''
    try {
      const results = await search(COLLECTIONS.CONVERSATIONS, userMessage, workspaceId, 3)
      if (results.length > 0) {
        ragContext = '\n\nContexte pertinent trouvé:\n' + results.map((r) => r.content).join('\n---\n')
      }
    } catch (err) {
      this.logger.warn(`Failed to search RAG: ${err}`)
    }

    // 6. Build full prompt
    const axeType = workspace.axeType || (workspace as any).axe_type || 'idea'
    const systemPrompt = SYSTEM_PROMPTS[axeType] || SYSTEM_PROMPTS['idea']

    const conversationHistory = messages
      .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`)
      .join('\n')

    const fullPrompt = `${systemPrompt}${ragContext}\n\nHistorique de la conversation:\n${conversationHistory}\n\nUtilisateur: ${userMessage}\n\nAssistant:`

    // 7. Generate response via LLM
    const llm = getLLMProvider('openai')
    const response = await llm.generate(fullPrompt, {
      temperature: 0.7,
      maxTokens: 1000,
    })

    // 8. Store assistant response
    await this.workspaceService.addMessage(workspaceId, 'assistant', response)

    // 9. Index response in RAG
    try {
      await indexDocument(
        COLLECTIONS.CONVERSATIONS,
        { content: response, metadata: { role: 'assistant' } },
        workspaceId,
        userId,
      )
    } catch (err) {
      this.logger.warn(`Failed to index assistant response in RAG: ${err}`)
    }

    // 10. Return response
    return response
  }
}
