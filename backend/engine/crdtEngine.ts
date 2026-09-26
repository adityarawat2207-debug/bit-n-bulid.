/**
 * ROLE 2: CRDT Engine & Conflict Resolver
 * 
 * Owns: Making concurrent and offline edits merge without data loss.
 * - Same-paragraph concurrent edits via 3-way differential merge
 * - Concurrent list reordering via fractional indexing
 * - Delete vs. Edit race condition via non-destructive tombstone resurrection
 * - Offline batch reconciliation
 */

import {
  Document,
  Block,
  Section,
  Operation,
  AuditLogEntry
} from '../models/document.js';
import { generateBetween, compareBlockOrder } from './fractionalIndex.js';
import { threeWayMerge } from './diffMerge.js';

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

export class CRDTEngine {
  /**
   * Apply an operation to the document state with deterministic conflict resolution
   */
  static applyOperation(doc: Document, op: Operation): ApplyOpResult {
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

        // Hazard 3: Delete vs. Edit conflict -> Tombstone resurrection
        if (currentBlock.isDeleted) {
          const resurrectedBlock: Block = {
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
          newDoc.blocks[blockIndex] = resurrectedBlock;

          auditEntry = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            type: 'DELETE_VS_EDIT_RESURRECTED',
            severity: 'conflict',
            author: { id: op.author.id, name: op.author.name, color: op.author.color },
            details: `Block ${op.blockId} was resurrected: Offline edit by ${op.author.name} preserved after deletion.`,
            blockId: op.blockId,
            sectionId: currentBlock.sectionId,
            resolution: 'Block non-destructively restored with conflict banner'
          };

          return { success: true, document: newDoc, auditEntry };
        }

        // Hazard 1: Concurrent Paragraph Edit -> 3-way differential merge
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

          return { success: true, document: newDoc, auditEntry };
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

        return { success: true, document: newDoc };
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
        return { success: true, document: newDoc };
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
        return { success: true, document: newDoc };
      }

      // Hazard 2: Concurrent List Reordering -> Fractional Indexing
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
        return { success: true, document: newDoc, auditEntry };
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
        return { success: true, document: newDoc };
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
        return { success: true, document: newDoc };
      }

      case 'SECTION_INSERT': {
        newDoc.sections.push(op.payload.section);
        newDoc.sections.sort((a, b) => a.order.localeCompare(b.order));
        return { success: true, document: newDoc };
      }

      case 'SECTION_UPDATE': {
        const idx = newDoc.sections.findIndex(s => s.id === op.sectionId);
        if (idx !== -1) {
          newDoc.sections[idx] = {
            ...newDoc.sections[idx],
            title: op.payload.title ?? newDoc.sections[idx].title
          };
        }
        return { success: true, document: newDoc };
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
        return { success: true, document: newDoc };
      }

      case 'SECTION_PERMISSIONS_UPDATE': {
        const idx = newDoc.sections.findIndex(s => s.id === op.sectionId);
        if (idx !== -1) {
          newDoc.sections[idx] = {
            ...newDoc.sections[idx],
            allowedRoles: op.payload.allowedRoles
          };
        }
        return { success: true, document: newDoc };
      }

      case 'DOC_UPDATE_TITLE': {
        newDoc.title = op.payload.title;
        return { success: true, document: newDoc };
      }

      case 'RESTORE_VERSION': {
        const { restoredSnapshot } = op.payload;
        newDoc.blocks = restoredSnapshot.blocks.map((b: Block) => ({ ...b }));
        newDoc.sections = restoredSnapshot.sections.map((s: Section) => ({ ...s }));
        newDoc.title = restoredSnapshot.title;
        return { success: true, document: newDoc };
      }

      default:
        return { success: true, document: newDoc };
    }
  }

  /**
   * Batch offline reconciliation
   */
  static syncOfflineBatch(currentDoc: Document, offlineOps: Operation[]): SyncBatchResult {
    let doc = currentDoc;
    let appliedCount = 0;
    let rejectedCount = 0;
    let conflictsResolved = 0;
    const auditEntries: AuditLogEntry[] = [];

    const sortedOps = [...offlineOps].sort((a, b) => {
      if (a.lamport !== b.lamport) return a.lamport - b.lamport;
      return a.timestamp - b.timestamp;
    });

    for (const op of sortedOps) {
      const res = this.applyOperation(doc, op);
      if (res.success) {
        doc = res.document;
        appliedCount++;
        if (res.auditEntry) {
          auditEntries.push(res.auditEntry);
          if (res.auditEntry.severity === 'conflict') {
            conflictsResolved++;
          }
        }
      } else {
        rejectedCount++;
      }
    }

    return {
      document: doc,
      appliedCount,
      rejectedCount,
      conflictsResolved,
      auditEntries
    };
  }
}
