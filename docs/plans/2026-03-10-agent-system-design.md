# Agent System V1 — Design Document

**Goal:** Build a custom agent executor with real tools (Gmail, Apify, etc.) that can find prospects, contact them, and analyze feedback — no framework, no black box.

**Architecture:** Hybrid Plan + ReAct. A PlannerService decomposes user goals into workflow steps. Each step is executed by a specialized agent that can call tools in a ReAct loop (1-5 iterations). The existing WorkflowEngine orchestrates step dependencies. All actions are logged and visible.

**Tech Stack:** NestJS API, BullMQ workers, Supabase Postgres, OpenAI/Claude LLM, Google OAuth2, Apify API.

---

## 1. Tool System

### BaseTool + ToolRegistry (`packages/tool-registry/`)

Same pattern as existing `BaseAgent` / `AgentRegistry`.

```typescript
interface ToolDefinition {
  toolId: string            // 'gmail', 'sheets', 'apify'
  name: string              // 'Gmail'
  description: string
  service: string           // 'google' | 'apify'
  actions: ToolAction[]
  authType: 'oauth2' | 'api_key' | 'none'
  oauthConfig?: { scopes: string[], provider: 'google' | 'apify' }
}

interface ToolAction {
  actionId: string          // 'send_email'
  description: string
  inputSchema: JSONSchema
  outputSchema: JSONSchema
}

abstract class BaseTool {
  abstract definition: ToolDefinition
  abstract execute(actionId: string, input: any, credentials: any): Promise<ToolResult>
  isConnected(companyId: string): Promise<boolean>
}

class ToolRegistry {
  register(tool: BaseTool): void
  resolve(toolId: string): BaseTool | undefined
  listAll(): ToolDefinition[]
  listConnected(companyId: string): ToolDefinition[]
}
```

### Tools V1

| Tool | Actions | Auth |
|------|---------|------|
| Gmail | `send_email`, `read_threads`, `list_messages` | Google OAuth2 |
| Sheets | `create_sheet`, `append_rows`, `read_rows` | Google OAuth2 |
| Drive | `create_document`, `save_file`, `read_document` | Google OAuth2 |
| Apify | `run_actor`, `get_results` | API Key |
| Google Search | `search_web` | API Key (SerpAPI or Custom Search) |

Sheets and Drive are **export-only** tools. Primary data storage is in Supabase (CRM tables).

### OAuth Flow

1. Frontend: user clicks "Connect Gmail" on `/dashboard/connectors`
2. API: `GET /tools/:toolId/auth-url` returns Google OAuth URL
3. Google redirects to `GET /tools/callback?code=...&state=toolId`
4. API exchanges code for tokens, stores in `tool_connections` table
5. Frontend shows "Connected" with account email

### Credentials Storage

Dedicated `tool_connections` table (not `company_memory`). Tokens encrypted at rest.

---

## 2. Agents V1

Extend existing `BaseAgent`. Add `ToolRegistry` and `CredentialStore` to `AgentContext`.

```typescript
interface AgentContext {
  llm: BaseLLMProvider       // existing
  memory: AgentMemory         // existing
  company: CompanyInfo        // existing
  tools: ToolRegistry         // NEW
  credentials: CredentialStore // NEW
}
```

### ReAct Execution Loop

Each agent executes in a ReAct loop (max 5 iterations):

```typescript
async execute(task, context) {
  const messages = [{ role: 'system', content: this.systemPrompt }]
  messages.push({ role: 'user', content: `Objectif: ${task.input.goal}` })

  for (let i = 0; i < 5; i++) {
    const response = await context.llm.generate(messages, {
      tools: this.getToolSchemas(context.tools)
    })
    if (response.toolCall) {
      const result = await context.tools.resolve(response.toolCall.toolId)
        .execute(response.toolCall.action, response.toolCall.input, credentials)
      messages.push({ role: 'tool', content: JSON.stringify(result) })
      // Log in task_execution_steps
    } else {
      return this.makeResult(response.content)
    }
  }
}
```

### Lead Discovery Agent (`lead-discovery`)

- **Capabilities:** `define_icp`, `search_companies`, `enrich_contacts`, `structure_leads`
- **Required tools:** `apify`, `google-search`
- **Autonomy:** 3
- **Storage:** Leads inserted directly into `leads` table, visible in CRM

### Outreach Agent (`outreach`)

- **Capabilities:** `generate_sequence`, `send_email`, `read_replies`, `classify_reply`
- **Required tools:** `gmail`
- **Autonomy:** 2 (validation required before first email send)
- **Storage:** Emails as `interactions` (type: email_sent/email_reply), linked to leads

### Analysis Agent (`analysis`)

- **Capabilities:** `classify_responses`, `identify_objections`, `synthesize_feedback`, `produce_report`
- **Required tools:** none (reads from internal DB)
- **Optional tools:** `drive` (export report)
- **Autonomy:** 3
- **Storage:** Report in `workspace.metadata.agentReports`

---

## 3. Planner / Orchestration

### PlannerService (NEW)

Not an agent — a service that uses LLM to decompose a user goal into workflow steps.

```typescript
class PlannerService {
  async plan(
    goal: string,
    workspaceId: string,
    availableAgents: AgentDefinition[],
    connectedTools: ToolDefinition[]
  ): Promise<WorkflowExecution>
}
```

Flow:
1. User types objective in UI
2. PlannerService sends goal + available agents + connected tools to LLM
3. LLM returns structured plan (ordered steps with agent assignments and dependencies)
4. PlannerService creates `WorkflowExecution` + `task_executions` records
5. User sees the plan, approves/modifies/cancels
6. Existing `WorkflowEngine` orchestrates execution (dependency resolution, BullMQ dispatch)

