# Branding Dashboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single "branding" action with 3 separate actions (competitive, wording, identity), each with its own visual dashboard page, upload+enrichment support, and PDF export.

**Architecture:** Split branding into 3 action types (`competitive`, `wording`, `identity`) with dedicated prompts. Each gets a dashboard page under `/workspace/[id]/validation/[type]` that renders structured JSON data as visual cards. Add an upload endpoint per action that extracts document text and injects it into the generation prompt. Use html2pdf.js for client-side PDF export.

**Tech Stack:** Next.js 14, Tailwind, shadcn/ui, Lucide icons, html2pdf.js (PDF), NestJS + Fastify (API), OpenAI GPT-4o

---

### Task 1: Install html2pdf.js dependency

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install the package**

```bash
cd /opt/agent-more && npm install html2pdf.js --workspace=@agent-all/web
```

**Step 2: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore: add html2pdf.js for PDF export"
```

---

### Task 2: Add upload-for-action API endpoint

**Files:**
- Modify: `apps/api/src/chat/chat.controller.ts`
- Modify: `apps/api/src/chat/chat.service.ts`

**Step 1: Add the controller endpoint**

In `chat.controller.ts`, add this method after the existing `generateAction` method (before `getActions`):

```typescript
@Post(':workspaceId/actions/:actionType/upload')
async generateActionWithUpload(
  @Param('workspaceId') workspaceId: string,
  @Param('actionType') actionType: string,
  @Req() req: any,
  @Res() res: FastifyReply,
) {
  const data = await (req as any).file()
  if (!data) {
    return res.status(400).send({ error: 'No file uploaded' })
  }

  const chunks: Buffer[] = []
  for await (const chunk of data.file) {
    chunks.push(chunk)
  }
  const fileBuffer = Buffer.concat(chunks)
  const fileName = data.filename

  const extractedText = await this.chatService.extractDocumentText(fileBuffer, fileName)

  res.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  })

  try {
    for await (const chunk of this.chatService.generateAction(workspaceId, actionType, extractedText)) {
      res.raw.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }
    res.raw.write(`data: [DONE]\n\n`)
  } catch (err) {
    res.raw.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
  }

  res.raw.end()
}
```

**Step 2: Update generateAction signature in chat.service.ts**

Change `generateAction` to accept an optional `uploadedDocument` parameter:

```typescript
async *generateAction(workspaceId: string, actionType: string, uploadedDocument?: string): AsyncGenerator<string> {
```

And in the `buildActionPrompt` call, pass it through:

```typescript
const prompt = this.buildActionPrompt(actionType, dashboard, conversationContext, uploadedDocument)
```

**Step 3: Update buildActionPrompt to accept uploadedDocument**

Change signature:

```typescript
private buildActionPrompt(actionType: string, dashboard: Record<string, unknown>, conversation: string, uploadedDocument?: string): { system: string; user: string } | null {
```

Add after the `context` variable:

```typescript
const documentContext = uploadedDocument
  ? `\n\n=== DOCUMENT UPLOADE PAR L'ENTREPRENEUR ===\n${uploadedDocument.substring(0, 6000)}\n\nINSTRUCTION : Analyse ce document existant. Integre ses elements dans ton resultat. Complete ce qui manque, ameliore ce qui peut l'etre, et signale les incoherences si tu en trouves.`
  : ''

const fullContext = context + documentContext
```

Then replace all `${context}` references in the user prompts with `${fullContext}`.

**Step 4: Update the existing generateAction controller to pass undefined**

The existing `@Post(':workspaceId/actions/:actionType')` already calls `this.chatService.generateAction(workspaceId, actionType)` — this will work as-is because the parameter is optional.

**Step 5: Commit**

```bash
git add apps/api/src/chat/chat.controller.ts apps/api/src/chat/chat.service.ts
git commit -m "feat: add upload-for-action endpoint with document enrichment"
```

---

### Task 3: Split branding into 3 action prompts (API)

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts` (buildActionPrompt method)

**Step 1: Remove the existing `branding` prompt and replace with 3 new ones**

Delete the `branding` entry from the `prompts` record. Add these 3 entries:

**`competitive` prompt:**

```typescript
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

IMPORTANT : Reponds UNIQUEMENT avec le bloc JSON dans un bloc \\\`\\\`\\\`json. Pas de texte avant ou apres.
Sois specifique : vrais noms de concurrents, vrais prix, vrais positionnements.
Reponds en francais.`,
  user: `${fullContext}

Analyse les concurrents de ce projet. Identifie 3-5 concurrents reels, leurs forces/faiblesses, les axes de differenciation, les opportunites et les risques.

Reponds UNIQUEMENT avec un bloc JSON valide.`
},
```

**`wording` prompt:**

```typescript
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

IMPORTANT : Reponds UNIQUEMENT avec le bloc JSON dans un bloc \\\`\\\`\\\`json. Pas de texte avant ou apres.
Reponds en francais. Sois tranchant et specifique.`,
  user: `${fullContext}

Definis le wording et la posture de marque pour ce projet. Positionnement, personnalite, taglines, pitches, lexique.

Reponds UNIQUEMENT avec un bloc JSON valide.`
},
```

**`identity` prompt:**

```typescript
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

