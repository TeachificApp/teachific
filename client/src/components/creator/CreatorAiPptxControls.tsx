import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { validateCreatorExchangeDraft, type CreatorExchangeDraft } from "@shared/course360CreatorExchangeDraft";
import { toast } from "sonner";

export function CreatorAiPptxControls({ orgId, projectId, title = "", description = "", beforeExport, onApplied }: { orgId?: number | null; projectId?: number; title?: string; description?: string | null; beforeExport?: () => Promise<void>; onApplied: (id: number) => void }) {
  const [open, setOpen] = useState(false), [topic, setTopic] = useState(title), [details, setDetails] = useState(description || ""), [mode, setMode] = useState<"slides" | "outline" | "questions" | "narration" | "full_lesson">("slides"), [count, setCount] = useState(5);
  const [raw, setRaw] = useState(""), [draft, setDraft] = useState<CreatorExchangeDraft | null>(null), [error, setError] = useState(""), [html, setHtml] = useState(""), [reviewedRaw, setReviewedRaw] = useState(""), [consent, setConsent] = useState(false), [mediaConsent, setMediaConsent] = useState(false), [target, setTarget] = useState<"new_project" | "append_slides">("new_project"), [busy, setBusy] = useState(false);
  const current = useRef({ orgId, projectId }); current.current = { orgId, projectId };
  const sequence = useRef(0), mounted = useRef(true), running = useRef(false);
  const [reviewToken, setReviewToken] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++; }; }, []);
  useEffect(() => { sequence.current++; setRaw(""); setDraft(null); setHtml(""); setReviewedRaw(""); setConsent(false); setMediaConsent(false); setOpen(false); setError(""); }, [orgId, projectId]);
  const generate = trpc.authoring.generateAiDraft.useMutation(), importPptx = trpc.authoring.importPptxDraft.useMutation(), preview = trpc.authoring.previewExchangeDraft.useMutation(), apply = trpc.authoring.applyExchangeDraft.useMutation(), exportPptx = trpc.authoring.exportPptx.useMutation();
  async function operation(fn: (request: number, school: number) => Promise<void>) {
    if (!orgId || running.current) return; running.current = true; setBusy(true); setError(""); const request = ++sequence.current;
    try { await fn(request, orgId); } catch (e) { if (mounted.current && request === sequence.current) setError(e instanceof Error ? e.message : "Request failed; existing content and reviewed draft are retained."); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  const valid = (request: number, school: number) => mounted.current && request === sequence.current && current.current.orgId === school;
  function receive(value: unknown) { const next = validateCreatorExchangeDraft(value); setDraft(next); setRaw(JSON.stringify(next, null, 2)); setHtml(""); setReviewedRaw(""); setConsent(false); setMediaConsent(false); }
  async function generateDraft() {
    if (raw && !window.confirm("Replace only this unsaved review draft with a newly generated draft? Existing project content is never replaced.")) return;
    await operation(async (request, school) => { const result = await generate.mutateAsync({ expectedOrgId: school, ...(projectId ? { projectId } : {}), topic, details, mode, slideCount: count, consentToGenerate: true }); if (valid(request, school) && result.orgId === school) receive(result.draft); });
  }
  async function readFile(file?: File) {
    if (!file) return; if (!/\.pptx$/i.test(file.name) || file.size <= 0 || file.size > 16 * 1024 * 1024) { setError("Choose a .pptx file no larger than 16 MiB."); return; }
    if (raw && !window.confirm("Replace only this unsaved review draft with the imported PowerPoint? Existing project content stays unchanged.")) return;
    await operation(async (request, school) => { const buffer = new Uint8Array(await file.arrayBuffer()); let binary = ""; for (let i = 0; i < buffer.length; i += 8192) binary += String.fromCharCode(...buffer.subarray(i, i + 8192)); const result = await importPptx.mutateAsync({ expectedOrgId: school, filename: file.name, base64: btoa(binary), consentToImport: true }); if (valid(request, school) && result.orgId === school) receive(result.draft); });
  }
  async function review() { await operation(async (request, school) => { const value = validateCreatorExchangeDraft(JSON.parse(raw)); const result = await preview.mutateAsync({ expectedOrgId: school, draft: value }); if (valid(request, school) && result.orgId === school) { setDraft(value); setHtml(result.html); setReviewToken(result.reviewToken); setReviewedRaw(raw); setConsent(false); } }); }
  async function applyDraft() {
    if (!consent || !html || !reviewToken || raw !== reviewedRaw) return;
    await operation(async (request, school) => { const value = validateCreatorExchangeDraft(JSON.parse(raw)); const result = await apply.mutateAsync({ expectedOrgId: school, draft: value, reviewToken, target, ...(target === "append_slides" && projectId ? { projectId } : {}), consentToApply: true, saveImportedMedia: mediaConsent }); if (valid(request, school) && result.orgId === school) { setOpen(false); setRaw(""); setDraft(null); setHtml(""); setConsent(false); onApplied(result.id); toast.success("Reviewed draft applied to new slides. Existing content was not replaced."); } });
  }
  async function download() { await operation(async (request, school) => {
    if (!projectId) return; await beforeExport?.(); if (!valid(request, school)) return;
    const result = await exportPptx.mutateAsync({ expectedOrgId: school, projectId }); if (!valid(request, school)) return;
    const binary = atob(result.base64), bytes = Uint8Array.from(binary, c => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }));
    try { const a = document.createElement("a"); a.href = url; a.download = result.filename; a.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    if (result.warnings.length) { setError(result.warnings.join("\n")); setOpen(true); }
  }); }
  return <>
    <Button variant="ghost" size="sm" disabled={!orgId || busy} onClick={() => { setTopic(title); setDetails(description || ""); setOpen(true); }}>AI / PowerPoint</Button>
    {projectId && <Button variant="ghost" size="sm" disabled={!orgId || busy} onClick={download}>Editable PPTX</Button>}
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#111827] border-white/10 text-white"><DialogHeader><DialogTitle>Creator AI & PowerPoint drafts</DialogTitle><DialogDescription className="text-white/70">Selected school only. Generate/import → edit → validate preview → explicit apply to a new project or new slides. Nothing replaces existing content.</DialogDescription></DialogHeader>
      <div className="grid gap-3 md:grid-cols-2"><label>Draft topic<input aria-label="Creator draft topic" maxLength={500} value={topic} onChange={e => setTopic(e.target.value)} className="block w-full bg-white/10 p-2 rounded" /></label><label>Draft type<select aria-label="Creator draft type" value={mode} onChange={e => setMode(e.target.value as typeof mode)} className="block w-full bg-[#12324a] p-2 rounded"><option value="slides">Editable slide content</option><option value="outline">Outline draft</option><option value="questions">Question draft</option><option value="narration">Narration script (text only)</option><option value="full_lesson">Full lesson text (1,500+ words total)</option></select></label><label className="md:col-span-2">Topic details<textarea aria-label="Creator draft details" maxLength={8000} value={details} onChange={e => setDetails(e.target.value)} className="block w-full min-h-20 bg-white/10 p-2 rounded" /></label><label>Slide count<input aria-label="Creator draft slide count" type="number" min={1} max={12} value={count} onChange={e => setCount(Number(e.target.value))} className="block bg-white/10 p-2 rounded" /></label><div className="flex items-end"><Button disabled={busy || (!topic.trim() && !projectId) || !orgId || count < 1 || count > 12} onClick={generateDraft}>{busy ? "Working…" : "Generate review draft"}</Button></div></div>
      <p className="text-xs text-white/70">Runs the existing configured course AI provider/model only when you click Generate. Images remain honestly labeled missing placeholders; this action does not generate/upload images. Narration is editable text, not speech.</p>
      <label>Import editable PowerPoint (.pptx, ≤16 MiB)<input aria-label="Import Creator PowerPoint" type="file" accept=".pptx" disabled={busy || !orgId} onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ""; }} className="block w-full" /></label>
      {draft?.warnings.map((w, i) => <p key={i} className="text-xs text-amber-200">{w}</p>)}
      {!!draft?.assets.length && <div className="grid grid-cols-3 gap-2" aria-label="Imported picture byte drafts">{draft.assets.map(asset => <figure key={asset.id}><img src={`data:${asset.mimeType};base64,${asset.base64}`} alt={`Imported picture draft: ${asset.filename}`} className="h-28 w-full object-contain bg-white/5" /><figcaption className="text-xs text-white/70">{asset.filename} — not yet saved to Media Library</figcaption></figure>)}</div>}
      {error && <p role="alert" className="text-sm whitespace-pre-wrap text-amber-200">{error}</p>}
      {raw && <><label>Complete editable draft JSON<textarea aria-label="Creator complete draft JSON" value={raw} maxLength={32 * 1024 * 1024} onChange={e => { setRaw(e.target.value); setHtml(""); setReviewedRaw(""); setConsent(false); }} className="block w-full min-h-48 bg-white/10 p-2 rounded font-mono text-xs" /></label><Button disabled={busy} onClick={review}>Validate & preview draft</Button></>}
      {html && <><iframe title="Creator exchange draft preview" srcDoc={html} sandbox="allow-scripts" className="w-full h-72 border border-white/20" /><label>Apply destination<select aria-label="Creator draft apply destination" value={target} onChange={e => { setTarget(e.target.value as typeof target); setConsent(false); }} className="block bg-[#12324a] p-2"><option value="new_project">New draft project</option>{projectId && <option value="append_slides">Append NEW slides to this selected project</option>}</select></label>{!!draft?.assets.length && <label className="flex gap-2"><input type="checkbox" aria-label="Save imported Creator pictures" checked={mediaConsent} onChange={e => setMediaConsent(e.target.checked)} />Save imported pictures as new selected-school main Media Library assets (uses existing account quota).</label>}<label className="flex gap-2"><input type="checkbox" aria-label="Confirm Creator draft review" checked={consent} onChange={e => setConsent(e.target.checked)} />I reviewed this exact preview and consent to apply only new slides/project; existing content is not replaced.</label><Button disabled={busy || !consent || raw !== reviewedRaw || (!!draft?.assets.length && !mediaConsent)} onClick={applyDraft}>Apply reviewed draft</Button></>}
    </DialogContent></Dialog>
  </>;
}
