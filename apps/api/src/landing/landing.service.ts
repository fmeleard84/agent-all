import { Injectable, BadRequestException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface NewsletterSubmission {
  workspace_id: string
  landing_slug: string
  email: string
}

interface ContactSubmission {
  workspace_id: string
  landing_slug: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  message: string
}

@Injectable()
export class LandingService {
  async submitNewsletter(body: NewsletterSubmission) {
    if (!body.email || !body.workspace_id || !body.landing_slug) {
      throw new BadRequestException('Missing required fields')
    }

    const { error } = await supabase.from('landing_contacts').insert({
      workspace_id: body.workspace_id,
      landing_slug: body.landing_slug,
      form_type: 'newsletter',
      email: body.email,
    })

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  async submitContact(body: ContactSubmission) {
    if (!body.email || !body.workspace_id || !body.landing_slug) {
      throw new BadRequestException('Missing required fields')
    }

    const { error } = await supabase.from('landing_contacts').insert({
      workspace_id: body.workspace_id,
      landing_slug: body.landing_slug,
      form_type: 'contact',
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone || null,
      message: body.message || null,
    })

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  async getContacts(workspaceId: string) {
    const { data, error } = await supabase
      .from('landing_contacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data
  }
}
