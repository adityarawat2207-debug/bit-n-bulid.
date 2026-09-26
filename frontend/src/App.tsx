import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { DragHandle } from "@tiptap/extension-drag-handle";
import Toolbar from "./Toolbar";
import "./App.css";

function App() {
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
  });

  return (
    <div className="page">
      <div className="editor-shell">
        <header className="editor-header">
          <h1>Document Editor</h1>
          <span className="badge">Role 1 — Frontend</span>
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
