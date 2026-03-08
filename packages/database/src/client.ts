import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
    client = createClient(url, key)
  }
  return client
}

export function getSupabaseServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    serviceClient = createClient(url, key)
  }
  return serviceClient
}
