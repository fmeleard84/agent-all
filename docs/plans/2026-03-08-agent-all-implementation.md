# Agent All — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP of Agent All — an AI Company Operating System that orchestrates expert agents (email, document, accounting) to automate business operations for multi-tenant companies.

**Architecture:** Monorepo with npm workspaces. NestJS (Fastify) backend orchestrates workflows via BullMQ+Redis. Agents are NestJS modules consuming jobs from the queue. Next.js 14 frontend with shadcn/ui dashboard. Supabase for DB, auth, storage, and event sourcing.

**Tech Stack:** TypeScript, Next.js 14, NestJS, Fastify, BullMQ, Redis, Supabase (Postgres + Auth + Storage), Tailwind CSS, shadcn/ui, Claude API, OpenAI API

---

## Phase 1: Monorepo Scaffolding & Shared Packages

### Task 1: Initialize monorepo root

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "agent-all",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

**Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
.turbo
coverage/
```

**Step 4: Create .nvmrc**

```
20
```

**Step 5: Run npm install and verify workspaces**

Run: `npm install`
Expected: Clean install with empty workspaces warning (no packages yet)

**Step 6: Commit**

```bash
git add package.json tsconfig.base.json .gitignore .nvmrc
git commit -m "chore: initialize monorepo with npm workspaces"
```

---

### Task 2: Create packages/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/events.ts`
- Create: `packages/types/src/agents.ts`
- Create: `packages/types/src/workflows.ts`
- Create: `packages/types/src/entities.ts`
- Create: `packages/types/src/memory.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/types",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create src/events.ts**

```typescript
export type EventType =
  | 'EMAIL_RECEIVED'
  | 'DOCUMENT_UPLOADED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'MANUAL_TRIGGER'

export interface AgentEvent {
  id: string
  type: EventType
  companyId: string
  payload: Record<string, any>
  source: 'email' | 'upload' | 'api' | 'webhook' | 'manual'
  timestamp: Date
}

export interface EventHandler {
  (event: AgentEvent): Promise<void>
}
```

**Step 4: Create src/workflows.ts**

```typescript
export type TaskStatus = 'pending' | 'blocked' | 'running' | 'completed' | 'failed' | 'retrying'
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface TaskInputRef {
  fromTask: string
  field: string
}

export interface RetryPolicy {
  maxRetries: number
  backoff: 'exponential' | 'linear'
}

export interface TaskDefinition {
  id: string
  agentId: string
  action: string
  dependsOn?: string[]
  input?: Record<string, any> | TaskInputRef
  retryPolicy?: RetryPolicy
  timeout?: number
}

export interface WorkflowDefinition {
  id: string
  name: string
  trigger: string
  companyId?: string
  tasks: TaskDefinition[]
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  companyId: string
  status: WorkflowStatus
  triggerEvent: Record<string, any>
  startedAt: Date
  completedAt?: Date
}

export interface TaskExecution {
  id: string
  workflowExecutionId: string
  taskDefId: string
  agentId: string
  action: string
  status: TaskStatus
  input?: Record<string, any>
  output?: Record<string, any>
  confidence?: number
  attempts: number
  startedAt?: Date
  completedAt?: Date
}
```

**Step 5: Create src/agents.ts**

```typescript
import type { AgentEvent, EventType } from './events'
import type { TaskExecution } from './workflows'
import type { PlatformMemory, CompanyMemory, AgentMemoryData } from './memory'

export type AutonomyLevel = 1 | 2 | 3 | 4

export interface AgentDefinition {
  id: string
  name: string
  description: string
  capabilities: string[]
  allowedActions: string[]
  autonomyLevel: AutonomyLevel
  tools: string[]
}

export interface AgentResult {
  status: 'success' | 'failure'
  output: Record<string, any>
  confidence: number
  requiresHumanReview: boolean
  actions: ActionLog[]
}

export interface ActionLog {
  action: string
  input: Record<string, any>
  output: Record<string, any>
  timestamp: Date
}

export interface AgentContext {
  llm: LLMProvider
  memory: {
    platform: PlatformMemory
    company: CompanyMemory
    agent: AgentMemoryData
  }
  company: CompanyInfo
}

export interface LLMProvider {
  generate(prompt: string, options?: LLMOptions): Promise<string>
  generateStructured<T>(prompt: string, schema: Record<string, any>, options?: LLMOptions): Promise<T>
}

export interface LLMOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  provider?: 'anthropic' | 'openai'
}

export interface CompanyInfo {
  id: string
  name: string
  settings: Record<string, any>
}
```

**Step 6: Create src/entities.ts**

```typescript
export interface Company {
  id: string
  name: string
  settings: Record<string, any>
  createdAt: Date
}

export interface CompanyUser {
  id: string
  companyId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  invitedBy?: string
  createdAt: Date
}

export interface CompanyAgent {
  id: string
  companyId: string
  agentId: string
  autonomyLevel: 1 | 2 | 3 | 4
  config: Record<string, any>
  enabled: boolean
  createdAt: Date
}

export type DocumentType = 'invoice' | 'quote' | 'contract' | 'bank_statement' | 'other'
export type EmailCategory = 'invoice' | 'prospect' | 'support' | 'info' | 'spam'
export type PaymentStatus = 'pending' | 'paid' | 'overdue'

export interface Document {
  id: string
  companyId: string
  type: DocumentType
  originalName: string
  storagePath: string
  extractedData: Record<string, any>
  source: 'email' | 'upload' | 'api'
  createdAt: Date
}

export interface Email {
  id: string
  companyId: string
  fromAddress: string
  subject: string
  category?: EmailCategory
  rawContent: string
  attachments: Record<string, any>[]
  processed: boolean
  createdAt: Date
}

export interface AccountingEntry {
  id: string
  companyId: string
  documentId?: string
  category: string
  amount: number
  currency: string
  dueDate?: Date
  paymentStatus: PaymentStatus
  metadata: Record<string, any>
  createdAt: Date
}

