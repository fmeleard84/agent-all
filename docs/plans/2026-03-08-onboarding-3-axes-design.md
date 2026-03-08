# Onboarding 3 Axes — Design Document

## 3 Points d'Entrée vers l'Agent OS

---

## 1. Vision

Permettre à chaque utilisateur d'entrer dans l'Agent OS selon son niveau de maturité :

- **J'ai une idée** = explorer et challenger
- **Je veux ouvrir une boîte** = construire et lancer
- **J'ai déjà une boîte** = connecter, optimiser, automatiser

Ce ne sont pas 3 pages indépendantes mais 3 portes d'entrée vers le même système d'orchestration d'agents.

---

## 2. Architecture

### Flux utilisateur

```
Login → Onboarding Screen (3 axes) → Clic sur un axe
→ Création workspace (DB)
→ Chat agent contextuel (pose les questions, collecte, challenge)
→ Agent structure les données au fil de la conversation
→ Agents spécialisés activés selon le contexte collecté
→ Dashboard workspace avec résultats
```

### Nouveaux composants

| Composant | Rôle |
|-----------|------|
| Onboarding page (`/dashboard/onboarding`) | 3 cartes d'entrée |
| Workspace (entité DB) | Contexte de travail lié à un axe |
| Chat UI (`/dashboard/workspace/[id]`) | Interface conversationnelle |
| Onboarding Agent (nouveau) | Agent conversationnel par axe |
| RAG Service (`packages/rag`) | Client Qdrant + embeddings |
| File Upload (axe 3) | Upload relevés → Document Agent → RAG |
| Qonto Integration (axe 3) | API Qonto → sync transactions → RAG |

### Ce qui ne change pas

- Architecture existante (NestJS API, BullMQ workers, event-bus)
- Les 3 agents MVP (email, document, accounting)
- Système de workflows déclaratifs

---

## 3. Onboarding Agent — Logique par axe

Un seul Onboarding Agent avec 3 modes selon l'axe :

### Axe 1 — "J'ai une idée"

L'agent joue le rôle d'un mentor startup. Il pose des questions pour comprendre l'idée, la cible, la proposition de valeur, puis challenge les hypothèses.

Agents potentiellement activés :
- Idea Agent : reformule et structure l'idée
- Market Agent : marché, cible, concurrents, opportunités
- Positioning Agent : offre et promesse
- Business Model Agent : logique de monétisation
- Challenge Agent : points faibles, objections, angles morts

Résultat : idée clarifiée, cible définie, proposition de valeur nette, décision possible (abandonner, pivoter, créer).

### Axe 2 — "Je veux ouvrir une boîte"

L'agent joue le rôle d'un business coach. Il collecte les infos sur l'offre, le marché visé, le positionnement, puis structure le plan de lancement.

Agents potentiellement activés :
- Business Setup Agent : activité, offre, pricing
- Brand Agent : nom, ton, éléments de marque
- Website Agent : pages, landing, contenus
- Marketing Agent : messages, canaux, contenus
- Prospecting Agent : listes prospects, séquences
- Admin Agent : organisation documentaire, process

Résultat : activité structurée, fondations posées, premiers actifs créés, lancement rapide possible.

### Axe 3 — "J'ai déjà une boîte"

L'agent joue le rôle d'un consultant ops. Il comprend l'activité, les outils existants, les douleurs, puis propose les agents à activer. Propose la connexion Qonto.

Agents potentiellement activés :
- Ops Agent : cartographie process existants
- Email Agent : gestion et tri emails
- Document Agent : classement, extraction
- Admin Agent : tâches récurrentes, devis, factures
- Marketing Agent : visibilité et acquisition
- Sales Agent : pipeline, suivi prospects
- Finance / Cash Agent : revenus, dépenses, flux

Résultat : entreprise comprise, process structurés, tâches répétitives identifiées, premiers gains d'automatisation.

Note : pour le MVP, seul l'Onboarding Agent est implémenté. Les agents spécialisés par axe (Idea, Market, Brand, etc.) sont listés dans le design pour la vision produit mais ne font pas partie de cette implémentation. L'Onboarding Agent utilise le LLM directement avec des system prompts spécialisés par axe pour simuler ces expertises.

---

## 4. RAG & Données

