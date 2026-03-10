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

    // Actions with large JSON output need more tokens
    const largeActions = ['salesdeck', 'linkedin', 'instagram', 'landing', 'interview', 'prospects', 'pricing']
    const maxTokens = largeActions.includes(actionType) ? 12000 : 6000

    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
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
      landing: (() => {
        // Pull identity/wording data for dynamic prompt
        const actions = metadata?.actions || {}
        const identity = actions.identity?.structured
        const wording = actions.wording?.structured

        // Build dynamic branding from identity data
        const brandPrimary = identity?.colorPalette?.primary?.hex || '#7c3aed'
        const brandSecondary = identity?.colorPalette?.secondary?.hex || '#a78bfa'
        const brandAccent = identity?.colorPalette?.accent?.hex || brandSecondary
        const brandNeutral = identity?.colorPalette?.neutral?.hex
        const brandBackground = identity?.colorPalette?.background?.hex
        const headingFont = identity?.typography?.headingFont || 'Inter'
        const bodyFont = identity?.typography?.bodyFont || 'Inter'

        // Build full identity context
        let identityContext = ''
        if (identity) {
          identityContext = `
=== IDENTITE VISUELLE DE LA MARQUE (OBLIGATOIRE A RESPECTER) ===
PALETTE COMPLETE :
- Primaire : ${identity.colorPalette?.primary?.hex} (${identity.colorPalette?.primary?.name}) — ${identity.colorPalette?.primary?.usage}
- Secondaire : ${identity.colorPalette?.secondary?.hex} (${identity.colorPalette?.secondary?.name}) — ${identity.colorPalette?.secondary?.usage}
- Accent : ${identity.colorPalette?.accent?.hex} (${identity.colorPalette?.accent?.name}) — ${identity.colorPalette?.accent?.usage}
- Neutre : ${identity.colorPalette?.neutral?.hex} (${identity.colorPalette?.neutral?.name}) — ${identity.colorPalette?.neutral?.usage}
- Fond : ${identity.colorPalette?.background?.hex} (${identity.colorPalette?.background?.name}) — ${identity.colorPalette?.background?.usage}

TYPOGRAPHIE :
- Font titres : ${identity.typography?.headingFont} (UTILISE CETTE FONT, PAS Inter)
- Font texte : ${identity.typography?.bodyFont} (UTILISE CETTE FONT, PAS Inter)
- Style : ${identity.typography?.style}
- Justification : ${identity.typography?.rationale}

DIRECTION ARTISTIQUE :
- Mots-cles visuels : ${identity.visualDirection?.moodKeywords?.join(', ')}
- Atmosphere : ${identity.visualDirection?.atmosphere}
`
        }

        // Build full wording context
        let wordingContext = ''
        if (wording) {
          wordingContext = `
=== WORDING & POSTURE DE MARQUE (OBLIGATOIRE A RESPECTER) ===
POSITIONNEMENT :
- Territoire : ${wording.positioning?.territory}
- Promesse : ${wording.positioning?.promise}
- Ennemi : ${wording.positioning?.enemy}
- Belief : ${wording.positioning?.belief}

TON DE VOIX : ${wording.personality?.toneOfVoice}
La marque dit : ${wording.personality?.doesSay?.join(' | ')}
La marque ne dit jamais : ${wording.personality?.neverSays?.join(' | ')}

TAGLINES DISPONIBLES :
${wording.taglines?.map((t: any) => `- "${t.text}" (${t.rationale})`).join('\n')}

PITCH 30 SECONDES : ${wording.pitches?.thirtySeconds}

PHRASES CLES : ${wording.pitches?.keyPhrases?.join(' | ')}

LEXIQUE :
- Mots a utiliser : ${wording.lexicon?.useWords?.join(', ')}
- Mots a eviter : ${wording.lexicon?.avoidWords?.join(', ')}
`
        }

        return {
          system: `Tu es un expert en copywriting de conversion et en landing pages. Tu as cree des pages pour YC startups, des SaaS B2B, et des produits consumer.

REGLES ABSOLUES :
- Tu DOIS lire la conversation complete pour comprendre le positionnement EXACT du projet
- AUCUN texte generique. Chaque phrase doit etre specifique a CE projet
- Le storytelling doit suivre le framework PAS (Problem → Agitation → Solution)
- La page doit donner envie de laisser son email, pas juste "informer"
${identity ? `
REGLE CRITIQUE — IDENTITE VISUELLE :
- Tu DOIS utiliser les VRAIES couleurs de la charte graphique dans le champ "branding"
- Tu DOIS utiliser les VRAIES fonts de la charte (PAS "Inter" par defaut)
- La couleur primaire EST ${brandPrimary}, la secondaire EST ${brandSecondary}, l'accent EST ${brandAccent}
- La font titres EST "${headingFont}", la font texte EST "${bodyFont}"
- NE METS PAS de valeurs par defaut. Utilise EXACTEMENT les couleurs et fonts de l'identite.
` : ''}${wording ? `
REGLE CRITIQUE — WORDING :
- Le headline DOIT s'inspirer des taglines et du positionnement fournis
- Le ton de voix DOIT correspondre a la posture de marque
- Utilise les mots du lexique "a utiliser", evite ceux "a eviter"
- Le pitch et les phrases cles doivent etre integres dans le contenu
` : ''}
Tu dois generer UNIQUEMENT un JSON structure. Le JSON sera utilise par un template Next.js fixe.

Le JSON doit suivre EXACTEMENT cette structure :
{
  "sections": {
    "hero": { "enabled": true, "headline": "...", "subheadline": "...", "ctaText": "..." },
    "problem": { "enabled": true, "title": "...", "painPoints": ["...", "...", "..."] },
    "solution": { "enabled": true, "title": "...", "description": "...", "features": [{ "title": "...", "description": "..." }] },
    "benefits": { "enabled": true, "title": "...", "items": [{ "icon": "zap|shield|clock|star|target|heart|rocket|check|trending-up|users", "title": "...", "description": "..." }] },
    "testimonial": { "enabled": true, "quote": "...", "author": "...", "role": "...", "company": "..." },
    "cta": { "enabled": true, "title": "...", "subtitle": "...", "ctaText": "..." },
    "emailCapture": { "enabled": true, "title": "...", "subtitle": "...", "placeholder": "...", "buttonText": "...", "reassurance": "..." },
    "contactForm": { "enabled": true, "title": "...", "subtitle": "...", "fields": [{ "name": "lastName", "label": "Nom", "type": "text", "required": true }, { "name": "firstName", "label": "Prenom", "type": "text", "required": true }, { "name": "email", "label": "Email", "type": "email", "required": true }, { "name": "phone", "label": "Telephone", "type": "tel", "required": false }, { "name": "message", "label": "Message", "type": "textarea", "required": true }], "buttonText": "...", "successMessage": "..." },
    "social": { "enabled": true, "title": "Retrouvez-nous", "links": [{ "platform": "linkedin", "url": "" }, { "platform": "instagram", "url": "" }] },
    "footer": { "enabled": true, "companyName": "...", "email": "", "phone": "", "address": "" }
  },
  "branding": {
    "primaryColor": "${brandPrimary}",
    "secondaryColor": "${brandSecondary}",
    "accentColor": "${brandAccent}",
    "headingFont": "${headingFont}",
    "bodyFont": "${bodyFont}"
  },
  "status": "generated"
}

IMPORTANT : Reponds UNIQUEMENT avec le bloc JSON dans un bloc \`\`\`json. Pas de texte avant ou apres.
Reponds en francais. Sois percutant et specifique.`,
          user: `${fullContext}

Landing page test data: ${landingPageTest}
MVP: ${mvpPlan}
${identityContext}${wordingContext}
INSTRUCTIONS FINALES :
- Le champ "branding" DOIT contenir les couleurs et fonts EXACTES de l'identite visuelle ci-dessus
- Le headline hero DOIT s'inspirer des taglines et du positionnement
- Le ton du texte DOIT respecter la posture de marque
- Les mots utilises DOIVENT venir du lexique de la marque

Reponds UNIQUEMENT avec un bloc JSON valide.`
        }
      })(),
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

