// TEMPORARY MOCK - replace with Teammate B's real sync engine when ready.
// Contract (per team_contract.md): applyOp(), getDocState(), subscribeToChanges()

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

type Listener = (status: SyncStatus) => void

let listeners: Listener[] = []
let currentStatus: SyncStatus = 'synced'

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

export function applyOp(content: string): Promise<{ ok: true }> {
  setStatus('syncing')

  return new Promise((resolve) => {
    const fakeNetworkDelay = 500 + Math.random() * 400
    setTimeout(() => {
      console.log('[mock sync] saved:', content.slice(0, 40) + '...')
      setStatus('synced')
      resolve({ ok: true })
    }, fakeNetworkDelay)
  })
}