IMPORTANT : Reponds UNIQUEMENT avec le bloc JSON dans un bloc \\\`\\\`\\\`json. Pas de texte avant ou apres.
Les couleurs doivent etre des codes hex valides.
Reponds en francais.`,
  user: `${fullContext}

Definis l'identite visuelle pour ce projet. Palette couleurs, typographie, direction artistique, guidelines logo.

Reponds UNIQUEMENT avec un bloc JSON valide.`
},
```

**Step 2: Commit**

```bash
git add apps/api/src/chat/chat.service.ts
git commit -m "feat: split branding into competitive, wording, identity action prompts"
```

---

### Task 4: Update validation page — replace branding card with 3 cards + upload button

**Files:**
- Modify: `apps/web/src/app/dashboard/workspace/[id]/validation/page.tsx`

**Step 1: Update the imports**

Replace the icon imports with:

```typescript
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Users,
  UserPlus,
  Tag,
  BarChart3,
  Loader2,
  Rocket,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Palette,
  Swords,
  MessageSquareQuote,
  Upload,
} from 'lucide-react'
```

**Step 2: Replace the single branding entry in ACTIONS with 3 entries**

Remove the `branding` entry and add:

```typescript
{
  key: 'competitive',
  title: 'Analyse concurrentielle',
  description: 'Concurrents, forces/faiblesses, axes de differenciation, opportunites et risques.',
  why: 'Connaitre tes concurrents c\'est savoir ou frapper — et ou ne pas aller.',
  icon: Swords,
  color: 'text-red-600 dark:text-red-400',
  bgColor: 'bg-red-50 dark:bg-red-950/20',
  borderColor: 'border-red-200 dark:border-red-800',
  dashboardUrl: 'competitive',
},
{
  key: 'wording',
  title: 'Wording & Posture de marque',
  description: 'Taglines, pitches, phrases cles, ton de voix, mots a utiliser et a eviter.',
  why: 'Les bons mots font la difference entre "interessant" et "je veux ca".',
  icon: MessageSquareQuote,
  color: 'text-orange-600 dark:text-orange-400',
  bgColor: 'bg-orange-50 dark:bg-orange-950/20',
  borderColor: 'border-orange-200 dark:border-orange-800',
  dashboardUrl: 'wording',
},
{
  key: 'identity',
  title: 'Identite visuelle',
  description: 'Palette couleurs, typographie, direction artistique et guidelines.',
  why: 'Une identite forte inspire confiance avant meme que tu ouvres la bouche.',
  icon: Palette,
  color: 'text-purple-600 dark:text-purple-400',
  bgColor: 'bg-purple-50 dark:bg-purple-950/20',
  borderColor: 'border-purple-200 dark:border-purple-800',
  dashboardUrl: 'identity',
},
```

Also update the `ActionConfig` interface to include `dashboardUrl?`:

```typescript
interface ActionConfig {
  key: string
  title: string
  description: string
  why: string
  icon: typeof Globe
  color: string
  bgColor: string
  borderColor: string
  dashboardUrl?: string
}
```

**Step 3: Update ActionCard to include Upload + Dashboard link buttons**

Replace the ActionCard component with this version:

```tsx
function ActionCard({ config, action, onGenerate, onUpload, generating, uploading, workspaceId }: {
  config: ActionConfig
  action?: ActionData
  onGenerate: () => void
  onUpload: (file: File) => void
  generating: boolean
  uploading: boolean
  workspaceId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const Icon = config.icon
  const isGenerated = action?.status === 'generated'
  const isWorking = generating || uploading

  function handleCopy() {
    if (!action?.content) return
    navigator.clipboard.writeText(action.content.replace(/```(?:json|html)\s*\n[\s\S]*?\n```/g, '').trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleFileSelect() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.txt,.csv,.doc,.docx'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) onUpload(file)
    }
    input.click()
  }

  return (
    <div className={`rounded-xl border-2 ${isGenerated ? config.borderColor : 'border-border'} bg-card overflow-hidden transition-all`}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.bgColor}`}>
            <Icon className={`h-6 w-6 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{config.title}</h3>
              {isGenerated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Genere
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
            <p className="text-xs text-muted-foreground/70 mt-1.5 italic">{config.why}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {/* Generate button */}
          <button
            onClick={onGenerate}
            disabled={isWorking}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              isWorking
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generation en cours...</>
            ) : (
              <><Rocket className="h-4 w-4" /> {isGenerated ? 'Regenerer' : 'Generer'}</>
            )}
          </button>

          {/* Upload button */}
          <button
            onClick={handleFileSelect}
            disabled={isWorking}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analyse du document...</>
            ) : (
              <><Upload className="h-4 w-4" /> Uploader un document</>
            )}
          </button>

          {/* View dashboard button */}
          {isGenerated && config.dashboardUrl && (
            <Link
              href={`/dashboard/workspace/${workspaceId}/validation/${config.dashboardUrl}`}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              <ArrowRight className="h-4 w-4" /> Voir le resultat
            </Link>
          )}

          {/* Copy button for non-dashboard actions */}
          {isGenerated && !config.dashboardUrl && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {expanded ? 'Masquer' : 'Voir le resultat'}
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
                title="Copier"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </>
          )}

          {/* Landing page preview */}
          {config.key === 'landing' && isGenerated && action?.html && (
            <button
              onClick={() => {
                const w = window.open('', '_blank')
                if (w) { w.document.write(action.html!); w.document.close() }
              }}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
              title="Voir la landing page"
            >
              <ExternalLink className="h-4 w-4" /> Preview
            </button>
          )}
        </div>
      </div>

      {/* Expanded content for non-dashboard actions */}
      {expanded && isGenerated && action?.content && !config.dashboardUrl && (
        <div className={`border-t ${config.bgColor} p-6`}>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(action.content) }}
          />
        </div>
      )}
    </div>
  )
}
```

**Step 4: Add upload handler and state to ValidationPage**

Add `uploadingAction` state and `handleUpload` function. Update the ActionCard usage:

In the component state, add:
```typescript
const [uploadingAction, setUploadingAction] = useState<string | null>(null)
```

Add this function after `handleGenerate`:
```typescript
async function handleUpload(actionType: string, file: File) {
  setUploadingAction(actionType)
  setStreamContent('')

  try {
    const token = await getToken()
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_URL}/chat/${params.id}/actions/${actionType}/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    const reader = res.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let content = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          if (parsed.content) {
            content += parsed.content
            setStreamContent(content)
          }
        } catch { /* ignore */ }
      }
    }

    const { data } = await supabase
      .from('workspaces')
      .select('metadata')
      .eq('id', params.id)
      .single()

    if (data?.metadata?.actions) {
      setActions(data.metadata.actions)
    }
  } catch (err) {
    console.error('Upload generation failed:', err)
  } finally {
    setUploadingAction(null)
    setStreamContent('')
  }
}
```

Update the ActionCard rendering in the map:
```tsx
<ActionCard
  key={config.key}
  config={config}
  action={actions[config.key]}
  onGenerate={() => handleGenerate(config.key)}
  onUpload={(file) => handleUpload(config.key, file)}
  generating={generatingAction === config.key}
  uploading={uploadingAction === config.key}
  workspaceId={params.id}
