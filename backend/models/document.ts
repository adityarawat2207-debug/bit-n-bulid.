/**
 * ROLE 2: Document Data Model
 * 
 * Owns: CRDT document data model, operation schemas, vector clocks, and sync payloads.
 */

export type UserRole = 'admin' | 'editor' | 'legal' | 'viewer';

export interface User {
  id: string;
  name: string;
  color: string;
  avatar: string;
  role: UserRole;
  isSimulated?: boolean;
}

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'todo'
  | 'bullet_list'
  | 'numbered_list'
  | 'quote'
  | 'code';

export interface BlockAuthorInfo {
  id: string;
  name: string;
  color: string;
}

export interface ConflictBanner {
  type: 'delete_vs_edit' | 'concurrent_merge' | 'permission_rejected';
  message: string;
  originalValue?: string;
  mergedValue?: string;
  timestamp: number;
  resolved?: boolean;
}

export interface Block {
  id: string;
  sectionId: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  order: string; // Fractional index for deterministic total ordering
  lamport: number;
  author: BlockAuthorInfo;
  updatedAt: number;
  isDeleted?: boolean;
  deletedBy?: { id: string; name: string; timestamp: number } | null;
  conflictBanner?: ConflictBanner | null;
}

export interface Section {
  id: string;
  title: string;
  order: string;
  allowedRoles: UserRole[];
  isLocked: boolean;
  lockedBy?: { id: string; name: string; timestamp: number } | null;
  author: { id: string; name: string };
  createdAt: number;
}

export interface Document {
  id: string;
  title: string;
  sections: Section[];
  blocks: Block[];
  version: number;
  vectorClock: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export type OperationType =
  | 'BLOCK_UPDATE_TEXT'
  | 'BLOCK_INSERT'
  | 'BLOCK_DELETE'
  | 'BLOCK_REORDER'
  | 'BLOCK_TOGGLE_CHECK'
  | 'BLOCK_CHANGE_TYPE'
  | 'SECTION_INSERT'
  | 'SECTION_UPDATE'
  | 'SECTION_LOCK'
  | 'SECTION_PERMISSIONS_UPDATE'
  | 'SECTION_DELETE'
  | 'DOC_UPDATE_TITLE'
  | 'RESTORE_VERSION';

export interface Operation {
  opId: string;
  docId: string;
  documentId?: string; // Alias for Role 3 contract compatibility
  userId?: string;     // Alias for Role 3 contract compatibility
  type: OperationType;
  blockId?: string;
  sectionId?: string;
  baseContent?: string; // Pre-mutation content for 3-way differential merge
  payload: any;
  author: {
    id: string;
    name: string;
    color: string;
    role: UserRole;
  };
  lamport: number;
  timestamp: number;
}

export interface VersionSnapshot {
  versionId: string;
  docId: string;
  versionNumber: number;
  title: string;
  description: string;
  snapshot: Document;
  author: {
    id: string;
    name: string;
    color: string;
  };
  timestamp: number;
  trigger: 'auto' | 'offline_sync' | 'manual_milestone' | 'version_restored' | 'initial';
  diffSummary?: {
    addedBlocks: number;
    modifiedBlocks: number;
    deletedBlocks: number;
  };
}

export type AuditLogType =
  | 'MERGE_CONCURRENT_EDITS'
  | 'DELETE_VS_EDIT_RESURRECTED'
  | 'LIST_REORDER_CONVERGED'
  | 'PERMISSION_DENIED'
  | 'OFFLINE_SYNC_COMPLETED'
  | 'VERSION_RESTORED'
  | 'SECTION_LOCKED'
  | 'SECTION_UNLOCKED';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  type: AuditLogType;
  severity: 'info' | 'warning' | 'conflict' | 'error';
  author: {
    id: string;
    name: string;
    color: string;
  };
  details: string;
  blockId?: string;
  sectionId?: string;
  resolution?: string;
}

export interface UserPresence {
  user: User;
  cursor?: {
    blockId: string;
    offset: number;
    selectionEnd?: number;
    timestamp: number;
  };
  status: 'online' | 'flaky' | 'offline';
  lastSeen: number;
}

export interface SyncMessage {
  type:
    | 'INIT_DOC'
    | 'APPLY_OP'
    | 'OP_ACK'
    | 'OP_REJECTED'
    | 'SYNC_OFFLINE_QUEUE'
    | 'SYNC_CONVERGED'
    | 'PRESENCE_UPDATE'
    | 'AUDIT_LOG'
    | 'CREATE_SNAPSHOT'
    | 'RESTORE_SNAPSHOT'
    | 'RESET_DOC';
  docId: string;
  payload: any;
  timestamp: number;
}
