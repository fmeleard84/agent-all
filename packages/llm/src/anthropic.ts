import Anthropic from '@anthropic-ai/sdk'
import type { LLMOptions } from '@agent-all/types'
import { BaseLLMProvider } from './provider'

export class AnthropicProvider extends BaseLLMProvider {
  private client: Anthropic

  constructor(apiKey?: string) {
    super()
    this.client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY })
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: options?.model || 'claude-sonnet-4-20250514',
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type')
    return block.text
  }

  async generateStructured<T>(prompt: string, schema: Record<string, any>, options?: LLMOptions): Promise<T> {
    const fullPrompt = `${prompt}\n\nRespond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nReturn ONLY the JSON, no other text.`
    const text = await this.generate(fullPrompt, options)
    return JSON.parse(text) as T
  }
}
