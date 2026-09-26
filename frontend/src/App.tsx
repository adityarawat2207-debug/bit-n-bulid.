import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DragHandle } from "@tiptap/extension-drag-handle";
import { useEffect, useRef, useState } from "react";
import Toolbar from "./Toolbar";
import {
  applyOp,
  subscribeToChanges,
  type SyncStatus,
} from "./sync/mockSyncEngine";
import "./App.css";

function App() {
  const [status, setStatus] = useState<SyncStatus>("synced");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
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
      // Optimistic edit: the UI already updated instantly (Tiptap does this for us).
      // We debounce before telling the "server" (mock for now), so we don't spam
      // a network call on every keystroke.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        applyOp(editor.getHTML());
      }, 600);
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
