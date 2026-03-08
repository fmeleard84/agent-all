# Onboarding 3 Axes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 3 entry points to Agent OS (idea/launch/existing business) with conversational onboarding agent, RAG per workspace, and Qonto bank integration.

**Architecture:** New workspace entity + onboarding agent + RAG package (Qdrant). Chat-based onboarding creates workspaces and activates agents. Qonto API fetches transactions, Document Agent handles file imports, both feed into RAG for financial Q&A.

**Tech Stack:** Qdrant (existing 127.0.0.1:6333), OpenAI text-embedding-3-small, NestJS, Next.js, BullMQ, Supabase.

---

## Phase 1 — Database & Types

### Task 1: Add new types

**Files:**
- Modify: `packages/types/src/events.ts`
- Modify: `packages/types/src/entities.ts`
- Create: `packages/types/src/workspace.ts`
- Modify: `packages/types/src/index.ts`

**Step 1: Create workspace types**

Create `packages/types/src/workspace.ts`:

```typescript
export type AxeType = 'idea' | 'launch' | 'existing'

export type WorkspaceStatus = 'onboarding' | 'active' | 'archived'

export interface Workspace {
  id: string
  userId: string
  companyId: string
  axeType: AxeType
  name: string
  status: WorkspaceStatus
  metadata: Record<string, any>
  createdAt: Date
}

export interface ChatMessage {
  id: string
  workspaceId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  extractedData?: Record<string, any>
  createdAt: Date
}

export interface WorkspaceDocument {
  id: string
  workspaceId: string
  fileName: string
  storagePath: string
  docType: 'bank_statement' | 'invoice' | 'contract' | 'other'
  extractedData?: Record<string, any>
  createdAt: Date
}

export interface QontoCredentials {
  apiKey: string
  login: string
}

export interface QontoTransaction {
  transactionId: string
  amount: number
  amountCents: number
  currency: string
  side: 'credit' | 'debit'
  operationType: string
  label: string
  settledAt: string
  emittedAt: string
  status: string
  reference?: string
  category?: string
}
```

**Step 2: Add new event types**

In `packages/types/src/events.ts`, add to EventType union:

```typescript
export type EventType =
  | 'EMAIL_RECEIVED'
  | 'DOCUMENT_UPLOADED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'MANUAL_TRIGGER'
  | 'WORKSPACE_CREATED'
  | 'CHAT_MESSAGE_SENT'
  | 'DOCUMENT_UPLOADED_WORKSPACE'
  | 'QONTO_SYNC_REQUESTED'
```

**Step 3: Export from index**

Add to `packages/types/src/index.ts`:

```typescript
export * from './workspace'
```

**Step 4: Build and commit**

```bash
npm run build --workspace=@agent-all/types
git add packages/types/
git commit -m "feat: add workspace, chat, and Qonto types"
```

---

### Task 2: Database migration — new tables

**Files:**
- Create: `packages/database/migrations/002_workspaces.sql`

**Step 1: Write migration**

```sql
-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id),
  axe_type TEXT NOT NULL CHECK (axe_type IN ('idea', 'launch', 'existing')),
  name TEXT NOT NULL DEFAULT 'Mon workspace',
  status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'active', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspaces_user ON workspaces(user_id);
CREATE INDEX idx_workspaces_company ON workspaces(company_id);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  extracted_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_workspace ON chat_messages(workspace_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(workspace_id, created_at);

-- Workspace documents
CREATE TABLE IF NOT EXISTS workspace_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other' CHECK (doc_type IN ('bank_statement', 'invoice', 'contract', 'other')),
  extracted_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspace_docs_workspace ON workspace_documents(workspace_id);

-- RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workspaces" ON workspaces
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage chat in own workspaces" ON chat_messages
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage docs in own workspaces" ON workspace_documents
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = auth.uid()));
```

**Step 2: Apply migration to Supabase**

```bash
SUPABASE_URL=https://yojesskmdehepeqkdelp.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvamVzc2ttZGVoZXBlcWtkZWxwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjk4MDI2MywiZXhwIjoyMDg4NTU2MjYzfQ.K8MUAiMa43mhSEKpRUWJNHW0mbagPvL3BWsnG-KJGTU \
node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const sql = fs.readFileSync('packages/database/migrations/002_workspaces.sql', 'utf8');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
client.rpc('exec_sql', { sql_string: sql }).then(r => console.log(r)).catch(e => console.error(e));
"
```

If rpc doesn't work, apply via Supabase Dashboard SQL editor.

**Step 3: Commit**

```bash
git add packages/database/migrations/002_workspaces.sql
git commit -m "feat: add workspaces, chat_messages, workspace_documents tables"
```

---

## Phase 2 — RAG Package

### Task 3: Create packages/rag

**Files:**
- Create: `packages/rag/package.json`
- Create: `packages/rag/tsconfig.json`
- Create: `packages/rag/src/index.ts`
- Create: `packages/rag/src/embeddings.ts`
- Create: `packages/rag/src/qdrant.ts`
- Create: `packages/rag/src/search.ts`