### Human Validation (two levels)

**Plan level:** User sees and approves the plan before any execution starts.

**Agent level:** Existing `checkGuardrails()` mechanism. Tasks can enter `awaiting_approval` status. UI shows notification with preview. User approves or modifies.

### Reuses Existing Infrastructure

- `WorkflowEngine` — orchestration, dependency resolution
- `DependencyResolver` — task input references
- BullMQ — task dispatch to workers
- `TaskProcessor` — worker execution
- `audit_log` — action logging

---

## 4. Database Schema (Migration 003)

### New Tables

**`leads`**

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  company_id UUID REFERENCES companies(id),
  name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  source TEXT,                  -- 'apify', 'manual', 'google_search'
  source_detail JSONB,
  score INT DEFAULT 0,         -- 0-100
  status TEXT DEFAULT 'new',   -- 'new'|'contacted'|'replied'|'interested'|'not_interested'|'converted'
  tags TEXT[],
  raw_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**`interactions`**

```sql
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  workspace_id UUID REFERENCES workspaces(id),
  type TEXT,                   -- 'email_sent'|'email_reply'|'call'|'note'|'meeting'
  direction TEXT,              -- 'outbound'|'inbound'
  subject TEXT,
  content TEXT,
  classification TEXT,         -- 'positive'|'negative'|'objection'|'question'|'no_response'
  sentiment_score FLOAT,
  objections TEXT[],
  external_id TEXT,            -- Gmail Message-ID
  thread_id TEXT,              -- Gmail Thread ID
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`task_execution_steps`**

```sql
CREATE TABLE task_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_execution_id UUID REFERENCES task_executions(id),
  step_number INT,
  agent_id TEXT,
  tool_id TEXT,
  action_id TEXT,
  input JSONB,
  output JSONB,
  error TEXT,
  status TEXT,                 -- 'running'|'success'|'error'
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`tool_connections`**

```sql
CREATE TABLE tool_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  workspace_id UUID REFERENCES workspaces(id),
  tool_id TEXT NOT NULL,
  status TEXT DEFAULT 'connected',  -- 'connected'|'expired'|'revoked'
  credentials JSONB,
  account_info JSONB,
  connected_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

### Alterations

```sql
ALTER TABLE task_executions ADD COLUMN approval_data JSONB;
```

### Indexes

```sql
CREATE INDEX idx_leads_workspace ON leads(workspace_id);
CREATE INDEX idx_leads_status ON leads(workspace_id, status);
CREATE INDEX idx_interactions_lead ON interactions(lead_id);
CREATE INDEX idx_interactions_workspace ON interactions(workspace_id);
CREATE INDEX idx_steps_task ON task_execution_steps(task_execution_id);
CREATE INDEX idx_tool_connections_company ON tool_connections(company_id);
```

### RLS

All new tables with RLS on `workspace_id` or `company_id`, same pattern as existing tables.

---

## 5. First Workflow — Idea Validation via Outreach

### User Flow

1. User goes to `/dashboard/workspace/[id]/agents`
2. Types: "Trouver 50 cavistes independants en France et envoyer un email pilote"
3. PlannerService generates visible plan (3 steps)
4. User approves → execution starts

### Step 1 — Lead Discovery Agent

- Apify Google Maps Scraper → 50+ raw results
- Google Search enrichment → find emails
- INSERT 50 leads into `leads` table (source: 'apify', status: 'new', score: 60-80)
- All tool calls logged in `task_execution_steps`

### Step 2 — Outreach Agent

- Reads leads from CRM (status: 'new', has email)
- Generates personalized email using workspace wording/brand identity
- Task enters `awaiting_approval` — user sees preview of first email
- After approval: sends via Gmail, one per lead
- INSERT interactions (type: 'email_sent'), UPDATE lead.status = 'contacted'

### Step 3 — Analysis Agent (triggered manually)

- Does NOT auto-start — waits for replies
- User clicks "Analyser les retours" when ready
- Between Step 2 and 3: user can trigger "Verifier les reponses" to sync Gmail replies
- Agent reads interactions, classifies responses, identifies objections
- UPDATE interactions (classification, sentiment), UPDATE leads (status)
- Produces validation report → stored in `workspace.metadata.agentReports`

### Reply Checking (between Step 2 and 3)

- Manual trigger from UI: "Verifier les reponses"
- Outreach Agent `read_replies` action reads Gmail threads (via stored `thread_id`)
- Inserts new replies as interactions, updates lead status

### CRM View (real-time)

The CRM page (`/dashboard/workspace/[id]/contacts`) reflects agent activity in real-time:
- Leads appear as they're discovered (Step 1)
- Status updates as emails are sent (Step 2)
- Classifications appear as replies are analyzed (Step 3)
- Export to Sheets available as optional action

---

## 6. UI Pages

### `/dashboard/workspace/[id]/agents` (NEW)

- Goal input field
- Plan display with step cards (status, agent, tools)
- Execution log (real-time, fed by `task_execution_steps`)
- Approval prompts inline

### `/dashboard/connectors` (EXISTING, to enhance)

- Tool cards with connect/disconnect
- OAuth flow trigger
- Connection status display

### `/dashboard/workspace/[id]/contacts` (EXISTING, to enhance)

- Leads table with filters (status, score, tags, source)
- Interaction timeline per lead
- Export to Sheets button
- Bulk actions
