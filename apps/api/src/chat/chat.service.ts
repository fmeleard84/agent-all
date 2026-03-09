import { Injectable, Logger } from '@nestjs/common'
import { WorkspaceService } from '../workspace/workspace.service'
import { indexDocument, search, COLLECTIONS } from '@agent-all/rag'
import { SYSTEM_PROMPTS } from './prompts'
import OpenAI from 'openai'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private openai: OpenAI

  constructor(private readonly workspaceService: WorkspaceService) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async *chatStream(workspaceId: string, userMessage: string, userId: string): AsyncGenerator<string> {
    // 1. Get workspace + store message + get history in parallel
    const [workspace, , messages] = await Promise.all([
      this.workspaceService.findById(workspaceId),
      this.workspaceService.addMessage(workspaceId, 'user', userMessage),
      this.workspaceService.getMessages(workspaceId, 20),
    ])

    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`)
    }

    // 2. Search RAG only if enough history
    let ragContext = ''
    if (messages.length > 8) {
      try {
        const results = await search(COLLECTIONS.CONVERSATIONS, userMessage, workspaceId, 3)
        if (results.length > 0) {
          ragContext = '\n\nContexte des echanges precedents:\n' + results.map((r: { content: string }) => r.content).join('\n---\n')
        }
      } catch (err) {
        this.logger.warn(`RAG search failed: ${err}`)
      }
    }

    // 3. Build chat messages
    const axeType = workspace.axeType || (workspace as any).axe_type || 'idea'
    const systemPrompt = SYSTEM_PROMPTS[axeType] || SYSTEM_PROMPTS['idea']

    const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + ragContext },
    ]

    for (const m of messages) {
      if (m.role === 'user' || m.role === 'assistant') {
        chatMessages.push({ role: m.role, content: m.content })
      }
    }

    chatMessages.push({ role: 'user', content: userMessage })

    // 4. Stream response
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 4000,
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

    // 5. Store full response + RAG indexing (non-blocking)
    await this.workspaceService.addMessage(workspaceId, 'assistant', fullResponse)
    this.indexInBackground(workspaceId, userId, userMessage, fullResponse)

    // 6. Extract dashboard JSON if present in response
    this.extractAndStoreDashboard(workspaceId, fullResponse)
  }

  private extractAndStoreDashboard(workspaceId: string, response: string) {
    try {
      const jsonMatch = response.match(/```json\s*\n([\s\S]*?)\n```/)
      if (!jsonMatch) return

      const parsed = JSON.parse(jsonMatch[1])
      if (parsed.scores || parsed.verdict || parsed.competitors) {
        this.workspaceService.updateMetadata(workspaceId, { dashboard: parsed }).catch((err) => {
          this.logger.warn(`Failed to store dashboard: ${err}`)
        })
      }
    } catch {
      // Not valid JSON or no dashboard data — ignore
    }
  }

  async extractDocumentText(fileBuffer: Buffer, fileName: string): Promise<string> {
    const ext = fileName.toLowerCase().split('.').pop()

    if (ext === 'pdf') {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(fileBuffer)
      return data.text
    }

    if (ext === 'txt' || ext === 'csv') {
      return fileBuffer.toString('utf-8')
    }

    // For other types, return a note
    return `[Document ${fileName} uploade - type ${ext} non supporte pour l'extraction automatique]`
  }

  async getWorkspaceWithActions(workspaceId: string) {
    return this.workspaceService.findById(workspaceId)
  }

  async *generateAction(workspaceId: string, actionType: string, uploadedDocument?: string): AsyncGenerator<string> {
    const workspace = await this.workspaceService.findById(workspaceId)
    if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)

    const dashboard = (workspace as any).metadata?.dashboard
    if (!dashboard) throw new Error('No dashboard data available')

    // Fetch conversation history for richer context
    const messages = await this.workspaceService.getMessages(workspaceId, 20)
    const conversationContext = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `[${m.role === 'user' ? 'Entrepreneur' : 'Mentor'}]: ${m.content}`)
      .join('\n\n')

    const metadata = (workspace as any).metadata || {}
    const prompt = this.buildActionPrompt(actionType, dashboard, conversationContext, uploadedDocument, metadata)
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

    // Extract JSON and store in metadata.actions
    this.extractAndStoreAction(workspaceId, actionType, fullResponse)
  }

  private buildActionPrompt(actionType: string, dashboard: Record<string, unknown>, conversation: string, uploadedDocument?: string, metadata?: Record<string, any>): { system: string; user: string } | null {
    const summary = dashboard.summary || ''
    const verdict = dashboard.verdict || ''
    const competitors = JSON.stringify(dashboard.competitors || [])
    const market = JSON.stringify(dashboard.market || {})
    const strengths = JSON.stringify(dashboard.strengths || [])
    const clientValidation = JSON.stringify(dashboard.clientValidation || {})
    const mvpPlan = JSON.stringify(dashboard.mvpPlan || {})
    const pricingBenchmark = JSON.stringify(dashboard.pricingBenchmark || [])
    const landingPageTest = JSON.stringify(dashboard.landingPageTest || {})
    const firstTenCustomers = JSON.stringify(dashboard.firstTenCustomers || [])

    const context = `=== CONVERSATION COMPLETE AVEC L'ENTREPRENEUR ===
${conversation}

=== DONNEES STRUCTUREES DU DASHBOARD ===
Resume: ${summary}
Verdict: ${verdict}
Forces: ${strengths}
Marche: ${market}
Concurrents: ${competitors}`

    const documentContext = uploadedDocument
      ? `\n\n=== DOCUMENT UPLOADE PAR L'ENTREPRENEUR ===\n${uploadedDocument.substring(0, 6000)}\n\nINSTRUCTION : Analyse ce document existant. Integre ses elements dans ton resultat. Complete ce qui manque, ameliore ce qui peut l'etre, et signale les incoherences si tu en trouves.`
      : ''

    const fullContext = context + documentContext

    const prompts: Record<string, { system: string; user: string }> = {
      landing: {
        system: `Tu es un expert en copywriting de conversion et en landing pages. Tu as cree des pages pour YC startups, des SaaS B2B, et des produits consumer. Tu sais que le storytelling bat toujours les bullet points.

REGLES ABSOLUES :
- Tu DOIS lire la conversation complete pour comprendre le positionnement EXACT du projet
- AUCUN texte generique. Chaque phrase doit etre specifique a CE projet
- Le storytelling doit suivre le framework PAS (Problem → Agitation → Solution)
- La page doit donner envie de laisser son email, pas juste "informer"

Tu dois generer UNIQUEMENT un JSON structure. Pas de HTML. Le JSON sera utilise par un template Next.js fixe.

Si des donnees d'identite visuelle ou de wording existent, utilise-les (couleurs, fonts, taglines, positionnement).

Le JSON doit suivre EXACTEMENT cette structure :
{
  "sections": {
    "hero": {
      "enabled": true,
      "headline": "Headline percutant et emotionnel — pas descriptif",
      "subheadline": "Sous-titre qui explique la valeur en 1 phrase claire",
      "ctaText": "Texte du bouton CTA"
    },
    "problem": {
      "enabled": true,
      "title": "Titre de la section probleme",
      "painPoints": ["Point de douleur 1 (phrase narrative)", "Point 2", "Point 3"]
    },
    "solution": {
      "enabled": true,
      "title": "Titre de la section solution",
      "description": "Description en 2-3 phrases de comment le projet resout le probleme",
      "features": [
        { "title": "Titre feature 1", "description": "Description concrete avec chiffre si possible" },
        { "title": "Titre feature 2", "description": "Description" },
        { "title": "Titre feature 3", "description": "Description" }
      ]
    },
    "benefits": {
      "enabled": true,
      "title": "Titre de la section benefices",
      "items": [
        { "icon": "zap", "title": "Benefice 1", "description": "Description" },
        { "icon": "shield", "title": "Benefice 2", "description": "Description" },
        { "icon": "clock", "title": "Benefice 3", "description": "Description" }
      ]
    },
    "testimonial": {
      "enabled": true,
      "quote": "Temoignage fictif realiste d'un early adopter",
      "author": "Prenom Nom",
      "role": "Poste",
      "company": "Entreprise"
    },
    "cta": {
      "enabled": true,
      "title": "Titre d'appel a l'action final",
      "subtitle": "Sous-titre persuasif",
      "ctaText": "Texte du bouton"
    },
    "emailCapture": {
      "enabled": true,
      "title": "Titre de la section capture email",
      "subtitle": "Sous-titre incitatif",
      "placeholder": "Placeholder du champ email",
      "buttonText": "Texte du bouton",
      "reassurance": "Texte de reassurance (ex: Pas de spam, juste les actus)"
    }
  },
  "branding": {
    "primaryColor": "#7c3aed",
    "accentColor": "#a78bfa",
    "headingFont": "Inter",
    "bodyFont": "Inter"
  },
  "status": "generated"
}

ICONS DISPONIBLES pour benefits.items[].icon : "zap", "shield", "clock", "star", "target", "heart", "rocket", "check", "trending-up", "users"

IMPORTANT : Reponds UNIQUEMENT avec le bloc JSON dans un bloc \`\`\`json. Pas de texte avant ou apres.
Reponds en francais. Sois percutant et specifique.`,
        user: `${fullContext}

Landing page test data: ${landingPageTest}
MVP: ${mvpPlan}

${(() => {
  // Pull identity/wording data if available
  const actions = metadata?.actions || {}
  const identity = actions.identity?.structured
  const wording = actions.wording?.structured
  let extra = ''
  if (identity) extra += `\n=== IDENTITE VISUELLE GENEREE ===\nCouleur primaire: ${identity.colorPalette?.primary?.hex}\nCouleur secondaire: ${identity.colorPalette?.secondary?.hex}\nCouleur accent: ${identity.colorPalette?.accent?.hex}\nFont titres: ${identity.typography?.headingFont}\nFont texte: ${identity.typography?.bodyFont}\n`
  if (wording) extra += `\n=== WORDING GENERE ===\nTaglines: ${wording.taglines?.map((t: any) => t.text).join(' | ')}\nPromesse: ${wording.positioning?.promise}\nTerritoire: ${wording.positioning?.territory}\nTon: ${wording.personality?.toneOfVoice}\n`
  return extra
})()}

IMPORTANT : Lis la conversation et utilise le positionnement EXACT. Genere un JSON structure pour le template de landing page.

Reponds UNIQUEMENT avec un bloc JSON valide.`
      },
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
        user: `${fullContext}

Validation client: ${clientValidation}

Genere un script d'interview Mom Test SPECIFIQUE a ce projet. Chaque question doit etre taillee pour le client cible identifie dans la conversation.

A la fin, genere un bloc JSON avec: {"intro": "...", "questions": [{"question": "...", "why": "...", "greenFlags": ["..."], "redFlags": ["..."]}], "pitfalls": ["..."], "scoringGrid": {...}, "status": "generated"}`
      },
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
        user: `${fullContext}

Plan 10 premiers clients: ${firstTenCustomers}

Genere un plan d'acquisition ULTRA SPECIFIQUE. Des vrais noms de groupes, des vrais messages, des vrais chiffres.

A la fin, genere un bloc JSON avec: {"persona": {...}, "channels": [...], "templates": [...], "sequence": [...], "metrics": {...}, "status": "generated"}`
      },
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
        user: `${fullContext}

Benchmark pricing: ${pricingBenchmark}

Genere une strategie de pricing SPECIFIQUE a ce projet avec des prix concrets, un benchmark reel, et un plan de test.

A la fin, genere un bloc JSON avec: {"benchmark": [...], "options": [...], "recommended": {...}, "testMessage": "...", "testMethod": "...", "evolution": {...}, "status": "generated"}`
      },
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
        user: `${fullContext}

Genere un systeme de tracking de validation ADAPTE a ce projet. Pas de metriques generiques — des signaux specifiques a son marche et son modele.

A la fin, genere un bloc JSON avec: {"metrics": [...], "weeklyTemplate": {...}, "goNoGo": {"go": [...], "pivot": [...], "stop": [...]}, "tools": [...], "timeframe": "...", "status": "generated"}`
      },
      competitive: {
        system: `Tu es un analyste strategique specialise en veille concurrentielle pour startups. Tu as conseille 200+ entreprises sur leur positionnement face a la concurrence.

REGLE ABSOLUE : Lis la conversation complete avec l'entrepreneur. Ton analyse doit etre 100% specifique a CE projet, CE marche, CES concurrents.

Tu dois produire une analyse structuree en JSON strict. Pas de texte libre — uniquement du JSON.

Le JSON doit suivre EXACTEMENT cette structure :
{
  "competitors": [
    {
      "name": "Nom du concurrent",
      "website": "URL si connue",
      "positioning": "Leur positionnement en une phrase",
      "pricing": "Leur modele de prix",
      "strengths": ["Force 1", "Force 2", "Force 3"],
      "weaknesses": ["Faiblesse 1", "Faiblesse 2", "Faiblesse 3"],
      "threatLevel": "haute|moyenne|faible"
    }
  ],
  "differentiationAxes": [
    {
      "axis": "Nom de l'axe",
      "description": "Explication en 2-3 phrases",
      "strengthScore": 8,
      "competitors": "Comment les concurrents se positionnent sur cet axe"
    }
  ],
  "opportunities": [
    {
      "title": "Titre de l'opportunite",
      "description": "Description en 2-3 phrases",
      "actionable": "Ce qu'il faut faire concretement pour saisir cette opportunite"
    }
  ],
  "risks": [
    {
      "title": "Titre du risque",
      "description": "Description",
      "probability": "haute|moyenne|faible",
      "impact": "fort|moyen|faible",
      "mitigation": "Comment mitiger ce risque"
    }
  ],
  "swotSummary": {
    "strengths": ["Force 1", "Force 2", "Force 3"],
    "weaknesses": ["Faiblesse 1", "Faiblesse 2"],
    "opportunities": ["Opportunite 1", "Opportunite 2"],
    "threats": ["Menace 1", "Menace 2"]
  },
  "status": "generated"
}

IMPORTANT : Reponds UNIQUEMENT avec le bloc JSON dans un bloc \`\`\`json. Pas de texte avant ou apres.
Sois specifique : vrais noms de concurrents, vrais prix, vrais positionnements.
Reponds en francais.`,
        user: `${fullContext}\n\nAnalyse les concurrents de ce projet. Identifie 3-5 concurrents reels, leurs forces/faiblesses, les axes de differenciation, les opportunites et les risques.\n\nReponds UNIQUEMENT avec un bloc JSON valide.`
      },
      wording: {
        system: `Tu es un directeur de strategie de marque et expert en copywriting. Tu as defini le wording et la posture de marques comme Doctolib, Alan, Qonto.

REGLE ABSOLUE : Lis la conversation complete. Chaque mot, chaque phrase doit etre taillee pour CE projet.

Tu dois produire une analyse structuree en JSON strict. Pas de texte libre — uniquement du JSON.

Le JSON doit suivre EXACTEMENT cette structure :
{
  "positioning": {
    "territory": "L'espace de marque que tu occupes",
    "promise": "La promesse centrale en une phrase",
    "enemy": "Contre quoi tu te bats",
    "belief": "Ce que tu crois que les autres ne croient pas"
  },
  "personality": {
    "traits": [
      { "trait": "Trait de caractere", "example": "Exemple concret d'expression de ce trait" }
    ],
    "toneOfVoice": "Description du ton en 2-3 phrases",
    "toneExamples": ["Phrase exemple 1 dans ce ton", "Phrase exemple 2", "Phrase exemple 3"],
    "doesSay": ["Ce que la marque dit", "Autre chose qu'elle dit"],
    "neverSays": ["Ce que la marque ne dit jamais", "Autre chose qu'elle ne dit jamais"]
  },
  "taglines": [
    { "text": "Proposition de tagline", "rationale": "Pourquoi cette tagline fonctionne" }
  ],
  "pitches": {
    "thirtySeconds": "Le pitch de 30 secondes mot pour mot",
    "email": "Le pitch email en 3 lignes pour du cold outreach",
    "keyPhrases": ["Phrase cle reutilisable 1", "Phrase cle 2", "Phrase cle 3", "Phrase cle 4", "Phrase cle 5"]
  },
  "lexicon": {
    "useWords": ["Mot a utiliser 1", "Mot 2", "Mot 3", "Mot 4", "Mot 5"],
    "avoidWords": ["Mot a eviter 1", "Mot 2", "Mot 3", "Mot 4", "Mot 5"]
  },
  "status": "generated"
}

IMPORTANT : Reponds UNIQUEMENT avec le bloc JSON dans un bloc \`\`\`json. Pas de texte avant ou apres.
Reponds en francais. Sois tranchant et specifique.`,
        user: `${fullContext}\n\nDefinis le wording et la posture de marque pour ce projet. Positionnement, personnalite, taglines, pitches, lexique.\n\nReponds UNIQUEMENT avec un bloc JSON valide.`
      },
      identity: {
        system: `Tu es un directeur artistique et designer de marque. Tu as cree l'identite visuelle de startups qui ont leve des millions. Tu sais que le design n'est pas decoratif — c'est strategique.

REGLE ABSOLUE : Lis la conversation complete. L'identite visuelle doit refleter le positionnement et la personnalite de CE projet.

Tu dois produire une analyse structuree en JSON strict. Pas de texte libre — uniquement du JSON.

Le JSON doit suivre EXACTEMENT cette structure :
{
  "colorPalette": {
    "primary": { "hex": "#7c3aed", "name": "Nom de la couleur", "usage": "Ou et quand l'utiliser", "rationale": "Pourquoi cette couleur pour CE projet" },
    "secondary": { "hex": "#...", "name": "...", "usage": "...", "rationale": "..." },
    "accent": { "hex": "#...", "name": "...", "usage": "...", "rationale": "..." },
    "neutral": { "hex": "#...", "name": "...", "usage": "...", "rationale": "..." },
    "background": { "hex": "#...", "name": "...", "usage": "...", "rationale": "..." }
  },
  "typography": {
    "headingFont": "Nom de la font pour les titres",
    "bodyFont": "Nom de la font pour le texte",
    "style": "serif|sans-serif|mixed",
    "hierarchy": {
      "h1": "Taille, poids, usage",
      "h2": "Taille, poids, usage",
      "body": "Taille, poids, usage",
      "caption": "Taille, poids, usage"
    },
    "rationale": "Pourquoi ces choix typographiques pour CE projet"
  },
  "visualDirection": {
    "moodKeywords": ["Mot-cle visuel 1", "Mot-cle 2", "Mot-cle 3", "Mot-cle 4", "Mot-cle 5"],
    "references": [
      { "brand": "Nom de la marque reference", "why": "Pourquoi cette reference est pertinente", "takeaway": "Ce qu'il faut en retenir" }
    ],
    "atmosphere": "Description de l'univers visuel en 3-4 phrases"
  },
  "logoGuidelines": {
    "direction": "Minimaliste|Bold|Elegant|Playful",
    "type": "Wordmark|Symbole|Combinaison",
    "principles": ["Principe 1", "Principe 2", "Principe 3"],
    "avoid": ["A eviter 1", "A eviter 2"]
  },
  "status": "generated"
}

IMPORTANT : Reponds UNIQUEMENT avec le bloc JSON dans un bloc \`\`\`json. Pas de texte avant ou apres.
Les couleurs doivent etre des codes hex valides.
Reponds en francais.`,
        user: `${fullContext}\n\nDefinis l'identite visuelle pour ce projet. Palette couleurs, typographie, direction artistique, guidelines logo.\n\nReponds UNIQUEMENT avec un bloc JSON valide.`
      },
    }

    return prompts[actionType] || null
  }

  private extractAndStoreAction(workspaceId: string, actionType: string, response: string) {
    try {
      const jsonMatch = response.match(/```json\s*\n([\s\S]*?)\n```/)
      const htmlMatch = response.match(/```html\s*\n([\s\S]*?)\n```/)

      const actionData: Record<string, unknown> = {
        content: response,
        generatedAt: new Date().toISOString(),
        status: 'generated',
      }

      if (jsonMatch) {
        try {
          actionData.structured = JSON.parse(jsonMatch[1])
        } catch { /* ignore */ }
      }

      if (htmlMatch) {
        actionData.html = htmlMatch[1]
      }

      // Store under metadata.actions.<actionType>
      this.workspaceService.findById(workspaceId).then((ws) => {
        const existingActions = (ws?.metadata as any)?.actions || {}
        existingActions[actionType] = actionData
        this.workspaceService.updateMetadata(workspaceId, { actions: existingActions }).catch((err) => {
          this.logger.warn(`Failed to store action ${actionType}: ${err}`)
        })
      })
    } catch {
      // ignore
    }
  }

  private indexInBackground(workspaceId: string, userId: string, userMessage: string, response: string) {
    Promise.all([
      indexDocument(
        COLLECTIONS.CONVERSATIONS,
        { content: userMessage, metadata: { role: 'user' } },
        workspaceId,
        userId,
      ),
      indexDocument(
        COLLECTIONS.CONVERSATIONS,
        { content: response, metadata: { role: 'assistant' } },
        workspaceId,
        userId,
      ),
    ]).catch((err) => {
      this.logger.warn(`Background RAG indexing failed: ${err}`)
    })
  }
}
