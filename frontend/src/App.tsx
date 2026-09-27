import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DragHandle } from "@tiptap/extension-drag-handle";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Bell, ChevronDown, ChevronRight, CircleHelp, Clock3, Cloud, FileText, History, LayoutPanelLeft, ListChecks, Menu, MessageSquare, MoreHorizontal, PanelRightOpen, Plus, Search, Sparkles, Users, X } from "lucide-react";
import Toolbar from "./Toolbar";
import { BlockId } from "./sync/blockId";
import { applyOp, subscribeToChanges, type SyncStatus } from "./sync/mockSyncEngine";
import "./App.css";

const INITIAL_DOCUMENT = `<h1>Product launch brief</h1><p>Align the release story, launch scope, and owners before the September rollout.</p><h2>What we are shipping</h2><p>The first collaborative release lets a team draft, review, and keep a shared document in sync even when connections are unreliable.</p><ul><li>Real-time cursors and presence for active collaborators</li><li>Offline edits that reconcile safely after reconnecting</li><li>Version checkpoints with clear authorship</li></ul><h2>Launch checklist</h2><ol><li>Confirm copy and product screenshots</li><li>Review access rules with legal</li><li>Publish the release notes</li></ol>`;

const collaborators = [
  { initials: "AC", name: "Aarush Choubey", color: "coral", status: "Editing" },
  { initials: "MS", name: "Maya Shah", color: "gold", status: "Reviewing" },
  { initials: "JP", name: "Jon Park", color: "violet", status: "Online" },
];

const activity = [
  { initials: "MS", color: "gold", text: "Maya revised the launch checklist", time: "2 min" },
  { initials: "JP", color: "violet", text: "Jon added a version checkpoint", time: "18 min" },
  { initials: "AC", color: "coral", text: "You updated the release summary", time: "42 min" },
];

function getCurrentBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.attrs && node.attrs.blockId) return node;
  }
  return null;
}

