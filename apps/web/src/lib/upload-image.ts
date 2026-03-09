import { supabase } from './supabase'

export async function uploadLandingImage(
  workspaceId: string,
  file: File,
  slot: string,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `landing/${workspaceId}/${slot}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('images')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage
    .from('images')
    .getPublicUrl(path)

  return data.publicUrl
}