A la fin, genere un bloc JSON STRICT avec cette structure exacte:
\`\`\`json
{
  "intro": {
    "targetProfile": "Qui interviewer (profil exact)",
    "whereToFind": "Ou trouver ces personnes (canaux precis)",
    "approachScript": "Phrase d'accroche mot pour mot",
    "framing": "Comment cadrer l'interview (duree, contexte)"
  },
  "questions": [
    {
      "question": "La question exacte a poser",
      "why": "Pourquoi tu poses cette question (quel signal tu cherches)",
      "greenFlags": ["Reponse positive 1", "Reponse positive 2"],
      "redFlags": ["Reponse negative 1", "Reponse negative 2"],
      "followUp": "Question de relance si la reponse est vague"
    }
  ],
  "pitfalls": [
    {
      "title": "Nom du piege",
      "description": "Description du piege et comment l'eviter"
    }
  ],
  "scoringGrid": {
    "criteria": [
      { "name": "Nom du critere", "description": "Ce qu'on evalue", "weight": 2 }
    ],
    "threshold": 7,
    "thresholdExplanation": "Ce que signifie un score au-dessus/en-dessous",
    "minInterviews": 8,
    "stopRule": "Quand arreter les interviews"
  },
  "debrief": {
    "fields": ["Champ 1 a remplir apres chaque interview", "Champ 2", "Champ 3", "Champ 4", "Champ 5"],
    "synthesisTemplate": "Comment synthetiser les resultats de toutes les interviews"
  },
  "status": "generated"
}
\`\`\``
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

