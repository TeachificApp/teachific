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
import { useOrgScope } from "@/hooks/useOrgScope";

// ─── View Mode Types ─────────────────────────────────────────────────────────
type ViewMode = "editor" | "visitor" | "customer";

// ─── Determine context from URL params ───────────────────────────────────────
function usePageContext() {
  const params = useParams<{ courseId?: string; pageId?: string; productId?: string; webinarId?: string }>();
  const path = window.location.pathname;

  if (params.productId || path.includes("/downloads/")) {
    const id = params.productId || path.match(/\/downloads\/(\d+)\//)?.[1];
    return { type: "product" as const, id: id ? parseInt(id) : undefined };
  }
  if (params.webinarId || path.includes("/webinars/")) {
    const id = params.webinarId || path.match(/\/webinars\/(\d+)\//)?.[1];
    return { type: "webinar" as const, id: id ? parseInt(id) : undefined };
  }
  if (params.courseId && path.includes("/thank-you-builder")) {
    return { type: "thankyou" as const, id: parseInt(params.courseId) };
  }
  if (params.courseId) {
    return { type: "course" as const, id: parseInt(params.courseId) };
  }
  if (params.pageId) {
    return { type: "page" as const, id: parseInt(params.pageId) };
  }
  return { type: "page" as const, id: undefined };
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PageBuilderPage() {
  const context = usePageContext();
  const [, setLocation] = useLocation();

  const { orgId } = useOrgScope();

  const { data: theme } = trpc.lms.themes.get.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  // Load page data (for page type)
  const { data: page, isLoading: pageLoading } = trpc.lms.pages.get.useQuery(
    { id: context.id! },
    { enabled: context.type === "page" && !!context.id }
  );

  // Load page by course (for course type)
  const { data: coursePage, isLoading: coursePageLoading } = trpc.lms.pages.getByCourse.useQuery(
    { courseId: context.id! },
    { enabled: context.type === "course" && !!context.id }
  );

  // Load digital product data
  const { data: product, isLoading: productLoading } = trpc.lms.downloads.getProduct.useQuery(
    { id: context.id! },
    { enabled: context.type === "product" && !!context.id }
  );

  // Load webinar data
  const { data: webinar, isLoading: webinarLoading } = trpc.lms.webinars.get.useQuery(
    { id: context.id! },
    { enabled: context.type === "webinar" && !!context.id }
  );

  // Load course data (for thank-you page builder)
  const { data: thankYouCourse, isLoading: thankYouLoading } = trpc.lms.courses.get.useQuery(
    { id: context.id! },
    { enabled: context.type === "thankyou" && !!context.id }
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

  // Theme-based accent color resolved from the active organization when no saved override exists.
  const accentColor = theme?.primaryColor || (typeof window !== "undefined"
    ? window.getComputedStyle(document.documentElement).getPropertyValue("--org-primary").trim() || "#000000"
    : "#000000");

  // Initialize state based on context type
  useEffect(() => {
    if (context.type === "page" && page) {
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
  }, [page, context.type]);

  useEffect(() => {
    if (context.type === "course" && coursePage) {
      setPageTitle(coursePage.title || "Course Sales Page");
      setPageSlug(coursePage.slug || "");
      setIsPublished(coursePage.isPublished || false);
      try {
        const parsed = JSON.parse(coursePage.blocksJson || "[]");
        setBlocks(Array.isArray(parsed) ? parsed : []);
      } catch {
        setBlocks([]);
      }
    }
  }, [coursePage, context.type]);

  useEffect(() => {
    if (context.type === "product" && product) {
      setPageTitle(product.title ? `${product.title} - Sales Page` : "Product Sales Page");
      setPageSlug(product.slug || "");
      try {
        const raw = product.salesPageBlocksJson;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
        setBlocks(Array.isArray(parsed) ? parsed : []);
      } catch {
        setBlocks([]);
      }
    }
  }, [product, context.type]);

  useEffect(() => {
    if (context.type === "webinar" && webinar) {
      setPageTitle(webinar.title ? `${webinar.title} - Registration Page` : "Webinar Registration Page");
      setPageSlug(webinar.slug || "");
      try {
        const raw = webinar.salesPageBlocksJson;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
        setBlocks(Array.isArray(parsed) ? parsed : []);
      } catch {
        setBlocks([]);
      }
    }
  }, [webinar, context.type]);

  useEffect(() => {
    if (context.type === "thankyou" && thankYouCourse) {
      setPageTitle(`${thankYouCourse.title} - Thank You Page`);
      setPageSlug("");
      try {
        const raw = thankYouCourse.thankYouPageBlocks;
        const parsed = typeof raw === "string" ? JSON.parse(raw) : [];
        setBlocks(Array.isArray(parsed) ? parsed : []);
      } catch {
        setBlocks([]);
      }
    }
  }, [thankYouCourse, context.type]);

  // Save mutations
  const updatePage = trpc.lms.pages.update.useMutation({
    onSuccess: () => { toast.success("Page saved successfully"); setIsDirty(false); },
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

  const updateProduct = trpc.lms.downloads.updateProduct.useMutation({
    onSuccess: () => { toast.success("Sales page saved"); setIsDirty(false); },
    onError: (e) => toast.error(e.message),
  });

  const updateWebinar = trpc.lms.webinars.update.useMutation({
    onSuccess: () => { toast.success("Registration page saved"); setIsDirty(false); },
    onError: (e) => toast.error(e.message),
  });

  const updateCourse = trpc.lms.courses.update.useMutation({
    onSuccess: () => { toast.success("Thank you page saved"); setIsDirty(false); },
    onError: (e) => toast.error(e.message),
  });

  const handleBlocksChange = useCallback((newBlocks: Block[]) => {
    setBlocks(newBlocks);
    setIsDirty(true);
  }, []);

  const handleSave = () => {
    const blocksJson = JSON.stringify(blocks);

    if (context.type === "page" && context.id) {
      updatePage.mutate({ id: context.id, blocksJson, title: pageTitle, slug: pageSlug || undefined, isPublished });
    } else if (context.type === "course") {
      if (coursePage?.id) {
        updatePage.mutate({ id: coursePage.id, blocksJson, title: pageTitle, slug: pageSlug || undefined, isPublished });
      } else if (orgId && context.id) {
        createPage.mutate({ orgId, courseId: context.id, pageType: "course_sales", title: pageTitle, slug: pageSlug || undefined } as any);
      }
    } else if (context.type === "product" && context.id) {
      updateProduct.mutate({ id: context.id, salesPageBlocksJson: blocks as any });
    } else if (context.type === "webinar" && context.id) {
      updateWebinar.mutate({ id: context.id, salesPageBlocksJson: blocks as any });
    } else if (context.type === "thankyou" && context.id) {
      updateCourse.mutate({ id: context.id, thankYouPageBlocks: blocksJson, thankYouPageEnabled: true });
    } else if (orgId) {
      createPage.mutate({ orgId, pageType: "custom", title: pageTitle, slug: pageSlug || undefined } as any);
    }
  };

  const isSaving = updatePage.isPending || createPage.isPending || updateProduct.isPending || updateWebinar.isPending || updateCourse.isPending;
  const isLoading = pageLoading || coursePageLoading || productLoading || webinarLoading || thankYouLoading;
  const courseList = (courses || []).map((c: any) => ({ id: c.id, title: c.title }));

  // Determine preview URL
  const previewUrl = context.type === "product" && product?.slug
    ? `/shop/${product.slug}`
    : context.type === "webinar" && webinar?.slug
    ? `/webinar/${webinar.slug}/register`
    : context.type === "thankyou" && context.id
    ? `/courses/${context.id}/thank-you`
    : page?.slug ? `/p/${page.slug}` : null;

  // Determine product name for header
  const productName = context.type === "product"
    ? product?.title || "Digital Product"
    : context.type === "webinar"
    ? webinar?.title || "Webinar"
    : context.type === "thankyou"
    ? (thankYouCourse?.title || "Course") + " - Thank You"
    : context.type === "course"
    ? courseList.find(c => c.id === context.id)?.title || "Course"
    : pageTitle || "Page Editor";

  const handleBack = () => {
    if (context.type === "thankyou" && context.id) {
      setLocation(`/lms/courses/${context.id}/after_purchase`);
    } else if (context.type === "course" && context.id) {
      setLocation(`/lms/courses/${context.id}/edit`);
    } else if (context.type === "product" && context.id) {
      setLocation(`/admin/downloads/${context.id}`);
    } else if (context.type === "webinar" && context.id) {
      setLocation(`/lms/webinars/${context.id}/edit`);
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
            {productName}
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
            disabled={isSaving || (!isDirty && !!context.id)}
            className="gap-2 text-sm font-semibold px-5 shadow-md"
            style={{
              backgroundColor: accentColor,
              color: "#fff",
              opacity: (isSaving || (!isDirty && !!context.id)) ? 0.5 : 1,
            }}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ─── Page Title & Slug Bar ──────────────────────────────────────────── */}
      {(context.type === "page" || context.type === "course") && (
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
          {!isPublished && context.id && (
            <button
              onClick={() => { setIsPublished(true); setIsDirty(true); }}
              className="text-xs font-medium px-2 py-0.5 rounded-full border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              Draft — Click to Publish
            </button>
          )}
        </div>
      )}

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
