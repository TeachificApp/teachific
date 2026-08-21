import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WysiwygPageBuilder as PageBuilder } from "@/components/WysiwygPageBuilder";
import type { Block } from "@/components/WysiwygPageBuilder";
import { Plus, Edit, Trash2, Eye, EyeOff, Search, Building2, ChevronDown, X, Layout, Copy, Globe, GlobeLock, Save, SquarePen, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Searchable Org Selector ──────────────────────────────────────────────────
function OrgSearchSelector({
  orgs,
  selectedOrgId,
  onSelect,
}: {
  orgs: Array<{ id: number; name: string }>;
  selectedOrgId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId) ?? null;

  const filtered = useMemo(() => {
    if (!query.trim()) return orgs;
    const q = query.toLowerCase();
    return orgs.filter((o) => o.name.toLowerCase().includes(q));
  }, [orgs, query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 border rounded-md bg-background text-sm transition-colors text-left",
          open ? "border-primary ring-2 ring-primary/20" : "border-input hover:border-primary/50"
        )}
      >
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={cn("flex-1 truncate", !selectedOrg && "text-muted-foreground")}>
          {selectedOrg ? selectedOrg.name : "Select an organization…"}
        </span>
        {selectedOrg ? (
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
              setOpen(false);
            }}
          />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search organizations…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Results list */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No organizations match "{query}"
              </div>
            ) : (
              filtered.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    onSelect(org.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors hover:bg-muted",
                    org.id === selectedOrgId && "bg-primary/10 font-medium text-primary"
                  )}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.id === selectedOrgId && (
                    <span className="text-xs text-primary shrink-0">Selected</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer: result count */}
          <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            {filtered.length} of {orgs.length} organization{orgs.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomPagesPage() {
  const [, setLocation] = useLocation();
  const { orgId: autoOrgId, ready: orgReady } = useOrgScope();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  // Auto-select org from useOrgScope when it resolves
  useEffect(() => {
    if (orgReady && autoOrgId && !selectedOrgId) {
      setSelectedOrgId(autoOrgId);
    }
  }, [orgReady, autoOrgId, selectedOrgId]);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<number | null>(null);

  const { data: orgs } = trpc.orgs.list.useQuery();
  const { data: pages, refetch: refetchPages } = trpc.lms.pages.list.useQuery(
    { orgId: selectedOrgId! },
    { enabled: !!selectedOrgId }
  );

  const createPage = trpc.lms.pages.create.useMutation({
    onSuccess: () => {
      refetchPages();
      toast.success("Page created");
    },
  });

  const updatePage = trpc.lms.pages.update.useMutation({
    onSuccess: () => {
      refetchPages();
      setEditingPage(null);
      toast.success("Page updated");
    },
  });

  const deletePage = trpc.lms.pages.delete.useMutation({
    onSuccess: () => {
      refetchPages();
      setDeleteDialogOpen(false);
      setPageToDelete(null);
      toast.success("Page deleted");
    },
  });
  const duplicatePage = trpc.lms.pages.duplicate.useMutation({
    onSuccess: (copy) => {
      refetchPages();
      toast.success("Page duplicated");
      if (copy) setEditingPage(copy);
    },
  });

  const togglePublish = trpc.lms.pages.update.useMutation({
    onSuccess: () => {
      refetchPages();
      toast.success("Page status updated");
    },
  });

  const handleCreatePage = () => {
    if (!selectedOrgId) {
      toast.error("Please select an organization first");
      return;
    }
    setEditingPage({
      id: null,
      orgId: selectedOrgId,
      title: "",
      slug: "",
      blocksJson: "",
      isPublished: false,
      showHeader: true,
      showFooter: true,
      metaTitle: "",
      metaDescription: "",
      customCss: "",
      pageType: "custom",
    });
  };

  const handleSavePage = async () => {
    if (!editingPage) return;

    if (editingPage.id) {
      await updatePage.mutateAsync({
        id: editingPage.id,
        title: editingPage.title,
        slug: editingPage.slug,
        blocksJson: editingPage.blocksJson,
        isPublished: editingPage.isPublished,
        showHeader: editingPage.showHeader,
        showFooter: editingPage.showFooter,
        metaTitle: editingPage.metaTitle ?? "",
        metaDescription: editingPage.metaDescription ?? "",
        customCss: editingPage.customCss ?? "",
      });
    } else {
      const created = await createPage.mutateAsync({
        orgId: editingPage.orgId,
        pageType: "custom",
        title: editingPage.title,
        slug: editingPage.slug,
      });
      // After creating, open it for editing so the user can add content
      if (created) setEditingPage({ ...editingPage, id: (created as any).id });
    }
  };

  const handleDeletePage = async () => {
    if (!pageToDelete) return;
    await deletePage.mutateAsync({ id: pageToDelete });
  };

  const orgList: Array<{ id: number; name: string }> = orgs ?? [];

  return (
    <div className="container py-8 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Custom Pages</h1>
        <p className="text-muted-foreground">
          Create custom web pages with rich content, control header/footer visibility, and manage SEO.
        </p>
      </div>

      {/* Org selector */}
      <div className="mb-6 space-y-1.5">
        <Label>Organization</Label>
        <OrgSearchSelector
          orgs={orgList}
          selectedOrgId={selectedOrgId}
          onSelect={setSelectedOrgId}
        />
        {selectedOrgId && (
          <p className="text-xs text-muted-foreground">
            Showing pages for{" "}
            <span className="font-medium text-foreground">
              {orgList.find((o) => o.id === selectedOrgId)?.name}
            </span>
          </p>
        )}
      </div>

      {selectedOrgId && (
        <>
          <div className="mb-4">
            <Button onClick={handleCreatePage}>
              <Plus className="w-4 h-4 mr-2" />
              Create Page
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Header/Footer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages && pages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No pages yet. Click <strong>Create Page</strong> to get started.
                  </TableCell>
                </TableRow>
              )}
              {pages?.map((page: any) => (
                <TableRow key={page.id}>
                  <TableCell>{page.title || "(Untitled)"}</TableCell>
                  <TableCell className="font-mono text-sm">{page.slug || "—"}</TableCell>
                  <TableCell>
                    {page.isPublished ? (
                      <span className="text-green-600 font-medium">Published</span>
                    ) : (
                      <span className="text-muted-foreground">Draft</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {page.showHeader ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        Header
                      </span>
                      <span className="flex items-center gap-1">
                        {page.showFooter ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        Footer
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5 org-primary-button text-xs h-7 px-2"
                        onClick={() => setLocation(`/lms/page-builder/${page.id}`)}
                        title="Open in Page Builder"
                      >
                        <Layout className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`gap-1.5 text-xs h-7 px-2 ${page.isPublished ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
                        onClick={() => togglePublish.mutate({ id: page.id, isPublished: !page.isPublished })}
                        disabled={togglePublish.isPending}
                        title={page.isPublished ? "Unpublish" : "Publish"}
                      >
                        {page.isPublished ? <GlobeLock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                        {page.isPublished ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingPage(page)}
                        title="Edit Settings"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => duplicatePage.mutate({ id: page.id })}
                        disabled={duplicatePage.isPending}
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          setPageToDelete(page.id);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Edit Sheet */}
      <Sheet open={!!editingPage} onOpenChange={() => setEditingPage(null)}>
        <SheetContent className="w-full sm:max-w-[85vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingPage?.id ? "Edit Page" : "Create Page"}</SheetTitle>
            <SheetDescription>
              Build a custom page with rich content, control visibility, and manage SEO.
            </SheetDescription>
          </SheetHeader>

          {editingPage && (
            <div className="space-y-6 mt-6">
              <div>
                <Label htmlFor="page-title">Title</Label>
                <Input
                  id="page-title"
                  value={editingPage.title}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, title: e.target.value })
                  }
                  placeholder="About Us"
                />
              </div>

              <div>
                <Label htmlFor="page-slug">Slug (URL path)</Label>
                <Input
                  id="page-slug"
                  value={editingPage.slug}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, slug: e.target.value })
                  }
                  placeholder="about-us"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Example: /about-us
                </p>
              </div>

              {/* ── Top page controls toolbar ── */}
              <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-muted/40 border border-border rounded-lg">
                <div className="flex items-center gap-2">
                  <Switch id="show-header-top" checked={editingPage.showHeader} onCheckedChange={(checked) => setEditingPage({ ...editingPage, showHeader: checked })} />
                  <Label htmlFor="show-header-top" className="cursor-pointer">Show Header</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="show-footer-top" checked={editingPage.showFooter} onCheckedChange={(checked) => setEditingPage({ ...editingPage, showFooter: checked })} />
                  <Label htmlFor="show-footer-top" className="cursor-pointer">Show Footer</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is-published-top" checked={editingPage.isPublished} onCheckedChange={(checked) => setEditingPage({ ...editingPage, isPublished: checked })} />
                  <Label htmlFor="is-published-top" className="cursor-pointer">Published</Label>
                </div>
                <div className="ml-auto">
                  <Button onClick={handleSavePage} disabled={updatePage.isPending || createPage.isPending} className="gap-2">
                    <Save className="h-4 w-4" />
                    {editingPage.id ? "Save Page" : "Create Page"}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Layout className="h-4 w-4" />
                  Page Content
                </Label>
                <div className="border border-border rounded-lg p-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {(() => { try { const b = JSON.parse(editingPage.blocksJson || "[]"); return `${Array.isArray(b) ? b.length : 0} blocks configured`; } catch { return "0 blocks configured"; } })()}
                  </p>
                  {editingPage.id && (
                    <Button
                      className="gap-2 org-primary-button"
                      onClick={() => { setEditingPage(null); setLocation(`/lms/page-builder/${editingPage.id}`); }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Full-Screen Page Editor
                    </Button>
                  )}
                  {!editingPage.id && (
                    <p className="text-xs text-muted-foreground">Save the page first, then edit content in the full-screen builder.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-header"
                    checked={editingPage.showHeader}
                    onCheckedChange={(checked) =>
                      setEditingPage({ ...editingPage, showHeader: checked })
                    }
                  />
                  <Label htmlFor="show-header">Show Header</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="show-footer"
                    checked={editingPage.showFooter}
                    onCheckedChange={(checked) =>
                      setEditingPage({ ...editingPage, showFooter: checked })
                    }
                  />
                  <Label htmlFor="show-footer">Show Footer</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="is-published"
                    checked={editingPage.isPublished}
                    onCheckedChange={(checked) =>
                      setEditingPage({ ...editingPage, isPublished: checked })
                    }
                  />
                  <Label htmlFor="is-published">Published</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="meta-title">SEO Title</Label>
                <Input
                  id="meta-title"
                  value={editingPage.metaTitle}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, metaTitle: e.target.value })
                  }
                  placeholder="About Us | Your Company"
                />
              </div>

              <div>
                <Label htmlFor="meta-description">SEO Description</Label>
                <Textarea
                  id="meta-description"
                  value={editingPage.metaDescription}
                  onChange={(e) =>
                    setEditingPage({
                      ...editingPage,
                      metaDescription: e.target.value,
                    })
                  }
                  placeholder="Learn more about our mission and values…"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="custom-css">Custom CSS</Label>
                <Textarea
                  id="custom-css"
                  value={editingPage.customCss}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, customCss: e.target.value })
                  }
                  placeholder=".custom-class { color: blue; }"
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSavePage}
                  disabled={updatePage.isPending || createPage.isPending}
                >
                  {editingPage.id ? "Update Page" : "Create Page"}
                </Button>
                <Button variant="outline" onClick={() => setEditingPage(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this page? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePage}
              disabled={deletePage.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