export interface AuditLogEntry {
  id: string
  companyId: string
  workflowExecutionId?: string
  taskExecutionId?: string
  agentId: string
  action: string
  result: string
  confidence?: number
  humanOverride: boolean
  metadata: Record<string, any>
  createdAt: Date
}
```

**Step 7: Create src/memory.ts**

```typescript
import type { DocumentType } from './entities'
import type { WorkflowDefinition } from './workflows'

export interface PlatformMemory {
  documentTaxonomy: DocumentType[]
  defaultWorkflows: WorkflowDefinition[]
  globalRules: Rule[]
}

export interface CompanyMemory {
  id: string
  companyId: string
  preferences: Record<string, any>
  connectedServices: ConnectedService[]
  internalRules: CompanyRule[]
  customCategories: string[]
}

export interface AgentMemoryData {
  id: string
  agentId: string
  companyId: string
  decisions: Decision[]
  corrections: HumanCorrection[]
  stats: AgentStats
}

export interface Rule {
  id: string
  condition: string
  action: string
}

export interface CompanyRule {
  id: string
  type: 'approval_threshold' | 'blocked_action' | 'rate_limit' | 'custom'
  config: Record<string, any>
}

export interface ConnectedService {
  type: 'gmail' | 'storage' | 'accounting' | 'crm'
  config: Record<string, any>
  enabled: boolean
}

export interface Decision {
  taskId: string
  action: string
  output: Record<string, any>
  confidence: number
  timestamp: Date
}

export interface HumanCorrection {
  taskId: string
  originalOutput: Record<string, any>
  correctedOutput: Record<string, any>
  timestamp: Date
}

export interface AgentStats {
  totalTasks: number
  successRate: number
  avgConfidence: number
  avgDurationMs: number
}
```

**Step 8: Create src/index.ts**

```typescript
export * from './events'
export * from './workflows'
export * from './agents'
export * from './entities'
export * from './memory'
```

**Step 9: Install typescript and build**

Run: `cd packages/types && npx tsc --init --declaration --outDir dist --rootDir src --strict && npm run build`
Expected: Clean compilation, dist/ folder generated

**Step 10: Commit**

```bash
git add packages/types/
git commit -m "feat: add shared types package (events, workflows, agents, entities, memory)"
```

---

### Task 3: Create packages/database (Supabase client + migrations)

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/src/index.ts`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/migrations/001_initial_schema.sql`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/database",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "migrate": "supabase db push --project-ref yojesskmdehepeqkdelp"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "@agent-all/types": "*"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create src/client.ts**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
    client = createClient(url, key)
  }
  return client
}

export function getSupabaseServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    serviceClient = createClient(url, key)
  }
  return serviceClient
}
```

**Step 4: Create src/index.ts**

```typescript
export { getSupabaseClient, getSupabaseServiceClient } from './client'
```

**Step 5: Create migrations/001_initial_schema.sql**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company users (links to Supabase Auth)
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Company agents
CREATE TABLE company_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  autonomy_level INT NOT NULL DEFAULT 1 CHECK (autonomy_level BETWEEN 1 AND 4),
  config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, agent_id)
);

-- Workflows
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL,
  definition JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  trigger_event JSONB NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Task executions
CREATE TABLE task_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  task_def_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'blocked', 'running', 'completed', 'failed', 'retrying')),
  input JSONB,
  output JSONB,
  confidence FLOAT,
  attempts INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  workflow_execution_id UUID REFERENCES workflow_executions(id),
  task_execution_id UUID REFERENCES task_executions(id),
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  confidence FLOAT,
  human_override BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company memory
CREATE TABLE company_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  preferences JSONB DEFAULT '{}',
  connected_services JSONB DEFAULT '[]',
  internal_rules JSONB DEFAULT '[]',
  custom_categories JSONB DEFAULT '[]'
);

