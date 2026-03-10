# Agent System V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a custom agent executor with tool registry, 3 specialized agents (lead discovery, outreach, analysis), and a planner that decomposes user goals into executable workflows — all integrated with the existing CRM.

**Architecture:** Hybrid Plan + ReAct. A PlannerService uses LLM to generate a workflow plan from a user goal. Each step is executed by a specialized agent that calls tools via a ToolRegistry in a ReAct loop (max 5 iterations). The existing WorkflowEngine orchestrates step dependencies. All tool calls are logged in `task_execution_steps`.

**Tech Stack:** TypeScript, NestJS, BullMQ, Supabase Postgres, OpenAI/Claude LLM, Google OAuth2, Apify API, googleapis.

---

## Task 1: Database Migration 003

**Files:**
- Create: `packages/database/migrations/003_agent_system.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration 003: Agent System V1 — leads, interactions, tool connections, execution steps

-- Leads table (CRM)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  source TEXT DEFAULT 'manual',
  source_detail JSONB DEFAULT '{}',
  score INT DEFAULT 0,
  status TEXT DEFAULT 'new',
  tags TEXT[] DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  direction TEXT,
  subject TEXT,
  content TEXT,
  classification TEXT,
  sentiment_score FLOAT,
  objections TEXT[] DEFAULT '{}',
  external_id TEXT,
  thread_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Task execution steps (tool call log for transparency)
CREATE TABLE IF NOT EXISTS task_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_execution_id UUID REFERENCES task_executions(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  agent_id TEXT,
  tool_id TEXT,
  action_id TEXT,
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error TEXT,
  status TEXT DEFAULT 'running',
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tool connections (OAuth tokens, API keys)
CREATE TABLE IF NOT EXISTS tool_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  tool_id TEXT NOT NULL,
  status TEXT DEFAULT 'connected',
  credentials JSONB DEFAULT '{}',
  account_info JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Add approval_data to task_executions
ALTER TABLE task_executions ADD COLUMN IF NOT EXISTS approval_data JSONB;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_workspace ON interactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(workspace_id, type);
CREATE INDEX IF NOT EXISTS idx_steps_task ON task_execution_steps(task_execution_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_company ON tool_connections(company_id);
CREATE INDEX IF NOT EXISTS idx_tool_connections_tool ON tool_connections(company_id, tool_id);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_execution_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role bypasses, auth users access own workspace data)
CREATE POLICY "Users can view leads in their workspaces" ON leads
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view interactions in their workspaces" ON interactions
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view task steps via task executions" ON task_execution_steps
  FOR SELECT USING (true);

CREATE POLICY "Users can view their tool connections" ON tool_connections
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );
```

**Step 2: Run the migration on Supabase**

