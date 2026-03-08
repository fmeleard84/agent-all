'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Lightbulb, Rocket, Building2, ArrowRight, Loader2 } from 'lucide-react'

type AxeType = 'idea' | 'launch' | 'existing'

const axes: { type: AxeType; icon: typeof Lightbulb; title: string; description: string; agents: string[] }[] = [
  {
    type: 'idea',
    icon: Lightbulb,
    title: "J'ai une idee",
    description: "Transformez une intuition en projet structure. Nos agents clarifient l'idee, testent le potentiel et definissent vos hypotheses.",
    agents: ['Idea', 'Market', 'Challenge'],
  },
  {
    type: 'launch',
    icon: Rocket,
    title: 'Je veux ouvrir une boite',
    description: "Passez de l'idee a l'activite. Structurez votre offre, preparez votre presence en ligne et lancez vos premiers workflows.",
    agents: ['Business Setup', 'Brand', 'Marketing'],
  },
  {
    type: 'existing',
    icon: Building2,
    title: "J'ai deja une boite",
    description: "Connectez votre activite a l'Agent OS. Analysez vos process, activez les bons agents et automatisez.",
    agents: ['Ops', 'Finance', 'Admin'],
  },
]

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<AxeType | null>(null)

  async function handleSelect(axeType: AxeType) {
    if (loading) return
    setLoading(axeType)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const res = await fetch(`${API_URL}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ axeType }),
      })

      if (!res.ok) throw new Error('Failed to create workspace')

      const workspace = await res.json()
      router.push(`/dashboard/workspace/${workspace.id}`)
    } catch (error) {
      console.error('Error creating workspace:', error)
      setLoading(null)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="max-w-4xl w-full space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Bienvenue sur Agent All</h1>
          <p className="text-muted-foreground">Choisissez votre point de depart</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {axes.map((axe) => {
            const Icon = axe.icon
            const isLoading = loading === axe.type
            const isDisabled = loading !== null && !isLoading

            return (
              <button
                key={axe.type}
                onClick={() => handleSelect(axe.type)}
                disabled={loading !== null}
                className="text-left group"
              >
                <Card className={`h-full transition-all duration-200 hover:shadow-md hover:border-violet-200 ${isLoading ? 'border-violet-400 shadow-md' : ''} ${isDisabled ? 'opacity-40' : ''}`}>
                  <CardHeader className="space-y-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{axe.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {axe.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {axe.agents.map((agent) => (
                        <span
                          key={agent}
                          className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700"
                        >
                          {agent}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center text-sm font-medium text-violet-600 group-hover:text-violet-700">
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creation...
                        </>
                      ) : (
                        <>
                          Commencer
                          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