-- Agent memory per company
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  decisions JSONB DEFAULT '[]',
  corrections JSONB DEFAULT '[]',
  stats JSONB DEFAULT '{"totalTasks":0,"successRate":0,"avgConfidence":0,"avgDurationMs":0}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, company_id)
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  type TEXT NOT NULL CHECK (type IN ('invoice', 'quote', 'contract', 'bank_statement', 'other')),
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_data JSONB DEFAULT '{}',
  source TEXT NOT NULL CHECK (source IN ('email', 'upload', 'api')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  from_address TEXT NOT NULL,
  subject TEXT,
  category TEXT CHECK (category IN ('invoice', 'prospect', 'support', 'info', 'spam')),
  raw_content TEXT,
  attachments JSONB DEFAULT '[]',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting entries
CREATE TABLE accounting_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  document_id UUID REFERENCES documents(id),
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  due_date DATE,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_company_users_company ON company_users(company_id);
CREATE INDEX idx_company_users_user ON company_users(user_id);
CREATE INDEX idx_company_agents_company ON company_agents(company_id);
CREATE INDEX idx_workflow_executions_company ON workflow_executions(company_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_task_executions_workflow ON task_executions(workflow_execution_id);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_audit_log_company ON audit_log(company_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_documents_company ON documents(company_id);
CREATE INDEX idx_emails_company ON emails(company_id);
CREATE INDEX idx_accounting_entries_company ON accounting_entries(company_id);

-- RLS policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

-- RLS: users see only their company data
CREATE POLICY "Users see own company" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own company_users" ON company_users
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own company_agents" ON company_agents
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own workflows" ON workflows
  FOR SELECT USING (
    company_id IS NULL OR company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own workflow_executions" ON workflow_executions
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own task_executions" ON task_executions
  FOR SELECT USING (
    workflow_execution_id IN (
      SELECT id FROM workflow_executions WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users see own audit_log" ON audit_log
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own company_memory" ON company_memory
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own agent_memory" ON agent_memory
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own documents" ON documents
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own emails" ON emails
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users see own accounting_entries" ON accounting_entries
  FOR ALL USING (
    company_id IN (SELECT company_id FROM company_users WHERE user_id = auth.uid())
  );
```

**Step 6: Apply migration to Supabase**

Run: `export SUPABASE_ACCESS_TOKEN="sbp_1260385f4c6b1b3b3e9ccb789d176777e22e1765" && supabase db push --project-ref yojesskmdehepeqkdelp`
Expected: Migration applied successfully

**Step 7: Commit**

```bash
git add packages/database/
git commit -m "feat: add database package with Supabase client and initial schema migration"
```

---

### Task 4: Create packages/llm (multi-provider abstraction)

**Files:**
- Create: `packages/llm/package.json`
- Create: `packages/llm/tsconfig.json`
- Create: `packages/llm/src/index.ts`
- Create: `packages/llm/src/provider.ts`
- Create: `packages/llm/src/anthropic.ts`
- Create: `packages/llm/src/openai.ts`
- Create: `packages/llm/src/factory.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/llm",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "openai": "^4.73.0"
  },
  "devDependencies": {
    "@agent-all/types": "*"
  }
}
```

**Step 2: Create src/provider.ts**

```typescript
import type { LLMProvider, LLMOptions } from '@agent-all/types'

export abstract class BaseLLMProvider implements LLMProvider {
  abstract generate(prompt: string, options?: LLMOptions): Promise<string>
  abstract generateStructured<T>(prompt: string, schema: Record<string, any>, options?: LLMOptions): Promise<T>
}
```

**Step 3: Create src/anthropic.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { LLMOptions } from '@agent-all/types'
import { BaseLLMProvider } from './provider'

export class AnthropicProvider extends BaseLLMProvider {
  private client: Anthropic

  constructor(apiKey?: string) {
    super()
    this.client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY })
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: options?.model || 'claude-sonnet-4-20250514',
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type')
    return block.text
  }

  async generateStructured<T>(prompt: string, schema: Record<string, any>, options?: LLMOptions): Promise<T> {
    const fullPrompt = `${prompt}\n\nRespond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nReturn ONLY the JSON, no other text.`
    const text = await this.generate(fullPrompt, options)
    return JSON.parse(text) as T
  }
}
```

**Step 4: Create src/openai.ts**

```typescript
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
```

**Step 5: Create src/factory.ts**

```typescript
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
```

**Step 6: Create src/index.ts**

```typescript
export { BaseLLMProvider } from './provider'
export { AnthropicProvider } from './anthropic'
export { OpenAIProvider } from './openai'
export { getLLMProvider } from './factory'
export type { ProviderType } from './factory'
```

**Step 7: Build and verify**

Run: `npm run build --workspace=packages/llm`
Expected: Clean compilation

**Step 8: Commit**

```bash
git add packages/llm/
git commit -m "feat: add LLM package with Anthropic and OpenAI providers"
```

---

### Task 5: Create packages/agent-sdk

**Files:**
- Create: `packages/agent-sdk/package.json`
- Create: `packages/agent-sdk/tsconfig.json`
- Create: `packages/agent-sdk/src/index.ts`
- Create: `packages/agent-sdk/src/base-agent.ts`
- Create: `packages/agent-sdk/src/guardrails.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/agent-sdk",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "@agent-all/types": "*"
  }
}
```

**Step 2: Create src/base-agent.ts**

```typescript
import type {
  AgentDefinition,
  AgentResult,
  AgentContext,
  AgentEvent,
  ActionLog,
} from '@agent-all/types'
import type { TaskExecution } from '@agent-all/types'
import { checkGuardrails } from './guardrails'

export abstract class BaseAgent {
  abstract readonly definition: AgentDefinition

  get id(): string { return this.definition.id }
  get name(): string { return this.definition.name }
  get capabilities(): string[] { return this.definition.capabilities }
  get allowedActions(): string[] { return this.definition.allowedActions }

  abstract canHandle(event: AgentEvent): boolean

  abstract execute(task: TaskExecution, context: AgentContext): Promise<AgentResult>

  protected async checkAction(
    action: string,
    context: AgentContext,
    amount?: number,
    confidence?: number,
  ): Promise<{ allowed: boolean; reason?: string }> {
    return checkGuardrails(action, this.definition, context, amount, confidence)
  }

  protected makeResult(
    output: Record<string, any>,
    confidence: number,
    actions: ActionLog[],
    requiresHumanReview = false,
  ): AgentResult {
    return {
      status: 'success',
      output,
      confidence,
      requiresHumanReview,
      actions,
    }
  }

  protected makeFailure(error: string): AgentResult {
    return {
      status: 'failure',
      output: { error },
      confidence: 0,
      requiresHumanReview: true,
      actions: [],
    }
  }
}
```

**Step 3: Create src/guardrails.ts**

```typescript
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
  // Always require approval for critical actions
  if (ALWAYS_REQUIRE_APPROVAL.includes(action)) {
    return { allowed: false, reason: `Action "${action}" always requires human approval` }
  }

  // Check if action is in agent's allowed list
  if (!agent.allowedActions.includes(action)) {
    return { allowed: false, reason: `Action "${action}" not in agent's allowed actions` }
  }

  // Check company blocked actions
  const rules = context.memory.company.internalRules || []
  const blockedRule = rules.find(r => r.type === 'blocked_action' && r.config.action === action)
  if (blockedRule) {
    return { allowed: false, reason: `Action "${action}" blocked by company rules` }
  }

  // Check amount threshold
  if (amount !== undefined) {
    const thresholdRule = rules.find(r => r.type === 'approval_threshold')
    const threshold = thresholdRule?.config?.amount ?? 5000
    if (amount > threshold) {
      return { allowed: false, reason: `Amount ${amount} exceeds threshold ${threshold}` }
    }
  }

  // Check confidence threshold
  if (confidence !== undefined) {
    const confRule = rules.find(r => r.type === 'approval_threshold')
    const confThreshold = confRule?.config?.minConfidence ?? 0.7
    if (confidence < confThreshold) {
      return { allowed: false, reason: `Confidence ${confidence} below threshold ${confThreshold}` }
    }
  }

  // Check autonomy level
  // Level 1: never auto-execute
  if (agent.autonomyLevel === 1) {
    return { allowed: false, reason: 'Agent autonomy level 1 (suggest only)' }
  }

  return { allowed: true }
}
```

**Step 4: Create src/index.ts**

```typescript
export { BaseAgent } from './base-agent'
export { checkGuardrails } from './guardrails'
```

**Step 5: Build and verify**

Run: `npm run build --workspace=packages/agent-sdk`
Expected: Clean compilation

**Step 6: Commit**

```bash
git add packages/agent-sdk/
git commit -m "feat: add agent-sdk with BaseAgent class and guardrails"
```

---

### Task 6: Create packages/workflow-engine

**Files:**
- Create: `packages/workflow-engine/package.json`
- Create: `packages/workflow-engine/tsconfig.json`
- Create: `packages/workflow-engine/src/index.ts`
- Create: `packages/workflow-engine/src/workflow-registry.ts`
- Create: `packages/workflow-engine/src/dependency-resolver.ts`
- Create: `packages/workflow-engine/src/workflow-engine.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/workflow-engine",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "@agent-all/types": "*",
    "@agent-all/database": "*"
  }
}
```

**Step 2: Create src/workflow-registry.ts**

```typescript
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
```

**Step 3: Create src/dependency-resolver.ts**

```typescript
import type { TaskExecution, TaskStatus } from '@agent-all/types'

