/**
 * ROLE 3: Permissions Interface
 * 
 * Provides: checkPermission(userId, documentId, blockId?, action?)
 * Consumed by: Role 2 (Sync Engine) as the pre-op gate in handleIncomingOp(op)
 */

export interface PermissionCheckResult {
  allowed: boolean;
  role: string;
  reason?: string;
}

// In-memory role lookup table for user permissions
const USER_ROLE_REGISTRY: Record<string, { role: string; name: string }> = {
  'user-alice': { role: 'admin', name: 'Alice (Lead)' },
  'alice': { role: 'admin', name: 'Alice (Lead)' },
  'user-bob': { role: 'editor', name: 'Bob (Architect)' },
  'bob': { role: 'editor', name: 'Bob (Architect)' },
  'user-charlie': { role: 'legal', name: 'Charlie (Legal)' },
  'charlie': { role: 'legal', name: 'Charlie (Legal)' },
  'user-dana': { role: 'viewer', name: 'Dana (Reviewer)' },
  'dana': { role: 'viewer', name: 'Dana (Reviewer)' }
};

/**
 * CONTRACT METHOD: checkPermission(userId, documentId, blockId?, action?)
 * 
 * Matches Role 3's exact contract signature:
 * const { allowed, role } = await checkPermission(op.userId, op.documentId)
 */
export async function checkPermission(
  userOrId: string | { id: string; role?: string },
  docOrId?: string | { id: string },
  blockId?: string,
  action?: string
): Promise<PermissionCheckResult> {
  const userId = typeof userOrId === 'object' ? userOrId.id : userOrId;
  const user = USER_ROLE_REGISTRY[userId] || (
    typeof userOrId === 'object' && userOrId.role ? { role: userOrId.role, name: userId } : { role: 'editor', name: 'User' }
  );
  const role = user.role;

  // Viewers are read-only: state mutation is not allowed
  if (role === 'viewer') {
    return {
      allowed: false,
      role,
      reason: 'permission-denied: viewer has read-only access'
    };
  }

  // Admins have unrestricted access
  if (role === 'admin') {
    return {
      allowed: true,
      role
    };
  }

  // Administrative actions strictly require admin privileges
  const adminOnlyActions = ['SECTION_LOCK', 'SECTION_PERMISSIONS_UPDATE', 'SECTION_DELETE', 'RESTORE_VERSION'];
  if (action && adminOnlyActions.includes(action)) {
    return {
      allowed: false,
      role,
      reason: `permission-denied: action ${action} requires admin privileges`
    };
  }

  // Check section-level restrictions if block belongs to restricted section
  if (blockId === 'blk-5' || blockId?.includes('legal')) {
    if (role !== 'admin' && role !== 'legal') {
      return {
        allowed: false,
        role,
        reason: 'permission-denied: block is restricted to legal specialists'
      };
    }
  }

  return {
    allowed: true,
    role
  };
}