Run: Open Supabase SQL Editor (https://supabase.com/dashboard/project/yojesskmdehepeqkdelp/sql) and execute the migration.

Alternatively via CLI:
```bash
# Copy migration content and run against Supabase
cat packages/database/migrations/003_agent_system.sql
```

Expected: All tables created, indexes added, RLS enabled.

**Step 3: Commit**

```bash
git add packages/database/migrations/003_agent_system.sql
git commit -m "feat: add migration 003 — leads, interactions, tool connections, execution steps"
```

---

## Task 2: Tool Registry Package

**Files:**
- Create: `packages/tool-registry/package.json`
- Create: `packages/tool-registry/tsconfig.json`
- Create: `packages/tool-registry/src/index.ts`
- Create: `packages/tool-registry/src/base-tool.ts`
- Create: `packages/tool-registry/src/tool-registry.ts`
- Create: `packages/tool-registry/src/types.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/tool-registry",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@agent-all/database": "*"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create types.ts**

```typescript
export interface ToolAction {
  actionId: string
  description: string
  inputSchema: Record<string, any>
  outputSchema: Record<string, any>
}

export interface ToolDefinition {
  toolId: string
  name: string
  description: string
  service: string
  actions: ToolAction[]
  authType: 'oauth2' | 'api_key' | 'none'
  oauthConfig?: {
    scopes: string[]
    provider: string
  }
}

export interface ToolResult {
  success: boolean
  data: Record<string, any>
  error?: string
}

export interface ToolCredentials {
  accessToken?: string
  refreshToken?: string
  apiKey?: string
  expiresAt?: string
  [key: string]: any
}
```

**Step 4: Create base-tool.ts**

```typescript
import { ToolDefinition, ToolResult, ToolCredentials } from './types'

export abstract class BaseTool {
  abstract readonly definition: ToolDefinition

  get toolId(): string { return this.definition.toolId }
  get name(): string { return this.definition.name }
  get actions(): string[] { return this.definition.actions.map(a => a.actionId) }

  abstract execute(
    actionId: string,
    input: Record<string, any>,
    credentials: ToolCredentials,
  ): Promise<ToolResult>

  protected makeResult(data: Record<string, any>): ToolResult {
    return { success: true, data }
  }

  protected makeError(error: string): ToolResult {
    return { success: false, data: {}, error }
  }
}
```

**Step 5: Create tool-registry.ts**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { BaseTool } from './base-tool'
import { ToolDefinition, ToolCredentials } from './types'

export class ToolRegistry {
  private tools = new Map<string, BaseTool>()

  constructor(private db: SupabaseClient) {}

  register(tool: BaseTool): void {
    this.tools.set(tool.toolId, tool)
  }

  resolve(toolId: string): BaseTool | undefined {
    return this.tools.get(toolId)
  }

  listAll(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition)
  }

  async listConnected(companyId: string): Promise<ToolDefinition[]> {
    const { data } = await this.db
      .from('tool_connections')
      .select('tool_id')
      .eq('company_id', companyId)
      .eq('status', 'connected')

    if (!data) return []

    const connectedIds = new Set(data.map(r => r.tool_id))
    return this.listAll().filter(t => connectedIds.has(t.toolId))
  }

  async getCredentials(companyId: string, toolId: string): Promise<ToolCredentials | null> {
    const { data } = await this.db
      .from('tool_connections')
      .select('credentials')
      .eq('company_id', companyId)
      .eq('tool_id', toolId)
      .eq('status', 'connected')
      .single()

    return data?.credentials || null
  }

  async saveConnection(
    companyId: string,
    toolId: string,
    credentials: ToolCredentials,
    accountInfo: Record<string, any>,
    workspaceId?: string,
    expiresAt?: string,
  ): Promise<void> {
    await this.db.from('tool_connections').upsert({
      company_id: companyId,
      workspace_id: workspaceId || null,
      tool_id: toolId,
      status: 'connected',
      credentials,
      account_info: accountInfo,
      connected_at: new Date().toISOString(),
      expires_at: expiresAt || null,
    }, { onConflict: 'company_id,tool_id' })
  }

  async revokeConnection(companyId: string, toolId: string): Promise<void> {
    await this.db
      .from('tool_connections')
      .update({ status: 'revoked', credentials: {} })
      .eq('company_id', companyId)
      .eq('tool_id', toolId)
  }
}
```

**Step 6: Create index.ts**

```typescript
export { BaseTool } from './base-tool'
export { ToolRegistry } from './tool-registry'
export type { ToolDefinition, ToolAction, ToolResult, ToolCredentials } from './types'
```

**Step 7: Install and commit**

```bash
cd /opt/agent-more && npm install
git add packages/tool-registry/
git commit -m "feat: add @agent-all/tool-registry package — BaseTool, ToolRegistry"
```

---

## Task 3: Extend AgentContext with Tools

**Files:**
- Modify: `packages/types/src/agents.ts`
- Modify: `apps/workers/src/task-processor.ts`

**Step 1: Add ToolRegistry and CredentialStore to AgentContext**

In `packages/types/src/agents.ts`, add after the existing `AgentContext` interface:

```typescript
// Add import at top of file (or keep loose coupling with 'any' type)
export interface AgentContext {
  llm: LLMProvider
  memory: {
    platform: PlatformMemory
    company: CompanyMemory
    agent: AgentMemoryData
  }
  company: CompanyInfo
  tools?: any       // ToolRegistry — optional for backward compat with existing agents
  credentials?: any // CredentialStore helper
  workspace?: { id: string; metadata: Record<string, any> }
}
```

**Step 2: Update TaskProcessor to inject ToolRegistry into context**

In `apps/workers/src/task-processor.ts`, modify the constructor and `buildAgentContext`:

Add to constructor params:
```typescript
constructor(
  private agentRegistry: AgentRegistry,
  private toolRegistry: ToolRegistry,  // NEW
  private redisConnection: { host: string; port: number },
) {
```

Add to end of `buildAgentContext()` return:
```typescript
return {
  llm: getLLMProvider('anthropic'),
  memory: { platform: platformMemory, company: memoryData, agent: agentMemoryData },
  company: { id: company?.id || '', name: company?.name || '', settings: company?.settings || {} },
  tools: this.toolRegistry,           // NEW
  credentials: {                       // NEW
    get: (toolId: string) => this.toolRegistry.getCredentials(companyId, toolId),
  },
}
```

**Step 3: Commit**

```bash
git add packages/types/src/agents.ts apps/workers/src/task-processor.ts
git commit -m "feat: extend AgentContext with ToolRegistry and credentials"
```

---

## Task 4: Gmail Tool

**Files:**
- Create: `packages/tool-registry/src/tools/gmail-tool.ts`

**Step 1: Install googleapis**

```bash
cd /opt/agent-more && npm install googleapis --workspace=@agent-all/tool-registry
```

**Step 2: Create gmail-tool.ts**

```typescript
import { google } from 'googleapis'
import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'

export class GmailTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'gmail',
    name: 'Gmail',
    description: 'Envoi et lecture d\'emails via Gmail',
    service: 'google',
    actions: [
      {
        actionId: 'send_email',
        description: 'Envoyer un email',
        inputSchema: { to: 'string', subject: 'string', body: 'string', replyToMessageId: 'string?' },
        outputSchema: { messageId: 'string', threadId: 'string' },
      },
      {
        actionId: 'read_threads',
        description: 'Lire les threads recents ou par query',
        inputSchema: { query: 'string?', maxResults: 'number?' },
        outputSchema: { threads: 'array' },
      },
      {
        actionId: 'list_messages',
        description: 'Lister les messages d\'un thread',
        inputSchema: { threadId: 'string' },
        outputSchema: { messages: 'array' },
      },
    ],
    authType: 'oauth2',
    oauthConfig: {
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
      provider: 'google',
    },
  }

  private getAuth(credentials: ToolCredentials) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    })
    return oauth2
  }

  async execute(actionId: string, input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    try {
      switch (actionId) {
        case 'send_email': return this.sendEmail(input, credentials)
        case 'read_threads': return this.readThreads(input, credentials)
        case 'list_messages': return this.listMessages(input, credentials)
        default: return this.makeError(`Unknown action: ${actionId}`)
      }
    } catch (err: any) {
      return this.makeError(`Gmail error: ${err.message}`)
    }
  }

  private async sendEmail(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const gmail = google.gmail({ version: 'v1', auth })

    const raw = Buffer.from(
      `To: ${input.to}\r\n` +
      `Subject: ${input.subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
      `${input.body}`
    ).toString('base64url')

    const params: any = { userId: 'me', requestBody: { raw } }
    if (input.replyToMessageId) {
      params.requestBody.threadId = input.threadId
    }

    const res = await gmail.users.messages.send(params)
    return this.makeResult({
      messageId: res.data.id,
      threadId: res.data.threadId,
    })
  }

  private async readThreads(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const gmail = google.gmail({ version: 'v1', auth })

    const res = await gmail.users.threads.list({
      userId: 'me',
      q: input.query || '',
      maxResults: input.maxResults || 20,
    })

    const threads = []
    for (const thread of (res.data.threads || []).slice(0, 10)) {
      const detail = await gmail.users.threads.get({ userId: 'me', id: thread.id! })
      const firstMsg = detail.data.messages?.[0]
      const headers = firstMsg?.payload?.headers || []
      threads.push({
        threadId: thread.id,
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
        from: headers.find((h: any) => h.name === 'From')?.value || '',
        date: headers.find((h: any) => h.name === 'Date')?.value || '',
        snippet: firstMsg?.snippet || '',
        messageCount: detail.data.messages?.length || 0,
      })
    }

    return this.makeResult({ threads })
  }

  private async listMessages(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const gmail = google.gmail({ version: 'v1', auth })

    const res = await gmail.users.threads.get({ userId: 'me', id: input.threadId })
    const messages = (res.data.messages || []).map((msg: any) => {
      const headers = msg.payload?.headers || []
      const body = msg.payload?.body?.data
        ? Buffer.from(msg.payload.body.data, 'base64url').toString('utf-8')
        : msg.snippet || ''
      return {
        messageId: msg.id,
        from: headers.find((h: any) => h.name === 'From')?.value || '',
        to: headers.find((h: any) => h.name === 'To')?.value || '',
        date: headers.find((h: any) => h.name === 'Date')?.value || '',
        subject: headers.find((h: any) => h.name === 'Subject')?.value || '',
        body,
      }
    })

    return this.makeResult({ messages })
  }
}
```

**Step 3: Commit**

```bash
git add packages/tool-registry/src/tools/gmail-tool.ts packages/tool-registry/package.json
git commit -m "feat: add Gmail tool — send_email, read_threads, list_messages"
```

---

## Task 5: Apify Tool

**Files:**
- Create: `packages/tool-registry/src/tools/apify-tool.ts`

**Step 1: Install apify-client**

```bash
cd /opt/agent-more && npm install apify-client --workspace=@agent-all/tool-registry
```

**Step 2: Create apify-tool.ts**

```typescript
import { ApifyClient } from 'apify-client'
import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'

