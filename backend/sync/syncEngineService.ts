/**
 * ROLE 2: Sync Engine Service (Exact Contract Implementation)
 * 
 * Exposes:
 *   - applyOp(op): ApplyOpResult
 *   - getDocState(docId): Document
 *   - subscribeToChanges(docId, listener): UnsubscribeFn
 *   - reconcileOfflineBatch(docId, ops): SyncBatchResult
 * 
 * Consumes:
 *   - checkPermission(user, blockId, action): Pre-op gate from Role 3
 */

import {
  Document,
  Block,
  Section,
  Operation,
  AuditLogEntry,
  User
} from '../models/document.js';
import { generateBetween, compareBlockOrder } from '../engine/fractionalIndex.js';
import { threeWayMerge } from '../engine/diffMerge.js';

export interface ApplyOpResult {
  success: boolean;
  document: Document;
  auditEntry?: AuditLogEntry;
  error?: string;
}

export interface SyncBatchResult {
  document: Document;
  appliedCount: number;
  rejectedCount: number;
  conflictsResolved: number;
  auditEntries: AuditLogEntry[];
}

export type ChangeListener = (op: Operation, state: Document, auditEntry?: AuditLogEntry) => void;
export type UnsubscribeFn = () => void;

export type PermissionPreCheck = (
  user: User,
  blockId?: string,
  action?: string,
  doc?: Document,
  sectionId?: string
) => { allowed: boolean; role?: string; reason?: string } | Promise<{ allowed: boolean; role?: string; reason?: string }>;

export class SyncEngineService {
  private documents: Map<string, Document> = new Map();
  private subscribers: Map<string, Set<ChangeListener>> = new Map();
  private permissionGate: PermissionPreCheck | null = null;
  private ledgers: Map<string, Operation[]> = new Map();

  constructor(permissionGate?: PermissionPreCheck) {
    if (permissionGate) {
      this.permissionGate = permissionGate;
    }
  }

  /**
   * ROLE 2/3 CONTRACT INTEGRATION: handleIncomingOp(op)
   * 
   * As specified by Role 3:
   * 1. Awaits checkPermission(op.userId, op.documentId)
   * 2. If !allowed, returns { rejected: true, reason: 'permission-denied', role }
   * 3. If allowed, merges op into document via CRDT engine and returns { rejected: false, ...result }
   */
  public async handleIncomingOp(op: Operation): Promise<{
    rejected: boolean;
    reason?: string;
    role?: string;
    document?: Document;
    auditEntry?: AuditLogEntry;
    success?: boolean;
    error?: string;
  }> {
    const userId = op.userId || op.author?.id;
    const documentId = op.documentId || op.docId;

    if (this.permissionGate) {
      const perm = await this.permissionGate(
        {
          id: userId,
          name: op.author?.name || 'User',
          color: op.author?.color || '#3b82f6',
          avatar: '',
          role: op.author?.role || 'editor'
        },
        op.blockId,
        op.type,
        this.getDocState(documentId),
        op.sectionId
      );

      if (!perm.allowed) {
        return {
          rejected: true,
          reason: perm.reason || 'permission-denied',
          role: perm.role || op.author?.role
        };
      }
    }

    // Proceed to merge op into document
    const result = this.applyOp({
      ...op,
      docId: documentId,
      author: op.author || { id: userId, name: userId, color: '#3b82f6', role: 'editor' }
    });

    if (!result.success) {
      return {
        rejected: true,
        reason: result.error || 'merge-failed',
        error: result.error
      };
    }

    return {
      rejected: false,
      success: true,
      document: result.document,
      auditEntry: result.auditEntry
    };
  }

  public setPermissionGate(gate: PermissionPreCheck) {
    this.permissionGate = gate;
  }

  public registerDocument(doc: Document) {
    this.documents.set(doc.id, JSON.parse(JSON.stringify(doc)));
  }