**Step 1: Package setup**

`packages/rag/package.json`:

```json
{
  "name": "@agent-all/rag",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@qdrant/js-client-rest": "^1.12.0",
    "openai": "^4.73.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

`packages/rag/tsconfig.json`:

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

**Step 2: Embeddings client**

`packages/rag/src/embeddings.ts`:

```typescript
import OpenAI from 'openai'

const MODEL = 'text-embedding-3-small'
const DIMENSIONS = 1536

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function embed(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: MODEL,
    input: text,
  })
  return response.data[0].embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const batches: string[][] = []
  for (let i = 0; i < texts.length; i += 100) {
    batches.push(texts.slice(i, i + 100))
  }

  const results: number[][] = []
  for (const batch of batches) {
    const response = await getClient().embeddings.create({
      model: MODEL,
      input: batch,
    })
    results.push(...response.data.map(d => d.embedding))
  }
  return results
}

export { DIMENSIONS }
```

**Step 3: Qdrant client**

`packages/rag/src/qdrant.ts`:

```typescript
import { QdrantClient } from '@qdrant/js-client-rest'
import { DIMENSIONS } from './embeddings'

const QDRANT_URL = process.env.QDRANT_URL || 'http://127.0.0.1:6333'

let client: QdrantClient | null = null

export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: QDRANT_URL })
  }
  return client
}

export const COLLECTIONS = {
  CONVERSATIONS: 'workspace_conversations',
  DOCUMENTS: 'workspace_documents',
} as const

export async function ensureCollections(): Promise<void> {
  const qdrant = getQdrantClient()
  const existing = await qdrant.getCollections()
  const names = existing.collections.map(c => c.name)

  for (const collection of Object.values(COLLECTIONS)) {
    if (!names.includes(collection)) {
      await qdrant.createCollection(collection, {
        vectors: { size: DIMENSIONS, distance: 'Cosine' },
      })
      await qdrant.createPayloadIndex(collection, {
        field_name: 'workspace_id',
        field_schema: 'keyword',
      })
      await qdrant.createPayloadIndex(collection, {
        field_name: 'user_id',
        field_schema: 'keyword',
      })
    }
  }
}
```

**Step 4: Search service**

`packages/rag/src/search.ts`:

```typescript
import { randomUUID } from 'crypto'
import { embed } from './embeddings'
import { getQdrantClient, COLLECTIONS } from './qdrant'

export interface RagDocument {
  id?: string
  content: string
  metadata: Record<string, any>
}

export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, any>
  score: number
}

export async function indexDocument(
  collection: string,
  doc: RagDocument,
  workspaceId: string,
  userId: string,
): Promise<string> {
  const id = doc.id || randomUUID()
  const vector = await embed(doc.content)
  const qdrant = getQdrantClient()

  await qdrant.upsert(collection, {
    points: [{
      id,
      vector,
      payload: {
        content: doc.content,
        workspace_id: workspaceId,
        user_id: userId,
        ...doc.metadata,
        indexed_at: new Date().toISOString(),
      },
    }],
  })

  return id
}

export async function search(
  collection: string,
  query: string,
  workspaceId: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  const vector = await embed(query)
  const qdrant = getQdrantClient()

  const results = await qdrant.search(collection, {
    vector,
    limit,
    filter: {
      must: [{ key: 'workspace_id', match: { value: workspaceId } }],
    },
    with_payload: true,
  })

  return results.map(r => ({
    id: r.id as string,
    content: (r.payload as any)?.content || '',
    metadata: r.payload as Record<string, any>,
    score: r.score,
  }))
}

export async function searchAcrossWorkspaces(
  collection: string,
  query: string,
  userId: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  const vector = await embed(query)
  const qdrant = getQdrantClient()

  const results = await qdrant.search(collection, {
    vector,
    limit,
    filter: {
      must: [{ key: 'user_id', match: { value: userId } }],
    },
    with_payload: true,
  })

  return results.map(r => ({
    id: r.id as string,
    content: (r.payload as any)?.content || '',
    metadata: r.payload as Record<string, any>,
    score: r.score,
  }))
}
```

**Step 5: Index**

`packages/rag/src/index.ts`:

```typescript
export { embed, embedBatch, DIMENSIONS } from './embeddings'
export { getQdrantClient, ensureCollections, COLLECTIONS } from './qdrant'
export { indexDocument, search, searchAcrossWorkspaces } from './search'
export type { RagDocument, SearchResult } from './search'
```

**Step 6: Install deps, build, commit**

```bash
npm install
npm run build --workspace=@agent-all/rag
git add packages/rag/
git commit -m "feat: add RAG package with Qdrant client and embeddings"
```

---

## Phase 3 — Qonto Integration

### Task 4: Create Qonto client package

**Files:**
- Create: `packages/rag/src/qonto.ts`
- Modify: `packages/rag/src/index.ts`

**Step 1: Qonto API client**

`packages/rag/src/qonto.ts`:

```typescript
import { QontoTransaction } from '@agent-all/types'