export class ApifyTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'apify',
    name: 'Apify',
    description: 'Web scraping et extraction de donnees via Apify actors',
    service: 'apify',
    actions: [
      {
        actionId: 'run_actor',
        description: 'Lancer un actor Apify et attendre les resultats',
        inputSchema: { actorId: 'string', input: 'object' },
        outputSchema: { items: 'array', count: 'number' },
      },
      {
        actionId: 'get_results',
        description: 'Recuperer les resultats d\'un run precedent',
        inputSchema: { runId: 'string' },
        outputSchema: { items: 'array', count: 'number' },
      },
    ],
    authType: 'api_key',
  }

  async execute(actionId: string, input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const client = new ApifyClient({ token: credentials.apiKey })

    try {
      switch (actionId) {
        case 'run_actor': return this.runActor(client, input)
        case 'get_results': return this.getResults(client, input)
        default: return this.makeError(`Unknown action: ${actionId}`)
      }
    } catch (err: any) {
      return this.makeError(`Apify error: ${err.message}`)
    }
  }

  private async runActor(client: ApifyClient, input: Record<string, any>): Promise<ToolResult> {
    const run = await client.actor(input.actorId).call(input.input || {})
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return this.makeResult({ items, count: items.length, runId: run.id })
  }

  private async getResults(client: ApifyClient, input: Record<string, any>): Promise<ToolResult> {
    const run = await client.run(input.runId).get()
    if (!run) return this.makeError('Run not found')
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return this.makeResult({ items, count: items.length })
  }
}
```

**Step 3: Commit**

```bash
git add packages/tool-registry/src/tools/apify-tool.ts packages/tool-registry/package.json
git commit -m "feat: add Apify tool — run_actor, get_results"
```

---

## Task 6: Google Search Tool

**Files:**
- Create: `packages/tool-registry/src/tools/google-search-tool.ts`

**Step 1: Create google-search-tool.ts**

```typescript
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
```

**Step 2: Export all tools from index**

Update `packages/tool-registry/src/index.ts`:

```typescript
export { BaseTool } from './base-tool'
export { ToolRegistry } from './tool-registry'
export type { ToolDefinition, ToolAction, ToolResult, ToolCredentials } from './types'

// Tools
export { GmailTool } from './tools/gmail-tool'
export { ApifyTool } from './tools/apify-tool'
export { GoogleSearchTool } from './tools/google-search-tool'
```

**Step 3: Commit**

```bash
git add packages/tool-registry/src/tools/google-search-tool.ts packages/tool-registry/src/index.ts
git commit -m "feat: add Google Search tool + export all tools"
```

---

## Task 7: Google Sheets & Drive Tools

**Files:**
- Create: `packages/tool-registry/src/tools/sheets-tool.ts`
- Create: `packages/tool-registry/src/tools/drive-tool.ts`
- Modify: `packages/tool-registry/src/index.ts`

**Step 1: Create sheets-tool.ts**

```typescript
import { google } from 'googleapis'
import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'

export class SheetsTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'sheets',
    name: 'Google Sheets',
    description: 'Export de donnees vers Google Sheets',
    service: 'google',
    actions: [
      {
        actionId: 'create_sheet',
        description: 'Creer un nouveau spreadsheet',
        inputSchema: { title: 'string', headers: 'string[]' },
        outputSchema: { spreadsheetId: 'string', url: 'string' },
      },
      {
        actionId: 'append_rows',
        description: 'Ajouter des lignes a un spreadsheet',
        inputSchema: { spreadsheetId: 'string', rows: 'any[][]' },
        outputSchema: { updatedRows: 'number' },
      },
      {
        actionId: 'read_rows',
        description: 'Lire les lignes d\'un spreadsheet',
        inputSchema: { spreadsheetId: 'string', range: 'string?' },
        outputSchema: { rows: 'any[][]' },
      },
    ],
    authType: 'oauth2',
    oauthConfig: {
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      provider: 'google',
    },
  }

  private getAuth(credentials: ToolCredentials) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    })
    return oauth2
  }

  async execute(actionId: string, input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    try {
      switch (actionId) {
        case 'create_sheet': return this.createSheet(input, credentials)
        case 'append_rows': return this.appendRows(input, credentials)
        case 'read_rows': return this.readRows(input, credentials)
        default: return this.makeError(`Unknown action: ${actionId}`)
      }
    } catch (err: any) {
      return this.makeError(`Sheets error: ${err.message}`)
    }
  }

  private async createSheet(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.create({
      requestBody: { properties: { title: input.title } },
    })
    if (input.headers?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: res.data.spreadsheetId!,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: { values: [input.headers] },
      })
    }
    return this.makeResult({
      spreadsheetId: res.data.spreadsheetId,
      url: res.data.spreadsheetUrl,
    })
  }

  private async appendRows(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: input.spreadsheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      requestBody: { values: input.rows },
    })
    return this.makeResult({ updatedRows: res.data.updates?.updatedRows || 0 })
  }

  private async readRows(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.range || 'A:Z',
    })
    return this.makeResult({ rows: res.data.values || [] })
  }
}
```

**Step 2: Create drive-tool.ts**

```typescript
import { google } from 'googleapis'
import { BaseTool } from '../base-tool'
import { ToolDefinition, ToolResult, ToolCredentials } from '../types'
import { Readable } from 'stream'

export class DriveTool extends BaseTool {
  readonly definition: ToolDefinition = {
    toolId: 'drive',
    name: 'Google Drive',
    description: 'Gestion de documents sur Google Drive',
    service: 'google',
    actions: [
      {
        actionId: 'create_document',
        description: 'Creer un Google Doc',
        inputSchema: { title: 'string', content: 'string' },
        outputSchema: { documentId: 'string', url: 'string' },
      },
      {
        actionId: 'save_file',
        description: 'Sauvegarder un fichier sur Drive',
        inputSchema: { name: 'string', content: 'string', mimeType: 'string?' },
        outputSchema: { fileId: 'string', url: 'string' },
      },
    ],
    authType: 'oauth2',
    oauthConfig: {
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      provider: 'google',
    },
  }

  private getAuth(credentials: ToolCredentials) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    })
    return oauth2
  }

  async execute(actionId: string, input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    try {
      switch (actionId) {
        case 'create_document': return this.createDocument(input, credentials)
        case 'save_file': return this.saveFile(input, credentials)
        default: return this.makeError(`Unknown action: ${actionId}`)
      }
    } catch (err: any) {
      return this.makeError(`Drive error: ${err.message}`)
    }
  }

  private async createDocument(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const drive = google.drive({ version: 'v3', auth })
    const res = await drive.files.create({
      requestBody: { name: input.title, mimeType: 'application/vnd.google-apps.document' },
      media: { mimeType: 'text/plain', body: Readable.from(input.content) },
    })
    return this.makeResult({
      documentId: res.data.id,
      url: `https://docs.google.com/document/d/${res.data.id}/edit`,
    })
  }

  private async saveFile(input: Record<string, any>, credentials: ToolCredentials): Promise<ToolResult> {
    const auth = this.getAuth(credentials)
    const drive = google.drive({ version: 'v3', auth })
    const res = await drive.files.create({
      requestBody: { name: input.name },
      media: { mimeType: input.mimeType || 'text/plain', body: Readable.from(input.content) },
    })
    return this.makeResult({
      fileId: res.data.id,
      url: `https://drive.google.com/file/d/${res.data.id}/view`,
    })
  }
}
```

**Step 3: Update index.ts to export new tools**

```typescript
export { BaseTool } from './base-tool'
export { ToolRegistry } from './tool-registry'
export type { ToolDefinition, ToolAction, ToolResult, ToolCredentials } from './types'

