import { useRoute } from "wouter";
import { sanitize, sanitizeCss } from "@/lib/sanitize";
import { trpc } from "@/lib/trpc";
import { renderBlockPreview } from "@/components/PageBuilder";
import type { Block } from "@/components/PageBuilder";

export default function PublicPagePage() {
  const [, params] = useRoute("/p/:slug");
  const slug = params?.slug ?? "";

  const { data: page, isLoading, error } = trpc.lms.pages.getBySlug.useQuery(
    { slug },
    { enabled: !!slug, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading page…</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-foreground">404</h1>
          <p className="text-muted-foreground">This page could not be found or is not published.</p>
          <a href="/" className="text-primary underline text-sm">Return home</a>
        </div>
      </div>
    );
  }

  let blocks: Block[] = [];
  try {
    const parsed = JSON.parse(page.blocksJson || "[]");
    blocks = Array.isArray(parsed) ? parsed : [];
  } catch {
    blocks = [];
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Custom CSS */}
      {page.customCss && (
        <style dangerouslySetInnerHTML={{ __html: sanitizeCss(page.customCss) }} />
      )}

      {/* SEO meta (best effort via document.title) */}
      {page.metaTitle && (() => { document.title = page.metaTitle; return null; })()}

      {/* Page blocks */}
      <div>
        {blocks.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
            <p>This page has no content yet.</p>
          </div>
        ) : (
          blocks
            .filter((b) => b.visible !== false)
            .map((block) => (
              <div key={block.id}>{renderBlockPreview(block)}</div>
            ))
        )}
      </div>
    </div>
  );
}
