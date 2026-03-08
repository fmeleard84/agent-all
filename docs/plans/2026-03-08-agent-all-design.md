# Agent All — Design Document

## AI Company Operating System

Plateforme d'orchestration d'agents experts pour piloter une entreprise.

---

## 1. Vision produit

Permettre a un utilisateur de piloter une entreprise via des agents IA specialises. Chaque entreprise compose sa propre equipe d'agents. Les agents sont reutilisables sur plusieurs entreprises.

### MVP : 3 agents

1. **Email Agent** — classifier, extraire pieces jointes, repondre
2. **Document Agent** — classifier, extraire donnees, stocker
3. **Accounting Agent** — categoriser factures, suivre paiements, exporter

### Flux MVP cible

```
Email entrant → Email Agent → classification: facture
→ Document Agent → extraction donnees
→ Accounting Agent → categorisation + stockage
→ Notification utilisateur
```

---

## 2. Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui |
| Backend | NestJS + Fastify adapter |
| Queue | BullMQ + Redis |
| Database | Supabase (Postgres) |
| LLM | Multi-provider (Claude + OpenAI) via abstraction |
| Auth | Supabase Auth (invitation only) |
| Monorepo | npm workspaces |

---

## 3. Structure monorepo

```
agent-all/
├── apps/
│   ├── web/                # Next.js frontend
│   ├── api/                # NestJS orchestrateur
│   └── workers/            # BullMQ processors (agents)
├── packages/
│   ├── types/              # Types partages (events, agents, workflows, entities)
│   ├── agent-sdk/          # Classe abstraite Agent + interfaces
│   ├── agent-registry/     # Registre des agents + capabilities
│   ├── workflow-engine/    # Registry + Task Engine + Dependency Resolver
│   ├── event-bus/          # Abstraction evenements (Supabase → future Kafka/NATS)
│   ├── llm/                # Abstraction multi-provider (Claude/OpenAI)
│   ├── database/           # Client Supabase + helpers
│   └── utils/              # Helpers communs
├── docker/
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
├── package.json            # npm workspaces root
└── tsconfig.base.json
```

---

## 4. Architecture

```
Event Source (Supabase triggers)
→ Event Bus (abstraction)
→ Orchestrator (NestJS)
→ Workflow Registry (resolve workflow)
→ Workflow Engine (create execution, resolve dependencies)
→ Task Queue (BullMQ)
→ Workers → Agents (execute)
→ Actions
→ Database + Audit Log
```

---

## 5. Workflow Engine

### Workflow Definition (declaratif)

```typescript
interface WorkflowDefinition {
  id: string
  name: string
  trigger: EventType
  companyId?: string           // workflow custom par entreprise (optionnel)
  tasks: TaskDefinition[]
}

interface TaskDefinition {
  id: string
  agentId: string
  action: string
  dependsOn?: string[]
  input?: Record<string, any> | TaskInputRef
  retryPolicy?: { maxRetries: number; backoff: 'exponential' | 'linear' }
  timeout?: number
}
```

### Workflow Registry

```typescript
class WorkflowRegistry {
  resolve(eventType: EventType, companyId: string): WorkflowDefinition
  register(workflow: WorkflowDefinition): void
  list(companyId?: string): WorkflowDefinition[]
}
```

Workflows par defaut (plateforme) + overrides par entreprise. Stockes en DB (table `workflows`).

### Task State Machine

```
PENDING → RUNNING → COMPLETED
                  → FAILED → RETRYING → RUNNING
PENDING → BLOCKED (dependances non resolues)
```

### Dependency Resolver

```typescript
class DependencyResolver {
  getReadyTasks(workflow: WorkflowExecution): TaskExecution[]
  isComplete(workflow: WorkflowExecution): boolean
}
```

### Flux d'execution

1. Event arrive (via event-bus)
2. Orchestrator → WorkflowRegistry.resolve(eventType, companyId)
3. WorkflowEngine cree un WorkflowExecution en DB
4. DependencyResolver identifie les tasks sans dependances
5. Chaque task prete → job BullMQ
6. Worker execute → Agent.execute()
7. Resultat → task COMPLETED → DependencyResolver reevalue
8. Prochaines tasks debloquees → BullMQ
9. Workflow COMPLETED quand toutes les tasks sont done