export class DependencyResolver {
  /**
   * Returns tasks that are ready to execute (all dependencies completed).
   */
  getReadyTasks(
    tasks: TaskExecution[],
    definitions: { id: string; dependsOn?: string[] }[],
  ): TaskExecution[] {
    const completedIds = new Set(
      tasks.filter(t => t.status === 'completed').map(t => t.taskDefId),
    )

    return tasks.filter(task => {
      if (task.status !== 'pending' && task.status !== 'blocked') return false

      const def = definitions.find(d => d.id === task.taskDefId)
      if (!def?.dependsOn?.length) return task.status === 'pending'

      return def.dependsOn.every(depId => completedIds.has(depId))
    })
  }

  /**
   * Checks if the entire workflow is complete (all tasks completed or failed).
   */
  isComplete(tasks: TaskExecution[]): boolean {
    return tasks.every(t => t.status === 'completed' || t.status === 'failed')
  }

  /**
   * Checks if the workflow has failed (any task failed with no retries left).
   */
  hasFailed(tasks: TaskExecution[]): boolean {
    return tasks.some(t => t.status === 'failed')
  }

  /**
   * Resolves input for a task, replacing TaskInputRef with actual output from completed tasks.
   */
  resolveInput(
    taskDef: { input?: Record<string, any> | { fromTask: string; field: string } },
    completedTasks: TaskExecution[],
  ): Record<string, any> {
    if (!taskDef.input) return {}

    const input = taskDef.input as any
    if (input.fromTask && input.field) {
      const sourceTask = completedTasks.find(t => t.taskDefId === input.fromTask)
      if (!sourceTask?.output) return {}
      return { [input.field]: sourceTask.output[input.field], ...sourceTask.output }
    }

    return taskDef.input as Record<string, any>
  }
}
```

**Step 4: Create src/workflow-engine.ts**

```typescript
import type {
  WorkflowDefinition,
  WorkflowExecution,
  TaskExecution,
  AgentEvent,
  TaskStatus,
  WorkflowStatus,
} from '@agent-all/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WorkflowRegistry } from './workflow-registry'
import { DependencyResolver } from './dependency-resolver'

export class WorkflowEngine {
  public readonly registry: WorkflowRegistry
  public readonly resolver: DependencyResolver

  constructor(private db: SupabaseClient) {
    this.registry = new WorkflowRegistry(db)
    this.resolver = new DependencyResolver()
  }

  async startWorkflow(event: AgentEvent): Promise<WorkflowExecution | null> {
    const definition = await this.registry.resolve(event.type, event.companyId)
    if (!definition) return null

    // Create workflow execution
    const { data: execution, error } = await this.db
      .from('workflow_executions')
      .insert({
        workflow_id: definition.id,
        company_id: event.companyId,
        status: 'running',
        trigger_event: event,
      })
      .select()
      .single()

    if (error || !execution) throw new Error(`Failed to create workflow execution: ${error?.message}`)

    // Create task executions
    const tasks = definition.tasks.map(taskDef => ({
      workflow_execution_id: execution.id,
      task_def_id: taskDef.id,
      agent_id: taskDef.agentId,
      action: taskDef.action,
      status: (taskDef.dependsOn?.length ? 'blocked' : 'pending') as TaskStatus,
      input: taskDef.input || {},
    }))

    await this.db.from('task_executions').insert(tasks)

    return execution as WorkflowExecution
  }

  async getReadyTasks(workflowExecutionId: string): Promise<TaskExecution[]> {
    const { data: tasks } = await this.db
      .from('task_executions')
      .select('*')
      .eq('workflow_execution_id', workflowExecutionId)

    if (!tasks) return []

    // Get workflow definition for dependency info
    const { data: execution } = await this.db
      .from('workflow_executions')
      .select('workflow_id')
      .eq('id', workflowExecutionId)
      .single()

    const { data: workflow } = await this.db
      .from('workflows')
      .select('definition')
      .eq('id', execution?.workflow_id)
      .single()

    const definition = workflow?.definition as WorkflowDefinition
    return this.resolver.getReadyTasks(
      tasks as TaskExecution[],
      definition.tasks,
    )
  }

