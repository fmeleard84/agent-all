# Validation Actions Enrichment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrichir les actions de validation pour qu'elles soient spécifiques au projet (contexte conversation), ajouter l'action "Identité & Positionnement", améliorer la LP avec storytelling + formulaire, et passer le layout en pleine largeur.

**Architecture:** On injecte l'historique de conversation dans `generateAction()` pour que chaque action ait le contexte complet du projet. On ajoute une 6ème action "Identité & Positionnement" (branding). On réécrit tous les prompts pour exiger de la spécificité. Côté front, on enlève `max-w-5xl` et on ajoute la nouvelle action.

**Tech Stack:** NestJS (API), Next.js (Web), OpenAI GPT-4o, Supabase

---

### Task 1: Fix layout — pleine largeur avec padding

**Files:**
- Modify: `apps/web/src/app/dashboard/workspace/[id]/validation/page.tsx:351`

**Step 1: Change the container class**

In `validation/page.tsx` line 351, replace:
```tsx
<div className="px-8 py-8 space-y-8 max-w-5xl mx-auto">
```
with:
```tsx
<div className="px-8 py-8 space-y-8">
```

**Step 2: Verify visually**

The page should now use the full available width with 32px padding on each side.

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/\[id\]/validation/page.tsx
git commit -m "fix: remove max-width constraint on validation page"
```

---

### Task 2: Inject conversation history into action generation (API)

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts:121-153` (generateAction method)
- Modify: `apps/api/src/chat/chat.service.ts:155-236` (buildActionPrompt method)

**Step 1: Modify `generateAction` to fetch conversation history**

In `chat.service.ts`, replace the `generateAction` method:

```typescript
async *generateAction(workspaceId: string, actionType: string): AsyncGenerator<string> {
  const workspace = await this.workspaceService.findById(workspaceId)
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)

  const dashboard = (workspace as any).metadata?.dashboard
  if (!dashboard) throw new Error('No dashboard data available')

  // Fetch conversation history for rich context
  const messages = await this.workspaceService.getMessages(workspaceId, 20)
  const conversationContext = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `[${m.role === 'user' ? 'Entrepreneur' : 'Mentor'}]: ${m.content}`)
    .join('\n\n')

  const prompt = this.buildActionPrompt(actionType, dashboard, conversationContext)
  if (!prompt) throw new Error(`Unknown action type: ${actionType}`)

  const stream = await this.openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.7,
    max_tokens: 6000,
    stream: true,
  })

  let fullResponse = ''
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content
    if (content) {
      fullResponse += content
      yield content
    }
  }

  this.extractAndStoreAction(workspaceId, actionType, fullResponse)
}
```

**Step 2: Update `buildActionPrompt` signature to accept conversation**

Change the method signature from:
```typescript
private buildActionPrompt(actionType: string, dashboard: Record<string, unknown>): { system: string; user: string } | null {
```
to:
```typescript
private buildActionPrompt(actionType: string, dashboard: Record<string, unknown>, conversation: string): { system: string; user: string } | null {
```

And update the `context` variable to include the conversation:
```typescript
const context = `=== CONVERSATION COMPLETE AVEC L'ENTREPRENEUR ===
${conversation}

=== DONNEES STRUCTUREES DU DASHBOARD ===
Resume: ${summary}
Verdict: ${verdict}
Forces: ${strengths}
Marche: ${market}
Concurrents: ${competitors}`
```

**Step 3: Commit**

```bash
git add apps/api/src/chat/chat.service.ts
git commit -m "feat: inject conversation history into action generation context"
```

---

