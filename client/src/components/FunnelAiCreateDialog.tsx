import React, { useEffect, useId, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { trpc } from "@/lib/trpc";
import {
  buildFunnelAiBlocks,
  funnelAiDraftSchema,
  funnelAiGenerateInputSchema,
  type FunnelAiDraft,
  type FunnelAiGenerateInput,
  type FunnelAiPage,
  type FunnelAiSection,
} from "@shared/funnelAi";
import { renderBlockPreview } from "@/components/PageBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Sparkles } from "lucide-react";

const PAGE_TYPES: { value: FunnelAiPage["pageType"]; label: string }[] = [
  { value: "landing", label: "Landing Page" },
  { value: "checkout", label: "Checkout" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
  { value: "thank_you", label: "Thank You" },
  { value: "custom", label: "Custom Page" },
];
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

function preventPreviewAction(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function CopyField({ label, value, onChange, multiline = false, maxLength }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  const props = { id, value, maxLength, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      {multiline ? <Textarea {...props} className="min-h-[80px] text-sm" /> : <Input {...props} className="h-10 text-sm" />}
    </div>
  );
}

function SectionCopyEditor({ section, index, onChange }: {
  section: FunnelAiSection;
  index: number;
  onChange: (section: FunnelAiSection) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-gray-200 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--org-primary)]">Section {index + 1}: {section.kind}</legend>
      <CopyField label="Section headline" value={section.headline} maxLength={255} onChange={headline => onChange({ ...section, headline })} />
      <CopyField label="Section copy" value={section.body} maxLength={6000} multiline onChange={body => onChange({ ...section, body })} />
      {section.kind === "bullets" && (
        <CopyField label="Bullets (one per line)" value={section.items.join("\n")} multiline onChange={value => onChange({ ...section, items: value.split("\n") })} />
      )}
      {section.kind === "faq" && section.questions.map((question, questionIndex) => (
        <div key={questionIndex} className="space-y-2 rounded-md bg-gray-50 p-3">
          <CopyField label={`FAQ ${questionIndex + 1} question`} value={question.q} maxLength={255} onChange={q => onChange({ ...section, questions: section.questions.map((item, i) => i === questionIndex ? { ...item, q } : item) })} />
          <CopyField label={`FAQ ${questionIndex + 1} answer`} value={question.a} maxLength={2000} multiline onChange={a => onChange({ ...section, questions: section.questions.map((item, i) => i === questionIndex ? { ...item, a } : item) })} />
        </div>
      ))}
      {(section.kind === "hero" || section.kind === "cta" || section.buttonText) && (
        <CopyField label="Button text" value={section.buttonText} maxLength={100} onChange={buttonText => onChange({ ...section, buttonText })} />
      )}
    </fieldset>
  );
}

/** Creates new unpublished content only; generation never writes a funnel/page. */
export function FunnelAiCreateDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<FunnelAiGenerateInput["mode"]>("landing");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [pageTypes, setPageTypes] = useState<FunnelAiPage["pageType"][]>(["landing", "checkout", "thank_you"]);
  const [draftOrgId, setDraftOrgId] = useState<number | null>(null);
  const [draft, setDraft] = useState<FunnelAiDraft | null>(null);
  const [tab, setTab] = useState<"copy" | "preview">("copy");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState<"generate" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const operation = useRef(0);
  const requestId = useRef<string | null>(null);
  const saved = useRef(false);
  const generate = trpc.funnelAi.generateAiDraft.useMutation();
  const create = trpc.funnelAi.createFromAiDraft.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; operation.current += 1; };
  }, []);

  const input: FunnelAiGenerateInput = { mode, name, prompt, audience, goal, ctaUrl, pageTypes: mode === "landing" ? ["landing"] : pageTypes };
  const validInput = funnelAiGenerateInputSchema.safeParse(input);
  const validDraft = funnelAiDraftSchema.safeParse(draft);
  const isBusy = busy !== null;

  function changeDraft(next: FunnelAiDraft) {
    if (pending.current || saved.current) return;
    if (JSON.stringify(next) === JSON.stringify(draft)) return;
    // A changed payload is a new draft version; unchanged failed saves retain their ID.
    requestId.current = crypto.randomUUID();
    setDraft(next);
    setReviewed(false);
    setError(null);
  }
  function changePage(pageIndex: number, next: FunnelAiPage) {
    if (draft) changeDraft({ ...draft, pages: draft.pages.map((page, i) => i === pageIndex ? next : page) });
  }

  function requestClose() {
    if (pending.current && busy === "create") return;
    const message = draft
      ? "Discard this unsaved AI draft and your local edits? Existing pages will not be changed."
      : "Close while AI generation is pending? Any returned draft will be ignored.";
    if ((draft || pending.current) && !window.confirm(message)) return;
    mounted.current = false;
    operation.current += 1;
    onClose();
  }

  async function handleGenerate() {
    if (pending.current || saved.current) return;
    const parsed = funnelAiGenerateInputSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check your generation details."); return; }
    if (draft && !window.confirm("Generate a new draft to replace this local unsaved AI draft, including your edits, only if generation succeeds? Existing pages will not be changed.")) return;
    pending.current = true;
    const token = ++operation.current;
    setBusy("generate");
    setError(null);
    try {
      const response = await generate.mutateAsync(parsed.data);
      if (!mounted.current || operation.current !== token) return;
      const result = funnelAiDraftSchema.safeParse(response.draft);
      if (!result.success || result.data.mode !== parsed.data.mode || result.data.pages.length !== parsed.data.pageTypes.length || result.data.pages.some((page, i) => page.pageType !== parsed.data.pageTypes[i])) {
        throw new Error("AI returned an incomplete draft or different page steps. Please generate again.");
      }
      // Allocate once on successful generation, never again during a failed-save retry.
      const newRequestId = crypto.randomUUID();
      requestId.current = newRequestId;
      setDraftOrgId(response.orgId);
      setDraft(result.data);
      setReviewed(false);
      setTab("copy");
    } catch (failure) {
      if (mounted.current && operation.current === token) setError(`Generation failed: ${failure instanceof Error ? failure.message : "Please try again."} Your previous draft and edits are unchanged.`);
    } finally {
      if (mounted.current && operation.current === token) { pending.current = false; setBusy(null); }
    }
  }

  async function handleCreate() {
    if (pending.current || saved.current || !reviewed || !requestId.current || !draftOrgId) return;
    const result = funnelAiDraftSchema.safeParse(draft);
    if (!result.success) { setError("Complete all page copy and SEO fields before creating the draft."); return; }
    pending.current = true;
    const token = ++operation.current;
    setBusy("create");
    setError(null);
    let response: { id: number };
    try {
      response = await create.mutateAsync({ requestId: requestId.current, draft: result.data, expectedOrgId: draftOrgId });
    } catch (failure) {
      if (mounted.current && operation.current === token) {
        setError(`Could not create draft: ${failure instanceof Error ? failure.message : "Please try again."} Your reviewed draft is preserved; retry uses the same request ID.`);
        pending.current = false;
        setBusy(null);
      }
      return;
    }
    saved.current = true;
    // A cache-refresh failure must never turn a successful creation into a failed save.
    void Promise.resolve().then(() => utils.invalidate()).catch(() => undefined);
    if (!mounted.current || operation.current !== token) return;
    pending.current = false;
    setBusy(null);
    setCreated(true);
    onCreated(response.id);
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-6xl" showCloseButton={false} onEscapeKeyDown={event => { if (pending.current && busy === "create") event.preventDefault(); }} onInteractOutside={event => { if (pending.current && busy === "create") event.preventDefault(); }}>
        <DialogHeader className="border-b border-gray-100 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-gray-900"><Sparkles size={20} className="text-teal-600" /> AI Landing Page &amp; Funnel Generator</DialogTitle>
          <DialogDescription>Generate new content, review and edit every page, then explicitly create an unpublished draft. Existing funnels, pages, and copy stay untouched.</DialogDescription>
        </DialogHeader>
        <div className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <fieldset disabled={isBusy || created} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor={`${id}-mode`} className="block text-sm font-medium text-gray-700">Type</label>
                <select id={`${id}-mode`} value={mode} className={selectClass} onChange={event => setMode(event.target.value as FunnelAiGenerateInput["mode"])}>
                  <option value="landing">Landing Page (one page)</option>
                  <option value="funnel">Funnel (2–5 steps)</option>
                </select>
              </div>
              <CopyField label="Name" value={name} maxLength={255} onChange={setName} />
              <CopyField label="Offer / topic / details" value={prompt} maxLength={12000} multiline onChange={setPrompt} />
              <CopyField label="Audience" value={audience} maxLength={1000} onChange={setAudience} />
              <CopyField label="Goal" value={goal} maxLength={1000} onChange={setGoal} />
              <CopyField label="CTA URL (optional)" value={ctaUrl} maxLength={2000} onChange={setCtaUrl} />
              <p className="text-xs text-gray-500">Use your school’s HTTPS publishing URL or relative path. Leave blank to configure destinations later in the editor; generation never starts checkout.</p>
              {mode === "funnel" && <p className="text-xs text-gray-500">This URL is the final-page destination. Earlier pages will link to the next new page in order when you create the draft.</p>}
              {mode === "funnel" && (
                <div className="space-y-3 rounded-lg bg-teal-50 p-3">
                  <label htmlFor={`${id}-count`} className="block text-sm font-medium text-teal-800">Step count</label>
                  <select id={`${id}-count`} value={pageTypes.length} className={selectClass} onChange={event => {
                    const count = Number(event.target.value);
                    setPageTypes(previous => Array.from({ length: count }, (_, i) => i === 0 ? "landing" : previous[i] ?? (i === count - 1 ? "thank_you" : "custom")));
                  }}>
                    {[2, 3, 4, 5].map(count => <option key={count} value={count}>{count} steps</option>)}
                  </select>
                  <p className="text-xs font-medium text-teal-800">Step 1: Landing Page</p>
                  {pageTypes.slice(1).map((pageType, i) => (
                    <div key={i} className="space-y-1">
                      <label htmlFor={`${id}-step-${i}`} className="block text-sm text-gray-700">Step {i + 2} page type</label>
                      <select id={`${id}-step-${i}`} value={pageType} className={selectClass} onChange={event => setPageTypes(previous => previous.map((type, index) => index === i + 1 ? event.target.value as FunnelAiPage["pageType"] : type))}>
                        {PAGE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
            {!validInput.success && (name || prompt || ctaUrl) && <p className="text-xs text-amber-700">{validInput.error.issues[0]?.message}</p>}
            <Button onClick={handleGenerate} disabled={isBusy || created || !validInput.success} className="w-full gap-2 org-primary-button">
              {busy === "generate" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {busy === "generate" ? "Generating…" : draft ? "Generate New Draft" : "Generate Draft"}
            </Button>
            <p className="text-xs text-gray-500">Generation is review-only. It does not save, publish, or replace existing content. Regeneration keeps your current edits unless a new draft succeeds after your confirmation.</p>
          </div>
          <section aria-label="AI draft review" className="min-w-0 space-y-4">
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            {draft ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900">Review all {draft.pages.length} {draft.pages.length === 1 ? "page" : "pages"}</h2>
                  <div role="tablist" aria-label="Draft review mode" className="flex rounded-lg bg-gray-100 p-1">
                    {(["copy", "preview"] as const).map(value => <button key={value} type="button" role="tab" aria-selected={tab === value} aria-controls={`${id}-review`} onClick={() => setTab(value)} className={`rounded-md px-3 py-1.5 text-sm ${tab === value ? "bg-white text-[var(--org-primary)] shadow-sm" : "text-gray-500"}`}>{value === "copy" ? "Copy" : "Preview"}</button>)}
                  </div>
                </div>
                <fieldset disabled={isBusy || created} className="space-y-3">
                  <CopyField label="Draft name" value={draft.name} maxLength={255} onChange={value => changeDraft({ ...draft, name: value })} />
                  <CopyField label="Draft description" value={draft.description} maxLength={4000} multiline onChange={value => changeDraft({ ...draft, description: value })} />
                  <CopyField label="Draft CTA URL (optional)" value={draft.ctaUrl} maxLength={2000} onChange={value => changeDraft({ ...draft, ctaUrl: value })} />
                  {draft.mode === "funnel" && <p className="text-xs text-gray-500">Final-page destination only; earlier pages link to their next step after creation. Inert previews show the copy and layout, not live saved-page links.</p>}
                </fieldset>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  <p>New draft only: unpublished, Education Library default off, publishing URLs use the owning school’s verified domain or Course360™ subdomain. Existing pages remain untouched.</p>
                  <p className="mt-1">Review AI claims and all links before publishing. Attach products to checkout pages and configure checkout / CTA destinations using the existing editor. Preview is inert: links, forms, and checkout cannot run.</p>
                  <p className="mt-1 break-all">CTA destination: {draft.ctaUrl || "Empty final CTA: configure a destination in the editor before publishing. No automatic checkout."}</p>
                  {draft.pages.length > 1 && <p className="mt-1">Page flow: {draft.pages.map((page, i) => `${i + 1}. ${page.title}`).join(" → ")}. Pages will be linked in this order.</p>}
                </div>
                <div id={`${id}-review`} role="tabpanel" className="space-y-4">
                  {draft.pages.map((page, pageIndex) => (
                    <article key={pageIndex} aria-label={`Page ${pageIndex + 1}: ${page.title}`} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                      <div className="border-b border-gray-100 bg-gray-50 p-4">
                        <h3 className="font-semibold text-gray-900">{pageIndex + 1}. {page.title}</h3>
                        <p className="text-xs text-[var(--org-primary)]">{PAGE_TYPES.find(type => type.value === page.pageType)?.label} · {page.pageType}</p>
                        <p className="mt-2 text-xs text-gray-500">SEO: {page.seoTitle}</p>
                        <p className="text-xs text-gray-500">{page.seoDescription}</p>
                        <p className="text-xs text-gray-500">Keywords: {page.seoKeywords || "None"}</p>
                        {page.pageType === "checkout" && <p className="mt-2 text-xs font-medium text-amber-700">Checkout needs products attached in the editor before publishing.</p>}
                      </div>
                      {tab === "copy" ? (
                        <fieldset disabled={isBusy || created} className="space-y-3 p-4">
                          <CopyField label="Page title" value={page.title} maxLength={255} onChange={title => changePage(pageIndex, { ...page, title })} />
                          <CopyField label="SEO title" value={page.seoTitle} maxLength={255} onChange={seoTitle => changePage(pageIndex, { ...page, seoTitle })} />
                          <CopyField label="SEO description" value={page.seoDescription} maxLength={500} multiline onChange={seoDescription => changePage(pageIndex, { ...page, seoDescription })} />
                          <CopyField label="SEO keywords" value={page.seoKeywords} maxLength={1000} onChange={seoKeywords => changePage(pageIndex, { ...page, seoKeywords })} />
                          {page.sections.map((section, sectionIndex) => <SectionCopyEditor key={sectionIndex} section={section} index={sectionIndex} onChange={next => changePage(pageIndex, { ...page, sections: page.sections.map((item, i) => i === sectionIndex ? next : item) })} />)}
                        </fieldset>
                      ) : (
                        <div inert aria-label={`Inert preview of page ${pageIndex + 1}`} onClickCapture={preventPreviewAction} onAuxClickCapture={preventPreviewAction} onKeyDownCapture={preventPreviewAction} onSubmitCapture={preventPreviewAction} className="pointer-events-none select-text">
                          {buildFunnelAiBlocks(page, `ai_preview_${pageIndex}`, draft.ctaUrl).map(block => <React.Fragment key={block.id}>{renderBlockPreview(block)}</React.Fragment>)}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {!validDraft.success && <p role="alert" className="text-sm text-red-700">Draft incomplete: {validDraft.error.issues[0]?.message}. Complete valid copy and SEO for every page.</p>}
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={reviewed} disabled={isBusy || created || !validDraft.success} onChange={event => setReviewed(event.target.checked)} className="mt-1 accent-teal-600" />
                  I have reviewed all pages, SEO, copy, and CTA destinations. Create a new unpublished draft only.
                </label>
              </>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-teal-100 bg-teal-50/30 p-8 text-center">
                <Sparkles size={32} className="mb-3 text-teal-500" />
                <h2 className="font-semibold text-gray-800">Your new draft will appear here</h2>
                <p className="mt-2 max-w-sm text-sm text-gray-500">Describe your offer and audience. Review the complete copy and native block preview before choosing Create Draft.</p>
              </div>
            )}
          </section>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <Button variant="outline" onClick={requestClose} disabled={busy === "create"}>Close</Button>
          <Button onClick={handleCreate} disabled={isBusy || created || !reviewed || !validDraft.success} className="gap-2 org-primary-button">
            {busy === "create" && <Loader2 size={16} className="animate-spin" />}
            {busy === "create" ? "Creating…" : created ? "Draft Created" : "Create Draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
