import { Plus, Tags, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ImageLabelChoice, ImageLabelingData, ImageLabelTarget } from "../../types/quiz";

interface Props {
  data: ImageLabelingData;
  image?: { url: string; alt: string } | null;
  onChange: (data: ImageLabelingData) => void;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export function ImageLabelingEditor({ data, image, onChange }: Props) {
  const updateLabel = (id: string, text: string) => onChange({ ...data, labels: data.labels.map((label) => label.id === id ? { ...label, text } : label) });
  const addLabel = () => onChange({ ...data, labels: [...data.labels, { id: uuidv4(), text: `Label ${data.labels.length + 1}` }] });
  const removeLabel = (id: string) => onChange({
    ...data,
    labels: data.labels.filter((label) => label.id !== id),
    targets: data.targets.map((target) => target.labelId === id ? { ...target, labelId: "" } : target),
  });
  const updateTarget = (id: string, updates: Partial<ImageLabelTarget>) => onChange({
    ...data,
    targets: data.targets.map((target) => {
      if (target.id === id) return { ...target, ...updates };
      return updates.labelId && target.labelId === updates.labelId ? { ...target, labelId: "" } : target;
    }),
  });
  const addTargetAt = (x = 50, y = 50) => onChange({ ...data, targets: [...data.targets, { id: uuidv4(), x: clampPercent(x), y: clampPercent(y), labelId: "" }] });

  return (
    <section className="space-y-4 rounded-2xl border border-[color:color-mix(in_srgb,var(--org-primary)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--org-primary)_7%,transparent)] p-4" aria-label="Image labeling question setup">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--org-primary)] text-white"><Tags className="h-4 w-4" aria-hidden="true" /></div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Image labeling</h3>
          <p className="mt-0.5 text-xs leading-5 text-gray-700">Add a question image, create label choices, then click the image to place blank label targets. Learners select one label for each target.</p>
        </div>
      </div>

      {!image?.url ? (
        <div className="rounded-xl border border-dashed border-[color:color-mix(in_srgb,var(--org-primary)_55%,transparent)] bg-white px-4 py-5 text-sm text-gray-700">Add a question image using the <strong>Image</strong> control above before placing label targets.</div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--org-primary)]">1. Place label targets</p>
          <div className="relative overflow-hidden rounded-xl border border-[color:color-mix(in_srgb,var(--org-primary)_28%,transparent)] bg-white">
            <img src={image.url} alt={image.alt || "Question image for label placement"} className="block max-h-[32rem] w-full cursor-crosshair object-contain" onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              addTargetAt(((event.clientX - bounds.left) / bounds.width) * 100, ((event.clientY - bounds.top) / bounds.height) * 100);
            }} />
            {data.targets.map((target, index) => <div key={target.id} className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[var(--org-primary)] text-xs font-bold text-white shadow" style={{ left: `${target.x}%`, top: `${target.y}%` }} aria-hidden="true">{index + 1}</div>)}
          </div>
          <button type="button" onClick={() => addTargetAt()} className="rounded-lg border border-[color:color-mix(in_srgb,var(--org-primary)_55%,transparent)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--org-primary)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]">Add target at image center</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--org-primary)_20%,transparent)] bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--org-primary)]">2. Available labels</p><button type="button" onClick={addLabel} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--org-primary)] hover:brightness-75"><Plus className="h-3.5 w-3.5" /> Add label</button></div>
          <div className="space-y-2">{data.labels.map((label, index) => <div key={label.id} className="flex items-center gap-2"><span className="w-5 text-right text-xs font-semibold text-[var(--org-primary)]">{index + 1}</span><input value={label.text} onChange={(event) => updateLabel(label.id, event.target.value)} aria-label={`Label ${index + 1} text`} className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-[var(--org-primary)] focus:outline-none" /><button type="button" onClick={() => removeLabel(label.id)} disabled={data.labels.length <= 1} className="rounded p-1 text-gray-400 hover:text-red-600 disabled:opacity-30" aria-label={`Remove label ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
        </div>
        <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--org-primary)_20%,transparent)] bg-white p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--org-primary)]">3. Connect targets to labels</p>
          {data.targets.length === 0 ? <p className="text-sm text-gray-500">Click the image above to add a target.</p> : <div className="space-y-2">{data.targets.map((target, index) => <div key={target.id} className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem_3.5rem_auto] items-center gap-2 rounded-lg border border-gray-100 p-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--org-primary)] text-xs font-bold text-white">{index + 1}</span><select value={target.labelId} onChange={(event) => updateTarget(target.id, { labelId: event.target.value })} aria-label={`Correct label for target ${index + 1}`} className="min-w-0 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-[var(--org-primary)] focus:outline-none"><option value="">Choose label</option>{data.labels.map((label) => <option key={label.id} value={label.id}>{label.text || "Untitled label"}</option>)}</select><input type="number" min="0" max="100" value={Math.round(target.x)} onChange={(event) => updateTarget(target.id, { x: clampPercent(Number(event.target.value)) })} aria-label={`Target ${index + 1} horizontal position`} className="w-full rounded-md border border-gray-200 px-1 py-1.5 text-center text-xs" /><input type="number" min="0" max="100" value={Math.round(target.y)} onChange={(event) => updateTarget(target.id, { y: clampPercent(Number(event.target.value)) })} aria-label={`Target ${index + 1} vertical position`} className="w-full rounded-md border border-gray-200 px-1 py-1.5 text-center text-xs" /><button type="button" onClick={() => onChange({ ...data, targets: data.targets.filter((item) => item.id !== target.id) })} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label={`Remove target ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}
          <p className="mt-3 text-[11px] leading-4 text-gray-500">Position fields use percentages from the left and top edges. Each target must have a different correct label.</p>
        </div>
      </div>
    </section>
  );
}
