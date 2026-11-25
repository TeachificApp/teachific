import type { Block } from "@/components/BlockPreview";

const INVALID_DRAFT = "The generated landing page is incomplete or invalid. Your saved page has not changed. Please try again.";
const MAX_DRAFT_BLOCKS = 500;
const MAX_DRAFT_DEPTH = 20;

/** Validate only new AI drafts, never migrate or rewrite existing saved blocks. */
export function requireLandingDraftBlocks(value: unknown): Block[] {
  const ids = new Set<string>();
  let count = 0;
  const record = (input: unknown): input is Record<string, unknown> =>
    !!input && typeof input === "object" && !Array.isArray(input);
  function validate(items: unknown, depth: number, requireContent = false): asserts items is Block[] {
    if (!Array.isArray(items) || (requireContent && items.length === 0) || depth > MAX_DRAFT_DEPTH) {
      throw new Error(INVALID_DRAFT);
    }
    for (const item of items) {
      if (!record(item) || typeof item.id !== "string" || !item.id.trim()
        || ids.has(item.id) || typeof item.type !== "string" || !item.type.trim()
        || !record(item.data) || ++count > MAX_DRAFT_BLOCKS) throw new Error(INVALID_DRAFT);
      ids.add(item.id);
      if (item.type === "column_layout") {
        for (const side of ["leftBlocks", "rightBlocks"]) {
          if (item.data[side] !== undefined) validate(item.data[side], depth + 1);
        }
      }
    }
  }
  validate(value, 0, true);
  return value;
}

/** Do not show proxy/provider HTML, credentials, or a raw JSON parse stack in a toast. */
export function landingAiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message
    : typeof error === "string" ? error
    : error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "";
  if (!message.trim() || /<!doctype|<\/?[a-z][^>]*>|unexpected token|not valid json|json\.parse|bearer\s|sk-[\w-]+/i.test(message)) {
    return "The AI service returned an unreadable response. Your saved page has not changed. Please try again.";
  }
  return message.length > 300 ? "Landing page generation failed. Your saved page has not changed. Please try again." : message;
}

/** Consume a local course-specific draft only after validating the complete block tree. */
export function consumeLandingAiDraft(storage: Pick<Storage, "getItem" | "removeItem">, courseId: number): Block[] | null {
  const key = `landing-page-ai-draft:${courseId}`;
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return requireLandingDraftBlocks(JSON.parse(raw));
  } catch {
    throw new Error(INVALID_DRAFT);
  } finally {
    storage.removeItem(key);
  }
}