### Qdrant (existant sur 127.0.0.1:6333)

2 nouvelles collections :

| Collection | Contenu | Filtres payload |
|-----------|---------|-----------------|
| `workspace_conversations` | Messages, résumés, insights | `workspace_id`, `user_id`, `axe_type` |
| `workspace_documents` | Relevés, documents, données extraites | `workspace_id`, `user_id`, `doc_type` |

Embeddings : OpenAI `text-embedding-3-small` (1536 dims).

### Flux de données

```
Utilisateur parle → message stocké en DB (chat_messages)
→ Agent répond (LLM avec contexte RAG)
→ Réponse stockée en DB
→ Données structurées extraites → embedding → Qdrant
→ L'agent peut rechercher le contexte passé à chaque échange

Upload document → Supabase Storage
→ Document Agent extrait les données
→ Embedding → Qdrant (workspace_documents)
→ Accounting Agent catégorise (si relevé bancaire)
→ Résultats dans le chat + dashboard
```

### Nouvelles tables DB

```sql
workspaces (id, user_id, company_id, axe_type, name, status, metadata, created_at)
chat_messages (id, workspace_id, role, content, extracted_data, created_at)
workspace_documents (id, workspace_id, file_name, storage_path, doc_type, extracted_data, created_at)
```

---

## 5. Intégration Qonto (Axe 3)

### Deux modes proposés par l'agent dans le chat

> "Pour analyser vos finances, deux options :
> 1. Connecter votre compte Qonto — synchronisation automatique
> 2. Importer un relevé — déposez un fichier CSV ou PDF"

### Option A — API Qonto

Auth : clé API (Secret Key + Login) depuis Qonto > Paramètres > Intégrations.

```
L'agent demande la clé API + login Qonto
→ Stockage chiffré en DB (workspace metadata)
→ Appel API Qonto : GET /v2/transactions (paginé)
→ Transactions stockées en DB (accounting_entries)
→ Embedding → Qdrant (workspace_documents)
→ Accounting Agent catégorise
→ Sync périodique via BullMQ (cron job toutes les heures)
```

Endpoints Qonto utilisés :
- GET /v2/organization — infos entreprise
- GET /v2/transactions — transactions (filtres date, statut)
- GET /v2/bank-accounts — comptes bancaires

### Option B — Import fichier

Upload CSV/PDF → Document Agent → extraction → Accounting Agent → RAG.

### Les deux options alimentent le même RAG

L'agent peut répondre aux questions financières quel que soit le mode d'import.

---

## 6. Interface utilisateur

### Page onboarding (`/dashboard/onboarding`)

Affichée quand l'utilisateur n'a pas encore de workspace. 3 cartes :

| Carte | Titre | Description |
|-------|-------|-------------|
| 1 | J'ai une idée | Transformez une intuition en projet structuré. Nos agents vous aident à clarifier l'idée, tester son potentiel et définir vos premières hypothèses. |
| 2 | Je veux ouvrir une boîte | Passez de l'idée à l'activité. Nos agents vous aident à structurer votre offre, préparer votre présence en ligne et lancer vos premiers workflows. |
| 3 | J'ai déjà une boîte | Connectez votre activité à l'Agent OS. Analysez vos process, activez les bons agents et commencez à automatiser ce qui vous freine. |

Chaque carte affiche les agents qui seront activés.

### Page workspace (`/dashboard/workspace/[id]`)

3 colonnes :
- Gauche : liste des workspaces
- Centre : chat avec l'agent + zone d'upload
- Droite : résumé en temps réel des données structurées extraites

### Routing

- Utilisateur sans workspace → `/dashboard/onboarding`
- Utilisateur avec workspace(s) → `/dashboard` avec accès aux workspaces
- Clic sur un axe → création workspace → `/dashboard/workspace/[id]`

---

## 7. Stack technique

- Qdrant : existant sur 127.0.0.1:6333
- Embeddings : OpenAI text-embedding-3-small (clé existante)
- LLM : OpenAI (existant) pour l'Onboarding Agent
- Nouveau package : `packages/rag` (client Qdrant + embeddings)
- Nouvel agent : `apps/workers/src/agents/onboarding/`
- API Qonto : REST API v2, auth par clé API
- Upload : Supabase Storage (existant)
