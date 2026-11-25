import { useState, useEffect } from "react";
import { CreatorMediaPicker } from "./CreatorMediaPicker";
export function CreatorProjectSettings({ raw, orgId, save }: { raw: string | null | undefined; orgId?: number; save: (raw: string) => Promise<unknown> }) {
  const [draft, setDraft] = useState<Record<string, any>>({}); const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [dirty, setDirty] = useState(false);
  // Refresh only when server settings actually change. A successful save clears
  // dirty before query invalidation necessarily returns, so dirty itself must
  // not reload the old server JSON over the just-acknowledged local settings.
  useEffect(() => { if (dirty) return; try { const value = JSON.parse(raw || "{}"); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid settings"); setDraft(value); setError(""); } catch { setError("Saved settings cannot be edited safely; original fields retained."); } }, [raw]);
  const update = (key: string, value: any) => { setDirty(true); setDraft(d => ({ ...d, [key]: value })); };
  const brand = (value: any) => { setDirty(true); setDraft(d => ({ ...d, creatorBrand: { ...d.creatorBrand, ...value } })); };
  return <fieldset className="space-y-2"><legend className="text-xs font-semibold text-white/60">Project settings and player brand</legend>
    <label className="block text-xs">Passing score (%)<input aria-label="Project passing score" type="number" min={0} max={100} value={draft.passingScore ?? 80} onChange={e => update("passingScore", Number(e.target.value))} className="w-full rounded bg-[#12324a] p-1" /></label>
    <label className="block text-xs">Player font<select aria-label="Project player font" value={draft.creatorBrand?.fontFamily || "system-ui, sans-serif"} onChange={e => brand({ fontFamily: e.target.value })} className="w-full rounded bg-[#12324a] p-1">{["system-ui, sans-serif", "Arial, sans-serif", "Georgia, serif", "Verdana, sans-serif", "Courier New, monospace"].map(f => <option key={f}>{f}</option>)}</select></label>
    <label className="flex items-center gap-2 text-xs">Player accent<input aria-label="Player accent" type="color" value={draft.creatorBrand?.accent || "#22d3ee"} onChange={e => brand({ accent: e.target.value })} /></label>
    {orgId && <CreatorMediaPicker orgId={orgId} kind="image" onSelect={item => brand({ logoMediaId: item.id, logoUrl: item.url, logoAlt: item.filename })} />}
    <p className="text-[11px] text-white/50">System fonts are self-contained. A selected logo is owned by the main account and packaged with exports.</p>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <button type="button" disabled={pending || !dirty} className="w-full rounded border border-[#24abbc] p-1 text-xs" onClick={async () => { setPending(true); try { await save(JSON.stringify(draft)); setDirty(false); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Settings save failed; your draft is retained."); } finally { setPending(false); } }}>{pending ? "Saving settings…" : "Save project settings"}</button>
  </fieldset>;
}
