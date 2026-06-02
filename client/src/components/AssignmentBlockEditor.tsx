/**
 * AssignmentBlockEditor.tsx
 * A lightweight block editor for cohort assignments.
 * Uses the full BLOCK_CATALOG from LandingPageBuilder (all 50+ block types,
 * 7 categories including Saved templates) while keeping a simple onChange interface.
 */
import React, { useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Bookmark } from "lucide-react";
import { BlockPreview, Block, BlockType } from "@/components/BlockPreview";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings as LandingBlockSettings } from "@/pages/admin/LandingPageBuilder";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Paste from spreadsheet helper ───────────────────────────────────────────
function PasteFromSpreadsheet({ onPaste }: { onPaste: (rows: string[][]) => void }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const apply = () => {
    const rows = raw.trim().split("\n").map(line => line.split("\t"));
    if (rows.length > 0 && rows[0].length > 0) {
      onPaste(rows);
      setOpen(false);
      setRaw("");
    }
  };
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="text-xs text-teal-600 hover:underline">Paste from spreadsheet</button>
      {open && (
        <div className="mt-2 space-y-2">
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={5}
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="Paste tab-separated content from Excel or Google Sheets here..."
          />
          <div className="flex gap-2">
            <button onClick={apply} className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700">Apply</button>
            <button onClick={() => setOpen(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Saved block templates tab ────────────────────────────────────────────────
function AssignmentSavedTemplatesTab({ onInsert }: { onInsert: (block: Block) => void }) {
  const [search, setSearch] = useState("");
  const { data: templates, isLoading } = trpc.blockTemplates.list.useQuery({ search: search || undefined });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.blockTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted");
      utils.blockTemplates.list.invalidate();
    },
    onError: (e: any) => toast.error(`Delete failed: ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto p-1">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search saved blocks…"
        className="w-full h-7 rounded border border-gray-200 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
      />
      {isLoading && <p className="text-xs text-gray-400 text-center py-4">Loading…</p>}
      {!isLoading && (!templates || templates.length === 0) && (
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
          <Bookmark size={24} className="mb-2 opacity-30" />
          <p className="text-xs font-medium">No saved templates yet</p>
          <p className="text-[10px] mt-1">Save blocks as templates from any page builder</p>
        </div>
      )}
      {templates?.map((t: any) => {
        let block: Block | null = null;
        try { block = typeof t.blockJson === "string" ? JSON.parse(t.blockJson) : t.blockJson; } catch { /* ignore */ }
        if (!block) return null;
        return (
          <div key={t.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-teal-300 transition-colors">
            <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-700 truncate flex-1">{t.name}</span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => { const copy = { ...block!, id: Math.random().toString(36).slice(2, 10) }; onInsert(copy); }}
                  className="px-2 py-0.5 text-[10px] bg-teal-600 text-white rounded hover:bg-teal-700"
                >Insert</button>
                <button
                  onClick={() => { if (confirm("Delete this template?")) deleteMutation.mutate({ id: t.id }); }}
                  className="px-2 py-0.5 text-[10px] bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
                >✕</button>
              </div>
            </div>
            <div className="pointer-events-none scale-75 origin-top-left overflow-hidden" style={{ height: 80 }}>
              <BlockPreview block={block} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Block card ───────────────────────────────────────────────────────────────
function BlockCard({ block, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: {
  block: Block;
  onUpdate: (data: Record<string, any>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const label = BLOCK_CATALOG.find(b => b.type === block.type)?.label ?? block.type;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <span className="text-xs font-medium text-gray-600 flex-1 truncate">{label}</span>
        <button onClick={() => setExpanded(e => !e)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button onClick={onMoveUp} disabled={isFirst} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30">↑</button>
        <button onClick={onMoveDown} disabled={isLast} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-30">↓</button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
          <Trash2 size={13} />
        </button>
      </div>
      {/* Preview */}
      <div className="pointer-events-none">
        <BlockPreview block={block} />
      </div>
      {/* Settings (expanded) */}
      {expanded && (
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <LandingBlockSettings block={block} onChange={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface AssignmentBlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

export default function AssignmentBlockEditor({ blocks, onChange }: AssignmentBlockEditorProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("Content");
  const catalogByCat = BLOCK_CATALOG.filter(c => c.category === activeCat);

  const addBlock = useCallback((type: BlockType) => {
    const catalog = BLOCK_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newBlock: Block = { id: Math.random().toString(36).slice(2, 10), type, data: { ...catalog.defaultData } };
    onChange([...blocks, newBlock]);
    setShowPicker(false);
  }, [blocks, onChange]);

  const insertTemplate = useCallback((block: Block) => {
    onChange([...blocks, block]);
    setShowPicker(false);
  }, [blocks, onChange]);

  const updateBlock = useCallback((id: string, data: Record<string, any>) => {
    onChange(blocks.map(b => b.id === id ? { ...b, data } : b));
  }, [blocks, onChange]);

  const deleteBlock = useCallback((id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  }, [blocks, onChange]);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const next = [...blocks];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  }, [blocks, onChange]);

  return (
    <div className="p-4 space-y-3">
      {/* Block list */}
      {blocks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
          <Plus size={32} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">No content blocks yet</p>
          <p className="text-xs mt-1">Add blocks below to build the assignment content</p>
        </div>
      )}
      {blocks.map((block, idx) => (
        <BlockCard
          key={block.id}
          block={block}
          onUpdate={data => updateBlock(block.id, data)}
          onDelete={() => deleteBlock(block.id)}
          onMoveUp={() => moveBlock(block.id, -1)}
          onMoveDown={() => moveBlock(block.id, 1)}
          isFirst={idx === 0}
          isLast={idx === blocks.length - 1}
        />
      ))}

      {/* Add block button + picker */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed border-teal-300 text-teal-600 hover:bg-teal-50 hover:border-teal-400"
          onClick={() => setShowPicker(p => !p)}
        >
          <Plus size={14} className="mr-1" /> Add Block
        </Button>
        {showPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 flex flex-col" style={{ maxHeight: 420 }}>
            {/* Category tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none bg-gray-50 shrink-0 rounded-t-xl">
              {CATALOG_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors shrink-0",
                    activeCat === cat
                      ? "text-teal-700 border-b-2 border-teal-500 bg-white"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Block grid or Saved templates */}
            <div className="flex-1 overflow-y-auto p-2">
              {activeCat === "Saved" ? (
                <AssignmentSavedTemplatesTab onInsert={insertTemplate} />
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {catalogByCat.map(b => (
                    <button
                      key={b.type}
                      onClick={() => addBlock(b.type)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-700 hover:bg-teal-50 hover:text-teal-700 border border-gray-100 hover:border-teal-200 transition-colors text-left"
                    >
                      <span className="text-gray-400 shrink-0">{b.icon}</span>
                      <span className="truncate">{b.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