export { GmailTool } from './tools/gmail-tool'
export { ApifyTool } from './tools/apify-tool'
export { GoogleSearchTool } from './tools/google-search-tool'
export { SheetsTool } from './tools/sheets-tool'
export { DriveTool } from './tools/drive-tool'
```

**Step 4: Commit**

```bash
git add packages/tool-registry/src/tools/sheets-tool.ts packages/tool-registry/src/tools/drive-tool.ts packages/tool-registry/src/index.ts
git commit -m "feat: add Sheets and Drive tools (export-only)"
```

---

## Task 8: Tools API — OAuth + Listing

**Files:**
- Create: `apps/api/src/tools/tools.module.ts`
- Create: `apps/api/src/tools/tools.controller.ts`
- Create: `apps/api/src/tools/tools.service.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create tools.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { google } from 'googleapis'
import {
  ToolRegistry, GmailTool, ApifyTool, GoogleSearchTool, SheetsTool, DriveTool,
} from '@agent-all/tool-registry'
import { getSupabaseServiceClient } from '@agent-all/database'

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name)
  readonly registry: ToolRegistry

  constructor() {
    const db = getSupabaseServiceClient()
    this.registry = new ToolRegistry(db)

    // Register all V1 tools
    this.registry.register(new GmailTool())
    this.registry.register(new ApifyTool())
    this.registry.register(new GoogleSearchTool())
    this.registry.register(new SheetsTool())
    this.registry.register(new DriveTool())

    this.logger.log(`Registered ${this.registry.listAll().length} tools`)
  }

  listAll() {
    return this.registry.listAll()
  }

  async listConnected(companyId: string) {
    return this.registry.listConnected(companyId)
  }

  async getConnectionStatus(companyId: string) {
    const all = this.registry.listAll()
    const connected = await this.registry.listConnected(companyId)
    const connectedIds = new Set(connected.map(t => t.toolId))

    return all.map(tool => ({
      ...tool,
      status: connectedIds.has(tool.toolId) ? 'connected' : 'not_connected',
    }))
  }

  getGoogleAuthUrl(toolId: string, companyId: string) {
    const tool = this.registry.resolve(toolId)
    if (!tool || tool.definition.authType !== 'oauth2') return null

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.API_URL}/tools/callback`,
    )

    const scopes = tool.definition.oauthConfig?.scopes || []
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: JSON.stringify({ toolId, companyId }),
      prompt: 'consent',
    })
  }

  async handleGoogleCallback(code: string, state: string) {
    const { toolId, companyId } = JSON.parse(state)

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.API_URL}/tools/callback`,
    )

    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    // Get user info for display
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
    const userInfo = await oauth2Api.userinfo.get()

    await this.registry.saveConnection(
      companyId,
      toolId,
      {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
      },
      { email: userInfo.data.email, name: userInfo.data.name },
    )

    return { toolId, email: userInfo.data.email }
  }

  async saveApiKey(companyId: string, toolId: string, apiKey: string) {
    await this.registry.saveConnection(
      companyId,
      toolId,
      { apiKey },
      { type: 'api_key' },
    )
  }

  async disconnect(companyId: string, toolId: string) {
    await this.registry.revokeConnection(companyId, toolId)
  }
}
```

**Step 2: Create tools.controller.ts**

```typescript
import { Controller, Get, Post, Delete, Param, Query, Body, Res } from '@nestjs/common'
import { FastifyReply } from 'fastify'
import { ToolsService } from './tools.service'

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  listTools() {
    return this.toolsService.listAll()
  }

  @Get('status/:companyId')
  getStatus(@Param('companyId') companyId: string) {
    return this.toolsService.getConnectionStatus(companyId)
  }

  @Get(':toolId/auth-url')
  getAuthUrl(
    @Param('toolId') toolId: string,
    @Query('companyId') companyId: string,
  ) {
    const url = this.toolsService.getGoogleAuthUrl(toolId, companyId)
    if (!url) return { error: 'Tool not found or does not support OAuth' }
    return { url }
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.toolsService.handleGoogleCallback(code, state)
    // Redirect back to frontend connectors page
    const frontendUrl = process.env.FRONTEND_URL || 'https://agent-all.ialla.fr'
    reply.redirect(`${frontendUrl}/dashboard/connectors?connected=${result.toolId}`)
  }

  @Post(':toolId/api-key')
  async saveApiKey(
    @Param('toolId') toolId: string,
    @Body() body: { companyId: string; apiKey: string },
  ) {
    await this.toolsService.saveApiKey(body.companyId, toolId, body.apiKey)
    return { status: 'connected' }
  }

  @Delete(':toolId/:companyId')
  async disconnect(
    @Param('toolId') toolId: string,
    @Param('companyId') companyId: string,
  ) {
    await this.toolsService.disconnect(companyId, toolId)
    return { status: 'disconnected' }
  }
}
```

**Step 3: Create tools.module.ts**

```typescript
import { Module } from '@nestjs/common'
import { ToolsController } from './tools.controller'
import { ToolsService } from './tools.service'