const QONTO_BASE_URL = 'https://thirdparty.qonto.com/v2'

export interface QontoClient {
  getOrganization(): Promise<any>
  getBankAccounts(): Promise<any[]>
  getTransactions(bankAccountId: string, options?: TransactionOptions): Promise<QontoTransaction[]>
}

interface TransactionOptions {
  status?: 'pending' | 'reversed' | 'declined' | 'completed'
  updatedAtFrom?: string
  updatedAtTo?: string
  currentPage?: number
  perPage?: number
}

export function createQontoClient(login: string, apiKey: string): QontoClient {
  const headers = {
    'Authorization': `${login}:${apiKey}`,
    'Content-Type': 'application/json',
  }

  async function request(path: string, params?: Record<string, string>): Promise<any> {
    const url = new URL(`${QONTO_BASE_URL}${path}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Qonto API error ${res.status}: ${body}`)
    }
    return res.json()
  }

  return {
    async getOrganization() {
      const data = await request('/organization')
      return data.organization
    },

    async getBankAccounts() {
      const org = await request('/organization')
      return org.organization.bank_accounts
    },

    async getTransactions(bankAccountId: string, options: TransactionOptions = {}) {
      const params: Record<string, string> = {
        slug: bankAccountId,
        per_page: String(options.perPage || 100),
        current_page: String(options.currentPage || 1),
      }
      if (options.status) params.status = options.status
      if (options.updatedAtFrom) params['updated_at_from'] = options.updatedAtFrom
      if (options.updatedAtTo) params['updated_at_to'] = options.updatedAtTo

      const data = await request('/transactions', params)
      return (data.transactions || []).map((t: any) => ({
        transactionId: t.transaction_id,
        amount: t.amount,
        amountCents: t.amount_cents,
        currency: t.currency,
        side: t.side,
        operationType: t.operation_type,
        label: t.label || t.reference || 'Sans libellé',
        settledAt: t.settled_at,
        emittedAt: t.emitted_at,
        status: t.status,
        reference: t.reference,
        category: t.category,
      })) as QontoTransaction[]
    },
  }
}

export async function fetchAllTransactions(
  login: string,
  apiKey: string,
): Promise<{ organization: any; transactions: QontoTransaction[] }> {
  const client = createQontoClient(login, apiKey)
  const org = await client.getOrganization()
  const accounts = org.bank_accounts || []

  const allTransactions: QontoTransaction[] = []

  for (const account of accounts) {
    let page = 1
    let hasMore = true
    while (hasMore) {
      const txns = await client.getTransactions(account.slug, {
        currentPage: page,
        perPage: 100,
        status: 'completed',
      })
      allTransactions.push(...txns)
      hasMore = txns.length === 100
      page++
    }
  }

  return { organization: org, transactions: allTransactions }
}
```

**Step 2: Export from index**

Add to `packages/rag/src/index.ts`:

```typescript
export { createQontoClient, fetchAllTransactions } from './qonto'
export type { QontoClient } from './qonto'
```

**Step 3: Add @agent-all/types dependency**

Add to `packages/rag/package.json` devDependencies:

```json
"@agent-all/types": "*"
```

**Step 4: Build and commit**

```bash
npm install
npm run build --workspace=@agent-all/rag
git add packages/rag/
git commit -m "feat: add Qonto API client with transaction fetching"
```

---

## Phase 4 — API Endpoints

### Task 5: Workspace API module

**Files:**
- Create: `apps/api/src/workspace/workspace.service.ts`
- Create: `apps/api/src/workspace/workspace.controller.ts`
- Create: `apps/api/src/workspace/workspace.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Workspace service**