  async completeTask(
    taskExecutionId: string,
    output: Record<string, any>,
    confidence: number,
  ): Promise<void> {
    await this.db
      .from('task_executions')
      .update({
        status: 'completed',
        output,
        confidence,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskExecutionId)

    // Check if workflow is complete
    const { data: task } = await this.db
      .from('task_executions')
      .select('workflow_execution_id')
      .eq('id', taskExecutionId)
      .single()

    if (task) {
      await this.checkWorkflowCompletion(task.workflow_execution_id)
    }
  }

  async failTask(taskExecutionId: string, error: string): Promise<void> {
    const { data: task } = await this.db
      .from('task_executions')
      .select('*')
      .eq('id', taskExecutionId)
      .single()

    if (!task) return

    // Check retry policy
    const { data: execution } = await this.db
      .from('workflow_executions')
      .select('workflow_id')
      .eq('id', task.workflow_execution_id)
      .single()

    const { data: workflow } = await this.db
      .from('workflows')
      .select('definition')
      .eq('id', execution?.workflow_id)
      .single()

    const definition = workflow?.definition as WorkflowDefinition
    const taskDef = definition.tasks.find(t => t.id === task.task_def_id)
    const maxRetries = taskDef?.retryPolicy?.maxRetries || 0

    if (task.attempts < maxRetries) {
      await this.db
        .from('task_executions')
        .update({
          status: 'retrying',
          attempts: task.attempts + 1,
          output: { error },
        })
        .eq('id', taskExecutionId)
    } else {
      await this.db
        .from('task_executions')
        .update({
          status: 'failed',
          output: { error },
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskExecutionId)

      await this.checkWorkflowCompletion(task.workflow_execution_id)
    }
  }

  async updateTaskStatus(taskExecutionId: string, status: TaskStatus): Promise<void> {
    const update: Record<string, any> = { status }
    if (status === 'running') update.started_at = new Date().toISOString()
    await this.db.from('task_executions').update(update).eq('id', taskExecutionId)
  }

  private async checkWorkflowCompletion(workflowExecutionId: string): Promise<void> {
    const { data: tasks } = await this.db
      .from('task_executions')
      .select('status')
      .eq('workflow_execution_id', workflowExecutionId)

    if (!tasks) return

    const allDone = tasks.every(
      (t: any) => t.status === 'completed' || t.status === 'failed',
    )

    if (allDone) {
      const hasFailed = tasks.some((t: any) => t.status === 'failed')
      await this.db
        .from('workflow_executions')
        .update({
          status: hasFailed ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', workflowExecutionId)
    }
  }
}
```

**Step 5: Create src/index.ts**

```typescript
export { WorkflowEngine } from './workflow-engine'
export { WorkflowRegistry } from './workflow-registry'
export { DependencyResolver } from './dependency-resolver'
```

**Step 6: Build and verify**

Run: `npm run build --workspace=packages/workflow-engine`
Expected: Clean compilation

**Step 7: Commit**

```bash
git add packages/workflow-engine/
git commit -m "feat: add workflow-engine with registry, dependency resolver, and execution engine"
```

---

### Task 7: Create packages/event-bus

**Files:**
- Create: `packages/event-bus/package.json`
- Create: `packages/event-bus/tsconfig.json`
- Create: `packages/event-bus/src/index.ts`
- Create: `packages/event-bus/src/event-bus.ts`
- Create: `packages/event-bus/src/supabase-event-bus.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/event-bus",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0"
  },
  "devDependencies": {
    "@agent-all/types": "*"
  }
}
```

**Step 2: Create src/event-bus.ts**

```typescript
import type { AgentEvent, EventType, EventHandler } from '@agent-all/types'

export interface EventBus {
  emit(event: AgentEvent): Promise<void>
  subscribe(eventType: EventType, handler: EventHandler): void
  start(): Promise<void>
  stop(): Promise<void>
}
```

**Step 3: Create src/supabase-event-bus.ts**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentEvent, EventType, EventHandler } from '@agent-all/types'
import type { EventBus } from './event-bus'
import { randomUUID } from 'crypto'

export class SupabaseEventBus implements EventBus {
  private handlers = new Map<EventType, EventHandler[]>()
  private channel: any = null

  constructor(private db: SupabaseClient) {}

  async emit(event: AgentEvent): Promise<void> {
    // Persist event and trigger handlers
    const handlers = this.handlers.get(event.type) || []
    for (const handler of handlers) {
      await handler(event)
    }
  }

  subscribe(eventType: EventType, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  async start(): Promise<void> {
    // Listen for new emails
    this.channel = this.db
      .channel('db-events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emails' }, async (payload) => {
        const event: AgentEvent = {
          id: randomUUID(),
          type: 'EMAIL_RECEIVED',
          companyId: payload.new.company_id,
          payload: payload.new,
          source: 'email',
          timestamp: new Date(),
        }
        await this.emit(event)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documents' }, async (payload) => {
        const event: AgentEvent = {
          id: randomUUID(),
          type: 'DOCUMENT_UPLOADED',
          companyId: payload.new.company_id,
          payload: payload.new,
          source: payload.new.source || 'upload',
          timestamp: new Date(),
        }
        await this.emit(event)
      })
      .subscribe()
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.db.removeChannel(this.channel)
      this.channel = null
    }
  }
}
```

**Step 4: Create src/index.ts**

```typescript
export type { EventBus } from './event-bus'
export { SupabaseEventBus } from './supabase-event-bus'
```

**Step 5: Build and verify**

Run: `npm run build --workspace=packages/event-bus`
Expected: Clean compilation

**Step 6: Commit**

```bash
git add packages/event-bus/
git commit -m "feat: add event-bus with Supabase Realtime implementation"
```

---

### Task 8: Create packages/agent-registry

**Files:**
- Create: `packages/agent-registry/package.json`
- Create: `packages/agent-registry/tsconfig.json`
- Create: `packages/agent-registry/src/index.ts`
- Create: `packages/agent-registry/src/registry.ts`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/agent-registry",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "@agent-all/types": "*",
    "@agent-all/agent-sdk": "*",
    "@agent-all/database": "*"
  }
}
```

**Step 2: Create src/registry.ts**

```typescript
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
```

**Step 3: Create src/index.ts**

```typescript
export { AgentRegistry } from './registry'
```

**Step 4: Build and verify**

Run: `npm run build --workspace=packages/agent-registry`
Expected: Clean compilation

**Step 5: Commit**

```bash
git add packages/agent-registry/
git commit -m "feat: add agent-registry with capability resolution and company scoping"
```

---

## Phase 2: NestJS Backend (apps/api)

### Task 9: Scaffold NestJS app with Fastify

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/.env.example`
- Create: `apps/api/nest-cli.json`

