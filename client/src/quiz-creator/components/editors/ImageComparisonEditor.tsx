import type { ImageComparisonData } from "../../types/quiz";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";

interface Props {
  data: ImageComparisonData;
  onChange: (data: ImageComparisonData) => void;
}

type Side = "A" | "B";

export function ImageComparisonEditor({ data, onChange }: Props) {
  const setSide = (side: Side, value: string) => {
    onChange(side === "A" ? { ...data, comparisonImageA: value } : { ...data, comparisonImageB: value });
  };

  const setLabel = (side: Side, value: string) => {
    onChange(side === "A" ? { ...data, comparisonLabelA: value } : { ...data, comparisonLabelB: value });
  };

  const uploadSide = (side: Side, file: File) => {
    const reader = new FileReader();
    reader.onload = () => setSide(side, String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Add two images for learners to compare with a draggable slider. This is an exploratory, non-scoring interaction.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["A", "B"] as const).map((side) => {
          const image = side === "A" ? data.comparisonImageA : data.comparisonImageB;
          const label = side === "A" ? data.comparisonLabelA : data.comparisonLabelB;
          return (
            <div key={side} className="rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-700">Image {side}</p>
                {image && <button type="button" onClick={() => setSide(side, "")} className="text-gray-400 hover:text-red-600" aria-label={`Remove image ${side}`}><Trash2 className="h-4 w-4" /></button>}
              </div>
              {image ? <img src={image} alt={label || `Comparison image ${side}`} className="h-32 w-full rounded-lg object-cover border" /> : (
                <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-[var(--org-primary)] hover:text-[var(--org-primary)]">
                  <Upload className="h-5 w-5 mb-2" /><span className="text-xs">Upload image</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadSide(side, file); event.currentTarget.value = ""; }} />
                </label>
              )}
              <label className="block text-xs font-medium text-gray-600">Accessible label
                <input value={label ?? ""} onChange={(event) => setLabel(side, event.target.value)} placeholder={`Image ${side}`} className="mt-1 h-9 w-full rounded-md border border-gray-200 px-2 text-sm focus:border-[var(--org-primary)] focus:outline-none" />
              </label>
              <label className="block text-xs font-medium text-gray-600">Image URL (optional)
                <div className="relative mt-1"><ImageIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" /><input value={image ?? ""} onChange={(event) => setSide(side, event.target.value)} placeholder="https://…" className="h-9 w-full rounded-md border border-gray-200 pl-8 pr-2 text-sm focus:border-[var(--org-primary)] focus:outline-none" /></div>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
