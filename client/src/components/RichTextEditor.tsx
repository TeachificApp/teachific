import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Extension } from "@tiptap/core";
import Youtube from "@tiptap/extension-youtube";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Code, Link as LinkIcon,
  Image as ImageIcon, Minus, Undo, Redo, Heading1, Heading2, Heading3,
  Code2, Palette, Type, X, Check, ChevronDown, Video,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── HTML Embed Extension ─────────────────────────────────────────────────────
const HtmlEmbed = Extension.create({
  name: "htmlEmbed",
  addStorage() {
    return { embeds: [] as string[] };
  },
});

// ─── Toolbar Button ───────────────────────────────────────────────────────────
function ToolbarBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted text-muted-foreground hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

// ─── HTML Embed Dialog ────────────────────────────────────────────────────────
function HtmlEmbedDialog({ onInsert }: { onInsert: (html: string) => void }) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Insert HTML / Embed"
          className="h-7 px-2 flex items-center gap-1 rounded text-xs transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>HTML</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-4" side="bottom" align="start">
        <p className="text-sm font-semibold mb-1">Insert HTML / Embed Code</p>
        <p className="text-xs text-muted-foreground mb-3">
          Paste any HTML, iframe embed code, or custom markup. It will be rendered inline.
        </p>
        <Textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder='<iframe src="https://..." width="100%" height="400"></iframe>'
          className="font-mono text-xs min-h-[120px]"
        />
        <div className="flex gap-2 mt-3 justify-end">
          <Button variant="outline" size="sm" onClick={() => { setHtml(""); setOpen(false); }}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!html.trim()}
            onClick={() => {
              onInsert(html.trim());
              setHtml("");
              setOpen(false);
            }}
          >
            Insert
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Link Dialog ──────────────────────────────────────────────────────────────
function LinkDialog({ editor }: { editor: any }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const setLink = () => {
    if (!url) {
      editor.chain().focus().extendMarkToNextWord().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkToNextWord().setLink({ href: url, target: "_blank" }).run();
    }
    setOpen(false);
    setUrl("");
  };

  return (
    <Popover open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) setUrl(editor.getAttributes("link").href || "");
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Insert Link"
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded text-sm transition-colors",
            editor.isActive("link")
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" side="bottom" align="start">
        <p className="text-xs font-semibold mb-2">Insert Link</p>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="text-xs h-8"
            onKeyDown={(e) => e.key === "Enter" && setLink()}
          />
          <Button size="sm" className="h-8 px-2" onClick={setLink}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          {editor.isActive("link") && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={() => { editor.chain().focus().unsetLink().run(); setOpen(false); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
const COLORS = [
  "#000000", "#374151", "#6b7280", "#9ca3af", "#ffffff",
  "#dc2626", "#ea580c", "#d97706", "#16a34a", "#0891b2",
  "#2563eb", "#7c3aed", "#db2777", "#24abbc", "#4ad9e0",
];

function ColorPicker({ editor }: { editor: any }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Text Color"
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
        >
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" side="bottom" align="start">
        <p className="text-xs font-semibold mb-2">Text Color</p>
        <div className="grid grid-cols-5 gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              onClick={() => editor.chain().focus().setColor(c).run()}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs h-7"
          onClick={() => editor.chain().focus().unsetColor().run()}
        >
          Reset Color
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ─── Video Embed Dialog (YouTube & Vimeo) ────────────────────────────────────
function VideoEmbedDialog({ editor }: { editor: any }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const getVimeoEmbedUrl = (url: string) => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  };

  const insertVideo = () => {
    if (!url.trim() || !editor) return;
    const trimmed = url.trim();
    // YouTube — use Tiptap's built-in YouTube extension
    if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
      editor.chain().focus().setYoutubeVideo({ src: trimmed }).run();
    } else {
      // Vimeo or other — insert as iframe HTML
      const vimeoEmbed = getVimeoEmbedUrl(trimmed);
      const src = vimeoEmbed || trimmed;
      const iframe = `<iframe src="${src}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width:100%;border-radius:8px;"></iframe>`;
      editor.chain().focus().insertContent(iframe).run();
    }
    setUrl("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Embed YouTube or Vimeo video"
          className="h-7 px-2 flex items-center gap-1 rounded text-xs transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Video className="h-3.5 w-3.5" />
          <span>Video</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" side="bottom" align="start">
        <p className="text-sm font-semibold mb-1">Embed Video</p>
        <p className="text-xs text-muted-foreground mb-3">
          Paste a YouTube or Vimeo URL to embed the video inline.
        </p>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
          className="text-xs"
          onKeyDown={(e) => e.key === "Enter" && insertVideo()}
        />
        <div className="flex gap-2 mt-3 justify-end">
          <Button variant="outline" size="sm" onClick={() => { setUrl(""); setOpen(false); }}>Cancel</Button>
          <Button size="sm" disabled={!url.trim()} onClick={insertVideo}>Embed</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main RichTextEditor ──────────────────────────────────────────────────────

export interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  readOnly?: boolean;
  className?: string;
  showCharCount?: boolean;
}

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Start typing...",
  minHeight = 200,
  maxHeight,
  readOnly = false,
  className,
  showCharCount = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      HtmlEmbed,
      Youtube.configure({ width: 640, height: 360, nocookie: false }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  const insertHtml = useCallback((html: string) => {
    if (!editor) return;
    // Insert as raw HTML node
    editor.chain().focus().insertContent(html).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    const url = window.prompt("Enter image URL:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  if (readOnly) {
    return (
      <div
        className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">
        {/* Heading */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-7 px-2 flex items-center gap-1 rounded text-xs hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Type className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
              <span className="text-sm">Paragraph</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
              <span className="text-xl font-bold">Heading 1</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <span className="text-lg font-bold">Heading 2</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <span className="text-base font-bold">Heading 3</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Divider />

        {/* Basic formatting */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline Code">
          <Code className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Divider />

        {/* Color */}
        <ColorPicker editor={editor} />

        <Divider />

        {/* Alignment */}
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align Center">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right">
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify">
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Divider />

        {/* Lists */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code Block">
          <Code2 className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Divider />

        {/* Link & Image */}
        <LinkDialog editor={editor} />
        <ToolbarBtn onClick={insertImage} title="Insert Image">
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Divider />

        {/* Video Embeds */}
        <VideoEmbedDialog editor={editor} />
        {/* HTML Embed */}
        <HtmlEmbedDialog onInsert={insertHtml} />

        <Divider />

        {/* Undo/Redo */}
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
          <Undo className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
          <Redo className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none dark:prose-invert px-4 py-3 focus-within:outline-none"
        style={{ minHeight, ...(maxHeight ? { maxHeight, overflowY: 'auto' as const } : {}) }}
      />

      {/* Character count */}
      {showCharCount && (
        <div className="px-3 py-1.5 border-t border-border bg-muted/20 text-xs text-muted-foreground text-right">
          {editor.storage.characterCount.characters()} characters
        </div>
      )}
    </div>
  );
}

// ─── Read-only Rich Text Renderer ─────────────────────────────────────────────

export function RichTextContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "[&_iframe]:w-full [&_iframe]:rounded-lg [&_iframe]:border [&_iframe]:border-border",
        "[&_img]:rounded-lg [&_img]:max-w-full",
        "[&_a]:text-primary [&_a]:underline",
        "[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function RichTextDisplay({ content, className }: { content: string; className?: string }) {
  return <RichTextContent html={content} className={className} />;
}

export default RichTextEditor;
