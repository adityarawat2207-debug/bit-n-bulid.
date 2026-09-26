# Team Contract — "The Document That Edits Itself Correctly"

## Project Summary
A full-stack collaborative document editor that stays correct under concurrent,
offline, and flaky-connection editing. Three subsystems, three owners, zero
overlap. Ownership boundaries below are the source of truth if there's ever a
dispute about who's responsible for what.

---

## Role Split

### 1. Frontend & Real-Time Client — **Owner: Teammate A**
**Owns:** everything the user directly sees and interacts with.

- Editor UI (rich text, list reordering, cursors/selections)
- Local optimistic edits (apply instantly, reconcile later)
- Presence indicators (who's online, who's editing what)
- Offline detection + local edit queue (IndexedDB or similar)
- Reconnect flow: replay queued local ops through the sync client
- Rendering permission state (read-only sections, locked blocks)
- Rendering version history UI (diff view, restore button)

**Does not own:** how conflicts are actually resolved, how permissions are
enforced, how versions are stored. It only *displays* what those systems
return.

---

### 2. Sync Engine & Backend — **Owner: Teammate B**
**Owns:** making concurrent and offline edits merge without data loss.

- Document data model (CRDT — e.g. Yjs/Automerge — or OT, pick one and own it)
- Merge/conflict resolution logic
- WebSocket (or equivalent) server for live edit propagation
- Offline reconciliation: accepting a batch of queued ops from a client that
  just reconnected, merging them into current state
- Persistence of the live document state
- Exposes: `applyOp()`, `getDocState()`, `subscribeToChanges()` as the
  contract the frontend and the permissions/history layer build on

**Does not own:** who is *allowed* to make an edit (that's a pre-check by
Role 3, enforced before an op reaches the merge engine), or what the UI looks
like.

---

### 3. Permissions & Version History — **Owner: Teammate C**
**Owns:** access control and the historical record.

- Auth (who is the user)
- Permission model (who can edit which sections/blocks) + enforcement layer
  that gates ops before they reach the sync engine
- Version snapshots (periodic or per-session checkpoints)
- Change attribution (who changed what, when — sourced from ops tagged by
  the sync engine)
- Diff-between-versions and restore-to-version logic
- Exposes: `checkPermission()`, `getHistory()`, `restoreVersion()`

**Does not own:** the merge algorithm itself, or the editor UI — it consumes
the sync engine's tagged op stream and gates access to it.

---

## Why This Split Is Conflict-Free

- Each role owns exactly one layer of the stack (client / merge engine /
  access+history) — no two people write to the same files or modules.
- The three interfaces below are the *only* contact points. As long as each
  role honors its side of the interface, the others can build and test in
  isolation (mock the interface, swap in the real thing later).

| Interface | Producer | Consumer |
|---|---|---|
| `applyOp(op)` / op stream | Role 2 (Sync) | Role 1 (Frontend) |
| `checkPermission(user, blockId, action)` | Role 3 (Permissions) | Role 2 (Sync, as a pre-op gate) |
| `getHistory()` / `restoreVersion(id)` | Role 3 (Permissions) | Role 1 (Frontend) |

Any change to these three signatures must be agreed by both sides before
merging — that's the one shared decision surface.

---

## Working Agreement
- Each role works in its own module/directory; no cross-editing another
  role's files without a heads-up.
- Interface changes (the table above) require a quick sync between the two
  affected roles before implementation.
- Integration points are tested with mocked interfaces first, then wired up
  together at agreed checkpoints.
- Blockers get raised immediately, not discovered at integration time.

---

## Milestones (fill in dates)
| Milestone | Role 1 | Role 2 | Role 3 |
|---|---|---|---|
| M1 — Skeleton | Static editor UI | Single-user doc CRUD | Basic auth |
| M2 — Real-time | Live cursors/presence | Multi-client merge over WebSocket | Permission checks wired into ops |
| M3 — Offline | Offline queue + replay | Offline batch reconciliation | Version snapshots begin |
| M4 — Polish | History/diff UI | Merge edge-case hardening | Restore + attribution complete |
