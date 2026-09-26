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
    <div style={{ maxWidth: "700px", margin: "40px auto", padding: "20px" }}>
      <h2>Document Editor — Role 1 Test</h2>
      <Toolbar editor={editor} />
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "16px",
          minHeight: "300px",
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default App;
