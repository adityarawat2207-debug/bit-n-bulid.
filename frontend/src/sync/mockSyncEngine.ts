// TEMPORARY MOCK - matches Teammate B's real Operation schema.
// Swap this file's internals for a real WebSocket connection when his engine is ready.
// The exported function signatures should stay the same so App.tsx doesn't need to change.

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

export type OperationType =
  | 'BLOCK_UPDATE_TEXT'
  | 'BLOCK_REORDER'
  | 'BLOCK_INSERT'
  | 'BLOCK_DELETE'
  | 'BLOCK_TOGGLE_CHECK'
  | 'BLOCK_CHANGE_TYPE'
  | 'SECTION_INSERT'
  | 'SECTION_UPDATE'
  | 'SECTION_LOCK'
  | 'SECTION_PERMISSIONS_UPDATE'
  | 'SECTION_DELETE'
  | 'DOC_UPDATE_TITLE'
  | 'RESTORE_VERSION'

export type UserRole = 'admin' | 'editor' | 'legal' | 'viewer'

export interface Operation {
  opId: string
  docId: string
  type: OperationType
  blockId?: string
  sectionId?: string
  baseContent?: string
  payload: any
  author: {
    id: string
    name: string
    color: string
    role: UserRole
  }
  lamport: number
  timestamp: number
  userId?: string
  documentId?: string
}

type Listener = (status: SyncStatus) => void

let listeners: Listener[] = []
let currentStatus: SyncStatus = 'synced'
let lamportClock = 0

// TEMP: hardcoded until Teammate C's real auth exists
const currentUser = {
  id: 'user-aarush',
  name: 'Aarush Choubey',
  color: '#6c8dff',
  role: 'editor' as UserRole,
}

const DOC_ID = 'doc-team-spec-2026' // TEMP placeholder document ID

function setStatus(status: SyncStatus) {
  currentStatus = status
  listeners.forEach((l) => l(status))
}

export function subscribeToChanges(listener: Listener): () => void {
  listeners.push(listener)
  listener(currentStatus)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export function getStatus(): SyncStatus {
  return currentStatus
}

function nextLamport(): number {
  lamportClock += 1
  return lamportClock
}

function makeOpId(): string {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Builds a properly-shaped Operation and "sends" it (mocked for now).
 * This is the ONE function that will eventually be swapped to a real
 * WebSocket call to Teammate B's engine.
 */
export function applyOp(op: Omit<Operation, 'opId' | 'docId' | 'author' | 'lamport' | 'timestamp'>): Promise<{ ok: true }> {
  const fullOp: Operation = {
    ...op,
    opId: makeOpId(),
    docId: DOC_ID,
    author: currentUser,
    lamport: nextLamport(),
    timestamp: Date.now(),
  }

  setStatus('syncing')

  return new Promise((resolve) => {
    const fakeNetworkDelay = 400 + Math.random() * 400
    setTimeout(() => {
      console.log('[mock sync] op sent:', fullOp)
      setStatus('synced')
      resolve({ ok: true })
    }, fakeNetworkDelay)
  })
}