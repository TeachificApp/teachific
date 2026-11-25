import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { creatorPrimitives } from "@shared/course360CreatorModel";
import { getCourse360MediaLibraryHref } from "@/lib/course360MediaLibrary";
export function CreatorMediaPicker({ orgId, kind, onSelect }: { orgId: number; kind: "image" | "video" | "audio"; onSelect: (item: { id: number; url: string; filename: string }) => void }) {
  const [open, setOpen] = useState(false); const [page, setPage] = useState(1); const [search, setSearch] = useState("");
  const query = trpc.forms.media.list.useQuery({ orgId, page, pageSize: 50, mimeType: kind + "/" }, { enabled: open });
  const data = query.data; const items: any[] = Array.isArray(data) ? data : data?.items || [];
  return <div className="space-y-2"><button type="button" onClick={() => setOpen(!open)} className="w-full rounded border border-[#24abbc] px-2 py-1 text-xs text-[#4ad9e0]">Choose {kind} from main library</button>{open && <section aria-label={`Main account ${kind} picker`} className="space-y-2 rounded border border-white/20 p-2">
    <p className="text-[11px] text-white/60">Main Course360 account · school {orgId}. No app-owned storage.</p>
    <input aria-label="Search main library" value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white/10 p-1 text-xs" />
    {query.isLoading && <p>Loading media…</p>}{query.error && <p role="alert">{query.error.message}</p>}
    {items.filter(i => i.mimeType?.startsWith(kind + "/") && i.filename.toLowerCase().includes(search.toLowerCase())).map(item => <button key={item.id} type="button" className="block w-full rounded border border-white/20 p-2 text-left text-xs" onClick={() => { onSelect({ id: Number(item.id), url: creatorPrimitives.safeUrl(item.url, true), filename: item.filename }); setOpen(false); }}>{kind === "image" && creatorPrimitives.safeUrl(item.url, true) && <img alt="" src={item.url} className="mb-1 h-16 w-full object-contain" />}{item.filename}</button>)}
    <div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button><span>{page}</span><button disabled={items.length < 50} onClick={() => setPage(p => p + 1)}>Next</button></div>
    <a href={getCourse360MediaLibraryHref()} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4ad9e0]">Manage or upload in main Media Library</a>
  </section>}</div>;
}