/>
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/\[id\]/validation/page.tsx
git commit -m "feat: split branding into 3 cards with upload + dashboard links"
```

---

### Task 5: Create competitive analysis dashboard page

**Files:**
- Create: `apps/web/src/app/dashboard/workspace/[id]/validation/competitive/page.tsx`

**Step 1: Create the dashboard page**

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  Swords,
  Shield,
  Target,
  AlertTriangle,
  TrendingUp,
  Download,
  Loader2,
  ExternalLink,
} from 'lucide-react'

interface CompetitorData {
  name: string
  website?: string
  positioning: string
  pricing: string
  strengths: string[]
  weaknesses: string[]
  threatLevel: 'haute' | 'moyenne' | 'faible'
}

interface DifferentiationAxis {
  axis: string
  description: string
  strengthScore: number
  competitors: string
}

interface Opportunity {
  title: string
  description: string
  actionable: string
}

interface Risk {
  title: string
  description: string
  probability: 'haute' | 'moyenne' | 'faible'
  impact: 'fort' | 'moyen' | 'faible'
  mitigation: string
}

interface SwotSummary {
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
}

interface CompetitiveAnalysis {
  competitors: CompetitorData[]
  differentiationAxes: DifferentiationAxis[]
  opportunities: Opportunity[]
  risks: Risk[]
  swotSummary: SwotSummary
}

const threatColors = {
  haute: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  moyenne: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  faible: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const impactColors = {
  fort: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  moyen: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  faible: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

export default function CompetitiveDashboard() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<CompetitiveAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('')
  const dashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('name, metadata')
        .eq('id', params.id)
        .single()

      if (ws) {
        setWorkspaceName(ws.name)
        const structured = ws.metadata?.actions?.competitive?.structured
        if (structured) setData(structured as CompetitiveAnalysis)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleExportPdf() {
    const html2pdf = (await import('html2pdf.js')).default
    if (!dashboardRef.current) return
    html2pdf()
      .set({
        margin: [10, 10],
        filename: `analyse-concurrentielle-${workspaceName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(dashboardRef.current)
      .save()
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Swords className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune analyse concurrentielle generee.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour a la validation
        </Link>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Analyse concurrentielle</h1>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
        </div>
        <button
          onClick={handleExportPdf}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" /> Telecharger en PDF
        </button>
      </div>

      <div ref={dashboardRef} className="space-y-8">
        {/* Competitors grid */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Swords className="h-5 w-5 text-red-500" /> Concurrents ({data.competitors.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.competitors.map((c, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{c.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${threatColors[c.threatLevel]}`}>
                    Menace {c.threatLevel}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{c.positioning}</p>
                <p className="text-xs font-medium">Prix : {c.pricing}</p>
                {c.website && (
                  <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                    <ExternalLink className="h-3 w-3" /> {c.website}
                  </a>
                )}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase mb-1">Forces</p>
                    {c.strengths.map((s, j) => (
                      <p key={j} className="text-xs text-muted-foreground">• {s}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase mb-1">Faiblesses</p>
                    {c.weaknesses.map((w, j) => (
                      <p key={j} className="text-xs text-muted-foreground">• {w}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Differentiation axes */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-500" /> Axes de differenciation
          </h2>
          <div className="space-y-3">
            {data.differentiationAxes.map((a, i) => (
              <div key={i} className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{a.axis}</h3>
                  <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{a.strengthScore}/10</span>
                </div>
                <div className="h-2 rounded-full bg-muted mb-3">
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${a.strengthScore * 10}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">{a.description}</p>
                <p className="text-xs text-muted-foreground/70 mt-1 italic">Concurrents : {a.competitors}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Opportunities + Risks side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Opportunities */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" /> Opportunites
            </h2>
            <div className="space-y-3">
              {data.opportunities.map((o, i) => (
                <div key={i} className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                  <h3 className="font-medium text-emerald-700 dark:text-emerald-400">{o.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{o.description}</p>
                  <p className="text-xs mt-2 font-medium">Action : {o.actionable}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Risks */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Risques
            </h2>
            <div className="space-y-3">
              {data.risks.map((r, i) => (
                <div key={i} className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{r.title}</h3>
                    <div className="flex gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${threatColors[r.probability]}`}>
                        P: {r.probability}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${impactColors[r.impact]}`}>
                        I: {r.impact}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  <p className="text-xs mt-2 font-medium text-muted-foreground">Mitigation : {r.mitigation}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* SWOT Summary */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" /> Synthese SWOT
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
              <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-2">Forces</h3>
              {data.swotSummary.strengths.map((s, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {s}</p>
              ))}
            </div>
            <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase mb-2">Faiblesses</h3>
              {data.swotSummary.weaknesses.map((w, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {w}</p>
              ))}
            </div>
            <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-5">
              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase mb-2">Opportunites</h3>
              {data.swotSummary.opportunities.map((o, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {o}</p>
              ))}
            </div>
            <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-5">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase mb-2">Menaces</h3>
              {data.swotSummary.threats.map((t, i) => (
                <p key={i} className="text-sm text-muted-foreground">• {t}</p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/\[id\]/validation/competitive/page.tsx
git commit -m "feat: add competitive analysis dashboard page"
```

---

### Task 6: Create wording dashboard page

**Files:**
- Create: `apps/web/src/app/dashboard/workspace/[id]/validation/wording/page.tsx`

**Step 1: Create the dashboard page**

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  MessageSquareQuote,
  Download,
  Loader2,
  Copy,
  Check,
  Target,
  Mic,
  BookOpen,
  Ban,
  CheckCircle2,
} from 'lucide-react'

interface WordingData {
  positioning: {
    territory: string
    promise: string
    enemy: string
    belief: string
  }
  personality: {
    traits: { trait: string; example: string }[]
    toneOfVoice: string
    toneExamples: string[]
    doesSay: string[]
    neverSays: string[]
  }
  taglines: { text: string; rationale: string }[]
  pitches: {
    thirtySeconds: string
    email: string
    keyPhrases: string[]
  }
  lexicon: {
    useWords: string[]
    avoidWords: string[]
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="shrink-0 rounded-md p-1.5 hover:bg-accent transition-colors"
      title="Copier"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  )
}

export default function WordingDashboard() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<WordingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('')
  const dashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('name, metadata')
        .eq('id', params.id)
        .single()

      if (ws) {
        setWorkspaceName(ws.name)
        const structured = ws.metadata?.actions?.wording?.structured
        if (structured) setData(structured as WordingData)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleExportPdf() {
    const html2pdf = (await import('html2pdf.js')).default
    if (!dashboardRef.current) return
    html2pdf()
      .set({
        margin: [10, 10],
        filename: `wording-posture-${workspaceName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(dashboardRef.current)
      .save()
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <MessageSquareQuote className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucun wording genere.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour a la validation
        </Link>
      </div>
    )
  }

  return (
    <div className="px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Wording & Posture de marque</h1>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
        </div>
        <button
          onClick={handleExportPdf}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" /> Telecharger en PDF
        </button>
      </div>

      <div ref={dashboardRef} className="space-y-8">
        {/* Positioning */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-500" /> Positionnement
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Territoire de marque', value: data.positioning.territory, color: 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20' },
              { label: 'Promesse centrale', value: data.positioning.promise, color: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20' },
              { label: 'L\'ennemi', value: data.positioning.enemy, color: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' },
              { label: 'Le belief', value: data.positioning.belief, color: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20' },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border-2 ${item.color} p-5`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Personality */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mic className="h-5 w-5 text-orange-500" /> Personnalite & Ton de voix
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm">{data.personality.toneOfVoice}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.personality.traits.map((t, i) => (
                <div key={i} className="rounded-xl border bg-card p-4">
                  <p className="font-medium text-sm">{t.trait}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{t.example}&rdquo;</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.personality.toneExamples.map((ex, i) => (
                <div key={i} className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Exemple {i + 1}</p>
                  <p className="text-sm italic">&ldquo;{ex}&rdquo;</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> La marque dit</p>
                {data.personality.doesSay.map((s, i) => (
                  <p key={i} className="text-sm text-muted-foreground">• {s}</p>
                ))}
              </div>
              <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2 flex items-center gap-1"><Ban className="h-3 w-3" /> La marque ne dit jamais</p>
                {data.personality.neverSays.map((s, i) => (
                  <p key={i} className="text-sm text-muted-foreground">• {s}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Taglines */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Taglines</h2>
          <div className="space-y-3">
            {data.taglines.map((t, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-lg">&ldquo;{t.text}&rdquo;</p>
                  <p className="text-sm text-muted-foreground mt-1">{t.rationale}</p>
                </div>
                <CopyButton text={t.text} />
              </div>
            ))}
          </div>
        </section>

        {/* Pitches */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" /> Pitches
          </h2>
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pitch 30 secondes</p>
                <CopyButton text={data.pitches.thirtySeconds} />
              </div>
              <p className="text-sm">{data.pitches.thirtySeconds}</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pitch email</p>
                <CopyButton text={data.pitches.email} />
              </div>
              <p className="text-sm whitespace-pre-line">{data.pitches.email}</p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Phrases cles</p>
              <div className="space-y-2">
                {data.pitches.keyPhrases.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                    <p className="text-sm">&ldquo;{p}&rdquo;</p>
                    <CopyButton text={p} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Lexicon */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Lexique</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-3">Mots a utiliser</p>
              <div className="flex flex-wrap gap-2">
                {data.lexicon.useWords.map((w, i) => (
                  <span key={i} className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">{w}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-3">Mots a eviter</p>
              <div className="flex flex-wrap gap-2">
                {data.lexicon.avoidWords.map((w, i) => (
                  <span key={i} className="rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-400">{w}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/\[id\]/validation/wording/page.tsx
git commit -m "feat: add wording & brand posture dashboard page"
```

---

### Task 7: Create identity dashboard page

**Files:**
- Create: `apps/web/src/app/dashboard/workspace/[id]/validation/identity/page.tsx`

**Step 1: Create the dashboard page**

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft,
  Palette,
  Download,
  Loader2,
  Type,
  Eye,
  Sparkles,
  PenTool,
} from 'lucide-react'

interface ColorEntry {
  hex: string
  name: string
  usage: string
  rationale: string
}

interface IdentityData {
  colorPalette: {
    primary: ColorEntry
    secondary: ColorEntry
    accent: ColorEntry
    neutral: ColorEntry
    background: ColorEntry
  }
  typography: {
    headingFont: string
    bodyFont: string
    style: string
    hierarchy: {
      h1: string
      h2: string
      body: string
      caption: string
    }
    rationale: string
  }
  visualDirection: {
    moodKeywords: string[]
    references: { brand: string; why: string; takeaway: string }[]
    atmosphere: string
  }
  logoGuidelines: {
    direction: string
    type: string
    principles: string[]
    avoid: string[]
  }
}

function ColorSwatch({ color, label }: { color: ColorEntry; label: string }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="h-24 w-full" style={{ backgroundColor: color.hex }} />
      <div className="p-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <code className="text-xs font-mono text-muted-foreground">{color.hex}</code>
        </div>
        <p className="font-medium text-sm">{color.name}</p>
        <p className="text-xs text-muted-foreground">{color.usage}</p>
        <p className="text-xs text-muted-foreground/70 italic">{color.rationale}</p>
      </div>
    </div>
  )
}

export default function IdentityDashboard() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<IdentityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('')
  const dashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('name, metadata')
        .eq('id', params.id)
        .single()

      if (ws) {
        setWorkspaceName(ws.name)
        const structured = ws.metadata?.actions?.identity?.structured
        if (structured) setData(structured as IdentityData)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleExportPdf() {
    const html2pdf = (await import('html2pdf.js')).default
    if (!dashboardRef.current) return
    html2pdf()
      .set({
        margin: [10, 10],
        filename: `identite-visuelle-${workspaceName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(dashboardRef.current)
      .save()
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <Palette className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Aucune identite visuelle generee.</p>
        <Link href={`/dashboard/workspace/${params.id}/validation`} className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour a la validation
        </Link>
      </div>
    )
  }

  const colorEntries: { label: string; key: keyof IdentityData['colorPalette'] }[] = [
    { label: 'Primaire', key: 'primary' },
    { label: 'Secondaire', key: 'secondary' },
    { label: 'Accent', key: 'accent' },
    { label: 'Neutre', key: 'neutral' },
    { label: 'Fond', key: 'background' },
  ]

  return (
    <div className="px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/workspace/${params.id}/validation`} className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Identite visuelle</h1>
            <p className="text-sm text-muted-foreground">{workspaceName}</p>
          </div>
        </div>
        <button
          onClick={handleExportPdf}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" /> Telecharger en PDF
        </button>
      </div>

      <div ref={dashboardRef} className="space-y-8">
        {/* Color Palette */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5 text-purple-500" /> Palette de couleurs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {colorEntries.map(({ label, key }) => (
              <ColorSwatch key={key} color={data.colorPalette[key]} label={label} />
            ))}
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Type className="h-5 w-5 text-blue-500" /> Typographie
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font titres</p>
                <p className="text-2xl font-bold mt-1">{data.typography.headingFont}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Font texte</p>
                <p className="text-lg mt-1">{data.typography.bodyFont}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Style</p>
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1">{data.typography.style}</span>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hierarchie</p>
              {Object.entries(data.typography.hierarchy).map(([level, desc]) => (
                <div key={level} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                  <code className="text-xs font-mono font-semibold">{level}</code>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Justification</p>
            <p className="text-sm text-muted-foreground">{data.typography.rationale}</p>
          </div>
        </section>

        {/* Visual Direction */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5 text-emerald-500" /> Direction artistique
          </h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {data.visualDirection.moodKeywords.map((kw, i) => (
                <span key={i} className="rounded-full border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 px-4 py-1.5 text-sm font-medium">{kw}</span>
              ))}
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Atmosphere</p>
              <p className="text-sm">{data.visualDirection.atmosphere}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.visualDirection.references.map((ref, i) => (
                <div key={i} className="rounded-xl border bg-card p-5">
                  <p className="font-semibold text-sm">{ref.brand}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ref.why}</p>
                  <p className="text-xs font-medium mt-2">A retenir : {ref.takeaway}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Logo Guidelines */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PenTool className="h-5 w-5 text-pink-500" /> Guidelines logo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Direction</p>
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1">{data.logoGuidelines.direction}</span>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Type</p>
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium mt-1">{data.logoGuidelines.type}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">Principes</p>
                {data.logoGuidelines.principles.map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {p}</p>
                ))}
              </div>
              <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2">A eviter</p>
                {data.logoGuidelines.avoid.map((a, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {a}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/workspace/\[id\]/validation/identity/page.tsx
git commit -m "feat: add visual identity dashboard page"
```

---

### Task 8: Build and verify

**Step 1: Build API**

```bash
cd /opt/agent-more && npm run build --workspace=@agent-all/api
```

**Step 2: Build Web**

```bash
cd /opt/agent-more && npm run build --workspace=@agent-all/web
```

**Step 3: Fix any build errors and commit**
