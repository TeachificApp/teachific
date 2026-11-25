import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AiSourceFileReview, type AiSourceReviewFile } from "@/components/AiSourceFileReview";
import type { Course360SourceMime } from "../../../server/lib/course360AiSourceMetadata";

type Draft = Record<string, any>;
export function course360IntegratedSourceInput(files: AiSourceReviewFile[]) {
  return files.length ? files.map(({ url, mimeType, name, storageKey }) => ({ url, mimeType: mimeType as Course360SourceMime, name, storageKey })) : undefined;
}

export function useCourse360IntegratedSources(orgId: number | null | undefined) {
  const [sourceFiles, setSourceFiles] = useState<AiSourceReviewFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const busy = useRef(false);
  const activeOrg = useRef(orgId);
  activeOrg.current = orgId;
  useEffect(() => { setSourceFiles([]); }, [orgId]);
  const upload = async (files: File[]) => {
    if (busy.current) return;
    if (!orgId) { toast.error("Choose an organization before adding source files."); return; }
    if (sourceFiles.length + files.length > 3) { toast.error("You can add up to three source files."); return; }
    if (!files.length || files.some(file => file.size === 0 || file.size > 50 * 1024 * 1024)) { toast.error("Each source file must contain data and be 50 MB or smaller."); return; }
    if (files.some(file => !/\.(pdf|pptx?|jpe?g|png|webp)$/i.test(file.name))) { toast.error("Only PDF, PPTX, PPT, JPG, PNG, and WebP files are supported."); return; }
    busy.current = true;
    setIsUploading(true);
    const uploaded: AiSourceReviewFile[] = [];
    let failures = 0;
    try {
      // Keep successful uploads even when another file fails; never mutate originals.
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("orgId", String(orgId));
          formData.append("purpose", "course");
          const response = await fetch("/api/upload-ai-generation-source", { method: "POST", body: formData, credentials: "same-origin" });
          const payload = await response.json();
          if (!response.ok || !payload.sourceFile?.url || !payload.sourceFile?.mimeType) throw new Error("Source upload failed.");
          uploaded.push({ ...payload.sourceFile, storageKey: payload.sourceFile.storageKey ?? payload.fileKey });
        } catch { failures++; }
      }
      if (activeOrg.current === orgId) setSourceFiles(current => [...current, ...uploaded]);
      if (failures) toast.error(`${failures} source upload(s) failed. Successful sources remain available; retry the others.`);
    } finally { busy.current = false; setIsUploading(false); }
  };
  return { sourceFiles, isUploading, upload, remove: (index: number) => setSourceFiles(current => current.filter((_, i) => i !== index)) };
}

export function Course360IntegratedSources({ sources }: { sources: ReturnType<typeof useCourse360IntegratedSources> }) {
  return <AiSourceFileReview sourceFiles={sources.sourceFiles} isUploading={sources.isUploading} onFiles={sources.upload} onRemove={sources.remove} allowPowerPointSources description="Add up to three school-owned PDF, PPTX, PPT or image sources (50 MB each). Requires Pro or Enterprise. Review all content before applying." />;
}

/** Client preflight prevents an invalid reviewed draft from creating a shell; server remains authoritative. */
export function requireCourse360IntegratedReview(value: Draft | null, productType: "course" | "quiz") {
  const invalid = () => { throw new Error("Review the complete curriculum and valid quiz answers before creating or applying this draft."); };
  if (!value || value.__course360ReviewInvalid || typeof (value.title || value.courseTitle) !== "string" || !(value.title || value.courseTitle).trim()) invalid();
  const questions = (items: any) => {
    if (!Array.isArray(items) || !items.length || items.length > 100) invalid();
    for (const q of items) if (!q?.question?.trim() || !Array.isArray(q.options) || q.options.length < 2 || q.options.some((o: any) => typeof o !== "string" || !o.trim()) || !q.options.includes(q.correctAnswer) || new Set(q.options).size !== q.options.length) invalid();
  };
  if (productType === "quiz") questions(value!.questions);
  else {
    if (!Array.isArray(value!.sections) || !value!.sections.length || value!.sections.length > 20) invalid();
    for (const section of value!.sections) {
      if (!section.title?.trim() || !Array.isArray(section.lessons) || !section.lessons.length || section.lessons.length > 10) invalid();
      for (const lesson of section.lessons) {
        if (!lesson.title?.trim() || typeof lesson.content !== "string" || !lesson.content.replace(/<[^>]*>/g, " ").trim()) invalid();
        if (lesson.quiz) questions(lesson.quiz.questions);
      }
    }
    if (value!.courseQuiz) questions(value!.courseQuiz.questions);
  }
}

/** Complete HTML stays in state, review and submission; never shortened into a saved summary. */
export function Course360IntegratedDraftReview({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  const [jsonError, setJsonError] = useState("");
  const [rawJson, setRawJson] = useState(() => JSON.stringify(draft, null, 2));
  useEffect(() => { if (!draft.__course360ReviewInvalid) setRawJson(JSON.stringify(draft, null, 2)); }, [draft]);
  const updateLesson = (si: number, li: number, changes: Draft) => onChange({ ...draft, sections: draft.sections.map((s: Draft, i: number) => i !== si ? s : { ...s, lessons: s.lessons.map((l: Draft, j: number) => j !== li ? l : { ...l, ...changes }) }) });
  return <div className="space-y-3" aria-label="Editable full AI draft review">
    <p className="text-xs text-gray-500">Nothing is applied until you confirm. Review and edit full lesson HTML, quizzes, and landing copy below.</p>
    {draft.sections?.map((section: Draft, si: number) => <details key={si} className="rounded border p-3">
      <summary className="cursor-pointer text-sm font-medium">Module {si + 1}: {section.title} · {section.lessons.length} lessons</summary>
      <Input aria-label={`Module ${si + 1} title`} value={section.title} className="mt-2" onChange={e => onChange({ ...draft, sections: draft.sections.map((s: Draft, i: number) => i === si ? { ...s, title: e.target.value } : s) })} />
      {section.lessons.map((lesson: Draft, li: number) => <details key={li} className="mt-2 rounded border p-2">
        <summary className="cursor-pointer text-sm">Lesson {li + 1}: {lesson.title}</summary>
        <Input aria-label={`Module ${si + 1} lesson ${li + 1} title`} className="mt-2" value={lesson.title} onChange={e => updateLesson(si, li, { title: e.target.value })} />
        <Textarea aria-label={`Module ${si + 1} lesson ${li + 1} full HTML`} className="mt-2 min-h-48 font-mono text-xs" value={lesson.content} onChange={e => updateLesson(si, li, { content: e.target.value })} />
      </details>)}
    </details>)}
    <details className="rounded border p-3"><summary className="cursor-pointer text-sm font-medium">Review / edit complete draft JSON (including all quiz questions and landing copy)</summary>
      <Textarea aria-label="Complete AI draft JSON" className="mt-2 min-h-64 font-mono text-xs" value={rawJson} onChange={e => { setRawJson(e.target.value); }} onBlur={e => {
        try { const parsed = JSON.parse(e.target.value); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); delete parsed.__course360ReviewInvalid; requireCourse360IntegratedReview(parsed, Array.isArray(parsed.sections) ? "course" : "quiz"); onChange(parsed); setJsonError(""); }
        catch { onChange({ ...draft, __course360ReviewInvalid: true }); setJsonError("Invalid or incomplete JSON. Your previous draft is retained; correct the JSON before applying."); }
      }} />
      {jsonError && <p role="alert" className="mt-2 text-xs text-red-600">{jsonError}</p>}
    </details>
  </div>;
}
