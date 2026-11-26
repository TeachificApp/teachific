import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export type CreatorSchoolPublishControlsProps = { projectId: number; expectedOrgId: number | null; beforePublish: () => Promise<void> };
type Destinations = { orgId: number; model: "lms_courses"; courses: { id: number; title: string; slug: string; sections: { id: number; title: string }[] }[] };
export function CreatorSchoolPublishControls({ projectId, expectedOrgId, beforePublish }: CreatorSchoolPublishControlsProps) {
  const utils = trpc.useUtils();
  const publish = trpc.authoring.publishToSchoolCourse.useMutation();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [destinations, setDestinations] = useState<Destinations | null>(null);
  const [courseId, setCourseId] = useState(""), [sectionId, setSectionId] = useState(""), [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false), [message, setMessage] = useState("");
  const scope = `${expectedOrgId}:${projectId}`;
  const current = useRef({ scope, courseId, sectionId, title, consent, open }); current.current = { scope, courseId, sectionId, title, consent, open };
  const intent = useRef(0), pending = useRef(false), request = useRef<{ identity: string; id: string } | null>(null);
  useEffect(() => { intent.current++; pending.current = false; setBusy(false); setOpen(false); setDestinations(null); setCourseId(""); setSectionId(""); setConsent(false); setMessage(""); request.current = null; }, [scope]);
  useEffect(() => () => { intent.current++; }, []);
  async function showDestinations() {
    if (!expectedOrgId || pending.current) return;
    setOpen(true); setMessage(""); setBusy(true); pending.current = true;
    const token = ++intent.current, wantedScope = scope;
    try {
      const data = await utils.authoring.listSchoolPublishDestinations.fetch({ expectedOrgId, projectId });
      if (token !== intent.current || current.current.scope !== wantedScope) return;
      if (data.orgId !== expectedOrgId || data.model !== "lms_courses") throw new Error("The selected school changed; reopen publishing.");
      setDestinations(data);
    } catch (e) { if (token === intent.current && current.current.scope === wantedScope) setMessage(e instanceof Error ? e.message : "Unable to list school destinations."); }
    finally { if (token === intent.current && current.current.scope === wantedScope) { pending.current = false; setBusy(false); } }
  }
  function close() { intent.current++; pending.current = false; setBusy(false); setOpen(false); setConsent(false); setMessage(""); }
  async function publishNewLesson() {
    if (!expectedOrgId || !consent || !courseId || !sectionId || !title.trim() || pending.current) return;
    const wanted = { ...current.current }, token = ++intent.current;
    const identity = JSON.stringify([scope, courseId, sectionId, title.trim()]);
    const stillCurrent = () => token === intent.current && JSON.stringify([current.current.scope, current.current.courseId, current.current.sectionId, current.current.title.trim()]) === identity && current.current.consent && current.current.open;
    pending.current = true; setBusy(true); setMessage("");
    try {
      await beforePublish();
      if (!stillCurrent()) return;
      if (request.current?.identity !== identity) request.current = { identity, id: crypto.randomUUID() };
      const result = await publish.mutateAsync({ expectedOrgId, projectId, courseId: Number(courseId), sectionId: Number(sectionId), lessonTitle: title.trim(), requestId: request.current.id, consentToPublish: true });
      if (!stillCurrent()) return;
      if (result.status !== "published" || result.orgId !== expectedOrgId || result.courseId !== Number(wanted.courseId) || result.sectionId !== Number(wanted.sectionId) || !result.lessonId) throw new Error("School publish did not return a matching new lesson receipt.");
      setMessage(`Published a new lesson (ID ${result.lessonId}). Existing lessons and Creator project settings were retained.`); setConsent(false); request.current = null;
    } catch (e) { if (stillCurrent()) setMessage(e instanceof Error ? e.message : "Publishing failed. No published success is claimed; retry with the same destination."); }
    finally { if (token === intent.current && current.current.scope === scope) { pending.current = false; setBusy(false); } }
  }
  const selectedCourse = destinations?.courses.find(c => String(c.id) === courseId);
  return <div className="inline-block">
    <Button type="button" variant="outline" disabled={!expectedOrgId || busy} onClick={showDestinations}>Publish to school course</Button>
    {open && <section role="dialog" aria-label="Publish Creator to school course" className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <p className="text-sm">Add a NEW protected HTML5 lesson to an existing published school course. This saves your current project first. No existing lesson, course settings, or download defaults will be changed.</p>
      <p className="text-xs">Learner activities run in the shared Creator player. School lesson completion remains manual; Creator scores do not certify LMS completion.</p>
      {busy && <p role="status">{destinations ? "Saving and publishing…" : "Loading owned school destinations…"}</p>}
      {destinations && <>
        <label className="block text-sm">Destination course<select aria-label="Destination course" disabled={busy} value={courseId} onChange={e => { setCourseId(e.target.value); setSectionId(""); setConsent(false); setMessage(""); }} className="ml-2 rounded border bg-background p-1 text-foreground"><option value="">Choose a course</option>{destinations.courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className="block text-sm">Destination section<select aria-label="Destination section" disabled={busy || !selectedCourse} value={sectionId} onChange={e => { setSectionId(e.target.value); setConsent(false); setMessage(""); }} className="ml-2 rounded border bg-background p-1 text-foreground"><option value="">Choose a section</option>{selectedCourse?.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="block text-sm">New lesson title<input aria-label="New lesson title" disabled={busy} maxLength={255} value={title} onChange={e => { setTitle(e.target.value); setConsent(false); setMessage(""); }} className="ml-2 rounded border bg-background p-1 text-foreground" /></label>
        {!destinations.courses.length && <p>No supported published course with an owned non-preview section is available in this school.</p>}
        <label className="flex gap-2 text-sm"><input type="checkbox" aria-label="Consent to add a new school lesson" disabled={busy} checked={consent} onChange={e => setConsent(e.target.checked)} />I consent to create new school-owned media and append a NEW lesson in the selected section, visible to its enrolled learners.</label>
        <Button type="button" disabled={busy || !consent || !courseId || !sectionId || !title.trim()} onClick={publishNewLesson}>Save and publish new lesson</Button>
      </>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <Button type="button" variant="outline" onClick={close}>Close publishing</Button>
    </section>}
  </div>;
}