@Module({
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
```

**Step 4: Add ToolsModule to AppModule**

In `apps/api/src/app.module.ts`, add import:
```typescript
import { ToolsModule } from './tools/tools.module'
```
Add `ToolsModule` to the imports array.

**Step 5: Commit**

```bash
git add apps/api/src/tools/ apps/api/src/app.module.ts
git commit -m "feat: add Tools API — OAuth flow, API key storage, listing, status"
```

---

## Task 9: PlannerService

**Files:**
- Create: `apps/api/src/planner/planner.service.ts`
- Create: `apps/api/src/planner/planner.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create planner.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { getSupabaseServiceClient } from '@agent-all/database'
import { WorkflowEngine } from '@agent-all/workflow-engine'
import { getLLMProvider } from '@agent-all/llm'
import { AgentRegistry } from '@agent-all/agent-registry'
import { ToolsService } from '../tools/tools.service'

interface PlanStep {
  id: string
  agentId: string
  goal: string
  dependsOn: string[]
}

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name)
  private db = getSupabaseServiceClient()
  private workflowEngine = new WorkflowEngine(this.db)

  constructor(
    @InjectQueue('agent-tasks') private agentQueue: Queue,
    private toolsService: ToolsService,
  ) {}

  async plan(goal: string, workspaceId: string, companyId: string): Promise<{
    plan: PlanStep[]
    workflowExecutionId: string
  }> {
    const llm = getLLMProvider('openai')

    // Get available agents and connected tools for context
    const agentRegistry = new AgentRegistry(this.db)
    // Register the V1 agents (imported at module level)
    const allAgents = agentRegistry.listAll()
    const connectedTools = await this.toolsService.registry.listConnected(companyId)

    // Get workspace context (wording, identity, etc.)
    const { data: workspace } = await this.db
      .from('workspaces')
      .select('name, metadata')
      .eq('id', workspaceId)
      .single()

    const prompt = `Tu es un orchestrateur d'agents IA. L'utilisateur a un objectif. Tu dois decomposer cet objectif en etapes, chaque etape assignee a un agent.

AGENTS DISPONIBLES :
${allAgents.map(a => `- ${a.id}: ${a.name} — ${a.description} (capabilities: ${a.capabilities.join(', ')})`).join('\n')}

TOOLS CONNECTES :
${connectedTools.map(t => `- ${t.toolId}: ${t.name} — ${t.description}`).join('\n')}

CONTEXTE WORKSPACE :
Nom: ${workspace?.name || 'N/A'}

OBJECTIF UTILISATEUR :
${goal}

Genere un plan structure en JSON. Chaque etape a un id unique (step-1, step-2...), un agentId, un goal, et une liste de dependances (dependsOn).

Reponds UNIQUEMENT avec un JSON valide :
{
  "steps": [
    { "id": "step-1", "agentId": "lead-discovery", "goal": "...", "dependsOn": [] },
    { "id": "step-2", "agentId": "outreach", "goal": "...", "dependsOn": ["step-1"] }
  ]
}`

    const result = await llm.generateStructured<{ steps: PlanStep[] }>(prompt, {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              agentId: { type: 'string' },
              goal: { type: 'string' },
              dependsOn: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    })

    this.logger.log(`Generated plan with ${result.steps.length} steps`)
    return { plan: result.steps, workflowExecutionId: '' }
  }

  async executePlan(
    plan: PlanStep[],
    workspaceId: string,
    companyId: string,
    goal: string,
  ): Promise<string> {
    // Create workflow execution
    const { data: execution } = await this.db
      .from('workflow_executions')
      .insert({
        workflow_id: 'dynamic-plan',
        company_id: companyId,
        status: 'running',
        trigger_event: { type: 'USER_GOAL', goal, workspaceId },
      })
      .select()
      .single()

    if (!execution) throw new Error('Failed to create workflow execution')

    // Create task executions for each step
    const tasks = plan.map(step => ({
      workflow_execution_id: execution.id,
      task_def_id: step.id,
      agent_id: step.agentId,
      action: 'execute_goal',
      status: step.dependsOn.length === 0 ? 'pending' : 'blocked',
      input: { goal: step.goal, workspaceId },
    }))

    await this.db.from('task_executions').insert(tasks)

    // Dispatch ready tasks
    const readyTasks = await this.workflowEngine.getReadyTasks(execution.id)
    for (const task of readyTasks) {
      await this.workflowEngine.updateTaskStatus(task.id, 'running')
      await this.agentQueue.add('execute-task', {
        taskExecutionId: task.id,
        workflowExecutionId: execution.id,
        agentId: task.agentId,
        action: task.action,
        input: task.input,
      })
    }

    this.logger.log(`Launched workflow execution ${execution.id} with ${readyTasks.length} initial tasks`)
    return execution.id
  }

  async getExecutionStatus(workflowExecutionId: string) {
    const { data: execution } = await this.db
      .from('workflow_executions')
      .select('*')
      .eq('id', workflowExecutionId)
      .single()

    const { data: tasks } = await this.db
      .from('task_executions')
      .select('*')
      .eq('workflow_execution_id', workflowExecutionId)
      .order('created_at')

    const { data: steps } = await this.db
      .from('task_execution_steps')
      .select('*')
      .in('task_execution_id', (tasks || []).map(t => t.id))
      .order('created_at')

    return { execution, tasks, steps }
  }

  async approveTask(taskExecutionId: string, workflowExecutionId: string) {
    await this.workflowEngine.updateTaskStatus(taskExecutionId, 'running')
    await this.agentQueue.add('execute-task', {
      taskExecutionId,
      workflowExecutionId,
      agentId: '', // will be loaded from task record
      action: 'resume_after_approval',
      input: {},
    })
  }
}
```

**Step 2: Create planner.module.ts**

```typescript
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { PlannerService } from './planner.service'
import { ToolsModule } from '../tools/tools.module'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'agent-tasks' }),
    ToolsModule,
  ],
  providers: [PlannerService],
  exports: [PlannerService],
})
export class PlannerModule {}
```

**Step 3: Add PlannerModule to AppModule**

**Step 4: Commit**

```bash
git add apps/api/src/planner/ apps/api/src/app.module.ts
git commit -m "feat: add PlannerService — LLM-powered goal decomposition into workflow steps"
```

---

## Task 10: Agents API — Plan + Execute + Status

**Files:**
- Create: `apps/api/src/agents/agents.controller.ts`
- Create: `apps/api/src/agents/agents.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create agents.controller.ts**

```typescript
import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common'
import { PlannerService } from '../planner/planner.service'

@Controller('agents')
export class AgentsController {
  constructor(private readonly planner: PlannerService) {}

  @Post('plan')
  async createPlan(@Body() body: { goal: string; workspaceId: string; companyId: string }) {
    return this.planner.plan(body.goal, body.workspaceId, body.companyId)
  }

  @Post('execute')
  async executePlan(@Body() body: {
    plan: { id: string; agentId: string; goal: string; dependsOn: string[] }[]
    workspaceId: string
    companyId: string
    goal: string
  }) {
    const executionId = await this.planner.executePlan(body.plan, body.workspaceId, body.companyId, body.goal)
    return { workflowExecutionId: executionId }
  }

  @Get('execution/:id')
  async getStatus(@Param('id') id: string) {
    return this.planner.getExecutionStatus(id)
  }

  @Post('execution/:id/approve/:taskId')
  async approveTask(
    @Param('id') executionId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.planner.approveTask(taskId, executionId)
    return { status: 'approved' }
  }
}
```

**Step 2: Create agents.module.ts**

```typescript
import { Module } from '@nestjs/common'
import { AgentsController } from './agents.controller'
import { PlannerModule } from '../planner/planner.module'

@Module({
  imports: [PlannerModule],
  controllers: [AgentsController],
})
export class AgentsModule {}
```

**Step 3: Add to AppModule**

**Step 4: Commit**

```bash
git add apps/api/src/agents/ apps/api/src/app.module.ts
git commit -m "feat: add Agents API — plan, execute, status, approve endpoints"
```

---

## Task 11: Lead Discovery Agent

**Files:**
- Create: `apps/workers/src/agents/lead-discovery/lead-discovery-agent.ts`

**Step 1: Create the agent**

