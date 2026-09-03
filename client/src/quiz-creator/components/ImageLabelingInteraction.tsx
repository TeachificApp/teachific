import type { ImageLabelingData } from "../types/quiz";
import type { ImageLabelingAnswer } from "../../../../shared/imageLabeling";

interface Props {
  data: ImageLabelingData;
  imageUrl?: string | null;
  imageAlt?: string | null;
  answer?: ImageLabelingAnswer;
  onChange: (answer: ImageLabelingAnswer) => void;
  primaryColor?: string;
  disabled?: boolean;
}

export function ImageLabelingInteraction({ data, imageUrl, imageAlt, answer = {}, onChange, primaryColor = "#24abbc", disabled = false }: Props) {
  if (!imageUrl) return <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This image-labeling question is missing its image.</p>;
  if (data.targets.length === 0 || data.labels.length === 0) return <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">This image-labeling question needs at least one label and one image target.</p>;

  return (
    <section className="space-y-3" aria-label="Image-labeling response">
      <p className="text-sm leading-5 text-gray-600">Select a unique label for each numbered target on the image.</p>
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
        <img src={imageUrl} alt={imageAlt || "Image for labeling"} className="block max-h-[34rem] w-full object-contain" />
        {data.targets.map((target, index) => {
          const usedElsewhere = new Set(Object.entries(answer).filter(([targetId]) => targetId !== target.id).map(([, labelId]) => labelId));
          const alignRight = target.x > 59;
          return <label key={target.id} className="absolute flex max-w-[12rem] items-center gap-1.5" style={{ left: `${target.x}%`, top: `${target.y}%`, transform: alignRight ? "translate(-100%, -50%)" : "translate(0, -50%)" }}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow" style={{ backgroundColor: primaryColor }} aria-hidden="true">{index + 1}</span>
            <span className="sr-only">Label for image target {index + 1}</span>
            <select value={answer[target.id] ?? ""} onChange={(event) => onChange({ ...answer, [target.id]: event.target.value })} disabled={disabled} aria-label={`Label for image target ${index + 1}`} className="min-w-0 max-w-[9.5rem] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-900 shadow-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70" style={{ borderColor: `${primaryColor}80`, "--tw-ring-color": `${primaryColor}70` } as React.CSSProperties}>
              <option value="">Choose label</option>
              {data.labels.map((label) => <option key={label.id} value={label.id} disabled={usedElsewhere.has(label.id)}>{label.text || "Untitled label"}</option>)}
            </select>
          </label>;
        })}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Available labels">{data.labels.map((label) => <span key={label.id} className="rounded-full border px-2.5 py-1 text-xs font-medium text-gray-800" style={{ borderColor: `${primaryColor}45`, backgroundColor: `${primaryColor}12` }}>{label.text || "Untitled label"}</span>)}</div>
    </section>
  );
}