### Task 3: Add "Identité & Positionnement" action (API)

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts:155-236` (buildActionPrompt — add branding entry)

**Step 1: Add the `branding` prompt to the `prompts` object inside `buildActionPrompt`**

Add this entry to the `prompts` record, after the `tracker` entry:

```typescript
branding: {
  system: `Tu es un directeur de strategie de marque avec 20 ans d'experience en branding startup. Tu as travaille avec des marques comme Doctolib, Alan, Qonto, Pennylane — tu sais comment on construit un positionnement fort a partir de zero.

Tu dois produire une ANALYSE STRATEGIQUE COMPLETE de l'identite de marque, basee sur la conversation reelle avec l'entrepreneur. PAS de conseils generiques — tout doit etre specifique a CE projet, CE marche, CE positionnement.

STRUCTURE OBLIGATOIRE :

## 1. Analyse concurrentielle approfondie
Pour chaque concurrent majeur (3-5) :
- Leur positionnement exact (tagline, promesse, ton)
- Leurs forces et faiblesses de marque
- Leur pricing et perception de valeur
- Les failles dans leur communication ou tu peux t'engouffrer

## 2. Ton positionnement unique
- Le "territory de marque" : l'espace que tu occupes et que personne d'autre ne prend
- La promesse centrale en une phrase (pas un slogan — la verite profonde de ton offre)
- Le "enemy" : contre quoi tu te bats (un systeme, une habitude, un concurrent)
- Le "belief" : ce que tu crois que les autres ne croient pas encore

## 3. Posture de marque
- Personnalite (5 traits de caractere avec exemples concrets d'expression)
- Ton de voix : formel/informel, expert/accessible, provocateur/rassurant — avec 3 exemples de phrases dans ce ton
- Ce que ta marque dit vs ce que ta marque ne dit JAMAIS
- References visuelles et d'attitude (2-3 marques qui inspirent le bon registre, meme hors secteur)

## 4. Arsenal de wording
- Tagline principale (3 propositions avec justification)
- Pitch 30 secondes (ecrit mot pour mot)
- Pitch email (3 lignes pour du cold outreach)
- 5 phrases cles reutilisables (pour LP, posts LinkedIn, pitch deck)
- Les mots a utiliser vs les mots a eviter

## 5. Insights marche & angles differenciants
- 3 insights marche que tes concurrents ignorent ou sous-exploitent
- Ton angle d'attaque principal et pourquoi il fonctionne maintenant
- Les arguments commerciaux classes par force (must-have vs nice-to-have)

## 6. Recommandations identite visuelle
- Direction de palette couleurs (avec justification strategique)
- Style typographique recommande (serif/sans-serif, moderne/classique)
- Mood board textuel : 5 mots-cles visuels qui definissent l'univers
- NE PAS generer de logo — donner les principes directeurs

A la fin, genere un bloc \`\`\`json avec les donnees structurees.
Reponds en francais. Sois tranchant, specifique, et ancre dans la realite du projet.`,
  user: `${context}

Analyse cette conversation en profondeur. L'entrepreneur a discute de son projet avec un mentor — utilise TOUT ce contexte pour produire une analyse de marque ULTRA SPECIFIQUE a son cas.

A la fin, genere un bloc JSON avec:
{
  "positioning": { "territory": "...", "promise": "...", "enemy": "...", "belief": "..." },
  "personality": { "traits": ["...", "...", "...", "...", "..."], "toneOfVoice": "...", "doesSay": ["..."], "neverSays": ["..."] },
  "taglines": [{ "text": "...", "rationale": "..." }],
  "pitches": { "thirtySeconds": "...", "email": "...", "keyPhrases": ["..."] },
  "competitiveInsights": [{ "competitor": "...", "strength": "...", "weakness": "...", "opportunity": "..." }],
  "marketInsights": ["...", "...", "..."],
  "visualDirection": { "colors": "...", "typography": "...", "moodKeywords": ["..."] },
  "status": "generated"
}`
},
```

**Step 2: Commit**

```bash
git add apps/api/src/chat/chat.service.ts
git commit -m "feat: add branding/identity action prompt"
```

---

### Task 4: Rewrite landing page prompt for storytelling + real lead capture

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts:169-178` (landing prompt in buildActionPrompt)

**Step 1: Replace the landing page prompt**

Replace the existing `landing` entry in `prompts` with:

```typescript
landing: {
  system: `Tu es un expert en copywriting de conversion et en landing pages. Tu as cree des pages pour YC startups, des SaaS B2B, et des produits consumer. Tu sais que le storytelling bat toujours les bullet points.

