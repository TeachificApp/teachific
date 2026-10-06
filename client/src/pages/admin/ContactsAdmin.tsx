import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Download,
  FileText,
  GraduationCap,
  History,
  Import,
  Loader2,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Lifecycle = "lead" | "subscriber" | "learner" | "customer" | "inactive";
type ProfileTab = "identity" | "learning" | "purchases" | "email" | "forms" | "notes" | "consent";

type ContactDraft = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  lifecycleStage: Lifecycle;
};

const lifecycleOptions: Array<{ value: Lifecycle; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "subscriber", label: "Subscriber" },
  { value: "learner", label: "Learner" },
  { value: "customer", label: "Customer" },
  { value: "inactive", label: "Inactive" },
];

const profileTabs: Array<{ id: ProfileTab; label: string; icon: typeof UserRound }> = [
  { id: "identity", label: "Identity", icon: UserRound },
  { id: "learning", label: "Learning", icon: GraduationCap },
  { id: "purchases", label: "Purchases", icon: ReceiptText },
  { id: "email", label: "Email", icon: Mail },
  { id: "forms", label: "Forms", icon: FileText },
  { id: "notes", label: "Notes & History", icon: History },
  { id: "consent", label: "Consent", icon: ShieldCheck },
];

const emptyDraft: ContactDraft = {
  firstName: "",
  lastName: "",
  displayName: "",
  email: "",
  phone: "",
  lifecycleStage: "lead",
};

function lifecycleLabel(value: string) {
  return lifecycleOptions.find((item) => item.value === value)?.label ?? value;
}