`apps/api/src/workspace/workspace.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseServiceClient } from '@agent-all/database'
import { Workspace, ChatMessage, AxeType } from '@agent-all/types'

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name)
  private readonly supabase = getSupabaseServiceClient()

  async create(userId: string, axeType: AxeType, name?: string): Promise<Workspace> {
    const defaultNames: Record<AxeType, string> = {
      idea: 'Mon idée',
      launch: 'Mon projet',
      existing: 'Mon entreprise',
    }

    const { data, error } = await this.supabase
      .from('workspaces')
      .insert({
        user_id: userId,
        axe_type: axeType,
        name: name || defaultNames[axeType],
        status: 'onboarding',
        metadata: {},
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create workspace: ${error.message}`)
    this.logger.log(`Workspace created: ${data.id} (${axeType}) for user ${userId}`)
    return data
  }

  async findByUser(userId: string): Promise<Workspace[]> {
    const { data, error } = await this.supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch workspaces: ${error.message}`)
    return data || []
  }

  async findById(workspaceId: string): Promise<Workspace | null> {
    const { data, error } = await this.supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (error) return null
    return data
  }

  async getMessages(workspaceId: string, limit = 50): Promise<ChatMessage[]> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`)
    return data || []
  }

  async addMessage(
    workspaceId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    extractedData?: Record<string, any>,
  ): Promise<ChatMessage> {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .insert({
        workspace_id: workspaceId,
        role,
        content,
        extracted_data: extractedData,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to add message: ${error.message}`)
    return data
  }

  async updateMetadata(workspaceId: string, metadata: Record<string, any>): Promise<void> {
    const workspace = await this.findById(workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    const merged = { ...workspace.metadata, ...metadata }
    const { error } = await this.supabase
      .from('workspaces')
      .update({ metadata: merged })
      .eq('id', workspaceId)

    if (error) throw new Error(`Failed to update metadata: ${error.message}`)
  }
}
```

**Step 2: Workspace controller**

`apps/api/src/workspace/workspace.controller.ts`:

```typescript
import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common'
import { WorkspaceService } from './workspace.service'
import { SupabaseAuthGuard } from '../auth/auth.guard'
import { AxeType } from '@agent-all/types'

@Controller('workspaces')
@UseGuards(SupabaseAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  async create(@Req() req: any, @Body() body: { axeType: AxeType; name?: string }) {
    const userId = req.user.id
    return this.workspaceService.create(userId, body.axeType, body.name)
  }

  @Get()
  async list(@Req() req: any) {
    const userId = req.user.id
    return this.workspaceService.findByUser(userId)
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.workspaceService.findById(id)
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    return this.workspaceService.getMessages(id)
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    // Store user message
    const userMsg = await this.workspaceService.addMessage(id, 'user', body.content)
    return userMsg
  }

  @Post(':id/metadata')
  async updateMetadata(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    await this.workspaceService.updateMetadata(id, body)
    return { success: true }
  }
}
```

**Step 3: Workspace module**

`apps/api/src/workspace/workspace.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { WorkspaceService } from './workspace.service'
import { WorkspaceController } from './workspace.controller'

@Module({
  providers: [WorkspaceService],
  controllers: [WorkspaceController],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
```

**Step 4: Register in app module**

Add `WorkspaceModule` to imports in `apps/api/src/app.module.ts`.

**Step 5: Build and commit**

```bash
npm run build --workspace=@agent-all/api
git add apps/api/src/workspace/ apps/api/src/app.module.ts
git commit -m "feat: add workspace API module with CRUD and chat endpoints"
```

---

### Task 6: Chat API with LLM integration

**Files:**
- Create: `apps/api/src/chat/chat.service.ts`
- Create: `apps/api/src/chat/chat.controller.ts`
- Create: `apps/api/src/chat/chat.module.ts`
- Create: `apps/api/src/chat/prompts.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: System prompts per axe**

`apps/api/src/chat/prompts.ts`:

```typescript
export const SYSTEM_PROMPTS: Record<string, string> = {
  idea: `Tu es un mentor startup expert. Tu aides un entrepreneur à transformer une idée floue en projet structuré.

Ton rôle :
- Poser des questions pour comprendre l'idée, la cible, le problème résolu
- Challenger les hypothèses, identifier les points faibles
- Aider à définir la proposition de valeur
- Identifier le marché, les concurrents, les opportunités
- Suggérer un modèle économique
- Conclure par une recommandation : pivoter, abandonner, ou passer à la création

Commence par demander à l'utilisateur de décrire son idée en quelques phrases.
Pose UNE question à la fois. Sois direct, bienveillant mais exigeant.
Réponds toujours en français.`,

  launch: `Tu es un business coach expert en lancement d'activité. Tu aides un entrepreneur à passer de l'idée au lancement.

Ton rôle :
- Comprendre l'offre, le positionnement, la cible
- Structurer le plan de lancement : offre, pricing, branding
- Proposer les premiers canaux d'acquisition
- Aider à créer les fondations : site, email, contenus
- Identifier les premières actions prioritaires

Commence par demander à l'utilisateur ce qu'il veut lancer et où il en est.
Pose UNE question à la fois. Sois concret et actionnable.
Réponds toujours en français.`,

  existing: `Tu es un consultant opérationnel expert en optimisation d'entreprise. Tu aides un entrepreneur qui a déjà une activité à la structurer et l'automatiser.

Ton rôle :
- Comprendre l'activité actuelle, les outils utilisés, les process
- Identifier les tâches répétitives et les points de friction
- Proposer les agents à activer pour gagner du temps
- Aider à connecter les outils existants (banque, email, documents)
- Pour la banque, proposer la connexion Qonto (API ou import de relevé)

Commence par demander à l'utilisateur de décrire son activité et ses principales difficultés.
Quand l'utilisateur veut connecter Qonto, demande-lui son identifiant (login) et sa clé API.
Pose UNE question à la fois. Sois pragmatique et orienté résultats.
Réponds toujours en français.`,
}
```

**Step 2: Chat service**

`apps/api/src/chat/chat.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { WorkspaceService } from '../workspace/workspace.service'
import { getLLMProvider } from '@agent-all/llm'
import { indexDocument, search, COLLECTIONS } from '@agent-all/rag'
import { SYSTEM_PROMPTS } from './prompts'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly llm = getLLMProvider('openai')

  constructor(private readonly workspaceService: WorkspaceService) {}

  async chat(workspaceId: string, userMessage: string, userId: string): Promise<string> {
    const workspace = await this.workspaceService.findById(workspaceId)
    if (!workspace) throw new Error('Workspace not found')

    // Store user message
    await this.workspaceService.addMessage(workspaceId, 'user', userMessage)

    // Index user message in RAG
    await indexDocument(
      COLLECTIONS.CONVERSATIONS,
      { content: userMessage, metadata: { role: 'user', axe_type: workspace.axe_type } },
      workspaceId,
      userId,
    ).catch(err => this.logger.warn(`RAG indexing failed: ${err.message}`))

    // Get conversation history
    const messages = await this.workspaceService.getMessages(workspaceId)

    // Search RAG for relevant context
    const ragResults = await search(
      COLLECTIONS.CONVERSATIONS,
      userMessage,
      workspaceId,
      3,
    ).catch(() => [])

    // Build prompt
    const systemPrompt = SYSTEM_PROMPTS[workspace.axe_type] || SYSTEM_PROMPTS.idea
    const conversationHistory = messages.slice(-20).map(m =>
      `${m.role === 'user' ? 'Utilisateur' : 'Agent'}: ${m.content}`
    ).join('\n\n')

    const ragContext = ragResults.length > 0
      ? `\n\nContexte pertinent des échanges précédents:\n${ragResults.map(r => r.content).join('\n')}`
      : ''

    const fullPrompt = `${systemPrompt}${ragContext}\n\nHistorique de la conversation:\n${conversationHistory}\n\nUtilisateur: ${userMessage}\n\nAgent:`

    // Generate response
    const response = await this.llm.generate(fullPrompt, {
      temperature: 0.7,
      maxTokens: 1000,
    })

    // Store assistant response
    await this.workspaceService.addMessage(workspaceId, 'assistant', response)

    // Index response in RAG
    await indexDocument(
      COLLECTIONS.CONVERSATIONS,
      { content: response, metadata: { role: 'assistant', axe_type: workspace.axe_type } },
      workspaceId,
      userId,
    ).catch(err => this.logger.warn(`RAG indexing failed: ${err.message}`))

    return response
  }
}
```

**Step 3: Chat controller**

`apps/api/src/chat/chat.controller.ts`:

```typescript
import { Controller, Post, Param, Body, Req, UseGuards } from '@nestjs/common'
import { ChatService } from './chat.service'
import { SupabaseAuthGuard } from '../auth/auth.guard'

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':workspaceId')
  async chat(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
    @Body() body: { message: string },
  ) {
    const userId = req.user.id
    const response = await this.chatService.chat(workspaceId, body.message, userId)
    return { response }
  }
}
```

**Step 4: Chat module**

`apps/api/src/chat/chat.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { ChatService } from './chat.service'
import { ChatController } from './chat.controller'
import { WorkspaceModule } from '../workspace/workspace.module'

