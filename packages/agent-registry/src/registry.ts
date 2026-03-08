import type { AgentDefinition } from '@agent-all/types'
import type { BaseAgent } from '@agent-all/agent-sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

export class AgentRegistry {
  private agents = new Map<string, BaseAgent>()

  constructor(private db: SupabaseClient) {}

  register(agent: BaseAgent): void {
    this.agents.set(agent.id, agent)
  }

  resolve(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId)
  }

  findByCapability(capability: string): BaseAgent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.capabilities.includes(capability),
    )
  }

  async listForCompany(companyId: string): Promise<AgentDefinition[]> {
    const { data } = await this.db
      .from('company_agents')
      .select('agent_id, autonomy_level, config, enabled')
      .eq('company_id', companyId)
      .eq('enabled', true)

    if (!data) return []

    return data
      .map(row => {
        const agent = this.agents.get(row.agent_id)
        if (!agent) return null
        return {
          ...agent.definition,
          autonomyLevel: row.autonomy_level,
        }
      })
      .filter(Boolean) as AgentDefinition[]
  }

  listAll(): AgentDefinition[] {
    return Array.from(this.agents.values()).map(a => a.definition)
  }
}
