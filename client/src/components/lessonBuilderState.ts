import type { Block } from "@/components/BlockPreview";

/** Match upstream saved-order semantics: unset/non-positive positions follow saved ones. */
export function compareBuilderLibraryOrder(
  a: { libraryOrder?: number | null; createdAt?: string | Date | null },
  b: { libraryOrder?: number | null; createdAt?: string | Date | null },
): number {
  const position = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? value : Infinity;
  const first = position(a.libraryOrder);
  const second = position(b.libraryOrder);
  if (first !== second) return first < second ? -1 : 1;
  const timestamp = (value: string | Date | null | undefined) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  return timestamp(b.createdAt) - timestamp(a.createdAt);
}

/** Defensive UI selection only. Server ownership checks remain mandatory. */
export function builderRowsForOrg<T extends { orgId?: number | null }>(rows: T[] | undefined, orgId: number | null): T[] {
  return orgId ? (rows ?? []).filter(row => row.orgId === orgId) : [];
}

/** Never silently replace unreadable saved content with an empty editable lesson. */
export function parseLessonBuilderBlocks(raw: unknown): { blocks: Block[]; error: string | null } {
  if (raw == null || raw === "") return { blocks: [], error: null };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) throw new Error("Invalid block list");
    if (parsed.some(block => !block || typeof block !== "object" || typeof block.id !== "string" || typeof block.type !== "string" || !block.data || typeof block.data !== "object")) {
      throw new Error("Invalid block data");
    }
    return { blocks: parsed, error: null };
  } catch {
    return { blocks: [], error: "Saved lesson content could not be read. Reload or contact support before editing; existing content has not been changed." };
  }
}

/** Fresh IDs only for structural blocks, not quiz questions or instructional identifiers. */
export function cloneLessonBuilderBlocks(blocks: Block[], createId: () => string): Block[] {
  return blocks.map(block => {
    const copy = JSON.parse(JSON.stringify(block)) as Block;
    copy.id = createId();
    if (copy.type === "column_layout") {
      for (const key of ["leftBlocks", "rightBlocks"] as const) {
        if (Array.isArray(copy.data[key])) copy.data[key] = cloneLessonBuilderBlocks(copy.data[key], createId);
      }
    }
    return copy;
  });
}
