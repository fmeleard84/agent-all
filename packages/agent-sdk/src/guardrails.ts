import type { AgentDefinition, AgentContext } from '@agent-all/types'

const ALWAYS_REQUIRE_APPROVAL = [
  'pay_invoice',
  'delete_document',
  'delete_email',
  'contractual_commitment',
  'send_external_email_first_time',
]

export function checkGuardrails(
  action: string,
  agent: AgentDefinition,
  context: AgentContext,
  amount?: number,
  confidence?: number,
): { allowed: boolean; reason?: string } {
  if (ALWAYS_REQUIRE_APPROVAL.includes(action)) {
    return { allowed: false, reason: `Action "${action}" always requires human approval` }
  }

  if (!agent.allowedActions.includes(action)) {
    return { allowed: false, reason: `Action "${action}" not in agent's allowed actions` }
  }

  const rules = context.memory.company.internalRules || []
  const blockedRule = rules.find(r => r.type === 'blocked_action' && r.config.action === action)
  if (blockedRule) {
    return { allowed: false, reason: `Action "${action}" blocked by company rules` }
  }

  if (amount !== undefined) {
    const thresholdRule = rules.find(r => r.type === 'approval_threshold')
    const threshold = thresholdRule?.config?.amount ?? 5000
    if (amount > threshold) {
      return { allowed: false, reason: `Amount ${amount} exceeds threshold ${threshold}` }
    }
  }

  if (confidence !== undefined) {
    const confRule = rules.find(r => r.type === 'approval_threshold')
    const confThreshold = confRule?.config?.minConfidence ?? 0.7
    if (confidence < confThreshold) {
      return { allowed: false, reason: `Confidence ${confidence} below threshold ${confThreshold}` }
    }
  }

  if (agent.autonomyLevel === 1) {
    return { allowed: false, reason: 'Agent autonomy level 1 (suggest only)' }
  }

  return { allowed: true }
}
