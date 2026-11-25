import { useLayoutEffect, useRef } from "react";
import { creatorRenderer, type CreatorRenderContext } from "@shared/course360CreatorRenderer";
import type { CreatorBlock } from "@shared/course360CreatorModel";
export function CreatorBlockView({ block, context = { editor: true } }: { block: CreatorBlock; context?: CreatorRenderContext }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { const host = ref.current; if (!host) return; host.replaceChildren(creatorRenderer.renderBlock(host.ownerDocument, block, context)); return () => host.replaceChildren(); }, [block, context]);
  return <div ref={ref} style={{ width: "100%", height: "100%" }} data-creator-shared-renderer />;
}
