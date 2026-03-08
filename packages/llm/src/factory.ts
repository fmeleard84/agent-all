import type { LLMProvider } from '@agent-all/types'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'

export type ProviderType = 'anthropic' | 'openai'

const providers = new Map<ProviderType, LLMProvider>()

export function getLLMProvider(type: ProviderType = 'anthropic'): LLMProvider {
  if (!providers.has(type)) {
    switch (type) {
      case 'anthropic':
        providers.set(type, new AnthropicProvider())
        break
      case 'openai':
        providers.set(type, new OpenAIProvider())
        break
    }
  }
  return providers.get(type)!
}
