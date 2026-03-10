import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'

export class GoogleSearchTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'google-search',
    name: 'Google Search',
    description: 'Recherche web via Google Custom Search API',
    service: 'google',
    actions: [
      {
        actionId: 'search_web',
        description: 'Rechercher sur le web',
        inputSchema: { query: 'string', maxResults: 'number?' },
        outputSchema: { results: 'array' },
      },
    ],
    authType: 'api_key',
  }

  async execute(actionId: string, input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    if (actionId !== 'search_web') return this.makeError(`Unknown action: ${actionId}`)

    try {
      const apiKey = credentials.apiKey || process.env.GOOGLE_SEARCH_API_KEY
      const cx = process.env.GOOGLE_SEARCH_CX
      if (!apiKey || !cx) return this.makeError('Google Search API key or CX not configured')

      const maxResults = Math.min(input.maxResults || 10, 10)
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(input.query)}&num=${maxResults}`

      const res = await fetch(url)
      const data = await res.json()

      const results = (data.items || []).map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        displayLink: item.displayLink,
      }))

      return this.makeResult({ results, totalResults: data.searchInformation?.totalResults || '0' })
    } catch (err: any) {
      return this.makeError(`Google Search error: ${err.message}`)
    }
  }
}
