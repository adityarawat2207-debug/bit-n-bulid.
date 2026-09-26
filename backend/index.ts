/**
 * ============================================================================
 * ROLE 2: SYNC ENGINE & BACKEND — OWNER: TEAMMATE B
 * ============================================================================
 * 
 * Public API & Module Exports:
 * 
 * 1. Sync Engine Service (Contract Implementation):
 *    - SyncEngineService
 *    - applyOp(op)
 *    - getDocState(docId)
 *    - subscribeToChanges(docId, listener)
 *    - reconcileOfflineBatch(docId, ops)
 * 
 * 2. CRDT & Merge Algorithms:
 *    - CRDTEngine
 *    - threeWayMerge
 *    - generateBetween, compareBlockOrder, getInitialOrder
 * 
 * 3. Document Data Model:
 *    - Document, Block, Section, Operation, OperationType, User, UserRole, VectorClock
 * 
 * 4. Server & Persistence:
 *    - DocumentStore
 *    - createServer
 */

export * from './models/document.js';
export * from './engine/fractionalIndex.js';
export * from './engine/diffMerge.js';
export * from './engine/crdtEngine.js';
export * from './sync/syncEngineService.js';
export * from './store/documentStore.js';
export * from './server.js';
export * from './permissions.js';
