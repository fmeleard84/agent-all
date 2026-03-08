# Agent All - CLAUDE.md

## Projet

AI Company Operating System — Plateforme d'orchestration d'agents experts pour piloter une entreprise.

- **Repo** : https://github.com/fmeleard84/agent-all
- **Stack** : TypeScript monorepo (npm workspaces)

## Environnements

| Env | URL | Deploiement |
|-----|-----|-------------|
| **Dev** | dev-agent-all.ialla.fr | `cd docker && docker compose -f docker-compose.dev.yml up -d --build` |
| **Prod** | agent-all.ialla.fr | `cd docker && docker compose -f docker-compose.prod.yml up -d --build` |

## Supabase

- **Project ref** : yojesskmdehepeqkdelp
- **URL** : https://yojesskmdehepeqkdelp.supabase.co
- **Region** : EU West (Ireland)
- **Access token** : stored in env (SUPABASE_ACCESS_TOKEN)

Deploy edge functions:
```bash
supabase functions deploy <nom-fonction> --no-verify-jwt --project-ref yojesskmdehepeqkdelp
```

## Architecture

```
apps/
  web/          Next.js 14 + Tailwind + shadcn/ui (port 3000)
  api/          NestJS + Fastify adapter (port 3001)
  workers/      BullMQ processors (agents)

packages/
  types/            Types partages
  agent-sdk/        BaseAgent + guardrails
  agent-registry/   Registre des agents
  workflow-engine/  Registry + Task Engine + Dependency Resolver
  event-bus/        Abstraction evenements (Supabase Realtime)
  llm/              Multi-provider (Claude + OpenAI)
  database/         Client Supabase + migrations
```

## Stack

- **Frontend** : Next.js 14, Tailwind, shadcn/ui
- **Backend** : NestJS, Fastify adapter
- **Queue** : BullMQ + Redis
- **Database** : Supabase (Postgres)
- **LLM** : Claude (Anthropic) + OpenAI via abstraction
- **Auth** : Supabase Auth (invitation only)
- **Deploy** : Docker Compose + Traefik SSL

## Agents MVP

| Agent | Capabilities |
|-------|-------------|
| email-agent | classify_email, extract_attachments, draft_reply |
| document-agent | detect_type, extract_data, rename_document |
| accounting-agent | categorize_expense, match_invoice, detect_due_date |

## Commandes

```bash
# Dev
npm run dev                          # All workspaces
npm run dev --workspace=@agent-all/web    # Frontend only
npm run dev --workspace=@agent-all/api    # API only

# Build
npm run build                        # All workspaces
npm run build --workspace=@agent-all/web

# Docker dev
cd docker && docker compose -f docker-compose.dev.yml up -d --build

# Docker prod
cd docker && docker compose -f docker-compose.prod.yml up -d --build

# Database seed
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node packages/database/seeds/default-workflows.ts
```

## Conventions

- TypeScript strict mode
- Agents etendent BaseAgent (packages/agent-sdk)
- Workflows declaratifs (JSON dans table workflows)
- RLS sur toutes les tables avec company_id
- Niveaux autonomie : 1 (suggest) → 4 (full auto)
- Actions critiques toujours soumises a validation humaine
