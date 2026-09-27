export type SyncStatus = "connecting" | "synced" | "syncing" | "offline" | "error";

export type OperationType =
  | "BLOCK_UPDATE_TEXT"
  | "BLOCK_INSERT"
  | "BLOCK_DELETE"
  | "BLOCK_REORDER"
  | "BLOCK_TOGGLE_CHECK"
  | "BLOCK_CHANGE_TYPE"
  | "SECTION_INSERT"
  | "SECTION_UPDATE"
  | "SECTION_LOCK"
  | "SECTION_PERMISSIONS_UPDATE"
  | "SECTION_DELETE"
  | "DOC_UPDATE_TITLE"
  | "RESTORE_VERSION";

export interface OperationInput {
  type: OperationType;
  blockId?: string;
  sectionId?: string;
  baseContent?: string;
  payload: Record<string, unknown>;
}

export interface SyncDocument {
  id: string;
  title: string;
  sections: Array<{ id: string; title: string; order: string; isLocked: boolean }>;
  blocks: Array<{ id: string; sectionId: string; type: string; content: string; order: string; isDeleted?: boolean }>;
  version: number;
  updatedAt: number;
}

export interface Presence {
  user: { id: string; name: string; color: string; role: string };
  status: "online" | "flaky" | "offline";
}

interface SocketMessage {
  type: string;
  docId: string;
  payload: {
    document?: SyncDocument;
    presences?: Presence[];
    reason?: string;
  };
}

type StatusListener = (status: SyncStatus) => void;
type DocumentListener = (document: SyncDocument) => void;
type PresenceListener = (presence: Presence[]) => void;
type ErrorListener = (message: string) => void;

const config = {
  url: import.meta.env.VITE_SYNC_URL as string | undefined,
  documentId: import.meta.env.VITE_DOCUMENT_ID as string | undefined,
  userId: import.meta.env.VITE_USER_ID as string | undefined,
  userName: import.meta.env.VITE_USER_NAME as string | undefined,
  userRole: import.meta.env.VITE_USER_ROLE as string | undefined,
};

let socket: WebSocket | null = null;
let lamport = 0;
let status: SyncStatus = "offline";
const statusListeners = new Set<StatusListener>();
const documentListeners = new Set<DocumentListener>();
const presenceListeners = new Set<PresenceListener>();
const errorListeners = new Set<ErrorListener>();

function emitStatus(nextStatus: SyncStatus) {
  status = nextStatus;
  statusListeners.forEach((listener) => listener(status));
}

function emitError(message: string) {
  emitStatus("error");
  errorListeners.forEach((listener) => listener(message));
}

function isConfigured() {
  return Boolean(config.url && config.documentId && config.userId && config.userName && config.userRole);
}

export function connectSync() {
  if (!isConfigured()) {
    emitError("Sync is not configured. Add the VITE_SYNC_URL, VITE_DOCUMENT_ID, and VITE_USER_* values to frontend/.env.");
    return;
  }
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;

  emitStatus("connecting");
  socket = new WebSocket(config.url!);
  socket.addEventListener("open", () => {
    socket?.send(JSON.stringify({
      type: "INIT_DOC",
      docId: config.documentId,
      payload: {
        user: {
          id: config.userId,
          name: config.userName,
          color: "#15765d",
          role: config.userRole,
        },
      },
      timestamp: Date.now(),
    }));
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data) as SocketMessage;
    if (message.type === "INIT_DOC" && message.payload.document) {
      documentListeners.forEach((listener) => listener(message.payload.document!));
      presenceListeners.forEach((listener) => listener(message.payload.presences ?? []));
      emitStatus("synced");
    }
    if (message.type === "APPLY_OP" && message.payload.document) {
      documentListeners.forEach((listener) => listener(message.payload.document!));
      emitStatus("synced");
    }
    if (message.type === "PRESENCE_UPDATE") {
      presenceListeners.forEach((listener) => listener(message.payload.presences ?? []));
    }
    if (message.type === "OP_ACK") emitStatus("synced");
    if (message.type === "OP_REJECTED") emitError(message.payload.reason ?? "The server rejected this change.");
  });
  socket.addEventListener("close", () => emitStatus("offline"));
  socket.addEventListener("error", () => emitError("Could not reach the sync server."));
}

export function disconnectSync() {
  socket?.close();
  socket = null;
}

export function applyOp(operation: OperationInput): Promise<void> {
  if (!socket || socket.readyState !== WebSocket.OPEN || !config.documentId || !config.userId || !config.userName || !config.userRole) {
    return Promise.reject(new Error("The sync connection is not ready."));
  }
  lamport += 1;
  emitStatus("syncing");
  socket.send(JSON.stringify({
    type: "APPLY_OP",
    docId: config.documentId,
    payload: {
      operation: {
        ...operation,
        opId: crypto.randomUUID(),
        docId: config.documentId,
        documentId: config.documentId,
        userId: config.userId,
        author: { id: config.userId, name: config.userName, color: "#15765d", role: config.userRole },
        lamport,
        timestamp: Date.now(),
      },
    },
    timestamp: Date.now(),
  }));
  return Promise.resolve();
}

export function subscribeToChanges(listener: StatusListener) {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

export function subscribeToDocument(listener: DocumentListener) {
  documentListeners.add(listener);
  return () => documentListeners.delete(listener);
}

export function subscribeToPresence(listener: PresenceListener) {
  presenceListeners.add(listener);
  return () => presenceListeners.delete(listener);
}

export function subscribeToErrors(listener: ErrorListener) {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}