REGLES ABSOLUES :
- Tu DOIS lire la conversation complete pour comprendre le positionnement EXACT du projet
- AUCUN texte generique. Chaque phrase doit etre specifique a CE projet
- Le storytelling doit suivre le framework PAS (Problem → Agitation → Solution)
- La page doit donner envie de laisser son email, pas juste "informer"

STRUCTURE DE LA PAGE HTML :
1. **Hero** : Headline percutant (pas descriptif — emotionnel), sous-titre qui explique la valeur en 1 phrase, CTA email capture
2. **Le probleme** : Storytelling du probleme vecu par le client cible (3-4 phrases narratives, pas des bullet points)
3. **L'agitation** : Pourquoi les solutions actuelles ne marchent pas (nommer les alternatives et leurs defauts)
4. **La solution** : Comment ce projet resout le probleme differemment (3 benefices concrets avec chiffres si possible)
5. **Social proof / credibilite** : Temoignage fictif realiste OU chiffres du marche OU argument d'autorite
6. **CTA final** : Formulaire email avec micro-copy persuasif + message de confirmation

SPECIFICATIONS TECHNIQUES :
- HTML complet avec CSS inline, responsive, mobile-first
- Style minimaliste premium (Stripe/Linear/Vercel)
- Fond blanc, texte sombre, accent violet (#7c3aed)
- Font : Inter via Google Fonts
- Le formulaire email doit avoir : input email, bouton CTA, texte de reassurance ("Pas de spam, juste les actus")
- Le formulaire doit utiliser l'attribut action="https://formspree.io/f/placeholder" method="POST" pour etre fonctionnel (l'utilisateur remplacera le placeholder)
- Animations CSS subtiles (fade-in au scroll avec IntersectionObserver)
- Meta tags Open Graph pour le partage social

IMPORTANT : Genere le HTML complet dans un bloc \`\`\`html ... \`\`\` puis un bloc \`\`\`json avec les metadonnees.
Reponds en francais.`,
  user: `${context}

Landing page test data: ${landingPageTest}
MVP: ${mvpPlan}

IMPORTANT : Lis attentivement la conversation ci-dessus. Le positionnement, le storytelling, et le wording doivent refleter EXACTEMENT ce qui a ete discute. Pas de contenu generique.

Genere une landing page de validation premium. Le but : capturer des emails de personnes reellement interessees.

A la fin, genere un bloc JSON avec: {"title": "...", "description": "...", "emailPlaceholder": "...", "ctaText": "...", "status": "generated"}`
},
```

**Step 2: Commit**

```bash
git add apps/api/src/chat/chat.service.ts
git commit -m "feat: rewrite landing page prompt with storytelling + email capture"
```

---

### Task 5: Improve interview, prospects, pricing, tracker prompts

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts` (all remaining prompts in buildActionPrompt)

**Step 1: Replace the `interview` prompt**

```typescript
interview: {
  system: `Tu es un expert en customer discovery (methode "The Mom Test" de Rob Fitzpatrick). Tu as conduit 500+ interviews clients pour des startups early-stage.

REGLE ABSOLUE : Tu dois lire la conversation complete et generer un script SPECIFIQUE a ce projet. Pas de template generique.

Genere un script d'interview complet :

## Script d'introduction
- Comment trouver et approcher la personne (ou, comment, quel pretexte)
- Phrase d'accroche exacte (mot pour mot)
- Comment cadrer les 20 minutes d'interview

## Questions principales (7-8)
Pour chaque question :
- La question exacte a poser
- POURQUOI tu poses cette question (quel signal tu cherches)
- Les reponses "green flag" vs "red flag"
- La question de relance si la reponse est vague

## Pieges a eviter
- Les 5 erreurs specifiques a ce type de produit/marche
- Les biais cognitifs a surveiller pendant l'interview

## Grille de scoring
- Comment noter chaque interview (1-10) sur 5 criteres
- Le seuil pour considerer que le probleme est valide
- Combien d'interviews faire et quand s'arreter

## Template de compte-rendu
- Les 5 champs a remplir apres chaque interview