function App() {
  const [status, setStatus] = useState<SyncStatus>("synced");
  const [title, setTitle] = useState("Product launch brief");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notice, setNotice] = useState("All changes are saved locally");
  const [wordCount, setWordCount] = useState(0);
  const baseContentRef = useRef<Map<string, string>>(new Map());
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function sendOperation(blockId: string, content: string) {
    const baseContent = baseContentRef.current.get(blockId) ?? "";
    applyOp({ type: "BLOCK_UPDATE_TEXT", blockId, baseContent, payload: { content } }).then(() => setNotice("All changes are saved locally"));
    baseContentRef.current.set(blockId, content);
  }

  function scheduleBlockUpdate(blockId: string, content: string) {
    const timers = debounceTimersRef.current;
    const existingTimer = timers.get(blockId);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      sendOperation(blockId, content);
      timers.delete(blockId);
    }, 400);
    timers.set(blockId, timer);
  }

  function flushBlockUpdate(blockId: string, content: string) {
    const timers = debounceTimersRef.current;
    const existingTimer = timers.get(blockId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timers.delete(blockId);
    }
    sendOperation(blockId, content);
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      BlockId,
      DragHandle.configure({
        render: () => {
          const element = document.createElement("div");
          element.classList.add("drag-handle");
          element.innerHTML = "⠿";
          return element;
        },
        nested: { allowedContainers: ["bulletList", "orderedList"], edgeDetection: "left" },
      }),
    ],
    content: INITIAL_DOCUMENT,
    onCreate: ({ editor: instance }) => setWordCount(instance.getText().trim().split(/\s+/).filter(Boolean).length),
    onUpdate: ({ editor: instance }) => {
      setWordCount(instance.getText().trim().split(/\s+/).filter(Boolean).length);
      const block = getCurrentBlock(instance);
      if (!block?.attrs.blockId) return;
      const blockId = block.attrs.blockId as string;
      const content = block.textContent;
      if (!baseContentRef.current.has(blockId)) baseContentRef.current.set(blockId, content);
      setNotice("Saving your edits...");
      scheduleBlockUpdate(blockId, content);
    },
    onBlur: ({ editor: instance }) => {
      const block = getCurrentBlock(instance);
      if (block?.attrs.blockId) flushBlockUpdate(block.attrs.blockId as string, block.textContent);
    },
  });

  useEffect(() => {
    const unsubscribe = subscribeToChanges(setStatus);
    const timers = debounceTimersRef.current;
    return () => {
      unsubscribe();
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (status === "syncing") return "Saving changes";
    if (status === "synced") return "Saved to workspace";
    if (status === "offline") return "Offline edits queued";
    return "Sync needs attention";
  }, [status]);

  function shareDocument() { setNotice("Share link copied for your workspace"); }
  function saveTitle() { applyOp({ type: "DOC_UPDATE_TITLE", payload: { title } }); setNotice("Document title saved"); }

  return (
    <div className="workspace">
      <aside className={`left-sidebar ${sidebarOpen ? "mobile-open" : ""}`}>
        <div className="workspace-brand"><span className="brand-icon"><Sparkles size={17} /></span><span>Draftline</span><button className="close-mobile" type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <button type="button" className="new-document"><Plus size={16} /> New document</button>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <p className="nav-label">Workspace</p>
          <button type="button" className="nav-link active"><FileText size={16} /> Documents <span>12</span></button>
          <button type="button" className="nav-link"><Users size={16} /> Shared with me</button>
          <button type="button" className="nav-link"><History size={16} /> Recent</button>
          <p className="nav-label space-top">Collections</p>
          <button type="button" className="collection-link"><span className="collection-dot green" /> Product</button>
          <button type="button" className="collection-link"><span className="collection-dot coral" /> Planning</button>
          <button type="button" className="collection-link"><span className="collection-dot gold" /> Research</button>
        </nav>
        <div className="sidebar-bottom"><button type="button" className="nav-link"><CircleHelp size={16} /> Help center</button><button type="button" className="account-row"><span className="avatar coral">AC</span><span><strong>Aarush Choubey</strong><small>Personal workspace</small></span><MoreHorizontal size={16} /></button></div>
      </aside>
      {sidebarOpen && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <main className="workspace-main">
        <header className="top-header"><div className="header-left"><button type="button" className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumb"><span>Product</span><ChevronRight size={14} /><strong>Launch</strong></div></div><div className="header-actions"><button type="button" className="icon-button" title="Search" aria-label="Search"><Search size={18} /></button><button type="button" className="icon-button" title="Notifications" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button><button type="button" className="avatar-button" aria-label="Account menu"><span className="avatar coral">AC</span><ChevronDown size={14} /></button></div></header>
        <section className="document-bar"><div className="document-title-wrap"><button type="button" className="document-icon" aria-label="Document options"><FileText size={18} /></button><input aria-label="Document title" value={title} onChange={(event) => setTitle(event.target.value)} onBlur={saveTitle} /><span className={`sync-state ${status}`}><Cloud size={14} /> {statusLabel}</span></div><div className="document-actions"><div className="presence-stack" title="3 collaborators online">{collaborators.map((person) => <span className={`avatar ${person.color}`} key={person.initials}>{person.initials}</span>)}</div><button type="button" className="share-button" onClick={shareDocument}>Share</button><button type="button" className="icon-button" title="More document options" aria-label="More document options"><MoreHorizontal size={18} /></button></div></section>
        <section className="editor-layout"><div className="editor-column"><Toolbar editor={editor} /><article className="editor-surface"><EditorContent editor={editor} /></article><footer className="editor-footer"><span>{wordCount} words</span><span>{notice}</span><span>Last activity just now</span></footer></div>
          {detailsOpen && <aside className="details-panel"><div className="details-header"><div><p className="eyebrow">Document</p><h2>Team context</h2></div><button type="button" className="icon-button compact" onClick={() => setDetailsOpen(false)} title="Hide details" aria-label="Hide details"><PanelRightOpen size={16} /></button></div><div className="details-section"><div className="section-title"><span>Collaborators</span><button type="button" onClick={shareDocument}>Invite</button></div><div className="collaborator-list">{collaborators.map((person) => <div className="collaborator" key={person.initials}><span className={`avatar ${person.color}`}>{person.initials}</span><span><strong>{person.name}</strong><small>{person.status}</small></span><span className="online-dot" /></div>)}</div></div><div className="details-section"><div className="section-title"><span>Outline</span><button type="button" aria-label="Outline options"><MoreHorizontal size={15} /></button></div><div className="outline-list"><button type="button" className="current">Product launch brief</button><button type="button">What we are shipping</button><button type="button">Launch checklist</button></div></div><div className="details-section activity-section"><div className="section-title"><span>Recent activity</span><button type="button" onClick={() => setHistoryOpen(true)}>View all</button></div>{activity.map((item) => <div className="activity-row" key={item.text}><span className={`avatar ${item.color}`}>{item.initials}</span><p>{item.text}<time>{item.time} ago</time></p></div>)}</div><button type="button" className="history-cta" onClick={() => setHistoryOpen(true)}><History size={16} /> Version history <ChevronRight size={15} /></button></aside>}
          {!detailsOpen && <button type="button" className="show-details" onClick={() => setDetailsOpen(true)} title="Show document details" aria-label="Show document details"><LayoutPanelLeft size={18} /></button>}
        </section>
      </main>
      {historyOpen && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Version history"><button type="button" className="modal-scrim" onClick={() => setHistoryOpen(false)} aria-label="Close version history" /><section className="history-modal"><div className="history-header"><div><p className="eyebrow">Document history</p><h2>Version history</h2><p>Every checkpoint stays available to your team.</p></div><button type="button" className="icon-button" onClick={() => setHistoryOpen(false)} aria-label="Close version history"><X size={18} /></button></div><div className="version-list"><div className="version-row current"><span className="version-marker"><Clock3 size={14} /></span><div><strong>Current version</strong><p>Saved just now by Aarush Choubey</p></div><span className="current-tag">Live</span></div><div className="version-row"><span className="version-marker"><ListChecks size={14} /></span><div><strong>Launch checklist review</strong><p>Today, 10:42 AM by Maya Shah</p></div><button type="button" className="restore-button" onClick={() => setNotice("Previewing the selected checkpoint")}>Preview</button></div><div className="version-row"><span className="version-marker"><MessageSquare size={14} /></span><div><strong>Messaging feedback</strong><p>Yesterday, 4:18 PM by Jon Park</p></div><button type="button" className="restore-button" onClick={() => setNotice("Previewing the selected checkpoint")}>Preview</button></div></div></section></div>}
    </div>
  );
}

export default App;
