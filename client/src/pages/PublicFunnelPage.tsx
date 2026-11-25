import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { renderBlockPreview, type Block } from "@/components/PageBuilder";

export default function PublicFunnelPage() {
  const { funnelSlug = "", pageSlug = "" } = useParams<{ funnelSlug: string; pageSlug: string }>();
  const result = trpc.funnel360Public.getPage.useQuery({ funnelSlug, pageSlug }, { enabled: !!funnelSlug && !!pageSlug, retry: false });
  const data = result.data;
  useEffect(() => {
    if (!data) return;
    const originalTitle = document.title;
    document.title = data.page.metaTitle || data.page.title || data.schoolName;
    const head = document.head;
    const description = document.createElement("meta");
    description.name = "description";
    description.content = data.page.metaDescription || "";
    const keywords = document.createElement("meta");
    keywords.name = "keywords";
    keywords.content = data.seoKeywords || "";
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = data.canonical;
    const existing = Array.from(head.querySelectorAll('meta[name="description"],meta[name="keywords"],link[rel="canonical"]'));
    existing.forEach(node => node.remove());
    head.append(description, keywords, canonical);
    return () => {
      document.title = originalTitle;
      description.remove(); keywords.remove(); canonical.remove();
      existing.forEach(node => head.append(node));
    };
  }, [data]);
  if (result.isLoading) return <main className="min-h-screen flex items-center justify-center" aria-busy="true">Loading page…</main>;
  if (!data || result.error) return <main className="min-h-screen flex items-center justify-center"><p>This page is not available or has not been published.</p></main>;
  let blocks: Block[] = [];
  try { const parsed = JSON.parse(data.page.blocksJson); if (Array.isArray(parsed)) blocks = parsed; } catch { /* Invalid saved content renders no blocks, never executable HTML. */ }
  return <main className="min-h-screen bg-white text-slate-900">
    {data.page.showHeader && <header className="px-6 py-4 border-b flex items-center gap-3">{data.logoUrl && <img src={data.logoUrl} alt="" className="h-10 w-auto" />}<span>{data.schoolName}</span></header>}
    {blocks.filter(block => block && block.visible !== false).map(block => <section key={block.id}>{renderBlockPreview(block)}</section>)}
    {data.page.showFooter && <footer className="px-6 py-4 text-sm border-t">{data.schoolName}</footer>}
  </main>;
}
