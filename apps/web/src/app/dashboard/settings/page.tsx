'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [approvalThreshold, setApprovalThreshold] = useState('5000')
  const [confidenceThreshold, setConfidenceThreshold] = useState('0.7')
  const [maxAutoEmails, setMaxAutoEmails] = useState('20')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: cu } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)

      const cId = cu?.[0]?.company_id
      if (!cId) return
      setCompanyId(cId)

      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', cId)
        .single()
      setCompanyName(company?.name || '')

      const { data: memory } = await supabase
        .from('company_memory')
        .select('internal_rules')
        .eq('company_id', cId)
        .single()

      const rules = memory?.internal_rules || []
      const threshold = rules.find((r: any) => r.type === 'approval_threshold')
      if (threshold) {
        setApprovalThreshold(String(threshold.config?.amount ?? 5000))
        setConfidenceThreshold(String(threshold.config?.minConfidence ?? 0.7))
      }
      const rateLimit = rules.find((r: any) => r.type === 'rate_limit')
      if (rateLimit) {
        setMaxAutoEmails(String(rateLimit.config?.maxPerDay ?? 20))
      }
    }
    load()
  }, [])

  async function handleSave() {
    if (!companyId) return
    setSaving(true)

    await supabase
      .from('companies')
      .update({ name: companyName })
      .eq('id', companyId)

    const rules = [
      {
        id: 'approval-threshold',
        type: 'approval_threshold',
        config: {
          amount: parseFloat(approvalThreshold),
          minConfidence: parseFloat(confidenceThreshold),
        },
      },
      {
        id: 'rate-limit',
        type: 'rate_limit',
        config: { maxPerDay: parseInt(maxAutoEmails, 10) },
      },
    ]

    await supabase
      .from('company_memory')
      .update({ internal_rules: rules })
      .eq('company_id', companyId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Parametres</h1>
        <p className="text-muted-foreground">Configuration de votre entreprise</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entreprise</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nom de l entreprise</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regles des agents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Seuil de validation montant (EUR)</label>
            <p className="text-xs text-muted-foreground mb-1">
              Les actions depassant ce montant necessitent une validation
            </p>
            <Input
              type="number"
              value={approvalThreshold}
              onChange={(e) => setApprovalThreshold(e.target.value)}
            />
          </div>
          <Separator />
          <div>
            <label className="text-sm font-medium">Seuil de confiance minimum</label>
            <p className="text-xs text-muted-foreground mb-1">
              Les actions sous ce seuil de confiance necessitent une validation (0 a 1)
            </p>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(e.target.value)}
            />
          </div>
          <Separator />
          <div>
            <label className="text-sm font-medium">Emails automatiques max / jour</label>
            <Input
              type="number"
              value={maxAutoEmails}
              onChange={(e) => setMaxAutoEmails(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
        {saved && <span className="text-sm text-green-600">Enregistre</span>}
      </div>
    </div>
  )
}
