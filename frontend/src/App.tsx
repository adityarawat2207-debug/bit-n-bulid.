import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import "./App.css";

function App() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Hello! Start typing to test the editor...</p>",
  });

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto", padding: "20px" }}>
      <h2>Document Editor — Role 1 Test</h2>
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
