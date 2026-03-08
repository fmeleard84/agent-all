import type { LLMProvider, LLMOptions } from '@agent-all/types'

export abstract class BaseLLMProvider implements LLMProvider {
  abstract generate(prompt: string, options?: LLMOptions): Promise<string>
  abstract generateStructured<T>(prompt: string, schema: Record<string, any>, options?: LLMOptions): Promise<T>
}
