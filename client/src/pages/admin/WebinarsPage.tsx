import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { getOrgWebinarUrl } from "@/lib/orgUrl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Video,
  Users,
  Globe,
  EyeOff,
  ExternalLink,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function WebinarsPage() {
  const { orgId, orgs, ready } = useOrgScope();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", slug: "", type: "evergreen" as "live" | "evergreen" });

  const { data: webinars, refetch } = trpc.lms.webinars.list.useQuery(
    { orgId: orgId! },
    { enabled: ready }
  );

  const createMutation = trpc.lms.webinars.create.useMutation({
    onSuccess: (w) => {
      setCreateOpen(false);
      setForm({ title: "", slug: "", type: "evergreen" });
      refetch();
      toast.success("Webinar created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.lms.webinars.delete.useMutation({
    onSuccess: () => { setDeleteId(null); refetch(); toast.success("Webinar deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const togglePublish = trpc.lms.webinars.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });
  const activeOrg = orgs.find((candidate: any) => candidate.id === orgId);
  const activeOrgDomain = activeOrg as { customDomain?: string | null; domainVerificationStatus?: string | null } | undefined;
  const getRegistrationUrl = (slug: string) => activeOrg
    ? getOrgWebinarUrl(activeOrg.slug, slug, activeOrgDomain?.customDomain, activeOrgDomain?.domainVerificationStatus)
    : `/webinar/${slug}/register`;

  return (
    <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Webinars</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create live and evergreen on-demand webinars with sales funnels.
            </p>
          </div>
          <div className="flex items-center gap-3">

            <Button variant="outline" onClick={() => navigate(`/lms/webinars/reports${orgId ? `?orgId=${orgId}` : ``}`)}>
              <BarChart2 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Reports</span>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Webinar
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {(!webinars || webinars.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No webinars yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first webinar to get started.</p>
            </CardContent>
          </Card>
        )}

        {/* Mobile cards */}
        {webinars && webinars.length > 0 && (
          <>
            <div className="sm:hidden space-y-3">
              {webinars.map((w) => (
                <Card key={w.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {w.thumbnailUrl ? (
                          <img src={w.thumbnailUrl} alt={w.title} className="w-10 h-10 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <Video className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{w.title}</p>
                          <p className="text-xs text-muted-foreground">/{w.slug}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs">{w.type === "live" ? "🔴 Live" : "♻️ Evergreen"}</Badge>
                            {w.isPublished ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Published</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-xs">Draft</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/lms/webinars/${w.id}/edit`}><Edit className="w-4 h-4 mr-2" />Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => togglePublish.mutate({ id: w.id, isPublished: !w.isPublished })}>
                            {w.isPublished ? <><EyeOff className="w-4 h-4 mr-2" />Unpublish</> : <><Globe className="w-4 h-4 mr-2" />Publish</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={getRegistrationUrl(w.slug)} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />View Page
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(w.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registrations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webinars.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {w.thumbnailUrl ? (
                            <img src={w.thumbnailUrl} alt={w.title} className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                              <Video className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{w.title}</p>
                            <p className="text-xs text-muted-foreground">/{w.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{w.type === "live" ? "🔴 Live" : "♻️ Evergreen"}</Badge>
                      </TableCell>
                      <TableCell>
                        {w.isPublished ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200"><Globe className="w-3 h-3 mr-1" />Published</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground"><EyeOff className="w-3 h-3 mr-1" />Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="w-3.5 h-3.5" />—</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/lms/webinars/${w.id}/edit`}><Edit className="w-4 h-4 mr-2" />Edit</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/lms/webinars/${w.id}/reports`}><BarChart2 className="w-4 h-4 mr-2" />Reports</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePublish.mutate({ id: w.id, isPublished: !w.isPublished })}>
                              {w.isPublished ? <><EyeOff className="w-4 h-4 mr-2" />Unpublish</> : <><Globe className="w-4 h-4 mr-2" />Publish</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                            <a href={getRegistrationUrl(w.slug)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />View Registration Page
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(w.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Webinar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setForm((f) => ({ ...f, title, slug: slugify(title) }));
                }}
                placeholder="My Awesome Webinar"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="my-awesome-webinar"
              />
              <p className="text-xs text-muted-foreground">
                /webinar/<strong>{form.slug || "slug"}</strong>/register
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "live" | "evergreen" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evergreen">♻️ Evergreen (on-demand replay)</SelectItem>
                  <SelectItem value="live">🔴 Live (scheduled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!form.title.trim() || !form.slug.trim()) {
                  toast.error("Title and slug are required");
                  return;
                }
                if (!orgId) { toast.error("No org selected"); return; }
                createMutation.mutate({ orgId: orgId!, ...form });
              }}
              disabled={createMutation.isPending}
            >
              Create Webinar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Webinar?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the webinar, all registrations, and session data. This
            cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
