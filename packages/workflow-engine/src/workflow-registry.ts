import type { WorkflowDefinition } from '@agent-all/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export class WorkflowRegistry {
  constructor(private db: SupabaseClient) {}

  async resolve(triggerEvent: string, companyId: string): Promise<WorkflowDefinition | null> {
    // 1. Check company-specific workflow
    const { data: companyWorkflow } = await this.db
      .from('workflows')
      .select('definition')
      .eq('company_id', companyId)
      .eq('trigger_event', triggerEvent)
      .eq('enabled', true)
      .single()

    if (companyWorkflow) return companyWorkflow.definition as WorkflowDefinition

    // 2. Fallback to platform default
    const { data: defaultWorkflow } = await this.db
      .from('workflows')
      .select('definition')
      .is('company_id', null)
      .eq('trigger_event', triggerEvent)
      .eq('enabled', true)
      .single()

    return defaultWorkflow?.definition as WorkflowDefinition | null
  }

  async register(workflow: WorkflowDefinition, companyId?: string): Promise<void> {
    await this.db.from('workflows').insert({
      company_id: companyId || null,
      trigger_event: workflow.trigger,
      definition: workflow,
      enabled: true,
    })
  }

  async list(companyId?: string): Promise<WorkflowDefinition[]> {
    let query = this.db.from('workflows').select('definition').eq('enabled', true)
    if (companyId) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`)
    } else {
      query = query.is('company_id', null)
    }
    const { data } = await query
    return (data || []).map(row => row.definition as WorkflowDefinition)
  }
}
