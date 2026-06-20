import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmbedSnippetPanel } from "@/components/EmbedSnippetPanel";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Users, Loader2, Calendar, MapPin, Video,
  Globe, DollarSign, Clock, ArrowLeft, CheckCircle, XCircle, UserCheck,
  BarChart2, Settings, Eye, ExternalLink,
} from "lucide-react";

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    published: "bg-green-100 text-green-700 border-green-200",
    draft: "bg-gray-100 text-gray-600 border-gray-200",
    archived: "bg-red-100 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variants[status] ?? variants.draft}`}>
      {status}
    </span>
  );
}

// ─── Format Badge ─────────────────────────────────────────────────────────────
function FormatBadge({ format }: { format: string }) {
  const icons: Record<string, React.ReactNode> = {
    in_person: <MapPin className="w-3 h-3 mr-1" />,
    virtual: <Video className="w-3 h-3 mr-1" />,
    hybrid: <Globe className="w-3 h-3 mr-1" />,
  };
  const labels: Record<string, string> = {
    in_person: "In Person",
    virtual: "Virtual",
    hybrid: "Hybrid",
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      {icons[format]}
      {labels[format] ?? format}
    </span>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────
function CreateWorkshopDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<"in_person" | "virtual" | "hybrid">("in_person");
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState("0.00");

  const createMut = trpc.lms.workshops.create.useMutation({
    onSuccess: () => {
      utils.lms.workshops.list.invalidate();
      toast.success("Workshop created!");
      setTitle("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Workshop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced React Workshop" />
          </div>
          <div>
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In Person</SelectItem>
                <SelectItem value="virtual">Virtual</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isFree} onCheckedChange={setIsFree} id="is-free" />
            <Label htmlFor="is-free">Free workshop</Label>
          </div>
          {!isFree && (
            <div>
              <Label>Price (USD)</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49.00" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!title.trim() || createMut.isPending}
            onClick={() => createMut.mutate({ title: title.trim(), format, isFree, price: isFree ? "0.00" : price })}
          >
            {createMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Workshop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Workshop List ────────────────────────────────────────────────────────────
function WorkshopList({ onSelect }: { onSelect: (id: number) => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const { data: workshops, isLoading } = trpc.lms.workshops.list.useQuery();
  const utils = trpc.useUtils();
  const deleteMut = trpc.lms.workshops.delete.useMutation({
    onSuccess: () => { utils.lms.workshops.list.invalidate(); toast.success("Workshop deleted"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workshops</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage in-person, virtual, and hybrid workshop events</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Workshop
        </Button>
      </div>

      {(!workshops || workshops.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No workshops yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first workshop to start accepting registrations.</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" /> Create Workshop</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workshops.map((w: any) => (
            <Card key={w.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(w.id)}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{w.title}</h3>
                    <StatusBadge status={w.status} />
                    <FormatBadge format={w.format} />
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    {w.startDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(w.startDate).toLocaleDateString()}
                      </span>
                    )}
                    {w.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {w.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {w.isFree ? "Free" : `$${Number(w.price).toFixed(2)}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" onClick={() => onSelect(w.id)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this workshop?")) deleteMut.mutate({ id: w.id });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateWorkshopDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

// ─── Workshop Editor ──────────────────────────────────────────────────────────
function WorkshopEditor({ workshopId, onBack }: { workshopId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data: workshop, isLoading } = trpc.lms.workshops.get.useQuery({ id: workshopId });
  const { data: registrations } = trpc.lms.workshops.getRegistrations.useQuery({ workshopId });
  const updateMut = trpc.lms.workshops.update.useMutation({
    onSuccess: () => { utils.lms.workshops.get.invalidate({ id: workshopId }); toast.success("Saved!"); },
    onError: (e) => toast.error(e.message),
  });
  const updateRegMut = trpc.lms.workshops.updateRegistration.useMutation({
    onSuccess: () => { utils.lms.workshops.getRegistrations.invalidate({ workshopId }); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<any>(null);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!workshop) return <div className="p-6 text-muted-foreground">Workshop not found.</div>;

  // Initialize form from workshop data
  const w = form ?? workshop;

  const set = (key: string, value: any) => setForm((prev: any) => ({ ...(prev ?? workshop), [key]: value }));

  const save = () => {
    if (!form) return;
    updateMut.mutate({ id: workshopId, ...form });
  };

  const regCount = registrations?.length ?? 0;
  const attendedCount = registrations?.filter((r: any) => r.status === "attended").length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{workshop.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusBadge status={workshop.status} />
            <FormatBadge format={workshop.format} />
          </div>
        </div>
        <Button onClick={save} disabled={!form || updateMut.isPending}>
          {updateMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="mb-6">
          <TabsTrigger value="details"><Settings className="w-4 h-4 mr-2" />Details</TabsTrigger>
          <TabsTrigger value="registrations">
            <Users className="w-4 h-4 mr-2" />Registrations
            {regCount > 0 && <Badge className="ml-2 h-5 px-1.5 text-xs">{regCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
        </TabsList>

        {/* ── Details Tab ── */}
        <TabsContent value="details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={w.title ?? ""} onChange={(e) => set("title", e.target.value)} />
                </div>
                <div>
                  <Label>Short Description</Label>
                  <Input value={w.shortDescription ?? ""} onChange={(e) => set("shortDescription", e.target.value)} placeholder="One-line summary" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={4} value={w.description ?? ""} onChange={(e) => set("description", e.target.value)} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={w.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Schedule & Location</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Format</Label>
                  <Select value={w.format} onValueChange={(v) => set("format", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="datetime-local"
                      value={w.startDate ? new Date(w.startDate).toISOString().slice(0, 16) : ""}
                      onChange={(e) => set("startDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="datetime-local"
                      value={w.endDate ? new Date(w.endDate).toISOString().slice(0, 16) : ""}
                      onChange={(e) => set("endDate", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input value={w.timezone ?? "UTC"} onChange={(e) => set("timezone", e.target.value)} placeholder="America/New_York" />
                </div>
                {(w.format === "in_person" || w.format === "hybrid") && (
                  <div>
                    <Label>Location / Venue</Label>
                    <Input value={w.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="123 Main St, City, State" />
                  </div>
                )}
                {(w.format === "virtual" || w.format === "hybrid") && (
                  <div>
                    <Label>Virtual Meeting URL</Label>
                    <Input value={w.virtualUrl ?? ""} onChange={(e) => set("virtualUrl", e.target.value)} placeholder="https://zoom.us/j/..." />
                  </div>
                )}
                <div>
                  <Label>Max Attendees</Label>
                  <Input type="number" min="1" value={w.maxAttendees ?? ""} onChange={(e) => set("maxAttendees", e.target.value ? Number(e.target.value) : null)} placeholder="Unlimited" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={w.isFree ?? false}
                    onCheckedChange={(v) => set("isFree", v)}
                    id="edit-is-free"
                  />
                  <Label htmlFor="edit-is-free">Free workshop</Label>
                </div>
                {!w.isFree && (
                  <>
                    <div>
                      <Label>Price (USD)</Label>
                      <Input type="number" min="0" step="0.01" value={w.price ?? "0.00"} onChange={(e) => set("price", e.target.value)} />
                    </div>
                    <div>
                      <Label>Compare-at Price (optional)</Label>
                      <Input type="number" min="0" step="0.01" value={w.compareAtPrice ?? ""} onChange={(e) => set("compareAtPrice", e.target.value || null)} placeholder="Original price for strikethrough" />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Instructor</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Instructor Name</Label>
                  <Input value={w.instructorName ?? ""} onChange={(e) => set("instructorName", e.target.value)} />
                </div>
                <div>
                  <Label>Instructor Bio</Label>
                  <Textarea rows={3} value={w.instructorBio ?? ""} onChange={(e) => set("instructorBio", e.target.value)} />
                </div>
                <div>
                  <Label>Instructor Photo URL</Label>
                  <Input value={w.instructorImageUrl ?? ""} onChange={(e) => set("instructorImageUrl", e.target.value)} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Registrations Tab ── */}
        <TabsContent value="registrations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Registrations ({regCount})</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {attendedCount} attended · {regCount - attendedCount} registered
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!registrations || registrations.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No registrations yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Paid</th>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Registered</th>
                        <th className="text-left py-2 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((r: any) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 pr-4">{r.firstName} {r.lastName}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{r.email}</td>
                          <td className="py-2 pr-4">
                            <Select
                              value={r.status}
                              onValueChange={(v) => updateRegMut.mutate({ id: r.id, status: v })}
                            >
                              <SelectTrigger className="h-7 text-xs w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="registered">Registered</SelectItem>
                                <SelectItem value="attended">Attended</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="waitlisted">Waitlisted</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 pr-4">{r.amountPaid ? `$${Number(r.amountPaid).toFixed(2)}` : "Free"}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{new Date(r.registeredAt).toLocaleDateString()}</td>
                          <td className="py-2">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => updateRegMut.mutate({ id: r.id, status: r.status === "attended" ? "registered" : "attended" })}
                              title={r.status === "attended" ? "Mark as not attended" : "Mark as attended"}
                            >
                              {r.status === "attended"
                                ? <XCircle className="w-4 h-4 text-muted-foreground" />
                                : <CheckCircle className="w-4 h-4 text-green-600" />}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Registrations", value: regCount, icon: Users },
              { label: "Attended", value: attendedCount, icon: UserCheck },
              { label: "Attendance Rate", value: regCount > 0 ? `${Math.round((attendedCount / regCount) * 100)}%` : "—", icon: BarChart2 },
              { label: "Revenue", value: registrations ? `$${registrations.reduce((s: number, r: any) => s + Number(r.amountPaid ?? 0), 0).toFixed(2)}` : "$0.00", icon: DollarSign },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{value}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        {/* ── Embed Tab ── */}
        <TabsContent value="embed">
          <div className="max-w-2xl space-y-2">
            <h3 className="text-base font-semibold">Embed this Workshop</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Copy the snippet below to embed this workshop registration page on any external website.
            </p>
            <EmbedSnippetPanel
              contentUrl={`/workshops/${workshopId}`}
              title={workshop.title}
              defaultHeight={600}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function WorkshopsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  if (selectedId !== null) {
    return <WorkshopEditor workshopId={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <WorkshopList onSelect={setSelectedId} />;
}
