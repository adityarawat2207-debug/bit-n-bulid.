import { supabase } from './supabaseClient.js'

// Define which actions each role is allowed to perform
const ROLE_PERMISSIONS = {
  editor: ['insert', 'delete', 'update', 'format'],
  viewer: ['comment']   // viewers can comment but not mutate content
}

function isActionAllowed(role, opType) {
  if (!role) return false
  const allowedActions = ROLE_PERMISSIONS[role] || []
  return allowedActions.includes(opType)
}

export async function checkPermission(userId, documentId, blockId, opType) {
  let role = null

  // 1. Check for a block-specific permission first
  if (blockId) {
    const { data: blockPerm } = await supabase
      .from('permissions')
      .select('role')
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .eq('block_id', blockId)
      .maybeSingle()

    if (blockPerm) role = blockPerm.role
  }

  // 2. Fall back to document-level permission if no block-level match
  if (!role) {
    const { data: docPerm } = await supabase
      .from('permissions')
      .select('role')
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .is('block_id', null)
      .maybeSingle()

    if (docPerm) role = docPerm.role
  }

  if (!role) {
    return { allowed: false, role: null }
  }

  return { allowed: isActionAllowed(role, opType), role }
}