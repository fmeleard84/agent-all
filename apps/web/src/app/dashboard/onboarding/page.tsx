'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

type AxeType = 'idea' | 'launch' | 'existing'

const axes: { type: AxeType; icon: string; title: string; description: string; agents: string[]; borderColor: string; gradientFrom: string }[] = [
  {
    type: 'idea',
    icon: '\u{1F4A1}',
    title: "J'ai une id\u00e9e",
    description: "Transformez une intuition en projet structur\u00e9. Nos agents vous aident \u00e0 clarifier l'id\u00e9e, tester son potentiel et d\u00e9finir vos premi\u00e8res hypoth\u00e8ses.",
    agents: ['Idea Agent', 'Market Agent', 'Challenge Agent'],
    borderColor: 'border-amber-500/50 hover:border-amber-400',
    gradientFrom: 'from-amber-950/40 to-gray-900/80',
  },
  {
    type: 'launch',
    icon: '\u{1F680}',
    title: "Je veux ouvrir une bo\u00eete",
    description: "Passez de l'id\u00e9e \u00e0 l'activit\u00e9. Nos agents vous aident \u00e0 structurer votre offre, pr\u00e9parer votre pr\u00e9sence en ligne et lancer vos premiers workflows.",
    agents: ['Business Setup Agent', 'Brand Agent', 'Marketing Agent'],
    borderColor: 'border-blue-500/50 hover:border-blue-400',
    gradientFrom: 'from-blue-950/40 to-gray-900/80',
  },
  {
    type: 'existing',
    icon: '\u{1F3E2}',
    title: "J'ai d\u00e9j\u00e0 une bo\u00eete",
    description: "Connectez votre activit\u00e9 \u00e0 l'Agent OS. Analysez vos process, activez les bons agents et commencez \u00e0 automatiser ce qui vous freine.",
    agents: ['Ops Agent', 'Finance Agent', 'Admin Agent'],
    borderColor: 'border-emerald-500/50 hover:border-emerald-400',
    gradientFrom: 'from-emerald-950/40 to-gray-900/80',
  },
]

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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ axeType }),
      })

      if (!res.ok) {
        throw new Error('Failed to create workspace')
      }

      const workspace = await res.json()
      router.push(`/dashboard/workspace/${workspace.id}`)
    } catch (error) {
      console.error('Error creating workspace:', error)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-5xl w-full space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Bienvenue sur Agent All
          </h1>
          <p className="text-gray-400 text-lg">
            Choisissez votre point de d&eacute;part
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {axes.map((axe) => (
            <button
              key={axe.type}
              onClick={() => handleSelect(axe.type)}
              disabled={loading !== null}
              className="text-left focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg"
            >
              <Card
                className={`
                  relative overflow-hidden cursor-pointer
                  bg-gradient-to-br ${axe.gradientFrom}
                  border ${axe.borderColor}
                  transition-all duration-300 ease-out
                  hover:scale-[1.03] hover:shadow-xl hover:shadow-black/30
                  ${loading === axe.type ? 'opacity-80 scale-[0.98]' : ''}
                  ${loading !== null && loading !== axe.type ? 'opacity-40 pointer-events-none' : ''}
                `}
              >
                <CardHeader className="pb-3">
                  <div className="text-4xl mb-3">{axe.icon}</div>
                  <CardTitle className="text-xl text-white">{axe.title}</CardTitle>
                  <CardDescription className="text-gray-400 text-sm leading-relaxed">
                    {axe.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agents activ&eacute;s
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {axe.agents.map((agent) => (
                        <span
                          key={agent}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-gray-300 border border-white/10"
                        >
                          {agent}
                        </span>
                      ))}
                    </div>
                  </div>
                  {loading === axe.type && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Cr&eacute;ation en cours...
                    </div>
                  )}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
