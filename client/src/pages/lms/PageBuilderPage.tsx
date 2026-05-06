import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { WysiwygPageBuilder } from "@/components/WysiwygPageBuilder";
import type { Block } from "@/components/WysiwygPageBuilder";
import {
  Save,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { renderBlockPreview } from "@/components/PageBuilder";
import type { Block as PBBlock } from "@/components/PageBuilder";

// ─── View Mode Types ─────────────────────────────────────────────────────────
type ViewMode = "editor" | "visitor" | "customer";

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PageBuilderPage() {
  const params = useParams<{ courseId?: string; pageId?: string }>();
  const [, setLocation] = useLocation();
  const courseId = params.courseId ? parseInt(params.courseId) : undefined;
  const pageId = params.pageId ? parseInt(params.pageId) : undefined;

  const { data: orgs } = trpc.orgs.myOrgs.useQuery();
  const orgId = orgs?.[0]?.id;

  const { data: theme } = trpc.lms.themes.get.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const { data: page, isLoading } = trpc.lms.pages.get.useQuery(
    { id: pageId! },
    { enabled: !!pageId }
  );

  const { data: courses } = trpc.lms.courses.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [pageTitle, setPageTitle] = useState("Untitled Page");
  const [pageSlug, setPageSlug] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");

  // Theme-based accent color (defaults to teal)
  const accentColor = theme?.primaryColor || "#189aa1";
  const accentColorLight = theme?.accentColor || "#4ad9e0";

  useEffect(() => {
    if (page) {
      setPageTitle(page.title || "Untitled Page");
      setPageSlug(page.slug || "");
      setIsPublished(page.isPublished || false);
      try {
        const parsed = JSON.parse(page.blocksJson || "[]");
        setBlocks(Array.isArray(parsed) ? parsed : []);
      } catch {
        setBlocks([]);
      }
    }
  }, [page]);

  const updatePage = trpc.lms.pages.update.useMutation({
    onSuccess: () => {
      toast.success("Page saved successfully");
      setIsDirty(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const createPage = trpc.lms.pages.create.useMutation({
    onSuccess: (newPage) => {
      toast.success("Page created");
      setIsDirty(false);
      setLocation(`/lms/page-builder/${newPage.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleBlocksChange = useCallback((newBlocks: Block[]) => {
    setBlocks(newBlocks);
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    const blocksJson = JSON.stringify(blocks);
    if (pageId) {
      updatePage.mutate({
        id: pageId,
        blocksJson,
        title: pageTitle,
        slug: pageSlug || undefined,
        isPublished,
      });
    } else if (orgId) {
      createPage.mutate({
        orgId,
        courseId,
        pageType: "course_sales",
        title: pageTitle,
        slug: pageSlug || undefined,
      } as any);
    }
  };

  const isSaving = updatePage.isPending || createPage.isPending;
  const courseList = (courses || []).map((c: any) => ({ id: c.id, title: c.title }));
  const previewUrl = page?.slug ? `/p/${page.slug}` : null;

  // Get the course name if this is a course page
  const courseName = courseId
    ? courseList.find(c => c.id === courseId)?.title
    : page?.courseId
    ? courseList.find(c => c.id === page.courseId)?.title
    : null;

  const backLabel = courseName
    ? `← Back to Product`
    : `← Back to Pages`;

  const handleBack = () => {
    if (courseId) {
      setLocation(`/lms/courses/${courseId}/edit`);
    } else if (page?.courseId) {
      setLocation(`/lms/courses/${page.courseId}/edit`);
    } else {
      setLocation("/lms/custom-pages");
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background w-screen">
      {/* ─── Header Bar (AAU Style) ─────────────────────────────────────────── */}
      <div
        className="h-14 flex items-center justify-between px-4 shrink-0 z-20 shadow-sm"
        style={{ backgroundColor: "#fff", borderBottom: `2px solid ${accentColor}20` }}
      >
        {/* Left: Back + Product Name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleBack}
            className="text-sm font-medium hover:opacity-80 transition-opacity flex items-center gap-1.5 shrink-0"
            style={{ color: accentColor }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Product</span>
          </button>
          <div className="w-px h-6 bg-border shrink-0" />
          <span className="text-sm font-bold text-foreground truncate max-w-[200px]">
            {courseName || pageTitle || "Page Editor"}
          </span>
        </div>

        {/* Center: View Mode Toggle */}
        <div className="flex items-center rounded-lg overflow-hidden border border-border shadow-sm">
          {(["editor", "visitor", "customer"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="px-4 py-1.5 text-xs font-semibold transition-all capitalize"
              style={{
                backgroundColor: viewMode === mode ? accentColor : "transparent",
                color: viewMode === mode ? "#fff" : "#64748b",
              }}
            >
              {mode === "editor" ? "Editor" : mode === "visitor" ? "As Visitor" : "As Customer"}
            </button>
          ))}
        </div>

        {/* Right: Open Page + Save */}
        <div className="flex items-center gap-2 shrink-0">
          {previewUrl && (
            <button
              onClick={() => window.open(previewUrl, "_blank")}
              className="flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity"
              style={{ color: accentColor }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open Page</span>
            </button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || (!isDirty && !!pageId)}
            className="gap-2 text-sm font-semibold px-5 shadow-md"
            style={{
              backgroundColor: accentColor,
              color: "#fff",
              opacity: (isSaving || (!isDirty && !!pageId)) ? 0.5 : 1,
            }}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ─── Page Title & Slug Bar ──────────────────────────────────────────── */}
      <div className="h-10 flex items-center gap-4 px-4 border-b border-border bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Page Title</label>
          <Input
            value={pageTitle}
            onChange={(e) => { setPageTitle(e.target.value); setIsDirty(true); }}
            className="h-7 text-sm font-semibold border-border bg-white w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">URL Slug</label>
          <Input
            value={pageSlug}
            onChange={(e) => { setPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setIsDirty(true); }}
            className="h-7 text-sm border-border bg-white w-48 font-mono"
            placeholder="my-page-slug"
          />
        </div>
        {isPublished && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
            Published
          </span>
        )}
        {!isPublished && pageId && (
          <button
            onClick={() => { setIsPublished(true); setIsDirty(true); }}
            className="text-xs font-medium px-2 py-0.5 rounded-full border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            Draft — Click to Publish
          </button>
        )}
      </div>

      {/* ─── Editor / Preview Area ──────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading page…
        </div>
      ) : viewMode === "editor" ? (
        <div className="flex-1 overflow-hidden">
          <WysiwygPageBuilder
            initialBlocks={blocks}
            onChange={handleBlocksChange}
            courses={courseList}
            orgId={orgId}
          />
        </div>
      ) : (
        /* Preview modes (As Visitor / As Customer) — render blocks read-only */
        <div className="flex-1 overflow-auto bg-white">
          <PagePreview blocks={blocks} viewMode={viewMode} />
        </div>
      )}
    </div>
  );
}

// ─── Page Preview Component (read-only rendering) ────────────────────────────
function PagePreview({ blocks, viewMode }: { blocks: Block[]; viewMode: ViewMode }) {

  const visibleBlocks = blocks.filter(b => b.visible !== false);

  if (visibleBlocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
        <p className="text-lg font-medium">No content yet</p>
        <p className="text-sm mt-1 opacity-60">Switch to Editor mode to add blocks</p>
      </div>
    );
  }

  return (
    <div>
      {viewMode === "visitor" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs text-amber-700 font-medium">
          Viewing as: Visitor (not logged in) — Purchase buttons and gated content shown as locked
        </div>
      )}
      {viewMode === "customer" && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-center text-xs text-green-700 font-medium">
          Viewing as: Customer (enrolled) — All content accessible
        </div>
      )}
      <div>
        {visibleBlocks.map((block) => (
          <div key={block.id}>
            {renderBlockPreview(block as unknown as PBBlock)}
          </div>
        ))}
      </div>
    </div>
  );
}