---

## 6. Agent SDK & Agent Registry

### Agent SDK

```typescript
abstract class BaseAgent {
  abstract id: string
  abstract name: string
  abstract capabilities: string[]
  abstract allowedActions: string[]

  abstract canHandle(event: AgentEvent): boolean
  abstract execute(task: TaskExecution, context: AgentContext): Promise<AgentResult>
}

interface AgentResult {
  status: 'success' | 'failure'
  output: Record<string, any>
  confidence: number
  requiresHumanReview: boolean
  actions: ActionLog[]
}

interface AgentContext {
  llm: LLMProvider
  memory: {
    platform: PlatformMemory
    company: CompanyMemory
    agent: AgentMemory
  }
  company: CompanyInfo
  tools: ToolSet
}
```

### Agent Registry

```typescript
class AgentRegistry {
  register(agent: AgentDefinition): void
  resolve(agentId: string): BaseAgent
  findByCapability(capability: string): AgentDefinition[]
  listForCompany(companyId: string): AgentDefinition[]
}

interface AgentDefinition {
  id: string
  name: string
  capabilities: string[]
  allowedActions: string[]
  autonomyLevel: 1 | 2 | 3 | 4
  tools: string[]
}
```

### Agents MVP

| Agent | Capabilities | Actions autorisees |
|---|---|---|
| email-agent | classify_email, extract_attachments, draft_reply | reply_email, forward_to_agent, archive_email, create_task |
| document-agent | detect_type, extract_data, rename_document | store_document, notify_accounting |
| accounting-agent | categorize_expense, match_invoice, detect_due_date | create_entry, generate_export, notify_payment |

### Guardrails

Actions qui requierent toujours une validation humaine :
- pay_invoice
- delete_document
- delete_email
- contractual_commitment
- send_external_email_first_time

---

## 7. Memory Layer

### 3 niveaux

**Memoire plateforme (globale)**
- Taxonomie documents (facture, devis, contrat, releve)
- Workflows standards
- Regles generiques

**Memoire entreprise** (table `company_memory`)
- Preferences
- Services connectes
- Regles internes (ex: facture > 5000 EUR → validation manuelle)
- Categories custom

**Memoire agent par entreprise** (table `agent_memory`)
- Decisions precedentes
- Corrections humaines (apprentissage)
- Statistiques (taux de succes, temps moyen)

Les corrections humaines sont reinjectees dans le contexte agent pour ameliorer les futures decisions.

---

## 8. Modele de donnees

### Tables principales

```sql
-- Multi-tenant
companies (id, name, settings, created_at)

-- Utilisateurs (Supabase Auth)
company_users (id, company_id, user_id, role, invited_by, created_at)

-- Agents actives par entreprise
company_agents (id, company_id, agent_id, autonomy_level, config, enabled, created_at)

-- Workflows
workflows (id, company_id, trigger_event, definition, enabled, created_at)

-- Executions de workflows
workflow_executions (id, workflow_id, company_id, status, trigger_event, started_at, completed_at)

-- Tasks (steps d'un workflow)
task_executions (id, workflow_execution_id, task_def_id, agent_id, action, status, input, output, confidence, attempts, started_at, completed_at)

-- Journal d'audit
audit_log (id, company_id, workflow_execution_id, task_execution_id, agent_id, action, result, confidence, human_override, metadata, created_at)

-- Memoire entreprise
company_memory (id, company_id, preferences, connected_services, internal_rules, custom_categories)

-- Memoire agent par entreprise
agent_memory (id, agent_id, company_id, decisions, corrections, stats, updated_at)

-- Documents traites
documents (id, company_id, type, original_name, storage_path, extracted_data, source, created_at)

-- Emails traites
emails (id, company_id, from_address, subject, category, raw_content, attachments, processed, created_at)

-- Entrees comptables
accounting_entries (id, company_id, document_id, category, amount, currency, due_date, payment_status, metadata, created_at)
```

