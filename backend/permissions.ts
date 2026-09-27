/**
 * ROLE 3: Permissions Interface (Supabase-backed)
 *
 * Provides: checkPermission(userId, documentId, blockId?, action?)
 * Consumed by: Role 2 (Sync Engine) as the pre-op gate in handleIncomingOp(op)
 */

import { supabase } from '../supabaseClient.js';

export interface PermissionCheckResult {
  allowed: boolean;
  role: string;
  reason?: string;
}

// Which actions each role is allowed to perform
const ROLE_PERMISSIONS: Record<string, string[]> = {
  editor: ['insert', 'delete', 'update', 'format', 'RESTORE_VERSION'],
  viewer: ['comment']
};

function isActionAllowed(role: string, action?: string): boolean {
  if (!action) return true; // no specific action given, defer to allowed flag from role lookup
  const allowedActions = ROLE_PERMISSIONS[role] || [];
  return allowedActions.includes(action);
}

/**
 * CONTRACT METHOD: checkPermission(userId, documentId, blockId?, action?)
 * Same signature Role 2 already calls — internals now hit Supabase instead
 * of the hardcoded registry.
 */
export async function checkPermission(
  userOrId: string | { id: string; role?: string },
  docOrId?: string | { id: string },
  blockId?: string,
  action?: string
): Promise<PermissionCheckResult> {
  const userId = typeof userOrId === 'object' ? userOrId.id : userOrId;
  const documentId = typeof docOrId === 'object' ? docOrId.id : docOrId;

  if (!userId || !documentId) {
    return { allowed: false, role: 'none', reason: 'permission-denied: missing userId or documentId' };
  }

  let role: string | null = null;

  // 1. Block-specific permission takes priority, if a blockId was given
  if (blockId) {
    const { data: blockPerm } = await supabase
      .from('permissions')
      .select('role')
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .eq('block_id', blockId)
      .maybeSingle();

    if (blockPerm) role = blockPerm.role;
  }

  // 2. Fall back to document-level permission (block_id is null)
  if (!role) {
    const { data: docPerm } = await supabase
      .from('permissions')
      .select('role')
      .eq('user_id', userId)
      .eq('document_id', documentId)
      .is('block_id', null)
      .maybeSingle();

    if (docPerm) role = docPerm.role;
  }

  if (!role) {
    return { allowed: false, role: 'none', reason: 'permission-denied: no access record for this user/document' };
  }

  const allowed = isActionAllowed(role, action);
  return {
    allowed,
    role,
    reason: allowed ? undefined : `permission-denied: role '${role}' cannot perform action '${action}'`
  };
}