```typescript
import { BaseAgent } from '@agent-all/agent-sdk'
import { AgentDefinition, AgentResult, AgentContext, AgentEvent, TaskExecution, ActionLog } from '@agent-all/types'
import { getSupabaseServiceClient } from '@agent-all/database'

export class LeadDiscoveryAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'lead-discovery',
    name: 'Lead Discovery Agent',
    description: 'Recherche de prospects correspondant a un ICP via scraping et enrichissement',
    capabilities: ['define_icp', 'search_companies', 'enrich_contacts', 'structure_leads'],
    allowedActions: ['search_companies', 'enrich_contacts', 'create_leads'],
    autonomyLevel: 3,
    tools: ['apify', 'google-search'],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'MANUAL_TRIGGER' && event.payload?.agentId === 'lead-discovery'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const db = getSupabaseServiceClient()
    const goal = task.input?.goal || ''
    const workspaceId = task.input?.workspaceId || ''
    const actions: ActionLog[] = []

    try {
      // Step 1: Use LLM to define search parameters from the goal
      const searchParams = await context.llm.generateStructured<{
        query: string
        location: string
        maxResults: number
        actorId: string
      }>(
        `Tu es un expert en lead generation. A partir de cet objectif, definis les parametres de recherche Apify.

Objectif: ${goal}

Reponds en JSON avec:
- query: la requete de recherche Google Maps
- location: le pays/la region
- maxResults: nombre de resultats (max 100)
- actorId: l'actor Apify a utiliser. Utilise "apify/google-maps-scraper" pour des commerces locaux, "apify/google-search-scraper" pour des entreprises en ligne.`,
        {
          type: 'object',
          properties: {
            query: { type: 'string' },
            location: { type: 'string' },
            maxResults: { type: 'number' },
            actorId: { type: 'string' },
          },
        },
      )

      // Step 2: Run Apify scraper
      const apifyTool = context.tools?.resolve('apify')
      if (!apifyTool) return this.makeFailure('Apify tool not available')

      const apifyCreds = await context.credentials?.get('apify')
      if (!apifyCreds) return this.makeFailure('Apify not connected — please add your API key')

      const logStep = async (toolId: string, actionId: string, input: any, output: any, status: string, durationMs: number) => {
        await db.from('task_execution_steps').insert({
          task_execution_id: task.id,
          step_number: actions.length + 1,
          agent_id: this.id,
          tool_id: toolId,
          action_id: actionId,
          input,
          output: output?.data || output,
          status,
          duration_ms: durationMs,
        })
      }

      const start1 = Date.now()
      const scrapeResult = await apifyTool.execute('run_actor', {
        actorId: searchParams.actorId,
        input: {
          searchStringsArray: [searchParams.query],
          locationQuery: searchParams.location,
          maxCrawledPlacesPerSearch: searchParams.maxResults,
        },
      }, apifyCreds)
      await logStep('apify', 'run_actor', { query: searchParams.query }, scrapeResult, scrapeResult.success ? 'success' : 'error', Date.now() - start1)

      if (!scrapeResult.success) return this.makeFailure(`Apify scraping failed: ${scrapeResult.error}`)

      actions.push({
        action: 'search_companies',
        input: { query: searchParams.query, actorId: searchParams.actorId },
        output: { count: scrapeResult.data.count },
        timestamp: new Date(),
      })

      // Step 3: Structure leads and insert into CRM
      const items = scrapeResult.data.items || []
      const leads = items.map((item: any) => ({
        workspace_id: workspaceId,
        name: item.title || item.name || 'Unknown',
        contact_name: item.contactName || null,
        email: item.email || item.emailAddress || null,
        phone: item.phone || item.phoneNumber || null,
        website: item.website || item.url || null,
        source: 'apify',
        source_detail: { actorId: searchParams.actorId, query: searchParams.query },
        score: item.email ? 70 : 40,
        status: 'new',
        tags: [searchParams.query.split(' ')[0]?.toLowerCase()].filter(Boolean),
        raw_data: item,
      }))

      const { data: insertedLeads, error } = await db
        .from('leads')
        .insert(leads)
        .select('id')

      if (error) return this.makeFailure(`Failed to insert leads: ${error.message}`)

      actions.push({
        action: 'create_leads',
        input: { count: leads.length },
        output: { inserted: insertedLeads?.length || 0 },
        timestamp: new Date(),
      })

      const withEmail = leads.filter((l: any) => l.email).length

      return this.makeResult(
        {
          leadsCount: insertedLeads?.length || 0,
          withEmail,
          summary: `${insertedLeads?.length} leads trouves, ${withEmail} avec email`,
        },
        0.85,
        actions,
      )
    } catch (err: any) {
      return this.makeFailure(`Lead discovery failed: ${err.message}`)
    }
  }
}
```

**Step 2: Register in workers**

In `apps/workers/src/index.ts` (or wherever agents are registered), add:
```typescript
import { LeadDiscoveryAgent } from './agents/lead-discovery/lead-discovery-agent'
agentRegistry.register(new LeadDiscoveryAgent())
```

**Step 3: Commit**

```bash
git add apps/workers/src/agents/lead-discovery/
git commit -m "feat: add Lead Discovery Agent — Apify scraping + CRM insertion"
```

---

## Task 12: Outreach Agent

**Files:**
- Create: `apps/workers/src/agents/outreach/outreach-agent.ts`

**Step 1: Create the agent**

```typescript
import { BaseAgent } from '@agent-all/agent-sdk'
import { AgentDefinition, AgentResult, AgentContext, AgentEvent, TaskExecution, ActionLog } from '@agent-all/types'
import { getSupabaseServiceClient } from '@agent-all/database'

