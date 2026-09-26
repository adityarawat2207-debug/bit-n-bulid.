import { supabase } from './supabaseClient.js'

export async function checkPermission(userId, documentId) {
  const { data, error } = await supabase
    .from('permissions')
    .select('role')
    .eq('user_id', userId)
    .eq('document_id', documentId)
    .single()

  if (error || !data) {
    return { allowed: false, role: null }
  }

  return {
    allowed: data.role === 'editor',
    role: data.role
  }
}