A la fin, genere un bloc JSON STRICT avec cette structure exacte:
\`\`\`json
{
  "persona": {
    "name": "Nom fictif",
    "age": "Tranche d'age",
    "role": "Poste / fonction",
    "company": "Type d'entreprise",
    "dailyPain": "Sa journee type et ou il a le probleme",
    "searchBehavior": "Ce qu'il google quand il cherche une solution",
    "triggerToBuy": "Ce qui le ferait payer demain"
  },
  "channels": [
    {
      "name": "Nom du canal exact (groupe LinkedIn, subreddit, etc.)",
      "type": "linkedin|email|community|event|ads",
      "why": "Pourquoi CE canal pour CE projet",
      "reachableProspects": "Nombre de prospects atteignables",
      "cost": "Cout en temps ou argent",
      "expectedConversion": "Taux de conversion attendu"
    }
  ],
  "templates": [
    {
      "channel": "linkedin|email|community",
      "label": "Nom du template (ex: Message froid LinkedIn)",
      "subject": "Objet du message si email",
      "body": "Le texte exact du message mot pour mot",
      "tips": "Conseils pour maximiser le taux de reponse"
    }
  ],
  "sequence": [
    {
      "day": "J+0",
      "action": "Description de l'action",
      "channel": "Canal utilise",
      "message": "Message exact ou angle d'approche"
    }
  ],
  "metrics": {
    "responseRateByChannel": "Taux de reponse attendu par canal",
    "dailyContacts": "Nombre de contacts par jour",
    "targetTimeline": "Delai pour atteindre 10 clients",
    "pivotSignal": "Quand pivoter si ca ne marche pas"
  },
  "status": "generated"
}
\`\`\``
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

