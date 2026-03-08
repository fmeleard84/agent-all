import OpenAI from 'openai'
import type { LLMOptions } from '@agent-all/types'
import { BaseLLMProvider } from './provider'

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI

  constructor(apiKey?: string) {
    super()
    this.client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY })
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: options?.model || 'gpt-4o',
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    })
    return response.choices[0]?.message?.content || ''
  }

  async generateStructured<T>(prompt: string, schema: Record<string, any>, options?: LLMOptions): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: options?.model || 'gpt-4o',
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
    return JSON.parse(response.choices[0]?.message?.content || '{}') as T
  }
}
