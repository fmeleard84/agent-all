import { Injectable, Logger } from '@nestjs/common'
import { WorkspaceService } from '../workspace/workspace.service'
import { indexDocument, search, COLLECTIONS } from '@agent-all/rag'
import { SYSTEM_PROMPTS } from './prompts'
import OpenAI from 'openai'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private openai: OpenAI

  constructor(private readonly workspaceService: WorkspaceService) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async chat(workspaceId: string, userMessage: string, userId: string): Promise<string> {
    // 1. Get workspace + store message + get history in parallel
    const [workspace, , messages] = await Promise.all([
      this.workspaceService.findById(workspaceId),
      this.workspaceService.addMessage(workspaceId, 'user', userMessage),
      this.workspaceService.getMessages(workspaceId, 20),
    ])

    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    // 2. Search RAG only if enough history
    let ragContext = ''
    if (messages.length > 8) {
      try {
        const results = await search(COLLECTIONS.CONVERSATIONS, userMessage, workspaceId, 3)
        if (results.length > 0) {
          ragContext = '\n\nContexte des echanges precedents:\n' + results.map((r: { content: string }) => r.content).join('\n---\n')
        }
      } catch (err) {
        this.logger.warn(`RAG search failed: ${err}`)
      }
    }

    // 3. Build proper chat messages (system + history + user)
    const axeType = workspace.axeType || (workspace as any).axe_type || 'idea'
    const systemPrompt = SYSTEM_PROMPTS[axeType] || SYSTEM_PROMPTS['idea']

    const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + ragContext },
    ]

    // Add conversation history as proper role messages
    for (const m of messages) {
      if (m.role === 'user' || m.role === 'assistant') {
        chatMessages.push({ role: m.role, content: m.content })
      }
    }

    // Add the current message
    chatMessages.push({ role: 'user', content: userMessage })

    // 4. Generate response — gpt-4o-mini for speed
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.8,
      max_tokens: 300,
    })

    const response = completion.choices[0]?.message?.content || ''

    // 5. Store response (blocking) + RAG indexing (non-blocking)
    await this.workspaceService.addMessage(workspaceId, 'assistant', response)
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
