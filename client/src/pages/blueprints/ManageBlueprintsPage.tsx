import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Layers, Plus, Edit, Globe, Lock, Loader2, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

export default function ManageBlueprintsPage() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "site_owner" || user?.role === "site_admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "course",
    isPublic: false,
    previewImageUrl: "",
  });

  const { data: blueprints, isLoading, refetch } = trpc.blueprints.listAll.useQuery(undefined, {
    enabled: isPlatformAdmin,
  });

  const createMutation = trpc.blueprints.create.useMutation({
    onSuccess: () => {
      toast.success("Blueprint created! You can now add resources and publish it.");
      setCreateOpen(false);
      setForm({ name: "", description: "", category: "course", isPublic: false, previewImageUrl: "" });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const publishMutation = trpc.blueprints.publish.useMutation({
    onSuccess: () => { toast.success("Blueprint published"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.blueprints.archive.useMutation({
    onSuccess: () => { toast.success("Blueprint archived"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  if (!isPlatformAdmin) {
    return (
      <div className="container py-20 text-center text-muted-foreground">
        <Lock className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">Platform admin access required</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-6 h-6 text-[#24abbc]" />
            <h1 className="text-2xl font-bold">Manage Blueprints</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Create, edit, and publish blueprints for the marketplace.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Blueprint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Blueprint</DialogTitle>
              <DialogDescription>
                Define the blueprint metadata. You can add resources after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="bp-name">Name</Label>
                <Input
                  id="bp-name"
                  placeholder="e.g. Monthly Webinar Launch System"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="bp-desc">Description</Label>
                <Textarea
                  id="bp-desc"
                  placeholder="What does this blueprint include and who is it for?"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="bp-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger id="bp-category" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                    <SelectItem value="download">Digital Download</SelectItem>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="bundle">Bundle</SelectItem>
                    <SelectItem value="funnel">Funnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bp-image">Preview Image URL (optional)</Label>
                <Input
                  id="bp-image"
                  placeholder="https://..."
                  value={form.previewImageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, previewImageUrl: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Public on Marketplace</Label>
                  <p className="text-xs text-muted-foreground">Visible to all orgs on Builder+ plans</p>
                </div>
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Blueprint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !blueprints?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No blueprints yet</p>
          <p className="text-sm">Create your first blueprint to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blueprints.map((bp) => (
            <Card key={bp.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{bp.name}</CardTitle>
                        <Badge
                          variant={bp.status === "published" ? "default" : bp.status === "archived" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {bp.status}
                        </Badge>
                        {bp.isPublic ? (
                          <Badge variant="outline" className="text-xs border-green-500/30 text-green-600">
                            <Globe className="w-2.5 h-2.5 mr-1" />Public
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="w-2.5 h-2.5 mr-1" />Private
                          </Badge>
                        )}
                      </div>
                      {bp.description && (
                        <CardDescription className="text-xs mt-0.5 line-clamp-1">{bp.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{bp.installCount ?? 0} installs</span>
                    {bp.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => publishMutation.mutate({ id: bp.id })}
                        disabled={publishMutation.isPending}
                      >
                        <Globe className="w-3.5 h-3.5 mr-1" />
                        Publish
                      </Button>
                    )}
                    {bp.status === "published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => archiveMutation.mutate({ id: bp.id })}
                        disabled={archiveMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
