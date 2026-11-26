import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { CreatorOwnedImageResult } from "@shared/course360CreatorOwnedImage";

export type { CreatorOwnedImageResult } from "@shared/course360CreatorOwnedImage";
export type CreatorOwnedImageControlsProps = { orgId?: number | null; projectId?: number; scopeKey?: string | number; onGenerated?: (image: CreatorOwnedImageResult) => void | Promise<void> };
function validReceipt(value: CreatorOwnedImageResult, school: number) {
  if (value.orgId !== school || !Number.isSafeInteger(value.mediaId) || value.mediaId < 1 || value.mimeType !== "image/png" || !Number.isSafeInteger(value.fileSize) || value.fileSize < 1 || value.fileSize > 8 * 1024 * 1024 || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width < 1 || value.height < 1 || value.width > 4096 || value.height > 4096 || value.width * value.height > 8_000_000 || !new RegExp(`^org-${school}/media/creator-images/[a-f0-9-]{36}\\.png$`).test(value.key)) return false;
  if (value.url === `/manus-storage/${value.key}` || value.url === `/manus-storage/${value.key.split("/").map(encodeURIComponent).join("/")}`) return true;
  try { const u = new URL(value.url); return u.protocol === "https:" && !u.username && !u.password && !u.hash; } catch { return false; }
}
/** No automatic generation/status/save on mount. Parent appends a fresh block only on explicit Insert. */
export function CreatorOwnedImageControls({ orgId, projectId, scopeKey, onGenerated }: CreatorOwnedImageControlsProps) {
  const [open, setOpen] = useState(false), [prompt, setPrompt] = useState(""), [generateConsent, setGenerateConsent] = useState(false), [saveConsent, setSaveConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("Availability has not been checked. No generation runs automatically."), [available, setAvailable] = useState<boolean | null>(null), [image, setImage] = useState<CreatorOwnedImageResult | null>(null);
  const status = trpc.authoring.creatorOwnedImageStatus.useMutation(), generate = trpc.authoring.generateCreatorOwnedImage.useMutation(), cancel = trpc.authoring.cancelCreatorOwnedImage.useMutation();
  const mounted = useRef(true), sequence = useRef(0), running = useRef(false), pending = useRef<{ requestId: string; school: number } | null>(null);
  const current = useRef({ orgId, projectId, scopeKey }); current.current = { orgId, projectId, scopeKey };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; sequence.current++; }; }, []);
  useEffect(() => { sequence.current++; setOpen(false); setImage(null); setGenerateConsent(false); setSaveConsent(false); setAvailable(null); setError(""); setPrompt(""); setMessage("Availability has not been checked. No generation runs automatically."); }, [orgId, projectId, scopeKey]);
  const valid = (n: number, school: number, project: number | undefined, scope: string | number | undefined) => mounted.current && sequence.current === n && current.current.orgId === school && current.current.projectId === project && current.current.scopeKey === scope;
  async function operation(fn: (n: number, school: number, project: number | undefined, scope: string | number | undefined) => Promise<void>) {
    if (!orgId || running.current) return; running.current = true; setBusy(true); setError(""); const n = ++sequence.current, school = orgId, project = projectId, scope = scopeKey;
    try { await fn(n, school, project, scope); }
    catch (e) { if (valid(n, school, project, scope)) setError(e instanceof Error ? e.message : "Image request failed. Existing content is unchanged."); }
    finally { running.current = false; pending.current = null; if (mounted.current) setBusy(false); }
  }
  async function check() { await operation(async (n, school, project, scope) => { const result = await status.mutateAsync({ expectedOrgId: school }); if (valid(n, school, project, scope) && result.orgId === school) { setAvailable(result.available); setMessage(result.reason); } }); }
  async function create() {
    if (!generateConsent || !saveConsent || !prompt.trim() || available === false || image) return;
    await operation(async (n, school, project, scope) => {
      const requestId = crypto.randomUUID(); pending.current = { requestId, school }; setImage(null);
      const result = await generate.mutateAsync({ expectedOrgId: school, requestId, prompt: prompt.trim(), consentToGenerate: true, consentToSaveToMainLibrary: true });
      if (!valid(n, school, project, scope)) return;
      if (!validReceipt(result, school)) throw new Error("Image response does not identify a verified selected-school media item. Nothing was inserted.");
      setImage(result); setGenerateConsent(false); setSaveConsent(false); setMessage("Actual generated image saved as a NEW main school Media Library item. Review it, then explicitly insert a NEW block. Existing content is unchanged.");
    });
  }
  async function stop() {
    const p = pending.current; if (!p) return;
    // Suppress a late completed result immediately, even if server cancellation loses a race.
    sequence.current++; setImage(null); setGenerateConsent(false); setSaveConsent(false); setMessage("Cancellation requested. Nothing will be inserted automatically; a completed save may remain in the main library.");
    try { await cancel.mutateAsync({ expectedOrgId: p.school, requestId: p.requestId }); }
    catch (e) { if (mounted.current && current.current.orgId === p.school) setError(e instanceof Error ? e.message : "Cancellation unavailable; bounded server work still rechecks school before saving."); }
  }
  async function insert() { if (!image || !onGenerated) return; const saved = image; await operation(async (n, school, project, scope) => { if (!validReceipt(saved, school) || !valid(n, school, project, scope)) return; await onGenerated(saved); if (valid(n, school, project, scope)) { setImage(null); setOpen(false); setMessage("New image block requested. Existing blocks were not replaced."); } }); }
  return <>
    <Button variant="ghost" size="sm" disabled={!orgId || busy} onClick={() => setOpen(true)}>Generate owned image</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#111827] border-white/10 text-white"><DialogHeader><DialogTitle>Creator owned image</DialogTitle><DialogDescription className="text-white/70">One explicit generated image, saved as new media in the main school library. No Studio gate. No existing asset or block is replaced; AI lesson image automation and TTS are separate.</DialogDescription></DialogHeader>
      <p role="status" className="text-sm whitespace-pre-wrap text-white/70">{message}</p>
      <Button variant="outline" disabled={busy || !orgId} onClick={check}>Check image availability</Button>
      <label>Image prompt<textarea aria-label="Creator image prompt" maxLength={4000} disabled={busy || !!image} value={prompt} onChange={e => { setPrompt(e.target.value); setGenerateConsent(false); setSaveConsent(false); }} className="block w-full min-h-24 bg-white/10 p-2 rounded" /></label>
      <label className="flex gap-2"><input type="checkbox" aria-label="Consent to Creator image generation" disabled={busy || !!image} checked={generateConsent} onChange={e => setGenerateConsent(e.target.checked)} />I explicitly consent to this configured-provider image generation request.</label>
      <label className="flex gap-2"><input type="checkbox" aria-label="Consent to new main-library image save" disabled={busy || !!image} checked={saveConsent} onChange={e => setSaveConsent(e.target.checked)} />I explicitly consent to save a NEW generated image in this school's main Media Library using its storage allowance.</label>
      <Button disabled={busy || !orgId || !prompt.trim() || !generateConsent || !saveConsent || available === false || !!image} onClick={create}>{busy ? "Working…" : "Generate & save NEW image"}</Button>
      {busy && pending.current && <Button variant="outline" onClick={stop}>Cancel image request</Button>}
      {error && <p role="alert" className="text-sm whitespace-pre-wrap text-amber-200">{error}</p>}
      {image && <><figure><img src={image.url} alt={image.alt} className="w-full max-h-72 object-contain" /><figcaption className="text-xs text-white/70">Saved media #{image.mediaId} · {image.width} × {image.height} · {image.fileSize} bytes</figcaption></figure>{onGenerated && <Button disabled={busy || !orgId} onClick={insert}>Insert NEW image block</Button>}<Button variant="outline" disabled={busy} onClick={() => { setImage(null); setMessage("Saved media remains in the main library. A new request requires fresh consent."); }}>Keep in library without inserting</Button></>}
    </DialogContent></Dialog>
  </>;
}
