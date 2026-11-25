import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { renderBlockPreview, type Block } from "@/components/PageBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/** Target-native copy editor. Unknown blocks and fields remain byte-for-value;
 * existing full editors and their features/routes are not replaced. */
export function Funnel360PageEditorDialog({ stepId, onClose }: { stepId: number; onClose: () => void }) {
  const query = trpc.funnel360.getStepPage.useQuery({ stepId }, { retry: false });
  const save = trpc.funnel360.updateStepPage.useMutation();
  const utils = trpc.useUtils();
  const hydrated = useRef(false);
  const pending = useRef(false);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!query.data || hydrated.current) return;
    const { page } = query.data;
    try {
      const parsed = JSON.parse(page.blocksJson);
      if (!Array.isArray(parsed)) throw new Error("Invalid page blocks");
      setBlocks(parsed); setTitle(page.title || ""); setSeoTitle(page.metaTitle || ""); setDescription(page.metaDescription || "");
      setPublished(page.isPublished); setOrgId(query.data.orgId); hydrated.current = true;
    } catch { setError("Saved block data is invalid. No content has been changed."); }
  }, [query.data]);
  function close() {
    if (pending.current || (dirty && !window.confirm("Discard unsaved page edits?"))) return;
    onClose();
  }
  function patchBlock(i: number, patch: Record<string, unknown>) {
    setBlocks(previous => previous.map((block, index) => index === i ? { ...block, data: { ...block.data, ...patch } } : block));
    setDirty(true);
  }
  async function handleSave() {
    if (pending.current || !orgId || !title.trim()) return;
    pending.current = true; setError("");
    try {
      await save.mutateAsync({ stepId, expectedOrgId: orgId, title, metaTitle: seoTitle, metaDescription: description, blocksJson: JSON.stringify(blocks), isPublished: published });
    } catch (failure) {
      pending.current = false; setError(failure instanceof Error ? failure.message : "Could not save; your edits are preserved."); return;
    }
    pending.current = false; setDirty(false);
    void Promise.resolve().then(() => utils.invalidate()).catch(() => undefined);
    onClose();
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }} onInteractOutside={event => { if (pending.current) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>Funnel page copy &amp; SEO</DialogTitle><DialogDescription>Edit this school’s funnel page without changing its saved URL or unknown block settings.</DialogDescription></DialogHeader>
    <p className="text-sm text-muted-foreground">Edit native page copy without changing its slug, products, layout, unknown blocks, or shared Learn name. Publishing this page does not activate the funnel.</p>
    {query.error && <p role="alert">{query.error.message}</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <fieldset disabled={!orgId || save.isPending} className="space-y-3">
      <label className="block text-sm">Page title<Input value={title} maxLength={255} onChange={e => { setTitle(e.target.value); setDirty(true); }} /></label>
      <label className="block text-sm">SEO title<Input value={seoTitle} maxLength={255} onChange={e => { setSeoTitle(e.target.value); setDirty(true); }} /></label>
      <label className="block text-sm">SEO description<Textarea value={description} maxLength={500} onChange={e => { setDescription(e.target.value); setDirty(true); }} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={published} onChange={e => { setPublished(e.target.checked); setDirty(true); }} />Publish this page (Pro+)</label>
      <Button type="button" variant="outline" onClick={() => setPreview(!preview)}>{preview ? "Edit copy" : "Inert preview"}</Button>
      {blocks.map((block, i) => <section key={block.id} className="rounded-lg border p-3 space-y-2">
        <h3 className="text-sm font-medium">{i + 1}. {block.type}</h3>
        {preview ? <div inert className="pointer-events-none">{(["banner", "bg_section", "checklist", "faq", "cta"] as string[]).includes(block.type) ? renderBlockPreview(block) : <p className="text-xs text-muted-foreground">Advanced block preserved; preview disabled here.</p>}</div> : <>
          {["headline", "headline2", "body", "subtext", "ctaText"].filter(key => typeof block.data?.[key] === "string").map(key => <label key={key} className="block text-sm">{key}<Textarea value={block.data[key]} onChange={e => patchBlock(i, { [key]: e.target.value })} /></label>)}
          {block.type === "checklist" && Array.isArray(block.data?.items) && block.data.items.map((item: any, j: number) => <label key={item.id || j} className="block text-sm">Bullet {j + 1}<Input value={item.text || ""} onChange={e => patchBlock(i, { items: block.data.items.map((old: any, index: number) => index === j ? { ...old, text: e.target.value } : old) })} /></label>)}
          {block.type === "faq" && Array.isArray(block.data?.items) && block.data.items.map((item: any, j: number) => <div key={item.id || j}>{["question", "answer"].map(key => <label key={key} className="block text-sm">FAQ {j + 1} {key}<Textarea value={item[key] || ""} onChange={e => patchBlock(i, { items: block.data.items.map((old: any, index: number) => index === j ? { ...old, [key]: e.target.value } : old) })} /></label>)}</div>)}
          {!(["banner", "bg_section", "checklist", "faq", "cta"] as string[]).includes(block.type) && <p className="text-xs text-muted-foreground">Additional settings are preserved. Use the existing full page editor for this block's advanced layout.</p>}
        </>}
      </section>)}
    </fieldset>
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={close} disabled={save.isPending}>Cancel</Button><Button onClick={handleSave} disabled={!orgId || !dirty || !title.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save page"}</Button></div>
  </DialogContent></Dialog>;
}
