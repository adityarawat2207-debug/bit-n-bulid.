import { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
}

export default function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        marginBottom: "10px",
        flexWrap: "wrap",
      }}
    >
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        style={{ fontWeight: editor.isActive("bold") ? "bold" : "normal" }}
      >
        Bold
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        style={{ fontStyle: editor.isActive("italic") ? "italic" : "normal" }}
      >
        Italic
      </button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()}>
        Strike
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()}>
        Bullet List
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        Numbered List
      </button>
      <button onClick={() => editor.chain().focus().undo().run()}>Undo</button>
      <button onClick={() => editor.chain().focus().redo().run()}>Redo</button>
    </div>
  );
}