function lifecycleBadgeClass(value: string) {
  return {
    lead: "bg-sky-50 text-sky-700 border-sky-200",
    subscriber: "bg-violet-50 text-violet-700 border-violet-200",
    learner: "bg-teal-50 text-teal-700 border-teal-200",
    customer: "bg-emerald-50 text-emerald-700 border-emerald-200",
    inactive: "bg-slate-100 text-slate-600 border-slate-200",
  }[value] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function displayContactName(contact: { displayName?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return contact.displayName?.trim() || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "Unnamed contact";
}

function initials(contact: { displayName?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }) {
  const name = displayContactName(contact).trim();
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function toDraft(contact?: any): ContactDraft {
  if (!contact) return emptyDraft;
  return {
    firstName: contact.firstName ?? "",
    lastName: contact.lastName ?? "",
    displayName: contact.displayName ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    lifecycleStage: contact.lifecycleStage ?? "lead",
  };
}

function downloadText(filename: string, content: string, mimeType: string) {
  const href = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

function parseContactsCsv(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const read = (...keys: string[]) => {
      const index = headers.findIndex((header) => keys.includes(header));
      return index >= 0 ? values[index]?.trim() : "";
    };
    const lifecycle = read("lifecyclestage", "lifecycle") as Lifecycle;
    return {
      firstName: read("firstname") || undefined,
      lastName: read("lastname") || undefined,
      displayName: read("displayname", "name") || undefined,
      email: read("email") || undefined,
      phone: read("phone", "telephone") || undefined,
      lifecycleStage: lifecycleOptions.some((item) => item.value === lifecycle) ? lifecycle : "lead" as Lifecycle,
      source: "import",
    };
  }).filter((row) => row.email || row.phone);
}

export default function ContactsAdmin() {
  const [location, setLocation] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const requestedId = Number(searchParams.get("contactId"));
  const requestedEmail = searchParams.get("email") ?? undefined;
  const requestedUserId = Number(searchParams.get("userId"));
  const [selectedId, setSelectedId] = useState<number | null>(Number.isFinite(requestedId) && requestedId > 0 ? requestedId : null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [lifecycle, setLifecycle] = useState<Lifecycle | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const sourceLinkSyncAttempted = useRef(false);
  const utils = trpc.useUtils();
  const searchInput = useMemo(() => ({ search: search || undefined, lifecycleStage: lifecycle, page, pageSize: 25 }), [search, lifecycle, page]);
  const contactsQuery = trpc.contacts.list.useQuery(searchInput);
  const identityQuery = trpc.contacts.getByIdentity.useQuery(
    { email: requestedEmail, userId: Number.isFinite(requestedUserId) && requestedUserId > 0 ? requestedUserId : undefined },
    { enabled: !selectedId && Boolean(requestedEmail || requestedUserId) },
  );
  const syncSources = trpc.contacts.syncExistingSources.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.contacts.list.invalidate(), utils.contacts.getByIdentity.invalidate()]);
      toast.success(`Synced ${result.scanned} source records: ${result.created} new, ${result.updated} refreshed.`);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (identityQuery.data?.id) setSelectedId(identityQuery.data.id);
  }, [identityQuery.data?.id]);

  useEffect(() => {
    if (!selectedId && (requestedEmail || requestedUserId) && identityQuery.isFetched && !identityQuery.data && !syncSources.isPending && !sourceLinkSyncAttempted.current) {
      sourceLinkSyncAttempted.current = true;
      syncSources.mutate();
    }
  // A source-link arrives only once via the URL. Subsequent refetches happen through query invalidation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityQuery.isFetched, identityQuery.data, requestedEmail, requestedUserId, selectedId]);

  const selectContact = (id: number) => {
    setSelectedId(id);
    setLocation(`/admin/contacts?contactId=${id}`);
  };

  const closeProfile = () => {
    setSelectedId(null);
    setLocation("/admin/contacts");
  };

  if (selectedId) {
    return <ContactProfile contactId={selectedId} onBack={closeProfile} />;
  }

  return (
    <div className="min-h-full bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--org-primary)] text-white shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Contacts</h1>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">{contactsQuery.data?.total ?? 0} in this organization</Badge>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">A private contact record for each school. The same email may exist in another school without being linked or exposed here.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => syncSources.mutate()} disabled={syncSources.isPending}>
                {syncSources.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                Sync sources
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDuplicatesOpen(true)}><MoreHorizontal className="mr-1.5 h-4 w-4" />Review duplicates</Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Import className="mr-1.5 h-4 w-4" />Import</Button>
              <ExportContactsButton />
              <Button size="sm" className="bg-[var(--org-primary)] text-white hover:opacity-90" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New contact</Button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, email, or phone" className="h-10 pl-9" />
            </div>
            <select value={lifecycle} onChange={(event) => { setLifecycle(event.target.value as Lifecycle | "all"); setPage(1); }} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[var(--org-primary)]/30">
              <option value="all">All lifecycle stages</option>
              {lifecycleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Contact</th><th className="px-4 py-3">Lifecycle</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Updated</th><th className="px-5 py-3 text-right">&nbsp;</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contactsQuery.isLoading && <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[var(--org-primary)]" />Loading contacts…</td></tr>}
                {!contactsQuery.isLoading && !contactsQuery.data?.contacts.length && <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-500"><Users className="mx-auto mb-3 h-7 w-7 text-slate-300" /><p className="font-medium text-slate-700">No contacts yet</p><p className="mt-1 text-xs">Sync current leads, subscribers, learners, and registrations, or create a contact.</p></td></tr>}
                {contactsQuery.data?.contacts.map((contact) => (
                  <tr key={contact.id} className="cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--org-primary)_4%,transparent)]" onClick={() => selectContact(contact.id)}>
                    <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--org-primary)_12%,transparent)] text-xs font-semibold text-[var(--org-primary)]">{initials(contact)}</div><div className="min-w-0"><p className="truncate font-medium text-slate-900">{displayContactName(contact)}</p><p className="truncate text-xs text-slate-500">{contact.email || "No email address"}</p></div></div></td>
                    <td className="px-4 py-3.5"><Badge variant="outline" className={lifecycleBadgeClass(contact.lifecycleStage)}>{lifecycleLabel(contact.lifecycleStage)}</Badge></td>
                    <td className="px-4 py-3.5 capitalize text-slate-600">{contact.source.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3.5 text-slate-600">{contact.phone || "—"}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{formatDate(contact.updatedAt)}</td>
                    <td className="px-5 py-3.5 text-right"><Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); selectContact(contact.id); }}>Open</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(contactsQuery.data?.total ?? 0) > 25 && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><p className="text-xs text-slate-500">Page {page} of {Math.max(1, Math.ceil((contactsQuery.data?.total ?? 0) / 25))}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((previous) => previous - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= Math.ceil((contactsQuery.data?.total ?? 0) / 25)} onClick={() => setPage((previous) => previous + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>}
        </section>
      </div>
      <ContactEditorDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ContactImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <DuplicateReviewDialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen} onSelect={selectContact} />
      <CustomFieldsDialog open={customFieldsOpen} onOpenChange={setCustomFieldsOpen} />
      <button type="button" className="sr-only" onClick={() => setCustomFieldsOpen(true)}>Manage custom fields</button>
    </div>
  );
}

function ExportContactsButton() {
  const exportContacts = trpc.contacts.exportContacts.useQuery(undefined, { enabled: false });
  const exportNow = async () => {
    try {
      const result = await exportContacts.refetch();
      if (!result.data) throw new Error("Export unavailable");
      downloadText(result.data.filename, result.data.csv, "text/csv;charset=utf-8");
      toast.success(`${result.data.total} contacts exported.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export contacts.");
    }
  };
  return <Button variant="outline" size="sm" onClick={exportNow} disabled={exportContacts.isFetching}>{exportContacts.isFetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}Export</Button>;
}

function ContactEditorDialog({ open, onOpenChange, contact, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; contact?: any; onSaved?: (id: number) => void }) {
  const [draft, setDraft] = useState<ContactDraft>(() => toDraft(contact));
  const utils = trpc.useUtils();
  useEffect(() => { if (open) setDraft(toDraft(contact)); }, [open, contact]);
  const create = trpc.contacts.create.useMutation({
    onSuccess: async (result) => { await utils.contacts.list.invalidate(); toast.success("Contact created."); onOpenChange(false); onSaved?.(result.contact.id); },
    onError: (error) => toast.error(error.message),
  });
  const update = trpc.contacts.update.useMutation({
    onSuccess: async (result) => { await Promise.all([utils.contacts.list.invalidate(), utils.contacts.get.invalidate({ id: result.contact.id })]); toast.success("Contact updated."); onOpenChange(false); onSaved?.(result.contact.id); },
    onError: (error) => toast.error(error.message),
  });
  const save = () => {
    if (!draft.email.trim() && !draft.phone.trim()) { toast.error("Enter an email address or phone number."); return; }
    const data = { firstName: draft.firstName || null, lastName: draft.lastName || null, displayName: draft.displayName || null, email: draft.email || null, phone: draft.phone || null, lifecycleStage: draft.lifecycleStage };
    if (contact) update.mutate({ id: contact.id, data }); else create.mutate(data);
  };
  const pending = create.isPending || update.isPending;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle><DialogDescription>Contact identity is stored only for the active organization.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="First name"><Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} /></Field><Field label="Last name"><Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} /></Field><Field label="Display name" className="sm:col-span-2"><Input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="Optional; defaults to first and last name" /></Field><Field label="Email" className="sm:col-span-2"><Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} type="email" placeholder="learner@example.com" /></Field><Field label="Phone"><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Optional" /></Field><Field label="Lifecycle"><select value={draft.lifecycleStage} onChange={(e) => setDraft({ ...draft, lifecycleStage: e.target.value as Lifecycle })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{lifecycleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} disabled={pending} className="bg-[var(--org-primary)] text-white hover:opacity-90">{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{contact ? "Save changes" : "Create contact"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ContactImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const importContacts = trpc.contacts.importContacts.useMutation({
    onSuccess: async (result) => { await utils.contacts.list.invalidate(); toast.success(`Import completed: ${result.created} new, ${result.updated} updated.${result.rejected.length ? ` ${result.rejected.length} rows need review.` : ""}`); onOpenChange(false); setRows([]); setFileName(""); },
    onError: (error) => toast.error(error.message),
  });
  const readFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const parsed = parseContactsCsv(String(reader.result ?? "")); setRows(parsed); setFileName(file.name); if (!parsed.length) toast.error("No contacts with an email or phone were found in this CSV."); };
    reader.readAsText(file);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Import contacts</DialogTitle><DialogDescription>CSV columns supported: firstName, lastName, displayName, email, phone, lifecycleStage. Existing contacts can only be matched inside this organization.</DialogDescription></DialogHeader><input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => readFile(event.target.files?.[0])} /><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><Upload className="mx-auto mb-2 h-6 w-6 text-slate-400" /><p className="text-sm font-medium text-slate-700">{fileName || "Choose a CSV file"}</p><p className="mt-1 text-xs text-slate-500">Maximum 1,000 contact rows per import.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>Choose file</Button></div>{rows.length > 0 && <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800"><CheckCircle2 className="mr-1.5 inline h-4 w-4" />{rows.length} valid contact rows ready to import.</div>}<div className="text-xs text-slate-500">Need a template? <button className="font-medium text-[var(--org-primary)] hover:underline" onClick={() => downloadText("course360-contact-import-template.csv", "firstName,lastName,displayName,email,phone,lifecycleStage\nJane,Doe,Jane Doe,jane@example.com,+14155550100,lead\n", "text/csv;charset=utf-8")}>Download CSV template</button>.</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => importContacts.mutate({ rows })} disabled={!rows.length || importContacts.isPending} className="bg-[var(--org-primary)] text-white hover:opacity-90">{importContacts.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Import {rows.length || ""} contacts</Button></DialogFooter></DialogContent></Dialog>;
}

function DuplicateReviewDialog({ open, onOpenChange, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; onSelect: (id: number) => void }) {
  const query = trpc.contacts.duplicateCandidates.useQuery(undefined, { enabled: open });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Potential duplicates</DialogTitle><DialogDescription>These records share an email or phone within this organization only. They are not merged automatically.</DialogDescription></DialogHeader>{query.isLoading && <div className="py-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Checking contacts…</div>}{!query.isLoading && !query.data?.length && <div className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">No duplicate candidates found.</div>}{query.data?.map((group) => <div key={group.match} className="rounded-xl border border-slate-200 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Matching {group.match.startsWith("email:") ? "email" : "phone"}: <span className="normal-case text-slate-700">{group.match.slice(group.match.indexOf(":") + 1)}</span></p><div className="space-y-1">{group.candidates.map((contact) => <button key={contact.id} onClick={() => { onOpenChange(false); onSelect(contact.id); }} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50"><span><span className="block text-sm font-medium text-slate-800">{displayContactName(contact)}</span><span className="text-xs text-slate-500">{contact.email || contact.phone || "No identifier"}</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></button>)}</div></div>)}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter></DialogContent></Dialog>;
}

function CustomFieldsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const fields = trpc.contacts.listCustomFields.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();
  const create = trpc.contacts.createCustomField.useMutation({ onSuccess: async () => { await utils.contacts.listCustomFields.invalidate(); setKey(""); setLabel(""); toast.success("Custom field created."); }, onError: (error) => toast.error(error.message) });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Contact custom fields</DialogTitle><DialogDescription>Definitions apply only to the active organization.</DialogDescription></DialogHeader><div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">{fields.data?.length ? fields.data.map((field) => <div key={field.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"><span>{field.label}<span className="ml-2 text-xs text-slate-400">{field.key}</span></span><Badge variant="secondary">{field.fieldType}</Badge></div>) : <p className="p-2 text-sm text-slate-500">No custom fields defined.</p>}</div><div className="grid gap-3 sm:grid-cols-2"><Field label="Field key"><Input value={key} onChange={(event) => setKey(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="organization_role" /></Field><Field label="Label"><Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Organization role" /></Field><Field label="Field type"><select value={fieldType} onChange={(event) => setFieldType(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="boolean">Yes / no</option><option value="select">Select</option><option value="url">URL</option></select></Field></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button disabled={!key || !label || create.isPending} onClick={() => create.mutate({ key, label, fieldType: fieldType as any })} className="bg-[var(--org-primary)] text-white hover:opacity-90">Add field</Button></DialogFooter></DialogContent></Dialog>;
}

function ContactProfile({ contactId, onBack }: { contactId: number; onBack: () => void }) {
  const [tab, setTab] = useState<ProfileTab>("identity");
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const query = trpc.contacts.get.useQuery({ id: contactId });
  const contact = query.data?.contact;
  if (query.isLoading) return <div className="min-h-full bg-slate-50/60 p-8"><div className="mx-auto flex max-w-6xl justify-center rounded-xl bg-white p-12 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading contact…</div></div>;
  if (!contact) return <div className="min-h-full bg-slate-50/60 p-8"><div className="mx-auto max-w-6xl rounded-xl bg-white p-10 text-center"><p className="text-slate-600">This contact is unavailable in the active organization.</p><Button className="mt-4" variant="outline" onClick={onBack}>Return to contacts</Button></div></div>;
  return <div className="min-h-full bg-slate-50/60 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl space-y-5"><Button variant="ghost" size="sm" className="-ml-2 text-slate-600" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />All contacts</Button><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--org-primary)_12%,transparent)] text-lg font-bold text-[var(--org-primary)]">{initials(contact)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-semibold text-slate-950">{displayContactName(contact)}</h1><Badge variant="outline" className={lifecycleBadgeClass(contact.lifecycleStage)}>{lifecycleLabel(contact.lifecycleStage)}</Badge></div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">{contact.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{contact.email}</span>}{contact.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{contact.phone}</span>}</div></div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit identity</Button><Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-1.5 h-4 w-4" />Anonymize</Button></div></div><div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">{profileTabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${tab === item.id ? "border-[var(--org-primary)] text-[var(--org-primary)]" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</div></section>{tab === "identity" && <IdentityTab payload={query.data} />}{tab === "learning" && <LearningTab rows={query.data?.enrollments ?? []} />}{tab === "purchases" && <PurchasesTab rows={query.data?.purchases ?? []} />}{tab === "email" && <EmailTab rows={query.data?.campaignParticipation ?? []} />}{tab === "forms" && <FormsTab rows={query.data?.forms ?? []} webinars={query.data?.webinarParticipation ?? []} />}{tab === "notes" && <NotesTab contactId={contact.id} activities={query.data?.activities ?? []} audits={query.data?.audits ?? []} />}{tab === "consent" && <ConsentTab contactId={contact.id} consents={query.data?.consents ?? []} />}</div><ContactEditorDialog open={editing} onOpenChange={setEditing} contact={contact} /><AnonymizeDialog open={deleteOpen} onOpenChange={setDeleteOpen} contact={contact} onCompleted={onBack} /></div>;
}

function IdentityTab({ payload }: { payload: any }) {
  const { contact, tags } = payload;
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Identity</h2><Badge variant="outline" className="capitalize">{contact.source.replace(/_/g, " ")}</Badge></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><Info label="First name" value={contact.firstName} /><Info label="Last name" value={contact.lastName} /><Info label="Email" value={contact.email} verified={contact.emailVerified} /><Info label="Phone" value={contact.phone} verified={contact.phoneVerified} /><Info label="Linked account" value={contact.userId ? `User #${contact.userId}` : "No linked account"} /><Info label="Added" value={formatDate(contact.createdAt)} /><Info label="Last updated" value={formatDate(contact.updatedAt)} /><Info label="Attribution" value={contact.attribution ? JSON.stringify(contact.attribution) : "—"} /></dl><div className="mt-6 border-t border-slate-100 pt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Custom fields</h3><button className="text-xs font-medium text-[var(--org-primary)] hover:underline" onClick={() => setCustomFieldsOpen(true)}>Manage definitions</button></div>{contact.customFields && Object.keys(contact.customFields as Record<string, unknown>).length ? <div className="grid gap-3 sm:grid-cols-2">{Object.entries(contact.customFields as Record<string, unknown>).map(([key, value]) => <Info key={key} label={key.replace(/_/g, " ")} value={typeof value === "string" ? value : JSON.stringify(value)} />)}</div> : <p className="text-sm text-slate-500">No custom values saved for this contact.</p>}</div></section><TagsPanel contactId={contact.id} tags={tags} /><CustomFieldsDialog open={customFieldsOpen} onOpenChange={setCustomFieldsOpen} /></div>;
}

function TagsPanel({ contactId, tags }: { contactId: number; tags: any[] }) {
  const allTags = trpc.contacts.listTags.useQuery();
  const utils = trpc.useUtils();
  const [newTag, setNewTag] = useState("");
  const add = trpc.contacts.addTag.useMutation({ onSuccess: () => { utils.contacts.get.invalidate({ id: contactId }); } });
  const remove = trpc.contacts.removeTag.useMutation({ onSuccess: () => { utils.contacts.get.invalidate({ id: contactId }); } });
  const create = trpc.contacts.createTag.useMutation({ onSuccess: async (tag) => { await utils.contacts.listTags.invalidate(); add.mutate({ contactId, tagId: tag.id }); setNewTag(""); }, onError: (error) => toast.error(error.message) });
  const available = (allTags.data ?? []).filter((tag) => !tags.some((assigned) => assigned.id === tag.id));
  return <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Tags className="h-4 w-4 text-[var(--org-primary)]" /><h2 className="font-semibold text-slate-900">Tags</h2></div><div className="mt-4 flex flex-wrap gap-2">{tags.length ? tags.map((tag) => <Badge key={tag.id} variant="outline" className="gap-1 border-slate-200 bg-slate-50 pr-1.5" style={tag.color ? { borderColor: tag.color, color: tag.color } : undefined}>{tag.name}<button onClick={() => remove.mutate({ contactId, tagId: tag.id })} aria-label={`Remove ${tag.name}`}><X className="h-3 w-3" /></button></Badge>) : <p className="text-sm text-slate-500">No tags yet.</p>}</div>{available.length > 0 && <select className="mt-4 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value="" onChange={(event) => { if (event.target.value) add.mutate({ contactId, tagId: Number(event.target.value) }); }}><option value="">Add an existing tag…</option>{available.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>}<div className="mt-3 flex gap-2"><Input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="New tag" className="h-9" /><Button size="sm" variant="outline" disabled={!newTag.trim() || create.isPending} onClick={() => create.mutate({ name: newTag.trim() })}><Plus className="h-4 w-4" /></Button></div></aside>;
}

function LearningTab({ rows }: { rows: any[] }) { return <DataPanel title="Learning activity" empty="No learning activity is linked to this contact yet." headers={["Course", "Status", "Progress", "Enrolled", "Last access"]} rows={rows.map((row) => [row.courseTitle, <Badge key={`status-${row.id}`} variant="outline" className="capitalize">{row.status}</Badge>, `${row.progressPercent ?? 0}%`, formatDate(row.enrolledAt), formatDate(row.lastAccessedAt)])} />; }
function PurchasesTab({ rows }: { rows: any[] }) { return <DataPanel title="Purchases" empty="No course purchases are linked to this contact yet." headers={["Course", "Status", "Amount", "Created", "Completed"]} rows={rows.map((row) => [row.courseTitle ?? "Course order", <Badge key={`status-${row.id}`} variant="outline" className="capitalize">{row.status}</Badge>, row.amount != null ? `${row.currency?.toUpperCase() ?? "USD"} ${row.amount}` : "—", formatDate(row.createdAt), formatDate(row.completedAt)])} />; }
function EmailTab({ rows }: { rows: any[] }) { return <DataPanel title="Email participation" empty="No campaign delivery is linked to this contact yet." headers={["Campaign", "Status", "Sent", "Opened", "Clicked"]} rows={rows.map((row) => [row.subject || `Campaign #${row.campaignId}`, <Badge key={`status-${row.id}`} variant="outline" className="capitalize">{row.status}</Badge>, formatDate(row.sentAt), formatDate(row.openedAt), formatDate(row.clickedAt)])} />; }
function FormsTab({ rows, webinars }: { rows: any[]; webinars: any[] }) { return <div className="grid gap-5 lg:grid-cols-2"><DataPanel title="Form submissions" empty="No form submissions are linked to this contact yet." headers={["Form", "Status", "Submitted"]} rows={rows.map((row) => [row.formTitle ?? row.formName ?? "Form", row.status ?? "Submitted", formatDate(row.submittedAt)])} /><DataPanel title="Webinar participation" empty="No webinar registrations are linked to this contact yet." headers={["Webinar", "Registered", "Attendance"]} rows={webinars.map((row) => [row.webinarTitle, formatDate(row.registeredAt), row.attended ? "Attended" : "Registered"])} /></div>; }

function NotesTab({ contactId, activities, audits }: { contactId: number; activities: any[]; audits: any[] }) {
  const [note, setNote] = useState(""); const utils = trpc.useUtils(); const add = trpc.contacts.addNote.useMutation({ onSuccess: async () => { setNote(""); await utils.contacts.get.invalidate({ id: contactId }); }, onError: (error) => toast.error(error.message) });
  return <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Add a note</h2><Textarea className="mt-3 min-h-28" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an internal note for organization administrators…" /><Button className="mt-3 bg-[var(--org-primary)] text-white hover:opacity-90" size="sm" disabled={!note.trim() || add.isPending} onClick={() => add.mutate({ contactId, note: note.trim() })}>{add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save note</Button></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Activity timeline</h2><div className="mt-4 space-y-4">{activities.length ? activities.map((activity) => <div key={activity.id} className="relative border-l-2 border-[var(--org-primary)]/25 pl-4"><CircleDot className="absolute -left-[7px] top-0 h-3 w-3 text-[var(--org-primary)]" /><p className="text-sm text-slate-800">{activity.summary}</p><p className="mt-1 text-xs text-slate-500">{formatDate(activity.createdAt)}</p></div>) : <p className="text-sm text-slate-500">No activity recorded yet.</p>}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"><h2 className="font-semibold text-slate-900">Field history</h2><div className="mt-4 divide-y divide-slate-100">{audits.length ? audits.map((audit) => <div key={audit.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-medium capitalize text-slate-800">{audit.action.replace(/_/g, " ")}{audit.fieldName ? ` · ${audit.fieldName.replace(/_/g, " ")}` : ""}</p>{audit.previousValue != null || audit.nextValue != null ? <p className="mt-1 break-all text-xs text-slate-500">{audit.previousValue != null ? `From: ${JSON.stringify(audit.previousValue)}` : ""}{audit.previousValue != null && audit.nextValue != null ? " · " : ""}{audit.nextValue != null ? `To: ${JSON.stringify(audit.nextValue)}` : ""}</p> : null}</div><p className="shrink-0 text-xs text-slate-500">{formatDate(audit.createdAt)}</p></div>) : <p className="text-sm text-slate-500">No field changes recorded yet.</p>}</div></section></div>;
}

function ConsentTab({ contactId, consents }: { contactId: number; consents: any[] }) {
  const utils = trpc.useUtils(); const update = trpc.contacts.setConsent.useMutation({ onSuccess: () => utils.contacts.get.invalidate({ id: contactId }), onError: (error) => toast.error(error.message) });
  const byType = new Map(consents.map((item) => [item.consentType, item]));
  const types = [{ id: "marketing_email", label: "Marketing email" }, { id: "marketing_sms", label: "Marketing SMS" }, { id: "terms", label: "Terms acceptance" }, { id: "privacy", label: "Privacy acknowledgement" }, { id: "data_processing", label: "Data processing" }];
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Consent</h2><p className="mt-1 text-sm text-slate-500">Record consent with a source and timestamp. Withdrawal remains in the audit history.</p><div className="mt-5 divide-y divide-slate-100">{types.map((item) => { const consent = byType.get(item.id); const status = consent?.status ?? "pending"; return <div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-slate-800">{item.label}</p><p className="mt-1 text-xs text-slate-500">{consent ? `${status} via ${consent.source} · updated ${formatDate(consent.updatedAt)}` : "Not recorded"}</p></div><div className="flex gap-2"><Button size="sm" variant={status === "granted" ? "default" : "outline"} className={status === "granted" ? "bg-[var(--org-primary)] hover:opacity-90" : ""} disabled={update.isPending} onClick={() => update.mutate({ contactId, consentType: item.id as any, status: "granted", source: "manual" })}>Grant</Button><Button size="sm" variant={status === "withdrawn" ? "destructive" : "outline"} disabled={update.isPending} onClick={() => update.mutate({ contactId, consentType: item.id as any, status: "withdrawn", source: "manual" })}>Withdraw</Button></div></div>; })}</div></section>;
}

function AnonymizeDialog({ open, onOpenChange, contact, onCompleted }: { open: boolean; onOpenChange: (open: boolean) => void; contact: any; onCompleted: () => void }) { const [confirmation, setConfirmation] = useState(""); const anonymize = trpc.contacts.anonymize.useMutation({ onSuccess: () => { toast.success("Contact data anonymized."); onOpenChange(false); onCompleted(); }, onError: (error) => toast.error(error.message) }); useEffect(() => { if (!open) setConfirmation(""); }, [open]); return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Anonymize contact data</DialogTitle><DialogDescription>This removes direct identifiers, custom values, tag links, and activity/audit payloads from {displayContactName(contact)}. The action is designed for privacy requests and cannot be undone.</DialogDescription></DialogHeader><div className="py-2"><Label>Type ANONYMIZE to continue</Label><Input className="mt-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" disabled={confirmation !== "ANONYMIZE" || anonymize.isPending} onClick={() => anonymize.mutate({ contactId: contact.id, confirmation: "ANONYMIZE" })}>{anonymize.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Anonymize data</Button></DialogFooter></DialogContent></Dialog>; }

function DataPanel({ title, empty, headers, rows }: { title: string; empty: string; headers: string[]; rows: any[][] }) { return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">{title}</h2></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-5 py-3 font-medium">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-3.5 text-slate-600">{cell || "—"}</td>)}</tr>)}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-500">{empty}</div>}</section>; }
function Info({ label, value, verified }: { label: string; value?: string | null; verified?: boolean }) { return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 flex items-center gap-1 text-sm text-slate-700 break-words">{value || "—"}{verified && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600" aria-label="Verified" />}</dd></div>; }
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><Label>{label}</Label><div className="mt-1.5">{children}</div></div>; }
