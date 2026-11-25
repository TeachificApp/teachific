import { Button } from "@/components/ui/button";

const mapAnswer = (value: unknown): Record<string, string> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, string> : {};
const arrayAnswer = (value: unknown): string[] => Array.isArray(value) ? value as string[] : [];
export function course360NativeMediaUrl(raw: unknown) {
  if (typeof raw !== "string") return undefined;
  if (/^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(raw)) return raw;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try { const url = new URL(raw); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? raw : undefined; } catch { return undefined; }
}
function Image({ url, alt = "Question image" }: { url: unknown; alt?: string }) { const safe = course360NativeMediaUrl(url); return safe ? <img src={safe} alt={alt} className="max-h-64 max-w-full rounded-lg object-contain" /> : null; }

/** Controlled native renderer: never reads answer keys, never calculates grades, no conversion to bank IDs. */
export function Course360NativeLessonQuizControls({ question: q, answer, onAnswer, disabled = false }: { question: any; answer: unknown; onAnswer: (value: any) => void; disabled?: boolean }) {
  const d = q.data ?? {}, ans = mapAnswer(answer);
  const updateMap = (id: string, value: string) => onAnswer({ ...ans, [id]: value });
  const select = (id: string) => {
    const current = arrayAnswer(answer);
    onAnswer(d.multiSelect ? current.includes(id) ? current.filter(v => v !== id) : [...current, id] : [id]);
  };
  const dropdown = (id: string, label: string, options: { id: string; text: string }[]) => <label key={id} className="block space-y-1 text-sm text-gray-700">{label}<select aria-label={label} value={ans[id] ?? ""} onChange={e => updateMap(id, e.target.value)} className="block w-full rounded-lg border border-gray-200 bg-white p-3"><option value="">Select...</option>{options.map(item => <option key={item.id} value={item.id}>{item.text}</option>)}</select></label>;
  let controls;
  switch (q.type) {
    case "mcq": case "image_choice": controls = <div className="space-y-2">{(d.choices ?? []).map((choice: any) => <button type="button" key={choice.id} aria-pressed={arrayAnswer(answer).includes(choice.id)} onClick={() => select(choice.id)} className={`w-full rounded-lg border px-4 py-3 text-left text-sm ${arrayAnswer(answer).includes(choice.id) ? "border-[var(--org-primary)] bg-teal-50" : "border-gray-200"}`}><Image url={choice.imageUrl} alt={choice.label ?? choice.text} />{choice.text ?? choice.label ?? "Image choice"}</button>)}</div>; break;
    case "tf": controls = <div className="flex gap-3">{[true, false].map(value => <Button key={String(value)} type="button" variant={answer === value ? "default" : "outline"} aria-pressed={answer === value} onClick={() => onAnswer(value)}>{value ? "True" : "False"}</Button>)}</div>; break;
    case "matching": controls = <div className="space-y-3">{(d.pairs ?? []).map((pair: any) => <div key={pair.id}><Image url={pair.premiseImageUrl} alt={pair.premise} />{dropdown(pair.id, pair.premise ?? pair.id, (d.responses ?? []).map((r: any) => ({ id: r.id, text: r.text ?? "Image response" })))}</div>)}</div>; break;
    case "hotspot": {
      const clicks = Array.isArray(answer) ? answer as any[] : [];
      const safe = course360NativeMediaUrl(d.imageUrl);
      controls = <div className="space-y-3"><p className="text-xs text-gray-500">Click the image or select a named region below.</p>{safe && <div className="relative inline-block"><img src={safe} alt={d.imageAlt ?? "Select a region"} className="max-h-80 max-w-full cursor-crosshair rounded-lg" onClick={e => { if (disabled) return; const rect = e.currentTarget.getBoundingClientRect(); if (!rect.width || !rect.height) return; const point = { x: (e.clientX - rect.left) / rect.width * 100, y: (e.clientY - rect.top) / rect.height * 100 }; onAnswer(d.multiSelect ? [...clicks, point] : [point]); }} />{clicks.filter(p => typeof p === "object").map((p, i) => <span key={i} className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-600" style={{ left: `${p.x}%`, top: `${p.y}%` }} />)}</div>}<div className="flex flex-wrap gap-2">{(d.regions ?? []).map((r: any) => <Button type="button" key={r.id} variant={clicks.includes(r.id) ? "default" : "outline"} aria-pressed={clicks.includes(r.id)} onClick={() => select(r.id)}>{r.label ?? r.id}</Button>)}<Button type="button" variant="ghost" onClick={() => onAnswer([])}>Clear selection</Button></div></div>; break;
    }
    case "fill_blank": controls = <div className="space-y-3"><p className="text-sm text-gray-600">{d.template}</p>{(d.blanks ?? []).map((b: any) => <label key={b.id} className="block text-sm">Blank {b.id}<input aria-label={`Blank ${b.id}`} value={ans[b.id] ?? ""} maxLength={20000} onChange={e => updateMap(b.id, e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label>)}</div>; break;
    case "short_answer": case "essay": controls = <div><textarea aria-label="Written answer" placeholder={q.type === "essay" ? d.placeholder : "Your answer"} value={typeof answer === "string" ? answer : ""} maxLength={20000} onChange={e => onAnswer(e.target.value)} className="min-h-28 w-full rounded-lg border p-3" />{(q.type === "essay" || d.autoGrade !== true) && <p className="text-xs text-gray-500">This answer requires instructor review.</p>}</div>; break;
    case "numeric": controls = <label className="block text-sm">Numeric answer {d.unit}<input aria-label="Numeric answer" type="number" step="any" value={typeof answer === "string" || typeof answer === "number" ? answer : ""} onChange={e => onAnswer(e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label>; break;
    case "ordering": {
      const items = d.items ?? [], ids = arrayAnswer(answer).length ? arrayAnswer(answer) : items.map((i: any) => i.id);
      controls = <div className="space-y-2">{ids.map((id, index) => <div key={id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><span className="flex-1">{items.find((i: any) => i.id === id)?.text ?? id}</span>{[-1, 1].map(dir => <Button key={dir} type="button" size="sm" variant="outline" aria-label={`Move ${id} ${dir < 0 ? "up" : "down"}`} disabled={index + dir < 0 || index + dir >= ids.length} onClick={() => { const next = [...ids]; [next[index], next[index + dir]] = [next[index + dir], next[index]]; onAnswer(next); }}>{dir < 0 ? "Up" : "Down"}</Button>)}</div>)}<Button type="button" variant="outline" onClick={() => onAnswer([...ids])}>Confirm order</Button></div>; break;
    }
    case "dropdown": controls = <div className="space-y-3"><p className="text-sm">{d.template}</p>{(d.blanks ?? []).map((b: any) => dropdown(b.id, `Blank ${b.id}`, (b.options ?? []).map((text: string, i: number) => ({ id: String(i), text }))))}</div>; break;
    case "drag_words": controls = <div className="space-y-3"><p className="text-sm">{d.template}</p>{(d.blanks ?? []).map((b: any) => dropdown(b.id, `Blank ${b.id}`, (d.wordOptions ?? []).map((text: string) => ({ id: text, text }))))}</div>; break;
    case "drag_drop": controls = <div className="space-y-3"><Image url={d.backgroundImageUrl} />{(d.items ?? []).map((item: any) => dropdown(item.id, item.text ?? item.id, (d.targets ?? []).map((t: any) => ({ id: t.id, text: t.label ?? t.id }))))}</div>; break;
    case "image_labeling": controls = <div className="space-y-3"><Image url={q.image?.url ?? d.imageUrl} />{(d.targets ?? []).map((t: any, i: number) => dropdown(t.id, `Target ${i + 1} (${t.x}%, ${t.y}%)`, d.labels ?? []))}</div>; break;
    case "likert": controls = <div className="space-y-3"><p className="text-xs text-gray-500">Unscored survey</p>{(d.statements ?? []).map((s: any) => dropdown(s.id, s.text, (d.scaleLabels ?? []).map((text: string, i: number) => ({ id: String(i), text }))))}</div>; break;
    case "image_comparison": controls = <div className="space-y-3"><p className="text-xs text-gray-500">Unscored activity</p><Image url={d.comparisonImageA} alt={d.comparisonLabelA} /><Image url={d.comparisonImageB} alt={d.comparisonLabelB} /></div>; break;
    case "info_slide": controls = <p className="text-xs text-gray-500">Unscored activity</p>; break;
    default: controls = <p role="alert">This question type requires instructor support.</p>;
  }
  return <fieldset disabled={disabled} className="space-y-4"><legend className="mb-3 text-sm font-medium leading-relaxed text-gray-800">{q.stem ?? "Question"}</legend><Image url={q.image?.url} alt={q.image?.alt} />{controls}</fieldset>;
}
