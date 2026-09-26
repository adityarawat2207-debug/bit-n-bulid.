/**
 * ROLE 2: Document State Persistence & Ledger Store
 * 
 * Owns: Persistence of live document state, snapshot archives, and audit records.
 */

import {
  Document,
  VersionSnapshot,
  AuditLogEntry,
  Operation
} from '../models/document.js';
import { CRDTEngine } from '../engine/crdtEngine.js';
import { getInitialOrder } from '../engine/fractionalIndex.js';

export class DocumentStore {
  private documents: Map<string, Document> = new Map();
  private versions: Map<string, VersionSnapshot[]> = new Map();
  private auditLogs: Map<string, AuditLogEntry[]> = new Map();
  private documentLedgers: Map<string, Operation[]> = new Map();

  constructor() {
    this.seedDefaultDocument();
  }

  private seedDefaultDocument() {
    const docId = 'doc-team-spec-2026';
    const now = Date.now() - 3600000;

    const doc: Document = {
      id: docId,
      title: 'Q4 Product Launch & Real-Time Sync Architecture',
      createdAt: now,
      updatedAt: now,
      version: 1,
      vectorClock: {
        'user-alice': 12,
        'user-bob': 8,
        'user-charlie': 3
      },
      sections: [
        {
          id: 'sec-overview',
          title: '1. Executive Summary & Goals',
          order: 'a000',
          allowedRoles: ['admin', 'editor', 'legal', 'viewer'],
          isLocked: false,
          author: { id: 'user-alice', name: 'Alice (Lead Eng)' },
          createdAt: now
        },
        {
          id: 'sec-architecture',
          title: '2. Real-Time Sync & Conflict Engine',
          order: 'a001',
          allowedRoles: ['admin', 'editor'],
          isLocked: false,
          author: { id: 'user-bob', name: 'Bob (Core Architect)' },
          createdAt: now
        },
        {
          id: 'sec-legal',
          title: '3. Legal & Compliance Agreement [Restricted]',
          order: 'a002',
          allowedRoles: ['admin', 'legal'],
          isLocked: true,
          lockedBy: { id: 'user-charlie', name: 'Charlie (Legal Counsel)', timestamp: now + 600000 },
          author: { id: 'user-charlie', name: 'Charlie (Legal Counsel)' },
          createdAt: now
        },
        {
          id: 'sec-checklist',
          title: '4. Deployment & Launch Checklist',
          order: 'a003',
          allowedRoles: ['admin', 'editor'],
          isLocked: false,
          author: { id: 'user-alice', name: 'Alice (Lead Eng)' },
          createdAt: now
        }
      ],
      blocks: [
        {
          id: 'blk-1',
          sectionId: 'sec-overview',
          type: 'heading1',
          content: 'Real-Time Distributed Collaborative Workspace',
          order: getInitialOrder(0),
          lamport: 1,
          author: { id: 'user-alice', name: 'Alice (Lead Eng)', color: '#3b82f6' },
          updatedAt: now + 60000
        },
        {
          id: 'blk-2',
          sectionId: 'sec-overview',
          type: 'paragraph',
          content: 'This document is simultaneously edited by distributed team members across flaky mobile connections, in-flight offline laptops, and high-speed office fiber.',
          order: getInitialOrder(1),
          lamport: 2,
          author: { id: 'user-alice', name: 'Alice (Lead Eng)', color: '#3b82f6' },
          updatedAt: now + 120000
        },
        {
          id: 'blk-3',
          sectionId: 'sec-architecture',
          type: 'paragraph',
          content: 'The sync engine utilizes fractional indexing for lists, three-way differential text merging with vector clocks, and non-destructive tombstone resurrection.',
          order: getInitialOrder(2),
          lamport: 3,
          author: { id: 'user-bob', name: 'Bob (Core Architect)', color: '#10b981' },
          updatedAt: now + 180000
        },
        {
          id: 'blk-4',
          sectionId: 'sec-architecture',
          type: 'code',
          content: '// Deterministic state convergence\nconst converged = crdtEngine.merge(localQueue, remoteOps);',
          order: getInitialOrder(3),
          lamport: 4,
          author: { id: 'user-bob', name: 'Bob (Core Architect)', color: '#10b981' },
          updatedAt: now + 240000
        },
        {
          id: 'blk-5',
          sectionId: 'sec-legal',
          type: 'quote',
          content: 'CONFIDENTIAL: Edits to this compliance section are restricted to administrators and legal specialists. Unauthorized modifications will be rejected by the server.',
          order: getInitialOrder(4),
          lamport: 5,
          author: { id: 'user-charlie', name: 'Charlie (Legal Counsel)', color: '#f59e0b' },
          updatedAt: now + 300000
        },
        {
          id: 'blk-6',
          sectionId: 'sec-checklist',
          type: 'todo',
          content: 'Implement fractional lexicographical indexing for list reordering',
          checked: true,
          order: getInitialOrder(5),
          lamport: 6,
          author: { id: 'user-alice', name: 'Alice (Lead Eng)', color: '#3b82f6' },
          updatedAt: now + 360000
        },
        {
          id: 'blk-7',
          sectionId: 'sec-checklist',
          type: 'todo',
          content: 'Verify paragraph 3-way merge when two peers edit concurrently',
          checked: true,
          order: getInitialOrder(6),
          lamport: 7,
          author: { id: 'user-bob', name: 'Bob (Core Architect)', color: '#10b981' },
          updatedAt: now + 420000
        },
        {
          id: 'blk-8',
          sectionId: 'sec-checklist',
          type: 'todo',
          content: 'Resurrect deleted blocks if edited offline (zero silent data loss)',
          checked: true,
          order: getInitialOrder(7),
          lamport: 8,
          author: { id: 'user-alice', name: 'Alice (Lead Eng)', color: '#3b82f6' },
          updatedAt: now + 480000
        }
      ]
    };

    this.documents.set(docId, doc);
    this.auditLogs.set(docId, [
      {
        id: 'seed-log-1',
        timestamp: now,
        type: 'MERGE_CONCURRENT_EDITS',
        severity: 'info',
        author: { id: 'user-alice', name: 'Alice (Lead Eng)', color: '#3b82f6' },
        details: 'Initial document created and synchronized with cloud replica.'
      },
      {
        id: 'seed-log-2',
        timestamp: now + 600000,
        type: 'SECTION_LOCKED',
        severity: 'info',
        author: { id: 'user-charlie', name: 'Charlie (Legal Counsel)', color: '#f59e0b' },
        details: 'Section "3. Legal & Compliance Agreement [Restricted]" locked by Charlie.'
      }
    ]);

    this.createSnapshot(docId, 'Initial Draft v1.0', 'Base document seeded with architecture spec', {
      id: 'system',
      name: 'System Initializer',
      color: '#6366f1'
    }, 'initial');
  }