  /**
   * CONTRACT METHOD: getDocState(docId)
   */
  public getDocState(docId: string): Document | undefined {
    const doc = this.documents.get(docId);
    return doc ? JSON.parse(JSON.stringify(doc)) : undefined;
  }

  /**
   * CONTRACT METHOD: subscribeToChanges(docId, listener)
   */
  public subscribeToChanges(docId: string, listener: ChangeListener): UnsubscribeFn {
    if (!this.subscribers.has(docId)) {
      this.subscribers.set(docId, new Set());
    }
    this.subscribers.get(docId)!.add(listener);

    return () => {
      const set = this.subscribers.get(docId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.subscribers.delete(docId);
        }
      }
    };
  }

  private notifySubscribers(docId: string, op: Operation, state: Document, auditEntry?: AuditLogEntry) {
    const listeners = this.subscribers.get(docId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(op, state, auditEntry);
        } catch (e) {
          console.error('[SyncEngine] Subscriber callback error:', e);
        }
      }
    }
  }

  /**
   * CONTRACT METHOD: applyOp(op)
   */
  public applyOp(op: Operation): ApplyOpResult {
    const docId = op.docId;
    let doc = this.documents.get(docId);
    if (!doc) {
      return { success: false, document: null as any, error: `Document ${docId} not found in Sync Engine` };
    }

    // 1. Role 3 Pre-Op Gate Check
    if (this.permissionGate) {
      const perm = this.permissionGate(
        {
          id: op.author?.id || op.userId || 'unknown',
          name: op.author?.name || 'User',
          color: op.author?.color || '#3b82f6',
          avatar: '',
          role: op.author?.role || 'editor'
        },
        op.blockId,
        op.type,
        doc,
        op.sectionId
      );

      // Only reject synchronously if perm explicitly resolved with allowed === false
      if (perm && typeof perm === 'object' && 'allowed' in perm && (perm as any).allowed === false) {
        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: Date.now(),
          type: 'PERMISSION_DENIED',
          severity: 'error',
          author: { id: op.author?.id || op.userId || 'user', name: op.author?.name || 'User', color: op.author?.color || '#3b82f6' },
          details: `Pre-op check failed: ${(perm as any).reason || 'permission-denied'}`,
          blockId: op.blockId,
          sectionId: op.sectionId
        };
        return { success: false, document: doc, error: (perm as any).reason || 'permission-denied', auditEntry };
      }
    }

    // 2. CRDT Merge & State Mutation
    const newDoc: Document = {
      ...doc,
      blocks: [...doc.blocks],
      sections: [...doc.sections],
      vectorClock: { ...doc.vectorClock },
      version: doc.version + 1,
      updatedAt: Date.now()
    };

    newDoc.vectorClock[op.author.id] = (newDoc.vectorClock[op.author.id] || 0) + 1;
    let auditEntry: AuditLogEntry | undefined;

    switch (op.type) {
      case 'BLOCK_UPDATE_TEXT': {
        const blockIndex = newDoc.blocks.findIndex(b => b.id === op.blockId);
        if (blockIndex === -1) {
          return { success: false, document: doc, error: `Block ${op.blockId} not found` };
        }

        const currentBlock = newDoc.blocks[blockIndex];

        // Delete vs. Edit conflict -> Tombstone resurrection
        if (currentBlock.isDeleted) {
          const resurrected: Block = {
            ...currentBlock,
            content: op.payload.content,
            isDeleted: false,
            deletedBy: null,
            author: { id: op.author.id, name: op.author.name, color: op.author.color },
            updatedAt: Date.now(),
            lamport: Math.max(currentBlock.lamport, op.lamport) + 1,
            conflictBanner: {
              type: 'delete_vs_edit',
              message: `Preserved offline edits: Block was deleted by ${currentBlock.deletedBy?.name || 'peer'}, but safely restored because ${op.author.name} edited it.`,
              timestamp: Date.now(),
              originalValue: op.payload.content
            }
          };
          newDoc.blocks[blockIndex] = resurrected;

          auditEntry = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            type: 'DELETE_VS_EDIT_RESURRECTED',
            severity: 'conflict',
            author: { id: op.author.id, name: op.author.name, color: op.author.color },
            details: `Block ${op.blockId} resurrected: Offline edit by ${op.author.name} preserved after deletion.`,
            blockId: op.blockId,
            sectionId: currentBlock.sectionId,
            resolution: 'Block non-destructively restored with conflict banner'
          };
          break;
        }

        // Concurrent Paragraph Edit -> 3-way differential merge
        const baseText = op.baseContent ?? currentBlock.content;
        const incomingText = op.payload.content;

        if (baseText !== currentBlock.content && currentBlock.content !== incomingText) {
          const merge = threeWayMerge(
            baseText,
            currentBlock.content,
            incomingText,
            currentBlock.author.name,
            op.author.name
          );

          newDoc.blocks[blockIndex] = {
            ...currentBlock,
            content: merge.mergedText,
            author: { id: op.author.id, name: op.author.name, color: op.author.color },
            lamport: Math.max(currentBlock.lamport, op.lamport) + 1,
            updatedAt: Date.now(),
            conflictBanner: merge.hasConflict ? {
              type: 'concurrent_merge',
              message: `Concurrent edits reconciled: ${merge.conflictDetails}`,
              timestamp: Date.now(),
              originalValue: currentBlock.content,
              mergedValue: merge.mergedText
            } : null
          };

          auditEntry = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            type: 'MERGE_CONCURRENT_EDITS',
            severity: merge.hasConflict ? 'conflict' : 'info',
            author: { id: op.author.id, name: op.author.name, color: op.author.color },
            details: `Concurrent edits merged: ${merge.conflictDetails}`,
            blockId: op.blockId,
            sectionId: currentBlock.sectionId,
            resolution: merge.hasConflict ? '3-way diff merge with side-by-side reconciliation' : 'Clean 3-way text merge'
          };
          break;
        }

        // Standard edit
        newDoc.blocks[blockIndex] = {
          ...currentBlock,
          content: incomingText,
          author: { id: op.author.id, name: op.author.name, color: op.author.color },
          lamport: Math.max(currentBlock.lamport, op.lamport) + 1,
          updatedAt: Date.now(),
          conflictBanner: null
        };
        break;
      }

      case 'BLOCK_INSERT': {
        const { block } = op.payload;
        if (!newDoc.blocks.some(b => b.id === block.id)) {
          newDoc.blocks.push({
            ...block,
            lamport: op.lamport,
            author: { id: op.author.id, name: op.author.name, color: op.author.color },
            updatedAt: Date.now()
          });
          newDoc.blocks.sort(compareBlockOrder);
        }
        break;
      }

      case 'BLOCK_DELETE': {
        const blockIndex = newDoc.blocks.findIndex(b => b.id === op.blockId);
        if (blockIndex !== -1) {
          newDoc.blocks[blockIndex] = {
            ...newDoc.blocks[blockIndex],
            isDeleted: true,
            deletedBy: { id: op.author.id, name: op.author.name, timestamp: Date.now() },
            updatedAt: Date.now()
          };
        }
        break;
      }

      case 'BLOCK_REORDER': {
        const { targetOrder, targetSectionId } = op.payload;
        const blockIndex = newDoc.blocks.findIndex(b => b.id === op.blockId);
        if (blockIndex !== -1) {
          const current = newDoc.blocks[blockIndex];
          newDoc.blocks[blockIndex] = {
            ...current,
            order: targetOrder,
            sectionId: targetSectionId || current.sectionId,
            lamport: Math.max(current.lamport, op.lamport) + 1,
            updatedAt: Date.now()
          };
          newDoc.blocks.sort(compareBlockOrder);

          auditEntry = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            type: 'LIST_REORDER_CONVERGED',
            severity: 'info',
            author: { id: op.author.id, name: op.author.name, color: op.author.color },
            details: `Block reordered with fractional key "${targetOrder}"`,
            blockId: op.blockId,
            sectionId: targetSectionId || current.sectionId
          };
        }
        break;
      }

      case 'BLOCK_TOGGLE_CHECK': {
        const blockIndex = newDoc.blocks.findIndex(b => b.id === op.blockId);
        if (blockIndex !== -1) {
          newDoc.blocks[blockIndex] = {
            ...newDoc.blocks[blockIndex],
            checked: op.payload.checked,
            updatedAt: Date.now()
          };
        }
        break;
      }

      case 'BLOCK_CHANGE_TYPE': {
        const blockIndex = newDoc.blocks.findIndex(b => b.id === op.blockId);
        if (blockIndex !== -1) {
          newDoc.blocks[blockIndex] = {
            ...newDoc.blocks[blockIndex],
            type: op.payload.newType,
            updatedAt: Date.now()
          };
        }
        break;
      }

      case 'SECTION_INSERT': {
        newDoc.sections.push(op.payload.section);
        newDoc.sections.sort((a, b) => a.order.localeCompare(b.order));
        break;
      }

      case 'SECTION_LOCK': {
        const idx = newDoc.sections.findIndex(s => s.id === op.sectionId);
        if (idx !== -1) {
          const lock = op.payload.isLocked;
          newDoc.sections[idx] = {
            ...newDoc.sections[idx],
            isLocked: lock,
            lockedBy: lock ? { id: op.author.id, name: op.author.name, timestamp: Date.now() } : null
          };
        }
        break;
      }

      case 'SECTION_PERMISSIONS_UPDATE': {
        const idx = newDoc.sections.findIndex(s => s.id === op.sectionId);
        if (idx !== -1) {
          newDoc.sections[idx] = {
            ...newDoc.sections[idx],
            allowedRoles: op.payload.allowedRoles
          };
        }
        break;
      }

      case 'DOC_UPDATE_TITLE': {
        newDoc.title = op.payload.title;
        break;
      }

      case 'RESTORE_VERSION': {
        const { restoredSnapshot } = op.payload;
        newDoc.blocks = restoredSnapshot.blocks.map((b: Block) => ({ ...b }));
        newDoc.sections = restoredSnapshot.sections.map((s: Section) => ({ ...s }));
        newDoc.title = restoredSnapshot.title;
        break;
      }
    }

    // 3. Persist State in Ledger
    this.documents.set(docId, newDoc);

    if (!this.ledgers.has(docId)) {
      this.ledgers.set(docId, []);
    }
    this.ledgers.get(docId)!.push(op);

    // 4. Notify Change Subscribers
    this.notifySubscribers(docId, op, newDoc, auditEntry);

    return { success: true, document: newDoc, auditEntry };
  }

  /**
   * CONTRACT METHOD: reconcileOfflineBatch(docId, ops)
   */
  public reconcileOfflineBatch(docId: string, ops: Operation[]): SyncBatchResult {
    let appliedCount = 0;
    let rejectedCount = 0;
    let conflictsResolved = 0;
    const auditEntries: AuditLogEntry[] = [];

    const sorted = [...ops].sort((a, b) => {
      if (a.lamport !== b.lamport) return a.lamport - b.lamport;
      return a.timestamp - b.timestamp;
    });

    for (const op of sorted) {
      const res = this.applyOp(op);
      if (res.success) {
        appliedCount++;
        if (res.auditEntry) {
          auditEntries.push(res.auditEntry);
          if (res.auditEntry.severity === 'conflict') {
            conflictsResolved++;
          }
        }
      } else {
        rejectedCount++;
        if (res.auditEntry) {
          auditEntries.push(res.auditEntry);
        }
      }
    }

    const currentDoc = this.getDocState(docId)!;
    return {
      document: currentDoc,
      appliedCount,
      rejectedCount,
      conflictsResolved,
      auditEntries
    };
  }
}