**Step 1: Create package.json**

```json
{
  "name": "@agent-all/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "start:prod": "node dist/main.js"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-fastify": "^10.4.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/bullmq": "^10.2.0",
    "bullmq": "^5.25.0",
    "ioredis": "^5.4.0",
    "@supabase/supabase-js": "^2.45.0",
    "@agent-all/types": "*",
    "@agent-all/database": "*",
    "@agent-all/llm": "*",
    "@agent-all/agent-sdk": "*",
    "@agent-all/agent-registry": "*",
    "@agent-all/workflow-engine": "*",
    "@agent-all/event-bus": "*",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.1.0",
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 2: Create nest-cli.json**

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2021"
  },
  "include": ["src"]
}
```

**Step 4: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```

**Step 5: Create .env.example**

```
SUPABASE_URL=https://yojesskmdehepeqkdelp.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Step 6: Create src/app.module.ts**

```typescript
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
  ],
})
export class AppModule {}
```

**Step 7: Create src/main.ts**

```typescript
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  )

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
  })

  const port = process.env.PORT || 3001
  await app.listen(port, '0.0.0.0')
  console.log(`API running on http://0.0.0.0:${port}`)
}

bootstrap()
```

**Step 8: Install dependencies and verify**

Run: `cd apps/api && npm install && npm run build`
Expected: Clean build

**Step 9: Commit**

```bash
git add apps/api/
git commit -m "feat: scaffold NestJS API with Fastify adapter and BullMQ"
```

---

### Task 10: Add Orchestrator module

**Files:**
- Create: `apps/api/src/orchestrator/orchestrator.module.ts`
- Create: `apps/api/src/orchestrator/orchestrator.service.ts`
- Create: `apps/api/src/orchestrator/orchestrator.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Create orchestrator.service.ts**

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { WorkflowEngine } from '@agent-all/workflow-engine'
import { AgentRegistry } from '@agent-all/agent-registry'
import { SupabaseEventBus } from '@agent-all/event-bus'
import { getSupabaseServiceClient } from '@agent-all/database'
import type { AgentEvent, EventType } from '@agent-all/types'

@Injectable()
export class OrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(OrchestratorService.name)
  private workflowEngine: WorkflowEngine
  private eventBus: SupabaseEventBus

  constructor(
    @InjectQueue('agent-tasks') private agentQueue: Queue,
    private agentRegistry: AgentRegistry,
  ) {
    const db = getSupabaseServiceClient()
    this.workflowEngine = new WorkflowEngine(db)
    this.eventBus = new SupabaseEventBus(db)
  }

  async onModuleInit() {
    // Subscribe to all event types
    const eventTypes: EventType[] = [
      'EMAIL_RECEIVED',
      'DOCUMENT_UPLOADED',
      'INVOICE_CREATED',
      'PAYMENT_RECEIVED',
      'MANUAL_TRIGGER',
    ]

    for (const eventType of eventTypes) {
      this.eventBus.subscribe(eventType, (event) => this.handleEvent(event))
    }

    await this.eventBus.start()
    this.logger.log('Orchestrator started, listening for events')
  }

  async handleEvent(event: AgentEvent): Promise<void> {
    this.logger.log(`Received event: ${event.type} for company ${event.companyId}`)

    const execution = await this.workflowEngine.startWorkflow(event)
    if (!execution) {
      this.logger.warn(`No workflow found for event ${event.type}`)
      return
    }

    this.logger.log(`Started workflow execution ${execution.id}`)
    await this.dispatchReadyTasks(execution.id)
  }

  async dispatchReadyTasks(workflowExecutionId: string): Promise<void> {
    const readyTasks = await this.workflowEngine.getReadyTasks(workflowExecutionId)

    for (const task of readyTasks) {
      await this.workflowEngine.updateTaskStatus(task.id, 'running')
      await this.agentQueue.add('execute-task', {
        taskExecutionId: task.id,
        workflowExecutionId,
        agentId: task.agentId,
        action: task.action,
        input: task.input,
      })
      this.logger.log(`Dispatched task ${task.taskDefId} to agent ${task.agentId}`)
    }
  }

  async onTaskCompleted(
    taskExecutionId: string,
    workflowExecutionId: string,
    output: Record<string, any>,
    confidence: number,
  ): Promise<void> {
    await this.workflowEngine.completeTask(taskExecutionId, output, confidence)
    // Dispatch newly unblocked tasks
    await this.dispatchReadyTasks(workflowExecutionId)
  }

  async onTaskFailed(taskExecutionId: string, error: string): Promise<void> {
    await this.workflowEngine.failTask(taskExecutionId, error)
  }

  getWorkflowEngine(): WorkflowEngine {
    return this.workflowEngine
  }

  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry
  }
}
```

**Step 2: Create orchestrator.controller.ts**

```typescript
import { Controller, Post, Body, Get, Param } from '@nestjs/common'
import { OrchestratorService } from './orchestrator.service'
import type { AgentEvent } from '@agent-all/types'

@Controller('orchestrator')
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Post('events')
  async triggerEvent(@Body() event: AgentEvent) {
    await this.orchestratorService.handleEvent(event)
    return { status: 'ok' }
  }

  @Get('agents')
  listAgents() {
    return this.orchestratorService.getAgentRegistry().listAll()
  }
}
```

**Step 3: Create orchestrator.module.ts**

```typescript
import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { OrchestratorService } from './orchestrator.service'
import { OrchestratorController } from './orchestrator.controller'
import { AgentRegistry } from '@agent-all/agent-registry'
import { getSupabaseServiceClient } from '@agent-all/database'

