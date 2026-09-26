import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolButton {
  icon: React.ElementType;
  label: string;
  action: () => void;
  isActive?: () => boolean;
}

export default function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const groups: ToolButton[][] = [
    [
      {
        icon: Bold,
        label: "Bold",
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive("bold"),
      },
      {
        icon: Italic,
        label: "Italic",
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive("italic"),
      },
      {
        icon: Strikethrough,
        label: "Strikethrough",
        action: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive("strike"),
      },
    ],
    [
      {
        icon: Heading1,
        label: "Heading 1",
        action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive("heading", { level: 1 }),
      },
      {
        icon: Heading2,
        label: "Heading 2",
        action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive("heading", { level: 2 }),
      },
    ],
    [
      {
        icon: List,
        label: "Bullet List",
        action: () => editor.chain().focus().toggleBulletList().run(),
        isActive: () => editor.isActive("bulletList"),
      },
      {
        icon: ListOrdered,
        label: "Numbered List",
        action: () => editor.chain().focus().toggleOrderedList().run(),
        isActive: () => editor.isActive("orderedList"),
      },
    ],
    [
      {
        icon: Undo2,
        label: "Undo",
        action: () => editor.chain().focus().undo().run(),
      },
      {
        icon: Redo2,
        label: "Redo",
        action: () => editor.chain().focus().redo().run(),
      },
    ],
  ];

  return (
    <div className="toolbar">
      {groups.map((group, gi) => (
        <div className="toolbar-group" key={gi}>
          {group.map(({ icon: Icon, label, action, isActive }) => (
            <button
              key={label}
              className={`toolbar-btn ${isActive?.() ? "active" : ""}`}
              onClick={action}
              title={label}
              aria-label={label}
              type="button"
            >
              <Icon size={17} strokeWidth={2} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