@Module({
  imports: [WorkspaceModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
```

**Step 5: Register in app module, add @agent-all/rag dependency**

Add `ChatModule` to `app.module.ts` imports.
Add `"@agent-all/rag": "*"` to `apps/api/package.json` dependencies.

**Step 6: Build and commit**

```bash
npm install
npm run build --workspace=@agent-all/api
git add apps/api/src/chat/ apps/api/src/app.module.ts apps/api/package.json
git commit -m "feat: add chat API with LLM and RAG integration"
```

---

### Task 7: Qonto API endpoints

**Files:**
- Create: `apps/api/src/qonto/qonto.service.ts`
- Create: `apps/api/src/qonto/qonto.controller.ts`
- Create: `apps/api/src/qonto/qonto.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Step 1: Qonto service**

`apps/api/src/qonto/qonto.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseServiceClient } from '@agent-all/database'
import { createQontoClient, fetchAllTransactions, indexDocument, COLLECTIONS } from '@agent-all/rag'
import { WorkspaceService } from '../workspace/workspace.service'

@Injectable()
export class QontoService {
  private readonly logger = new Logger(QontoService.name)
  private readonly supabase = getSupabaseServiceClient()

  constructor(private readonly workspaceService: WorkspaceService) {}

  async connectAndSync(workspaceId: string, userId: string, login: string, apiKey: string) {
    // Test connection
    const client = createQontoClient(login, apiKey)
    const org = await client.getOrganization()
    this.logger.log(`Connected to Qonto org: ${org.legal_name || org.slug}`)

    // Store credentials in workspace metadata
    await this.workspaceService.updateMetadata(workspaceId, {
      qonto: {
        login,
        apiKey,
        orgName: org.legal_name || org.slug,
        connectedAt: new Date().toISOString(),
      },
    })

    // Fetch and store transactions
    const { transactions } = await fetchAllTransactions(login, apiKey)
    this.logger.log(`Fetched ${transactions.length} transactions from Qonto`)

    // Store in accounting_entries
    for (const txn of transactions) {
      const { error } = await this.supabase
        .from('accounting_entries')
        .upsert({
          company_id: null, // workspace-level, not company-level
          document_id: null,
          category: txn.category || txn.operationType || 'non_catégorisé',
          amount: txn.side === 'debit' ? -txn.amount : txn.amount,
          currency: txn.currency || 'EUR',
          due_date: txn.settledAt || txn.emittedAt,
          payment_status: txn.status === 'completed' ? 'paid' : 'pending',
          metadata: {
            workspace_id: workspaceId,
            qonto_transaction_id: txn.transactionId,
            label: txn.label,
            side: txn.side,
            operation_type: txn.operationType,
            reference: txn.reference,
          },
        }, { onConflict: 'id' })

      if (error) this.logger.warn(`Failed to store transaction: ${error.message}`)
    }

    // Index in RAG for semantic search
    for (const txn of transactions) {
      const content = `${txn.side === 'debit' ? 'Dépense' : 'Revenu'} de ${txn.amount} ${txn.currency} — ${txn.label} — ${txn.operationType} — ${txn.settledAt || txn.emittedAt}`
      await indexDocument(
        COLLECTIONS.DOCUMENTS,
        {
          content,
          metadata: {
            doc_type: 'bank_transaction',
            amount: txn.amount,
            side: txn.side,
            label: txn.label,
            date: txn.settledAt || txn.emittedAt,
          },
        },
        workspaceId,
        userId,
      ).catch(err => this.logger.warn(`RAG indexing failed for txn: ${err.message}`))
    }

    return {
      organization: org.legal_name || org.slug,
      transactionCount: transactions.length,
      totalCredit: transactions.filter(t => t.side === 'credit').reduce((s, t) => s + t.amount, 0),
      totalDebit: transactions.filter(t => t.side === 'debit').reduce((s, t) => s + t.amount, 0),
    }
  }
}
```

**Step 2: Qonto controller**

`apps/api/src/qonto/qonto.controller.ts`:

```typescript
import { Controller, Post, Param, Body, Req, UseGuards } from '@nestjs/common'
import { QontoService } from './qonto.service'
import { SupabaseAuthGuard } from '../auth/auth.guard'

@Controller('qonto')
@UseGuards(SupabaseAuthGuard)
export class QontoController {
  constructor(private readonly qontoService: QontoService) {}

  @Post(':workspaceId/connect')
  async connect(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
    @Body() body: { login: string; apiKey: string },
  ) {
    const userId = req.user.id
    return this.qontoService.connectAndSync(workspaceId, userId, body.login, body.apiKey)
  }
}
```

**Step 3: Qonto module**

`apps/api/src/qonto/qonto.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { QontoService } from './qonto.service'
import { QontoController } from './qonto.controller'
import { WorkspaceModule } from '../workspace/workspace.module'

@Module({
  imports: [WorkspaceModule],
  providers: [QontoService],
  controllers: [QontoController],
})
export class QontoModule {}
```

**Step 4: Register in app module**

Add `QontoModule` to `app.module.ts` imports.

**Step 5: Build and commit**

```bash
npm run build --workspace=@agent-all/api
git add apps/api/src/qonto/ apps/api/src/app.module.ts
git commit -m "feat: add Qonto API integration with sync and RAG indexing"
```

---

## Phase 5 — Frontend

### Task 8: Onboarding page (3 cartes)

**Files:**
- Create: `apps/web/src/app/dashboard/onboarding/page.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx`

**Step 1: Onboarding page**

`apps/web/src/app/dashboard/onboarding/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const AXES = [
  {
    id: 'idea',
    title: "J'ai une idée",
    description: "Transformez une intuition en projet structuré. Nos agents vous aident à clarifier l'idée, tester son potentiel et définir vos premières hypothèses.",
    agents: ['Idea Agent', 'Market Agent', 'Challenge Agent'],
    icon: '💡',
    gradient: 'from-amber-500/10 to-orange-500/10',
    border: 'border-amber-500/20 hover:border-amber-500/50',
  },
  {
    id: 'launch',
    title: 'Je veux ouvrir une boîte',
    description: "Passez de l'idée à l'activité. Nos agents vous aident à structurer votre offre, préparer votre présence en ligne et lancer vos premiers workflows.",
    agents: ['Business Setup Agent', 'Brand Agent', 'Marketing Agent'],
    icon: '🚀',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/50',
  },
  {
    id: 'existing',
    title: "J'ai déjà une boîte",
    description: "Connectez votre activité à l'Agent OS. Analysez vos process, activez les bons agents et commencez à automatiser ce qui vous freine.",
    agents: ['Ops Agent', 'Finance Agent', 'Admin Agent'],
    icon: '🏢',
    gradient: 'from-emerald-500/10 to-green-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/50',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleSelectAxe(axeType: string) {
    setLoading(axeType)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ axeType }),
      })

      if (!res.ok) throw new Error('Failed to create workspace')
      const workspace = await res.json()
      router.push(`/dashboard/workspace/${workspace.id}`)
    } catch (err) {
      console.error(err)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-950">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-3">Bienvenue sur Agent All</h1>
        <p className="text-gray-400 text-lg">Choisissez votre point de départ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {AXES.map((axe) => (
          <Card
            key={axe.id}
            className={`cursor-pointer transition-all duration-300 bg-gradient-to-br ${axe.gradient} ${axe.border} border-2 hover:scale-105 ${loading === axe.id ? 'opacity-70' : ''}`}
            onClick={() => !loading && handleSelectAxe(axe.id)}
          >
            <CardHeader className="text-center pb-2">
              <div className="text-5xl mb-4">{axe.icon}</div>
              <CardTitle className="text-xl text-white">{axe.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-300 text-sm mb-4">
                {axe.description}
              </CardDescription>
              <div className="flex flex-wrap gap-1">
                {axe.agents.map((agent) => (
                  <span key={agent} className="text-xs bg-white/10 text-gray-300 px-2 py-1 rounded-full">
                    {agent}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && (
        <p className="mt-8 text-gray-400 animate-pulse">Création de votre espace...</p>
      )}
    </div>
  )
}
```

**Step 2: Modify dashboard to redirect if no workspaces**

In `apps/web/src/app/dashboard/page.tsx`, add workspace check at the top of the component. If the user has no workspaces, redirect to `/dashboard/onboarding`. Add a link to access existing workspaces if they exist.

Add this logic to the existing dashboard page — after fetching user/company data, also check workspaces:

```typescript
// After existing company fetch, add:
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id')
  .eq('user_id', user.id)
  .limit(1)

if (!workspaces || workspaces.length === 0) {
  // Show onboarding redirect or embed onboarding
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/onboarding/
git add apps/web/src/app/dashboard/page.tsx
git commit -m "feat: add onboarding page with 3 axes cards"
```

---

### Task 9: Chat workspace page

**Files:**
- Create: `apps/web/src/app/dashboard/workspace/[id]/page.tsx`
- Create: `apps/web/src/components/chat/chat-panel.tsx`
- Create: `apps/web/src/components/chat/message-bubble.tsx`
- Create: `apps/web/src/components/chat/workspace-sidebar.tsx`
- Create: `apps/web/src/components/chat/context-panel.tsx`

**Step 1: Message bubble**

`apps/web/src/components/chat/message-bubble.tsx`:

```tsx
interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export function MessageBubble({ role, content, createdAt }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gray-800 text-gray-100'
      }`}>
        {!isUser && (
          <div className="text-xs text-gray-400 mb-1 font-medium">Agent</div>
        )}
        <div className="text-sm whitespace-pre-wrap">{content}</div>
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
          {new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Chat panel**

`apps/web/src/components/chat/chat-panel.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MessageBubble } from './message-bubble'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

interface ChatPanelProps {
  workspaceId: string
  initialMessages: Message[]
}

export function ChatPanel({ workspaceId, initialMessages }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Send initial greeting if no messages yet
  useEffect(() => {
    if (initialMessages.length === 0) {
      sendMessage('Bonjour')
    }
  }, [])

  async function sendMessage(text?: string) {
    const message = text || input.trim()
    if (!message || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }

    if (!text) {
      setMessages(prev => [...prev, userMsg])
      setInput('')
    }
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/${workspaceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message }),
      })

      if (!res.ok) throw new Error('Chat failed')
      const data = await res.json()

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            createdAt={msg.created_at}
          />
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-800 text-gray-400 rounded-2xl px-4 py-3 text-sm animate-pulse">
              L'agent réfléchit...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez votre message..."
            className="flex-1 bg-gray-800 border-gray-700 text-white"
            disabled={loading}
          />
          <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Workspace sidebar**

`apps/web/src/components/chat/workspace-sidebar.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Workspace {
  id: string
  name: string
  axe_type: string
  status: string
}

const AXE_ICONS: Record<string, string> = {
  idea: '💡',
  launch: '🚀',
  existing: '🏢',
}

export function WorkspaceSidebar({ workspaces }: { workspaces: Workspace[] }) {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase">Workspaces</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {workspaces.map((ws) => {
          const isActive = pathname.includes(ws.id)
          return (
            <Link
              key={ws.id}
              href={`/dashboard/workspace/${ws.id}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              <span>{AXE_ICONS[ws.axe_type] || '📁'}</span>
              <span className="truncate">{ws.name}</span>
            </Link>
          )
        })}
      </div>
      <div className="p-4 border-t border-gray-800">
        <Link
          href="/dashboard/onboarding"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          + Nouveau workspace
        </Link>
      </div>
    </div>
  )
}
```

**Step 4: Context panel**

`apps/web/src/components/chat/context-panel.tsx`:

```tsx
interface ContextPanelProps {
  workspace: {
    axe_type: string
    metadata: Record<string, any>
  }
}

const AXE_LABELS: Record<string, string> = {
  idea: 'Explorer une idée',
  launch: 'Lancer une activité',
  existing: 'Optimiser mon entreprise',
}

export function ContextPanel({ workspace }: ContextPanelProps) {
  const metadata = workspace.metadata || {}
  const qonto = metadata.qonto

  return (
    <div className="w-72 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Contexte</h3>

      <div className="mb-6">
        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
          {AXE_LABELS[workspace.axe_type]}
        </span>
      </div>

      {qonto && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-white mb-2">Qonto connecté</h4>
          <p className="text-xs text-gray-400">{qonto.orgName}</p>
          <p className="text-xs text-gray-500">Connecté le {new Date(qonto.connectedAt).toLocaleDateString('fr-FR')}</p>
        </div>
      )}

      {Object.entries(metadata).filter(([k]) => k !== 'qonto').map(([key, value]) => (
        <div key={key} className="mb-3">
          <h4 className="text-xs font-medium text-gray-400 capitalize">{key.replace(/_/g, ' ')}</h4>
          <p className="text-sm text-white">{typeof value === 'string' ? value : JSON.stringify(value)}</p>
        </div>
      ))}
    </div>
  )
}
```

**Step 5: Workspace page**

`apps/web/src/app/dashboard/workspace/[id]/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ChatPanel } from '@/components/chat/chat-panel'
import { WorkspaceSidebar } from '@/components/chat/workspace-sidebar'
import { ContextPanel } from '@/components/chat/context-panel'

export default function WorkspacePage() {
  const { id } = useParams()
  const [workspace, setWorkspace] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [wsRes, allWsRes, msgRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', id).single(),
      supabase.from('workspaces').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('chat_messages').select('*').eq('workspace_id', id).order('created_at', { ascending: true }),
    ])

    setWorkspace(wsRes.data)
    setWorkspaces(allWsRes.data || [])
    setMessages(msgRes.data || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        Chargement...
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        Workspace introuvable
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <WorkspaceSidebar workspaces={workspaces} />
      <div className="flex-1 flex flex-col">
        <div className="border-b border-gray-800 px-6 py-3">
          <h1 className="text-lg font-semibold text-white">{workspace.name}</h1>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel workspaceId={workspace.id} initialMessages={messages} />
        </div>
      </div>
      <ContextPanel workspace={workspace} />
    </div>
  )
}
```

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/ apps/web/src/components/chat/
git commit -m "feat: add workspace chat UI with sidebar and context panel"
```

---

### Task 10: Dashboard redirect + file upload in chat

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Modify: `apps/web/src/components/chat/chat-panel.tsx`
- Modify: `apps/web/src/middleware.ts`

**Step 1: Dashboard redirect logic**

In `apps/web/src/app/dashboard/page.tsx`, add at the beginning of the component a check for workspaces. If the user has none, show the onboarding page inline or redirect. If they have workspaces, show the existing dashboard plus a "Mes workspaces" section.

**Step 2: Add file upload to chat panel**

Add a file upload button next to the input in `chat-panel.tsx`. When a file is uploaded:

```typescript
async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return

  setLoading(true)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  // Upload to Supabase Storage
  const path = `workspace-docs/${workspaceId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file)

  if (uploadError) {
    console.error(uploadError)
    setLoading(false)
    return
  }

  // Notify chat
  await sendMessage(`J'ai uploadé le fichier : ${file.name}`)
  setLoading(false)
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx apps/web/src/components/chat/chat-panel.tsx apps/web/src/middleware.ts
git commit -m "feat: add dashboard redirect and file upload in chat"
```

---

## Phase 6 — Docker & Deploy

### Task 11: Update Docker config and deploy

**Files:**
- Modify: `apps/api/.env`
- Modify: `apps/workers/.env`
- Modify: `docker/docker-compose.prod.yml`

**Step 1: Add env vars**

Add to `apps/api/.env` and `apps/workers/.env`:

```
QDRANT_URL=http://127.0.0.1:6333
```

**Step 2: Update docker-compose.prod.yml**

Add `QDRANT_URL=http://host.docker.internal:6333` (or the Qdrant container network address) to api and workers environment.

Add `extra_hosts: ["host.docker.internal:host-gateway"]` to api and workers services so they can reach Qdrant on the host.

**Step 3: Rebuild and deploy**

```bash
cd docker
NEXT_PUBLIC_SUPABASE_ANON_KEY=... docker compose -f docker-compose.prod.yml up -d --build
```

**Step 4: Initialize Qdrant collections**

```bash
curl -X PUT http://127.0.0.1:6333/collections/workspace_conversations \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 1536, "distance": "Cosine"}}'

curl -X PUT http://127.0.0.1:6333/collections/workspace_documents \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 1536, "distance": "Cosine"}}'
```

**Step 5: Test the full flow**

1. Login as `fmelerard+user@gmail.com`
2. Should see onboarding page with 3 cards
3. Click "J'ai déjà une boîte"
4. Chat should open with agent greeting
5. Type messages, agent responds
6. In the chat, mention wanting to connect Qonto
7. Agent should ask for credentials
8. Test Qonto sync via API

**Step 6: Commit and push**

```bash
git add -A
git commit -m "feat: deploy onboarding 3 axes with Qonto integration"
git push origin main
```