RLS sur toutes les tables avec `company_id` pour isolation multi-tenant.

---

## 9. Event Bus & Connecteurs

### Event Bus

```typescript
interface EventBus {
  emit(event: AgentEvent): Promise<void>
  subscribe(eventType: EventType, handler: EventHandler): void
}

// Implementation MVP : Supabase DB triggers + Realtime
// Future : Kafka, NATS, Redis Streams

interface AgentEvent {
  id: string
  type: EventType
  companyId: string
  payload: Record<string, any>
  source: string
  timestamp: Date
}

type EventType =
  | 'EMAIL_RECEIVED'
  | 'DOCUMENT_UPLOADED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'MANUAL_TRIGGER'
```

### Connecteurs MVP

| Connecteur | Role | Implementation |
|---|---|---|
| Email (Gmail) | Recevoir/envoyer | Google API + webhook push |
| Stockage documents | Stocker/recuperer | Supabase Storage |
| API Compta | Export comptable | CSV/JSON export |

---

## 10. Interface utilisateur MVP

### Pages

```
/                        → Landing (login/invitation)
/dashboard               → Dashboard principal (KPIs + activite recente + agents)
/dashboard/activity      → Centre d'activite agents (flux temps reel)
/dashboard/agents        → Agents actives + config autonomie
/dashboard/documents     → Documents traites
/dashboard/emails        → Emails traites
/dashboard/accounting    → Entrees comptables
/dashboard/validations   → Actions en attente de validation humaine
/dashboard/settings      → Parametres entreprise + connecteurs
```

### Dashboard principal

- KPIs : emails traites, documents classes, factures traitees, actions en attente
- Activite recente : flux temps reel des actions agents
- Agents actifs : statut + niveau d'autonomie

### Page validations

- Liste des actions en attente
- Pour chaque action : agent, action, donnees, confiance
- Boutons : Approuver / Corriger / Rejeter
- Les corrections alimentent agent_memory.corrections

---

## 11. Niveaux d'autonomie

| Niveau | Comportement |
|---|---|
| 1 — Suggest | Analyse et propose, n'execute rien |
| 2 — Auto-simple | Execute actions simples, demande pour le reste |
| 3 — Auto-guarded | Execute tout sauf actions critiques |
| 4 — Full auto | Autonomie complete sur actions autorisees |

### Actions toujours soumises a validation

- pay_invoice
- delete_document
- delete_email
- contractual_commitment
- send_external_email_first_time

### Seuils configurables par entreprise

- require_approval_above_amount (EUR)
- require_approval_low_confidence (0-1)
- max_auto_emails_per_day
- blocked_actions

### Flux de decision

```
Agent veut executer une action
→ ALWAYS_REQUIRE_APPROVAL ? → validation humaine
→ Montant > seuil ? → validation humaine
→ Confiance < seuil ? → validation humaine
→ Action bloquee ? → refuse
→ Autonomy level suffisant ? → execute
→ Sinon → validation humaine
```

---

## 12. Deploiement

### Environnements

| Env | Domaine | Infra |
|---|---|---|
| Dev | dev-agent-all.ialla.fr | Docker Compose, hot reload |
| Prod | agent-all.ialla.fr | Docker Compose, Traefik SSL |

### Docker Compose (prod)

```
services:
  web        → Next.js (port 3000)
  api        → NestJS (port 3001)
  workers    → BullMQ processors
  redis      → Queue BullMQ
  traefik    → Reverse proxy + SSL Let's Encrypt
```

DB = Supabase cloud (pas de Postgres local).

### Supabase

- Project ref : yojesskmdehepeqkdelp
- URL : https://yojesskmdehepeqkdelp.supabase.co
- Region : EU West (Ireland)

### CI/CD

MVP : deploiement manuel via `docker compose up -d --build`.
Evolution : GitHub Actions.

---

## 13. Infos projet

- **Repo** : https://github.com/fmeleard84/agent-all
- **Supabase project ref** : yojesskmdehepeqkdelp
- **Supabase access token** : sbp_1260385f4c6b1b3b3e9ccb789d176777e22e1765