  public getDocument(docId: string): Document | undefined {
    return this.documents.get(docId);
  }

  public applyOperation(docId: string, op: Operation) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);

    const result = CRDTEngine.applyOperation(doc, op);
    if (result.success) {
      this.documents.set(docId, result.document);

      if (!this.documentLedgers.has(docId)) {
        this.documentLedgers.set(docId, []);
      }
      this.documentLedgers.get(docId)!.push(op);

      if (result.auditEntry) {
        this.addAuditLog(docId, result.auditEntry);
      }

      const ledger = this.documentLedgers.get(docId)!;
      if (ledger.length % 15 === 0) {
        this.createSnapshot(
          docId,
          `Auto-Save (v${result.document.version})`,
          `Periodic checkpoint created after ${ledger.length} operations`,
          op.author,
          'auto'
        );
      }
    } else {
      if (result.auditEntry) {
        this.addAuditLog(docId, result.auditEntry);
      }
    }

    return result;
  }

  public syncOfflineBatch(docId: string, ops: Operation[]) {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);

    const result = CRDTEngine.syncOfflineBatch(doc, ops);
    this.documents.set(docId, result.document);

    if (!this.documentLedgers.has(docId)) {
      this.documentLedgers.set(docId, []);
    }
    this.documentLedgers.get(docId)!.push(...ops);

    for (const audit of result.auditEntries) {
      this.addAuditLog(docId, audit);
    }

    if (ops.length > 0) {
      const author = ops[0].author;
      this.createSnapshot(
        docId,
        `Offline Sync Reconnection (${ops.length} ops)`,
        `Synchronized ${result.appliedCount} operations, resolved ${result.conflictsResolved} conflicts`,
        author,
        'offline_sync'
      );
    }

    return result;
  }

  public getVersions(docId: string): VersionSnapshot[] {
    return this.versions.get(docId) || [];
  }

  public createSnapshot(
    docId: string,
    title: string,
    description: string,
    author: { id: string; name: string; color: string },
    trigger: VersionSnapshot['trigger']
  ): VersionSnapshot {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);

    const versionList = this.versions.get(docId) || [];
    const versionNumber = versionList.length + 1;

    const snapshot: VersionSnapshot = {
      versionId: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      docId,
      versionNumber,
      title,
      description,
      snapshot: JSON.parse(JSON.stringify(doc)),
      author,
      timestamp: Date.now(),
      trigger,
      diffSummary: {
        addedBlocks: doc.blocks.filter(b => !b.isDeleted).length,
        modifiedBlocks: doc.version,
        deletedBlocks: doc.blocks.filter(b => b.isDeleted).length
      }
    };

    versionList.unshift(snapshot);
    this.versions.set(docId, versionList);
    return snapshot;
  }

  public restoreVersion(docId: string, versionId: string, adminUser: any): Document {
    const doc = this.documents.get(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);

    const versionList = this.versions.get(docId) || [];
    const targetVersion = versionList.find(v => v.versionId === versionId);
    if (!targetVersion) throw new Error(`Version snapshot ${versionId} not found`);

    const op: Operation = {
      opId: `restore-${Date.now()}`,
      docId,
      type: 'RESTORE_VERSION',
      payload: { restoredSnapshot: targetVersion.snapshot },
      author: adminUser,
      lamport: doc.version + 10,
      timestamp: Date.now()
    };

    const res = this.applyOperation(docId, op);
    if (!res.success) {
      throw new Error(res.error || 'Failed to restore version');
    }

    this.createSnapshot(
      docId,
      `Restored: ${targetVersion.title}`,
      `Restored state from version #${targetVersion.versionNumber} taken at ${new Date(targetVersion.timestamp).toLocaleTimeString()}`,
      adminUser,
      'version_restored'
    );

    return res.document;
  }

  public getAuditLogs(docId: string): AuditLogEntry[] {
    return this.auditLogs.get(docId) || [];
  }

  public addAuditLog(docId: string, entry: AuditLogEntry) {
    if (!this.auditLogs.has(docId)) {
      this.auditLogs.set(docId, []);
    }
    this.auditLogs.get(docId)!.unshift(entry);
    if (this.auditLogs.get(docId)!.length > 200) {
      this.auditLogs.get(docId)!.pop();
    }
  }

  public resetSampleDocument(docId: string) {
    this.seedDefaultDocument();
    return this.documents.get(docId);
  }
}