@Module({
  imports: [
    BullModule.registerQueue({ name: 'agent-tasks' }),
  ],
  controllers: [OrchestratorController],
  providers: [
    OrchestratorService,
    {
      provide: AgentRegistry,
      useFactory: () => new AgentRegistry(getSupabaseServiceClient()),
    },
  ],
  exports: [OrchestratorService, AgentRegistry],
})
export class OrchestratorModule {}
```

**Step 4: Update app.module.ts to import OrchestratorModule**

Add `OrchestratorModule` to imports in `apps/api/src/app.module.ts`.

**Step 5: Build and verify**

Run: `npm run build --workspace=@agent-all/api`
Expected: Clean build

**Step 6: Commit**

```bash
git add apps/api/src/orchestrator/ apps/api/src/app.module.ts
git commit -m "feat: add orchestrator module with event handling and task dispatch"
```

---

### Task 11: Add Company & Auth modules

**Files:**
- Create: `apps/api/src/company/company.module.ts`
- Create: `apps/api/src/company/company.service.ts`
- Create: `apps/api/src/company/company.controller.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/auth.guard.ts`
- Modify: `apps/api/src/app.module.ts`

This task adds:
- CRUD for companies
- Supabase Auth guard for protecting routes
- Company-scoped middleware

**Step 1: Create auth.guard.ts** — verifies Supabase JWT from Authorization header

**Step 2: Create company.service.ts** — CRUD operations on companies table using Supabase service client

**Step 3: Create company.controller.ts** — REST endpoints: `GET /companies`, `POST /companies`, `GET /companies/:id`

**Step 4: Wire modules and update app.module.ts**

**Step 5: Commit**

```bash
git commit -m "feat: add company and auth modules"
```

---

## Phase 3: Workers & MVP Agents

### Task 12: Create apps/workers (BullMQ processor)

**Files:**
- Create: `apps/workers/package.json`
- Create: `apps/workers/tsconfig.json`
- Create: `apps/workers/src/main.ts`
- Create: `apps/workers/src/task-processor.ts`

The worker process connects to Redis, listens on the `agent-tasks` queue, resolves the agent from the registry, calls `agent.execute()`, and reports results back to the orchestrator API.

**Step 1: Create package.json with BullMQ + agent dependencies**

**Step 2: Create task-processor.ts** — BullMQ Worker that:
1. Receives job with `{ taskExecutionId, agentId, action, input }`
2. Resolves agent from AgentRegistry
3. Builds AgentContext (LLM, memory, company)
4. Calls `agent.execute(task, context)`
5. Reports success/failure back to DB

**Step 3: Create main.ts** — bootstraps worker, registers all agents, starts processing

**Step 4: Commit**

```bash
git commit -m "feat: add workers app with BullMQ task processor"
```

---

### Task 13: Implement Email Agent

**Files:**
- Create: `apps/workers/src/agents/email/email-agent.ts`
- Create: `apps/workers/src/agents/email/prompts.ts`

The Email Agent:
- `classify_email`: Uses LLM to classify email into categories (invoice, prospect, support, info, spam)
- `extract_attachments`: Extracts attachment metadata from email payload
- `draft_reply`: Uses LLM to draft a response (requires approval)

**Step 1: Create prompts.ts** with classification and reply prompts

**Step 2: Create email-agent.ts** extending BaseAgent

**Step 3: Register in main.ts**

**Step 4: Commit**

```bash
git commit -m "feat: implement email agent with classify, extract, draft capabilities"
```

---

### Task 14: Implement Document Agent

**Files:**
- Create: `apps/workers/src/agents/document/document-agent.ts`
- Create: `apps/workers/src/agents/document/prompts.ts`

The Document Agent:
- `detect_type`: Uses LLM to classify document type (invoice, quote, contract, bank_statement)
- `extract_data`: Uses LLM to extract structured data (amount, date, vendor, etc.)
- `rename_document`: Generates standardized filename

**Step 1: Create prompts.ts**

**Step 2: Create document-agent.ts** extending BaseAgent

**Step 3: Register in main.ts**

**Step 4: Commit**

```bash
git commit -m "feat: implement document agent with type detection and data extraction"
```

---

### Task 15: Implement Accounting Agent

**Files:**
- Create: `apps/workers/src/agents/accounting/accounting-agent.ts`
- Create: `apps/workers/src/agents/accounting/prompts.ts`

The Accounting Agent:
- `categorize_expense`: Uses LLM to categorize expense
- `match_invoice`: Matches invoice to existing entries
- `detect_due_date`: Extracts payment due date

**Step 1: Create prompts.ts**

**Step 2: Create accounting-agent.ts** extending BaseAgent

**Step 3: Register in main.ts**

**Step 4: Commit**

```bash
git commit -m "feat: implement accounting agent with categorize, match, due date detection"
```

---

### Task 16: Seed default workflows

**Files:**
- Create: `packages/database/seeds/default-workflows.ts`

Seed the `workflows` table with default platform workflows:

1. **process_incoming_email** (trigger: EMAIL_RECEIVED)
   - classify_email → extract_attachments → (if invoice) detect_type → extract_data → categorize_expense → notify_user

2. **process_document_upload** (trigger: DOCUMENT_UPLOADED)
   - detect_type → extract_data → categorize_expense → notify_user

**Step 1: Write seed script**

**Step 2: Run against Supabase**

**Step 3: Commit**

```bash
git commit -m "feat: add default workflow seeds for email and document processing"
```

---

## Phase 4: Next.js Frontend

### Task 17: Scaffold Next.js app with shadcn/ui

**Files:**
- Create: `apps/web/` (Next.js 14 app)

**Step 1: Create Next.js app**

Run: `cd apps && npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`

**Step 2: Install shadcn/ui**

Run: `cd apps/web && npx shadcn@latest init`

**Step 3: Install needed shadcn components**

Run: `npx shadcn@latest add button card badge table tabs input dialog dropdown-menu separator avatar`

**Step 4: Configure Supabase client for frontend**

Create `apps/web/src/lib/supabase.ts` with browser client

**Step 5: Commit**

```bash
git commit -m "feat: scaffold Next.js frontend with shadcn/ui and Supabase client"
```

---

### Task 18: Auth pages (login + invitation)

**Files:**
- Create: `apps/web/src/app/login/page.tsx`
- Create: `apps/web/src/app/invite/[token]/page.tsx`
- Create: `apps/web/src/middleware.ts`

**Step 1: Create login page** — email/password form using Supabase Auth

**Step 2: Create invitation page** — accepts invite token, creates account

**Step 3: Create middleware** — protects /dashboard routes, redirects to /login

**Step 4: Commit**

```bash
git commit -m "feat: add auth pages (login, invitation) with Supabase Auth"
```

---

### Task 19: Dashboard layout + main page

**Files:**
- Create: `apps/web/src/app/dashboard/layout.tsx`
- Create: `apps/web/src/app/dashboard/page.tsx`
- Create: `apps/web/src/components/dashboard/sidebar.tsx`
- Create: `apps/web/src/components/dashboard/kpi-card.tsx`
- Create: `apps/web/src/components/dashboard/activity-feed.tsx`

**Step 1: Create sidebar** — dark theme, navigation links to all dashboard pages

**Step 2: Create dashboard layout** — sidebar + main content area

**Step 3: Create KPI card component**

**Step 4: Create activity feed component** — shows recent agent actions from audit_log

**Step 5: Create main dashboard page** — KPIs + activity feed + agents status

**Step 6: Commit**

```bash
git commit -m "feat: add dashboard layout with sidebar, KPIs, and activity feed"
```

---

### Task 20: Agent activity + validation pages

**Files:**
- Create: `apps/web/src/app/dashboard/activity/page.tsx`
- Create: `apps/web/src/app/dashboard/validations/page.tsx`
- Create: `apps/web/src/components/dashboard/validation-card.tsx`

**Step 1: Create activity page** — real-time feed of all agent actions with filters

**Step 2: Create validation card** — shows action details + approve/correct/reject buttons

**Step 3: Create validations page** — list of pending validations, calls API to approve/correct/reject

**Step 4: Commit**

```bash
git commit -m "feat: add activity and validation pages"
```

---

### Task 21: Documents, Emails, Accounting pages

**Files:**
- Create: `apps/web/src/app/dashboard/documents/page.tsx`
- Create: `apps/web/src/app/dashboard/emails/page.tsx`
- Create: `apps/web/src/app/dashboard/accounting/page.tsx`

**Step 1: Create documents page** — table of processed documents with type, date, extracted data

**Step 2: Create emails page** — table of processed emails with category, status

**Step 3: Create accounting page** — table of accounting entries with amount, category, payment status

**Step 4: Commit**

```bash
git commit -m "feat: add documents, emails, and accounting pages"
```

---

### Task 22: Agents config + Settings pages

**Files:**
- Create: `apps/web/src/app/dashboard/agents/page.tsx`
- Create: `apps/web/src/app/dashboard/settings/page.tsx`

**Step 1: Create agents page** — cards for each agent with enable/disable toggle and autonomy level slider

**Step 2: Create settings page** — company info, connected services, internal rules (approval thresholds, blocked actions)

**Step 3: Commit**

```bash
git commit -m "feat: add agents config and settings pages"
```

---

## Phase 5: Docker & Deployment

### Task 23: Docker setup

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/workers/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `docker/docker-compose.dev.yml`
- Create: `docker/docker-compose.prod.yml`

**Step 1: Create Dockerfiles** for each app (multi-stage builds)

**Step 2: Create docker-compose.dev.yml** — all services with hot reload, Redis, no Traefik

**Step 3: Create docker-compose.prod.yml** — production builds with Traefik SSL for `agent-all.ialla.fr` and `dev-agent-all.ialla.fr`

**Step 4: Verify with docker compose build**

**Step 5: Commit**

```bash
git commit -m "feat: add Docker setup with dev and prod compose files"
```

---

### Task 24: CLAUDE.md + env files

**Files:**
- Create: `CLAUDE.md`
- Create: `apps/api/.env`
- Create: `apps/web/.env.local`

**Step 1: Create CLAUDE.md** with project overview, structure, commands, Supabase info, conventions

**Step 2: Create env files** with actual Supabase credentials

**Step 3: Commit CLAUDE.md only** (not .env files)

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project reference"
```

---

## Phase 6: Integration Test

### Task 25: End-to-end test of MVP flow

**Manual test:**

1. Start services: `docker compose -f docker/docker-compose.dev.yml up`
2. Create a company via API: `POST /companies`
3. Enable agents for company: `POST /companies/:id/agents`
4. Trigger email event: `POST /orchestrator/events` with EMAIL_RECEIVED payload containing invoice attachment
5. Verify in dashboard:
   - Email classified as "invoice"
   - Document extracted with amount/date
   - Accounting entry created
   - Action visible in activity feed
6. Test validation flow: trigger low-confidence action, verify it appears in validations page

---

## Summary

| Phase | Tasks | Description |
|---|---|---|
| 1 | 1-8 | Monorepo + shared packages (types, database, llm, agent-sdk, workflow-engine, event-bus, agent-registry) |
| 2 | 9-11 | NestJS API (orchestrator, company, auth modules) |
| 3 | 12-16 | Workers + 3 MVP agents + default workflows |
| 4 | 17-22 | Next.js frontend (auth, dashboard, all pages) |
| 5 | 23-24 | Docker + deployment config |
| 6 | 25 | Integration test |

Total: **25 tasks** across 6 phases. Each phase builds on the previous one.