A la fin, genere un bloc JSON STRICT avec cette structure exacte:
\`\`\`json
{
  "benchmark": [
    {
      "competitor": "Nom du concurrent",
      "price": "Leur prix exact",
      "includes": "Ce qui est inclus",
      "positioning": "premium|mid|low",
      "strengths": "Points forts de leur pricing",
      "weaknesses": "Points faibles"
    }
  ],
  "options": [
    {
      "name": "Nom du plan (ex: Starter, Pro, Enterprise)",
      "price": "Prix exact",
      "billing": "mensuel|annuel|one-shot",
      "includes": ["Feature 1 incluse", "Feature 2", "Feature 3"],
      "targetClient": "Le type de client qui choisirait cette option",
      "margin": "Marge estimee",
      "rationale": "Pourquoi ce prix (ancrage psychologique, comparaison marche)"
    }
  ],
  "recommended": {
    "optionName": "Nom de l'option recommandee",
    "reasoning": "Raisonnement detaille",
    "framing": "Comment presenter/annoncer le prix",
    "objections": [
      { "objection": "Objection previsible", "response": "Comment y repondre" }
    ]
  },
  "testPlan": {
    "message": "Message exact a envoyer pour tester le prix",
    "landingPageTips": "Quoi mettre sur la landing pour valider le prix",
    "vanWestendorp": ["Question 1", "Question 2", "Question 3", "Question 4"],
    "minResponses": "Nombre de reponses necessaires"
  },
  "evolution": {
    "launchPrice": "Prix de lancement",
    "targetPrice12m": "Prix cible a 12 mois",
    "increaseStrategy": "Quand et comment augmenter",
    "grandfathering": "Comment traiter les early adopters"
  },
  "status": "generated"
}
\`\`\``
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
      salesdeck: (() => {
        const identityData = metadata?.actions?.identity?.structured
        const wordingData = metadata?.actions?.wording?.structured
        const landingData = metadata?.actions?.landing?.structured
        const identityContext = identityData ? `\n\nIDENTITE VISUELLE :\n${JSON.stringify(identityData)}` : ''
        const wordingContext = wordingData ? `\n\nWORDING & POSTURE :\n${JSON.stringify(wordingData)}` : ''

        // Extract image URLs from landing page if available
        const heroImage = landingData?.sections?.hero?.imageUrl || ''
        const solutionImage = landingData?.sections?.solution?.imageUrl || ''
        const imagesContext = (heroImage || solutionImage)
          ? `\n\nIMAGES DISPONIBLES (de la landing page) :\n- Hero: ${heroImage}\n- Solution: ${solutionImage}\nUtilise ces URLs dans le champ "imageUrl" des slides appropriees.`
          : ''

        return {
          system: `Tu es un expert en presentations commerciales et pitch decks. Tu as cree des decks pour des startups YC, des levees de fonds Series A, et des cycles de vente B2B.

REGLE ABSOLUE : Lis TOUTE la conversation et TOUTES les donnees fournies (identite, wording, analyse). Le deck doit etre 100% aligne avec le positionnement et l'identite de marque.

Tu dois generer DEUX presentations structurees en JSON :

## 1. SALES DECK CLIENT (10-12 slides)
Objectif : convaincre un client d'acheter

Structure :
- Slide 1 — Titre : logo, slogan, promesse
- Slide 2 — Le probleme : faire dire "oui c'est exactement ca"
- Slide 3 — Contexte marche : montrer que le probleme est reel
- Slide 4 — La solution : expliquer simplement
- Slide 5 — Demo produit : visuels, captures, mockups
- Slide 6 — Benefices client : parler en benefices, pas en features
- Slide 7 — Cas d'usage : exemple concret
- Slide 8 — Resultats attendus : meme estimes
- Slide 9 — Les offres : pricing clair
- Slide 10 — Mise en place : rassurer sur la simplicite
- Slide 11 — Offre pilote : puissant pour convertir
- Slide 12 — Call to action : toujours finir par une action

## 2. PITCH DECK INVESTISSEUR (10 slides)
Objectif : convaincre d'investir

Structure :
- Slide 1 — Vision
- Slide 2 — Le probleme
- Slide 3 — La solution
- Slide 4 — Le produit (visuels)
- Slide 5 — Marche (TAM/SAM/SOM)
- Slide 6 — Business model
- Slide 7 — Traction
- Slide 8 — Concurrence (avantage competitif)
- Slide 9 — Roadmap
- Slide 10 — Equipe
- Slide 11 — Levee de fonds (objectifs)

Pour CHAQUE slide, fournis :
- title : titre de la slide
- subtitle : sous-titre optionnel
- content : texte principal (2-4 bullet points)
- notes : notes du presentateur
- visualType : "text" | "chart" | "image" | "comparison" | "pricing" | "timeline"
- imageUrl : URL d'une image si disponible (utilise les images de la landing page quand c'est pertinent)
- imagePlaceholder : si pas d'imageUrl, description de l'image/visuel suggeree pour cette slide (ex: "Photo d'equipe souriante", "Graphique de croissance", "Screenshot du produit")

UTILISE les couleurs et fonts de l'identite visuelle si disponibles.
UTILISE le ton et le wording definis dans la posture de marque.

Reponds UNIQUEMENT avec un bloc \`\`\`json. Pas de texte avant ou apres.
Reponds en francais.`,
          user: `${fullContext}${identityContext}${wordingContext}${imagesContext}

Genere les deux decks de presentation pour ce projet.

Le JSON DOIT suivre cette structure :
\`\`\`json
{
  "salesDeck": {
    "title": "Sales Deck - [Nom du projet]",
    "slides": [
      { "title": "...", "subtitle": "...", "content": ["..."], "notes": "...", "visualType": "text", "imageUrl": "", "imagePlaceholder": "Description du visuel suggere" }
    ]
  },
  "pitchDeck": {
    "title": "Pitch Deck - [Nom du projet]",
    "slides": [
      { "title": "...", "subtitle": "...", "content": ["..."], "notes": "...", "visualType": "text", "imageUrl": "", "imagePlaceholder": "Description du visuel suggere" }
    ]
  },
  "branding": {
    "primaryColor": "${identityData?.colorPalette?.primary?.hex || '#7c3aed'}",
    "secondaryColor": "${identityData?.colorPalette?.secondary?.hex || '#a78bfa'}",
    "accentColor": "${identityData?.colorPalette?.accent?.hex || '#f59e0b'}",
    "headingFont": "${identityData?.typography?.headingFont || 'Inter'}",
    "bodyFont": "${identityData?.typography?.bodyFont || 'Inter'}"
  },
  "status": "generated"
}
\`\`\``
        }
      })(),
      linkedin: (() => {
        const identityData = metadata?.actions?.identity?.structured
        const wordingData = metadata?.actions?.wording?.structured
        const identityContext = identityData ? `\n\nIDENTITE VISUELLE :\n${JSON.stringify(identityData)}` : ''
        const wordingContext = wordingData ? `\n\nWORDING & POSTURE :\n${JSON.stringify(wordingData)}` : ''

        return {
          system: `Tu es un expert en content marketing LinkedIn. Tu as gere les comptes de fondateurs qui generent 100K+ impressions/mois. Tu connais l'algorithme LinkedIn et ce qui engage.

REGLE ABSOLUE : Lis TOUTE la conversation et TOUTES les donnees fournies. Chaque post doit refleter l'identite, le ton et le positionnement de CE projet.

Tu dois generer 10 posts LinkedIn structures en JSON :

## TYPES DE POSTS A GENERER :
1. Post de lancement / teasing (storytelling personnel)
2. Post educatif (partager une expertise du domaine)
3. Post probleme/solution (montrer qu'on comprend la douleur)
4. Post behind-the-scenes (montrer la construction)
5. Post chiffre/statistique (credibiliser avec des donnees)
6. Post testimonial/social proof (meme fictif mais realiste)
7. Post controverse/opinion tranchee (generer du debat)
8. Post astuce/hack (valeur immediate pour le lecteur)
9. Post carousel (contenu slide par slide)
10. Post question/engagement (faire reagir la communaute)

Pour CHAQUE post :
- type : le type de post
- hook : la premiere ligne accrocheuse (CRITIQUE pour l'algo LinkedIn)
- body : le corps du post (avec sauts de ligne, emojis strategiques)
- cta : le call-to-action de fin
- hashtags : 3-5 hashtags pertinents
- bestTime : meilleur moment pour publier
- visualSuggestion : description du visuel a creer pour accompagner le post
- estimatedReach : portee estimee (faible/moyenne/forte)

UTILISE le ton de voix et le lexique de la marque.
UTILISE les couleurs et la direction artistique pour les suggestions visuelles.

Reponds UNIQUEMENT avec un bloc \`\`\`json. Pas de texte avant ou apres.
Reponds en francais.`,
          user: `${fullContext}${identityContext}${wordingContext}

Genere 10 posts LinkedIn prets a publier pour ce projet. Chaque post doit etre unique, engageant et aligne avec l'identite de marque.

Le JSON DOIT suivre cette structure :
\`\`\`json
{
  "posts": [
    {
      "type": "...",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "hashtags": ["..."],
      "bestTime": "...",
      "visualSuggestion": "...",
      "estimatedReach": "forte|moyenne|faible"
    }
  ],
  "strategy": {
    "postingFrequency": "...",
    "bestDays": ["..."],
    "contentMix": "...",
    "growthTips": ["..."]
  },
  "status": "generated"
}
\`\`\``
        }
      })(),
      instagram: (() => {
        const identityData = metadata?.actions?.identity?.structured
        const wordingData = metadata?.actions?.wording?.structured
        const identityContext = identityData ? `\n\nIDENTITE VISUELLE :\n${JSON.stringify(identityData)}` : ''
        const wordingContext = wordingData ? `\n\nWORDING & POSTURE :\n${JSON.stringify(wordingData)}` : ''

        return {
          system: `Tu es un expert en strategie de contenu Instagram. Tu as fait passer des comptes de 0 a 50K followers. Tu connais les formats qui marchent : Reels, carousels, stories.

REGLE ABSOLUE : Lis TOUTE la conversation et TOUTES les donnees fournies. Chaque post doit refleter l'identite visuelle et le positionnement de CE projet.

Tu dois generer 10 publications Instagram structures en JSON :

## TYPES DE PUBLICATIONS A GENERER :
1. Carousel educatif (5-7 slides avec texte)
2. Reel script (video courte avec hook + contenu)
3. Post image avec caption storytelling
4. Carousel before/after ou probleme/solution
5. Reel tendance adaptee au secteur
6. Post citation/phrase forte de la marque
7. Story interactive (sondage, quiz, question)
8. Carousel infographie/chiffres cles
9. Reel behind-the-scenes
10. Post UGC/testimonial inspire

Pour CHAQUE publication :
- type : "carousel" | "reel" | "post" | "story"
- caption : le texte de la publication
- slides : si carousel, le contenu de chaque slide (titre + texte)
- reelScript : si reel, le script (hook, contenu, cta, duree)
- visualDescription : description detaillee du visuel a creer
- colorScheme : couleurs a utiliser (basees sur l'identite)
- hashtags : 10-15 hashtags (mix populaires + niches)
- bestTime : meilleur moment pour publier
- estimatedReach : portee estimee

UTILISE les couleurs EXACTES de la charte graphique pour les visuels.
UTILISE le ton de voix de la marque pour les captions.

Reponds UNIQUEMENT avec un bloc \`\`\`json. Pas de texte avant ou apres.
Reponds en francais.`,
          user: `${fullContext}${identityContext}${wordingContext}

Genere 10 publications Instagram pretes a publier pour ce projet. Mix de formats (carousels, reels, posts, stories). Tout doit etre aligne avec l'identite visuelle.

Le JSON DOIT suivre cette structure :
\`\`\`json
{
  "publications": [
    {
      "type": "carousel|reel|post|story",
      "caption": "...",
      "slides": [{"title": "...", "text": "..."}],
      "reelScript": {"hook": "...", "content": "...", "cta": "...", "duration": "15s|30s|60s"},
      "visualDescription": "...",
      "colorScheme": {"primary": "#...", "secondary": "#...", "text": "#..."},
      "hashtags": ["..."],
      "bestTime": "...",
      "estimatedReach": "forte|moyenne|faible"
    }
  ],
  "strategy": {
    "postingFrequency": "...",
    "contentPillars": ["..."],
    "hashtagStrategy": "...",
    "growthTips": ["..."]
  },
  "status": "generated"
}
\`\`\``
        }
      })(),
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