A la fin, genere un bloc \`\`\`json avec le script structure.
Reponds en francais.`,
  user: `${context}

Validation client: ${clientValidation}

Genere un script d'interview Mom Test SPECIFIQUE a ce projet. Chaque question doit etre taillee pour le client cible identifie dans la conversation.

A la fin, genere un bloc JSON avec: {"intro": "...", "questions": [{"question": "...", "why": "...", "greenFlags": ["..."], "redFlags": ["..."]}], "pitfalls": ["..."], "scoringGrid": {...}, "status": "generated"}`
},
```

**Step 2: Replace the `prospects` prompt**

```typescript
prospects: {
  system: `Tu es un expert en outbound sales et acquisition early-stage. Tu as aide 100+ startups a trouver leurs premiers clients quand personne ne les connait.

REGLE ABSOLUE : Tu dois lire la conversation complete. Les canaux, les messages, les cibles doivent etre 100% specifiques a CE projet.

Genere un plan d'acquisition complet :

## Persona client ideal
- Nom fictif, age, poste, entreprise type
- Sa journee type et ou il a le probleme
- Ce qu'il google quand il cherche une solution
- Ce qui le ferait payer demain

## 5 canaux concrets (avec noms exacts)
Pour chaque canal :
- Le canal exact (nom du groupe LinkedIn, subreddit, forum, salon, communaute Slack)
- Pourquoi CE canal pour CE projet
- Le nombre de prospects atteignables
- Le cout (temps ou argent)

## 3 templates de message (mot pour mot)
- Message froid LinkedIn (connection + follow-up)
- Email froid (sujet + corps)
- Message communaute/forum (non-spammy, valeur d'abord)

## Sequence de relance
- J+0 : premier contact
- J+3 : relance 1 (quelle approche)
- J+7 : relance 2 (quel angle different)
- J+14 : dernier essai (quelle offre)

## Objectifs et metriques
- Taux de reponse attendu par canal
- Nombre de contacts par jour pour atteindre 10 clients en 30 jours
- Quand pivoter si ca ne marche pas

A la fin, genere un bloc \`\`\`json avec le plan structure.
Reponds en francais.`,
  user: `${context}

Plan 10 premiers clients: ${firstTenCustomers}

Genere un plan d'acquisition ULTRA SPECIFIQUE. Des vrais noms de groupes, des vrais messages, des vrais chiffres.

A la fin, genere un bloc JSON avec: {"persona": {...}, "channels": [...], "templates": [...], "sequence": [...], "metrics": {...}, "status": "generated"}`
},
```

**Step 3: Replace the `pricing` prompt**

```typescript
pricing: {
  system: `Tu es un expert en pricing de startups. Tu as aide a definir les modeles de prix de 50+ SaaS/services. Tu connais Van Westendorp, le Conjoint Analysis, et surtout le bon sens terrain.

REGLE ABSOLUE : Lis la conversation complete. Le pricing doit refleter le positionnement exact, les concurrents mentionnes, et la cible identifiee.

Genere une strategie de pricing complete :

## Benchmark concurrentiel detaille
- Tableau comparatif (concurrent, prix, ce qui est inclus, positionnement)
- Ou se situe le "trou" dans le marche (prix non couverts)

## 3 options de pricing
Pour chaque option :
- Le prix exact et ce qui est inclus
- Le type de client qui choisirait cette option
- La marge estimee
- Pourquoi ce prix (ancrage psychologique, comparaison marche)

## Recommandation
- L'option recommandee et le raisonnement detaille
- Comment l'annoncer (le framing du prix)
- Les objections previsibles et comment y repondre

## Test de willingness-to-pay
- Message exact a envoyer (email ou LinkedIn) pour tester le prix
- Landing page avec prix : quoi mettre pour valider sans vendre
- Methode Van Westendorp simplifiee (4 questions a poser)
- Combien de reponses il faut pour valider

## Strategie d'evolution
- Prix de lancement vs prix cible a 12 mois
- Quand et comment augmenter le prix
- Grandfathering : comment traiter les early adopters

A la fin, genere un bloc \`\`\`json avec la strategie structuree.
Reponds en francais.`,
  user: `${context}

Benchmark pricing: ${pricingBenchmark}

Genere une strategie de pricing SPECIFIQUE a ce projet avec des prix concrets, un benchmark reel, et un plan de test.

A la fin, genere un bloc JSON avec: {"benchmark": [...], "options": [...], "recommended": {...}, "testMessage": "...", "testMethod": "...", "evolution": {...}, "status": "generated"}`
},
```

**Step 4: Replace the `tracker` prompt**

```typescript
tracker: {
  system: `Tu es un expert en metriques de validation startup. Tu sais que 90% des entrepreneurs trackent les mauvaises metriques. Tu aides a se concentrer sur les signaux qui comptent.

REGLE ABSOLUE : Lis la conversation complete. Les metriques doivent etre specifiques a CE type de projet et CE marche.

Genere un systeme de suivi de validation :

## Les 5 metriques qui comptent (pas plus)
Pour chaque metrique :
- Nom et definition precise
- Comment la mesurer (outil gratuit)
- Seuil vert / orange / rouge
- Pourquoi cette metrique est critique pour CE projet

## Tableau de bord hebdomadaire
- Template avec les colonnes exactes
- Ce qu'il faut remplir chaque vendredi (10 min max)
- Les questions a se poser en regardant les chiffres

## Criteres Go / No-Go
- Les 3 conditions pour foncer (all must be true)
- Les 3 red flags pour pivoter
- Le signal pour arreter completement
- Le timeframe : combien de semaines de validation avant de decider

## Outils recommandes (gratuits)
- Pour le tracking : quel outil, comment le configurer en 15 min
- Pour les analytics LP : quel outil, quoi regarder
- Pour le CRM prospects : quel outil, quel setup minimal

A la fin, genere un bloc \`\`\`json avec le tracker structure.
Reponds en francais.`,
  user: `${context}

Genere un systeme de tracking de validation ADAPTE a ce projet. Pas de metriques generiques — des signaux specifiques a son marche et son modele.

A la fin, genere un bloc JSON avec: {"metrics": [...], "weeklyTemplate": {...}, "goNoGo": {"go": [...], "pivot": [...], "stop": [...]}, "tools": [...], "timeframe": "...", "status": "generated"}`
},
```

**Step 5: Commit**

```bash
git add apps/api/src/chat/chat.service.ts
git commit -m "feat: rewrite all action prompts for specificity and depth"
```

---

### Task 6: Add branding action to frontend

**Files:**
- Modify: `apps/web/src/app/dashboard/workspace/[id]/validation/page.tsx:45-96` (ACTIONS array)

**Step 1: Add the branding action to the ACTIONS array**

Add this entry as the FIRST item in the `ACTIONS` array (before `landing`), and add the `Palette` import from lucide-react:

Add `Palette` to the lucide-react import line.

New entry at the start of ACTIONS:
```typescript
{
  key: 'branding',
  title: 'Definir ton identite & positionnement',
  description: 'Analyse concurrentielle, posture de marque, wording et arguments differenciants.',
  why: 'Sans positionnement clair, ta landing page et tes messages seront generiques — et personne ne s\'en souviendra.',
  icon: Palette,
  color: 'text-orange-600 dark:text-orange-400',
  bgColor: 'bg-orange-50 dark:bg-orange-950/20',
  borderColor: 'border-orange-200 dark:border-orange-800',
},
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/\[id\]/validation/page.tsx
git commit -m "feat: add branding action card to validation page"
```

---

### Task 7: Increase max_tokens for richer outputs

**Files:**
- Already handled in Task 2 (max_tokens: 6000)

This is already covered by the `generateAction` rewrite in Task 2. The max_tokens was bumped from 4000 to 6000 to allow for richer, more detailed outputs.

No additional changes needed. Skip to next task.

---

### Task 8: Build and verify

**Step 1: Build API**

```bash
cd /opt/agent-more && npm run build --workspace=@agent-all/api
```

Expected: Clean build with no errors.

**Step 2: Build Web**

```bash
cd /opt/agent-more && npm run build --workspace=@agent-all/web
```

Expected: Clean build with no errors.

**Step 3: Final commit if needed**

Fix any build errors and commit.
