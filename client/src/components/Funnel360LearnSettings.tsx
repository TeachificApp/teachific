import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function Funnel360LearnSettings({ pageId, onClose }: { pageId: number; onClose: () => void }) {
  const settings = trpc.funnelAi.getPageLearnSettings.useQuery({ pageId }, { retry: false });
  const save = trpc.funnelAi.updatePageLearnSettings.useMutation();
  const utils = trpc.useUtils();
  const hydrated = useRef(false);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [dirty, setDirty] = useState({ name: false, show: false });
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    if (!settings.data || hydrated.current) return;
    hydrated.current = true;
    setOrgId(settings.data.orgId);
    setName(settings.data.displayName || "");
    setShow(settings.data.showInLibrary);
  }, [settings.data]);
  function close() {
    if (pending.current) return;
    if ((dirty.name || dirty.show) && !window.confirm("Discard unsaved Learn settings?")) return;
    onClose();
  }
  async function handleSave() {
    if (pending.current || !orgId || (!dirty.name && !dirty.show)) return;
    pending.current = true;
    setError("");
    try {
      await save.mutateAsync({ pageId, expectedOrgId: orgId,
        ...(dirty.name ? { displayName: name.trim() || null } : {}),
        ...(dirty.show ? { showInLibrary: show } : {}),
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save. Your edits are preserved.");
      pending.current = false;
      return;
    }
    pending.current = false;
    setDirty({ name: false, show: false });
    void Promise.resolve().then(() => utils.invalidate()).catch(() => undefined);
    onClose();
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }} onInteractOutside={event => { if (pending.current) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Learn page settings</DialogTitle><DialogDescription>Shared page card settings for the owning school.</DialogDescription></DialogHeader>
      <p className="text-sm text-muted-foreground">One optional display name is shared across this school's collections and Learn library. The authored title, SEO, page content and URLs are unchanged.</p>
      {settings.error && <p role="alert">{settings.error.message}</p>}
      <fieldset disabled={!settings.data || save.isPending} className="space-y-4">
        <label className="block text-sm">Learn display name (optional)
          <Input value={name} maxLength={255} placeholder={settings.data?.title || "Use authored page title"} onChange={e => { setName(e.target.value); setDirty(d => ({ ...d, name: true })); }} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={show} onChange={e => { setShow(e.target.checked); setDirty(d => ({ ...d, show: true })); }} />Show in Learn library
        </label>
      </fieldset>
      <p className="text-xs text-muted-foreground">Advanced settings require Pro+. Library visibility defaults off; turning it off does not remove collection associations. Only published pages should be listed publicly.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={close} disabled={save.isPending}>Cancel</Button><Button onClick={handleSave} disabled={!settings.data || save.isPending || (!dirty.name && !dirty.show)}>{save.isPending ? "Saving…" : "Save Learn settings"}</Button></div>
    </DialogContent>
  </Dialog>;
}
