import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DragHandle } from "@tiptap/extension-drag-handle";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import Toolbar from "./Toolbar";
import { BlockId } from "./sync/blockId";
import {
  applyOp,
  subscribeToChanges,
  type SyncStatus,
} from "./sync/mockSyncEngine";
import "./App.css";

// Finds the nearest block-level node (the one carrying our blockId attribute)
// around the current cursor position.
function getCurrentBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.attrs && node.attrs.blockId) {
      return node;
    }
  }
  return null;
}

function App() {
  const [status, setStatus] = useState<SyncStatus>("synced");

  // Tracks the "before editing started" content per block, per his 3-way-merge spec.
  const baseContentRef = useRef<Map<string, string>>(new Map());
  // One debounce timer per block, so editing block A doesn't reset block B's timer.
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  function emitBlockUpdate(blockId: string, content: string) {
    const baseContent = baseContentRef.current.get(blockId) ?? "";
    applyOp({
      type: "BLOCK_UPDATE_TEXT",
      blockId,
      baseContent,
      payload: { content },
    });
    // Advance the baseline now that this edit has been "sent".
    baseContentRef.current.set(blockId, content);
  }

  function scheduleBlockUpdate(blockId: string, content: string) {
    const timers = debounceTimersRef.current;
    if (timers.has(blockId)) clearTimeout(timers.get(blockId)!);

    const timer = setTimeout(() => {
      emitBlockUpdate(blockId, content);
      timers.delete(blockId);
    }, 400);
    timers.set(blockId, timer);
  }

  function flushBlockUpdate(blockId: string, content: string) {
    const timers = debounceTimersRef.current;
    if (timers.has(blockId)) {
      clearTimeout(timers.get(blockId)!);
      timers.delete(blockId);
    }
    emitBlockUpdate(blockId, content);
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
        nested: {
          allowedContainers: ["bulletList", "orderedList"],
          edgeDetection: "left",
        },
      }),
    ],
    content: `
      <p>Hello! Start typing to test the editor...</p>
      <ul>
        <li>First item</li>
        <li>Second item</li>
        <li>Third item</li>
      </ul>
    `,
    onUpdate: ({ editor }) => {
      const block = getCurrentBlock(editor);
      if (!block || !block.attrs.blockId) return;

      const blockId = block.attrs.blockId as string;
      const content = block.textContent;

      // First time we see this block, its "before" state is its current content.
      if (!baseContentRef.current.has(blockId)) {
        baseContentRef.current.set(blockId, content);
      }

      scheduleBlockUpdate(blockId, content);
    },
    onBlur: ({ editor }) => {
      const block = getCurrentBlock(editor);
      if (!block || !block.attrs.blockId) return;
      flushBlockUpdate(block.attrs.blockId as string, block.textContent);
    },
  });

  useEffect(() => {
    const unsubscribe = subscribeToChanges(setStatus);
    return unsubscribe;
  }, []);

  return (
    <div className="page">
      <div className="editor-shell">
        <header className="editor-header">
          <h1>Document Editor</h1>
          <span className="badge">Role 1 — Frontend</span>
          <span className={`sync-status sync-${status}`}>
            <span className="sync-dot" />
            {status === "syncing"
              ? "Saving..."
              : status === "synced"
                ? "Saved"
                : status}
          </span>
        </header>
        <Toolbar editor={editor} />
        <div className="editor-surface">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

export default App;