export class OutreachAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'outreach',
    name: 'Outreach Agent',
    description: 'Envoi d\'emails personnalises et suivi des reponses',
    capabilities: ['generate_sequence', 'send_email', 'read_replies', 'classify_reply'],
    allowedActions: ['send_email', 'read_replies', 'update_lead_status'],
    autonomyLevel: 2,
    tools: ['gmail'],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'MANUAL_TRIGGER' && event.payload?.agentId === 'outreach'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const db = getSupabaseServiceClient()
    const goal = task.input?.goal || ''
    const workspaceId = task.input?.workspaceId || ''
    const actions: ActionLog[] = []

    const gmailTool = context.tools?.resolve('gmail')
    if (!gmailTool) return this.makeFailure('Gmail tool not available')

    const gmailCreds = await context.credentials?.get('gmail')
    if (!gmailCreds) return this.makeFailure('Gmail not connected — please connect via OAuth')

    try {
      // Load leads to contact
      const { data: leads } = await db
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'new')
        .not('email', 'is', null)
        .limit(50)

      if (!leads?.length) return this.makeFailure('No leads with email found')

      // Load workspace context for personalization
      const { data: workspace } = await db
        .from('workspaces')
        .select('name, metadata')
        .eq('id', workspaceId)
        .single()

      const wording = workspace?.metadata?.actions?.wording?.structured
      const identity = workspace?.metadata?.actions?.identity?.structured

      // Generate email template via LLM
      const template = await context.llm.generateStructured<{
        subject: string
        bodyTemplate: string
      }>(
        `Tu es un expert en cold emailing. Genere un email de validation d'idee.

Objectif: ${goal}
Nom du projet: ${workspace?.name || 'Mon projet'}
${wording ? `Ton de voix: ${wording.personality?.toneOfVoice || ''}` : ''}
${wording ? `Pitch: ${wording.pitches?.thirtySeconds || ''}` : ''}

L'email doit :
- Etre court (5-7 lignes max)
- Poser une question ouverte
- Ne pas vendre, juste valider un besoin
- Etre personnalise avec {{name}} et {{company}}

Reponds en JSON: { "subject": "...", "bodyTemplate": "..." }`,
        {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            bodyTemplate: { type: 'string' },
          },
        },
      )

      // Request approval before sending (autonomy level 2)
      const guardCheck = await this.checkAction('send_external_email_first_time', context)
      if (!guardCheck.allowed) {
        // Store preview for approval
        await db
          .from('task_executions')
          .update({
            status: 'awaiting_approval',
            approval_data: {
              reason: 'Validation requise avant envoi du premier email',
              preview: {
                subject: template.subject,
                body: template.bodyTemplate.replace('{{name}}', leads[0].contact_name || leads[0].name).replace('{{company}}', leads[0].name),
                to: leads[0].email,
                totalLeads: leads.length,
              },
            },
          })
          .eq('id', task.id)

        return this.makeResult(
          { status: 'awaiting_approval', templatePreview: template, leadsCount: leads.length },
          0.9,
          actions,
          true,
        )
      }

      // Send emails
      let sent = 0
      for (const lead of leads) {
        const body = template.bodyTemplate
          .replace(/\{\{name\}\}/g, lead.contact_name || lead.name || '')
          .replace(/\{\{company\}\}/g, lead.name || '')

        const start = Date.now()
        const result = await gmailTool.execute('send_email', {
          to: lead.email,
          subject: template.subject,
          body,
        }, gmailCreds)

        // Log step
        await db.from('task_execution_steps').insert({
          task_execution_id: task.id,
          step_number: sent + 1,
          agent_id: this.id,
          tool_id: 'gmail',
          action_id: 'send_email',
          input: { to: lead.email, subject: template.subject },
          output: result.data,
          status: result.success ? 'success' : 'error',
          duration_ms: Date.now() - start,
        })

        if (result.success) {
          sent++
          // Create interaction
          await db.from('interactions').insert({
            lead_id: lead.id,
            workspace_id: workspaceId,
            type: 'email_sent',
            direction: 'outbound',
            subject: template.subject,
            content: body,
            external_id: result.data.messageId,
            thread_id: result.data.threadId,
          })
          // Update lead status
          await db.from('leads').update({ status: 'contacted', updated_at: new Date().toISOString() }).eq('id', lead.id)
        }
      }

      actions.push({
        action: 'send_email',
        input: { totalLeads: leads.length },
        output: { sent, failed: leads.length - sent },
        timestamp: new Date(),
      })

      return this.makeResult(
        { emailsSent: sent, totalLeads: leads.length, subject: template.subject },
        0.9,
        actions,
      )
    } catch (err: any) {
      return this.makeFailure(`Outreach failed: ${err.message}`)
    }
  }
}
```

**Step 2: Register in workers**

**Step 3: Commit**

```bash
git add apps/workers/src/agents/outreach/
git commit -m "feat: add Outreach Agent — email generation, approval flow, send via Gmail"
```

---

## Task 13: Analysis Agent

**Files:**
- Create: `apps/workers/src/agents/analysis/analysis-agent.ts`

**Step 1: Create the agent**

```typescript
import { BaseAgent } from '@agent-all/agent-sdk'
import { AgentDefinition, AgentResult, AgentContext, AgentEvent, TaskExecution, ActionLog } from '@agent-all/types'
import { getSupabaseServiceClient } from '@agent-all/database'

export class AnalysisAgent extends BaseAgent {
  readonly definition: AgentDefinition = {
    id: 'analysis',
    name: 'Analysis Agent',
    description: 'Analyse les retours et produit un rapport de validation marche',
    capabilities: ['classify_responses', 'identify_objections', 'synthesize_feedback', 'produce_report'],
    allowedActions: ['classify_responses', 'produce_report'],
    autonomyLevel: 3,
    tools: [],
  }

  canHandle(event: AgentEvent): boolean {
    return event.type === 'MANUAL_TRIGGER' && event.payload?.agentId === 'analysis'
  }

  async execute(task: TaskExecution, context: AgentContext): Promise<AgentResult> {
    const db = getSupabaseServiceClient()
    const workspaceId = task.input?.workspaceId || ''
    const actions: ActionLog[] = []

    try {
      // Load all interactions for this workspace
      const { data: interactions } = await db
        .from('interactions')
        .select('*, leads!inner(name, email, score)')
        .eq('workspace_id', workspaceId)

      const { data: leads } = await db
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)

      const totalLeads = leads?.length || 0
      const contacted = leads?.filter(l => l.status !== 'new').length || 0
      const replies = interactions?.filter(i => i.type === 'email_reply') || []
      const sent = interactions?.filter(i => i.type === 'email_sent') || []

      // Classify each reply with LLM
      for (const reply of replies) {
        if (reply.classification) continue // already classified

        const classification = await context.llm.generateStructured<{
          classification: string
          sentiment: number
          objections: string[]
          summary: string
        }>(
          `Classe cette reponse a un email de prospection.

Email envoye: ${sent.find(s => s.thread_id === reply.thread_id)?.content || 'N/A'}
Reponse recue: ${reply.content}

Reponds en JSON:
- classification: "positive" | "negative" | "objection" | "question" | "no_response"
- sentiment: -1 a 1
- objections: liste des objections identifiees
- summary: resume en une phrase`,
          {
            type: 'object',
            properties: {
              classification: { type: 'string' },
              sentiment: { type: 'number' },
              objections: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
            },
          },
        )

        await db.from('interactions').update({
          classification: classification.classification,
          sentiment_score: classification.sentiment,
          objections: classification.objections,
          metadata: { ...reply.metadata, summary: classification.summary },
        }).eq('id', reply.id)

        // Update lead status based on classification
        const newStatus = classification.classification === 'positive' ? 'interested'
          : classification.classification === 'negative' ? 'not_interested'
          : 'replied'
        await db.from('leads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', reply.lead_id)
      }

      actions.push({
        action: 'classify_responses',
        input: { replyCount: replies.length },
        output: { classified: replies.length },
        timestamp: new Date(),
      })

      // Generate validation report
      const responseRate = contacted > 0 ? (replies.length / contacted * 100).toFixed(1) : '0'
      const positive = replies.filter(r => r.classification === 'positive' || replies.find(rep => rep.id === r.id)).length
      const allObjections = replies.flatMap(r => r.objections || [])

      const report = await context.llm.generateStructured<{
        summary: string
        verdict: string
        responseRate: string
        interested: number
        topObjections: string[]
        recommendation: string
        nextSteps: string[]
      }>(
        `Genere un rapport de validation marche basé sur ces données:

- ${totalLeads} leads identifies
- ${contacted} contactes par email
- ${replies.length} reponses recues (${responseRate}% taux de reponse)
- ${positive} reponses positives
- Objections: ${allObjections.join(', ') || 'aucune'}

Reponds en JSON avec: summary, verdict (valide/a_approfondir/invalide), responseRate, interested, topObjections, recommendation, nextSteps`,
        {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            verdict: { type: 'string' },
            responseRate: { type: 'string' },
            interested: { type: 'number' },
            topObjections: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
            nextSteps: { type: 'array', items: { type: 'string' } },
          },
        },
      )

