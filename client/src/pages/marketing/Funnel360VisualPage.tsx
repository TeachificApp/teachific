import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { WysiwygPageBuilder, type Block } from "@/components/WysiwygPageBuilder";
import { renderBlockPreview } from "@/components/PageBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";

/** Native page_builder_pages editor; retained legacy editors remain available. */
export default function Funnel360VisualPage() {
  const { stepId = "" } = useParams<{ id: string; stepId: string }>();
  const id = Number(stepId);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const query = trpc.funnel360.getStepPage.useQuery({ stepId: id }, { enabled: Number.isInteger(id) && id > 0, retry: false });
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [published, setPublished] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [hydrated, setHydrated] = useState("");
  const data = query.data;
  const binding = data ? `${data.orgId}:${data.page.id}` : "";
  const save = trpc.funnel360.updateStepPage.useMutation({
    onSuccess: async () => {
      setDirty(false);
      await utils.funnel360.getStepPage.invalidate({ stepId: id });
      toast.success("Page saved. Publication uses the owning school's domain.");
    },
    onError: error => toast.error(error.message),
  });
  useEffect(() => {
    if (!data || hydrated === binding) return;
    try {
      const parsed = JSON.parse(data.page.blocksJson);
      if (!Array.isArray(parsed)) throw new Error("Invalid saved blocks");
      setBlocks(parsed);
      setTitle(data.page.title || "Untitled page");
      setMetaTitle(data.page.metaTitle || "");
      setMetaDescription(data.page.metaDescription || "");
      setPublished(data.page.isPublished);
      setDirty(false);
      setHydrated(binding);
    } catch {
      toast.error("Saved page content could not be loaded. Nothing has been replaced.");
    }
  }, [data, binding, hydrated]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const changeBlocks = useCallback((next: Block[]) => { setBlocks(next); setDirty(true); }, []);
  const back = () => {
    if (dirty && !window.confirm("Leave this page without saving your draft?")) return;
    navigate(data ? `/marketing/funnels/${data.funnel.id}` : "/marketing/funnels");
  };
  if (query.isLoading) return <main className="p-8" aria-busy="true">Loading school-owned funnel page…</main>;
  if (!data || query.error) return <main className="p-8 space-y-4"><p>{query.error?.message || "This page is unavailable in the active school."}</p><Button variant="outline" onClick={back}>Back to Funnels</Button></main>;
  if (hydrated !== binding) return <main className="p-8 space-y-4"><p>Page content has not loaded safely. Saving is disabled to preserve the existing page.</p><Button variant="outline" onClick={back}>Back to Funnels</Button></main>;
  const publicUrl = `${data.baseUrl}/funnel/${encodeURIComponent(data.funnel.slug)}/${encodeURIComponent(data.step.slug)}`;
  return <main className="h-screen flex flex-col bg-background text-foreground">
    <header className="flex flex-wrap items-center gap-3 border-b bg-white px-4 py-3">
      <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="mr-2 h-4 w-4" />Back to Funnel</Button>
      <span className="text-sm font-semibold">{data.funnel.name}</span>
      <span className="text-xs text-muted-foreground">{dirty ? "Unsaved draft" : "Saved"}</span>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPreview(value => !value)}>{preview ? "Edit" : "Preview draft"}</Button>
        <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1"><ExternalLink className="h-4 w-4" />Open published page</a>
        <Button size="sm" disabled={save.isPending || !dirty || !title.trim()} onClick={() => save.mutate({ stepId: id, expectedOrgId: data.orgId, title: title.trim(), metaTitle, metaDescription, blocksJson: JSON.stringify(blocks), isPublished: published })}><Save className="h-4 w-4 mr-2" />{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </header>
    <div className="flex flex-wrap items-center gap-4 border-b px-4 py-2">
      <label className="flex items-center gap-2 text-sm">Page title<Input value={title} maxLength={255} onChange={event => { setTitle(event.target.value); setDirty(true); }} className="w-64" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={published} onChange={event => { setPublished(event.target.checked); setDirty(true); }} />Publish when saved</label>
      <span className="text-xs text-muted-foreground">The funnel must also be active. No checkout or payment is configured automatically.</span>
      <details className="w-full"><summary className="cursor-pointer text-sm">Search preview &amp; SEO</summary><div className="grid gap-3 py-3 sm:grid-cols-2"><label className="text-sm">SEO title<Input value={metaTitle} maxLength={255} onChange={event => { setMetaTitle(event.target.value); setDirty(true); }} /></label><label className="text-sm">SEO description<Input value={metaDescription} maxLength={500} onChange={event => { setMetaDescription(event.target.value); setDirty(true); }} /></label></div></details>
    </div>
    <div className="flex-1 overflow-auto">
      {preview ? <div>{blocks.filter(block => block.visible !== false).map(block => <section key={block.id}>{renderBlockPreview(block)}</section>)}</div> : <WysiwygPageBuilder key={binding} initialBlocks={blocks} onChange={changeBlocks} orgId={data.orgId} />}
    </div>
  </main>;
}
