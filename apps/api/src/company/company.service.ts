import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseServiceClient } from '@agent-all/database'
import type { Company } from '@agent-all/types'

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name)
  private db = getSupabaseServiceClient()

  async create(name: string, ownerUserId: string): Promise<Company> {
    // Create company
    const { data: company, error } = await this.db
      .from('companies')
      .insert({ name })
      .select()
      .single()

    if (error || !company) throw new Error(`Failed to create company: ${error?.message}`)

    // Add owner
    await this.db.from('company_users').insert({
      company_id: company.id,
      user_id: ownerUserId,
      role: 'owner',
    })

    // Create company memory
    await this.db.from('company_memory').insert({
      company_id: company.id,
    })

    this.logger.log(`Created company ${company.id} with owner ${ownerUserId}`)
    return company as Company
  }

  async findById(companyId: string): Promise<Company | null> {
    const { data } = await this.db
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()
    return data as Company | null
  }

  async findByUser(userId: string): Promise<Company[]> {
    const { data } = await this.db
      .from('company_users')
      .select('company_id, companies(*)')
      .eq('user_id', userId)
    return (data || []).map((row: any) => row.companies as Company)
  }

  async update(companyId: string, updates: Partial<Pick<Company, 'name' | 'settings'>>): Promise<Company> {
    const { data, error } = await this.db
      .from('companies')
      .update(updates)
      .eq('id', companyId)
      .select()
      .single()

    if (error || !data) throw new Error(`Failed to update company: ${error?.message}`)
    return data as Company
  }

  async enableAgent(companyId: string, agentId: string, autonomyLevel: number = 1): Promise<void> {
    await this.db.from('company_agents').upsert({
      company_id: companyId,
      agent_id: agentId,
      autonomy_level: autonomyLevel,
      enabled: true,
    }, { onConflict: 'company_id,agent_id' })
  }

  async disableAgent(companyId: string, agentId: string): Promise<void> {
    await this.db.from('company_agents')
      .update({ enabled: false })
      .eq('company_id', companyId)
      .eq('agent_id', agentId)
  }

  async getCompanyAgents(companyId: string): Promise<any[]> {
    const { data } = await this.db
      .from('company_agents')
      .select('*')
      .eq('company_id', companyId)
    return data || []
  }
}