      // Store report in workspace metadata
      const { data: ws } = await db.from('workspaces').select('metadata').eq('id', workspaceId).single()
      const metadata = ws?.metadata || {}
      metadata.agentReports = { ...metadata.agentReports, validation: report }
      await db.from('workspaces').update({ metadata }).eq('id', workspaceId)

      actions.push({
        action: 'produce_report',
        input: {},
        output: report,
        timestamp: new Date(),
      })

      return this.makeResult(report, 0.85, actions)
    } catch (err: any) {
      return this.makeFailure(`Analysis failed: ${err.message}`)
    }
  }
}
```

**Step 2: Register in workers**

**Step 3: Commit**

```bash
git add apps/workers/src/agents/analysis/
git commit -m "feat: add Analysis Agent — classify replies, produce validation report"
```

---

## Task 14: Register New Agents in Workers

**Files:**
- Modify: `apps/workers/src/index.ts`

**Step 1: Import and register the 3 new agents**

Add these imports and registrations alongside the existing email/document/accounting agents:

```typescript
import { LeadDiscoveryAgent } from './agents/lead-discovery/lead-discovery-agent'
import { OutreachAgent } from './agents/outreach/outreach-agent'
import { AnalysisAgent } from './agents/analysis/analysis-agent'

// After existing agent registrations:
agentRegistry.register(new LeadDiscoveryAgent())
agentRegistry.register(new OutreachAgent())
agentRegistry.register(new AnalysisAgent())
```

Also inject the `ToolRegistry` into the `TaskProcessor`:

```typescript
import { ToolRegistry, GmailTool, ApifyTool, GoogleSearchTool, SheetsTool, DriveTool } from '@agent-all/tool-registry'

const toolRegistry = new ToolRegistry(db)
toolRegistry.register(new GmailTool())
toolRegistry.register(new ApifyTool())
toolRegistry.register(new GoogleSearchTool())
toolRegistry.register(new SheetsTool())
toolRegistry.register(new DriveTool())

const processor = new TaskProcessor(agentRegistry, toolRegistry, redisConnection)
```

**Step 2: Commit**

```bash
git add apps/workers/src/index.ts
git commit -m "feat: register lead-discovery, outreach, analysis agents + tool registry in workers"
```

---

## Task 15: Frontend — Connectors Page

**Files:**
- Modify: `apps/web/src/app/dashboard/connectors/page.tsx`

**Step 1: Rewrite the connectors page with tool cards**

This page shows all available tools with their connection status. OAuth tools get a "Connecter" button that opens the Google OAuth flow. API key tools get an input field.

Build the page with:
- Fetch tools status from `GET /tools/status/:companyId`
- Each tool as a card with icon, name, description, status badge
- "Connecter" button → opens `GET /tools/:toolId/auth-url?companyId=...` URL
- For API key tools: input field + save button → `POST /tools/:toolId/api-key`
- Connected tools show green badge + account info + "Deconnecter" button

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/connectors/page.tsx
git commit -m "feat: connectors page — tool cards with OAuth flow and API key input"
```

---

## Task 16: Frontend — Agent Execution Page

**Files:**
- Create: `apps/web/src/app/dashboard/workspace/[id]/agents/page.tsx`

**Step 1: Create the agents page**

This is the main agent execution interface with:
- Goal input field (text area)
- "Generer un plan" button → calls `POST /agents/plan`
- Plan display: step cards showing agent, goal, dependencies, status
- "Lancer" button → calls `POST /agents/execute`
- Real-time execution status via polling `GET /agents/execution/:id` every 3 seconds
- Execution log: list of `task_execution_steps` showing tool, action, result, duration
- Approval prompts: when a task is `awaiting_approval`, show the preview and approve/reject buttons

Design: same premium card style as the validation pages (gradient top bars, rounded icons, hover shadows).

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/[id]/agents/page.tsx
git commit -m "feat: agent execution page — plan, launch, real-time status, approval flow"
```

---

## Task 17: Frontend — CRM Leads Page Enhancement

**Files:**
- Modify: `apps/web/src/app/dashboard/workspace/[id]/contacts/page.tsx`

**Step 1: Enhance the contacts page**

Add:
- Leads table fetched from `leads` table (not just static data)
- Filters: status dropdown, score range, source, has email
- Each lead row: name, email, score badge, status badge, source, tags
- Click to expand: show interactions timeline (emails sent, replies, classification)
- Bulk actions: "Exporter vers Sheets" button
- Real-time: leads appear as agents discover them

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/[id]/contacts/page.tsx
git commit -m "feat: CRM leads page — filters, interaction timeline, export to Sheets"
```

---

## Task 18: Add Agents Link to Sidebar

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar.tsx`

**Step 1: Add "Agents" navigation item**

Add a new nav item pointing to `/dashboard/workspace/[id]/agents` with a `Bot` icon from Lucide. Place it after the existing navigation items.

**Step 2: Commit**

```bash
git add apps/web/src/components/dashboard/sidebar.tsx
git commit -m "feat: add Agents link to sidebar navigation"
```

---

## Task 19: Docker + Environment Variables

**Files:**
- Modify: `docker/docker-compose.prod.yml`

**Step 1: Add environment variables**

Add to the API and workers services:
```yaml
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI: https://agent-all.ialla.fr/api/tools/callback
GOOGLE_SEARCH_API_KEY: ${GOOGLE_SEARCH_API_KEY}
GOOGLE_SEARCH_CX: ${GOOGLE_SEARCH_CX}
```

**Step 2: Commit**

```bash
git add docker/docker-compose.prod.yml
git commit -m "feat: add Google OAuth + Search env vars to docker-compose"
```

---

## Task 20: Build and Deploy

**Step 1: Install all dependencies**

```bash
cd /opt/agent-more && npm install
```

**Step 2: Build all packages**

```bash
npm run build
```

**Step 3: Deploy**

```bash
cd docker && docker compose -f docker-compose.prod.yml up -d --build
```

**Step 4: Run migration 003 on Supabase**

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: agent system V1 — complete build and deploy"
```
