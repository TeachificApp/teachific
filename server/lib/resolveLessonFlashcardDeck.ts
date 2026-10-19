import { and, eq, inArray } from "drizzle-orm";
import { questionBankItems } from "../../drizzle/schema";
import {
  authoredLessonFlashcardSourceKey,
  normalizeLessonFlashcardGroupDraws,
  questionBankLessonFlashcardSourceKey,
  shuffleLessonFlashcards,
  type ResolvedLessonFlashcardCard,
} from "./lessonFlashcardGroupDraws";
import { collectQuestionBankDescendantFolderIds, selectQuestionBankFolders } from "./questionBankFolderQueries";

type StoredDeckBlock = {
  id?: unknown;
  type?: unknown;
  data?: {
    title?: unknown;
    cards?: unknown;
    questionBankGroupDraws?: unknown;
  };
};

function getFlashcardImageUrl(dataJson: unknown): string | undefined {
  try {
    const data = typeof dataJson === "string" ? JSON.parse(dataJson) : dataJson;
    const imageUrl = (data as { imageUrl?: unknown } | null)?.imageUrl;
    return typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function getStoredLessonFlashcardDeckConfig(contentBlocks: unknown, blockId: string) {
  let blocks: unknown = contentBlocks;
  if (typeof blocks === "string") {
    try { blocks = JSON.parse(blocks); } catch { return null; }
  }
  if (!Array.isArray(blocks)) return null;
  const block = blocks.find((candidate): candidate is StoredDeckBlock => Boolean(candidate)
    && typeof candidate === "object"
    && (candidate as StoredDeckBlock).type === "lesson_flashcard"
    && String((candidate as StoredDeckBlock).id ?? "") === blockId,
  );
  if (!block) return null;

  const cards = (Array.isArray(block.data?.cards) ? block.data.cards : [])
    .filter((card): card is Record<string, unknown> => Boolean(card) && typeof card === "object")
    .filter((card) => String(card.front ?? "").trim().length > 0 && String(card.back ?? "").trim().length > 0)
    .map((card, index): ResolvedLessonFlashcardCard => ({
      questionBankId: Number.isInteger(Number(card.questionBankId)) && Number(card.questionBankId) > 0 ? Number(card.questionBankId) : undefined,
      front: String(card.front).trim(),
      back: String(card.back).trim(),
      hint: typeof card.hint === "string" && card.hint.trim() ? card.hint.trim() : undefined,
      imageUrl: typeof card.imageUrl === "string" && card.imageUrl.trim() ? card.imageUrl.trim() : undefined,
      backImageUrl: typeof card.backImageUrl === "string" && card.backImageUrl.trim() ? card.backImageUrl.trim() : undefined,
      sourceKey: authoredLessonFlashcardSourceKey(index),
    }));
  const groupDraws = normalizeLessonFlashcardGroupDraws(block.data?.questionBankGroupDraws);
  if (cards.length === 0 && groupDraws.length === 0) return null;
  return {
    id: String(block.id),
    title: typeof block.data?.title === "string" ? block.data.title.trim() : "",
    cards,
    groupDraws,
  };
}

/**
 * Resolves a fixed lesson deck plus fresh server-selected group draws. All
 * folders and cards are constrained to the course's active organization.
 */
export async function resolveLessonFlashcardDeck(
  db: any,
  orgId: number,
  deck: NonNullable<ReturnType<typeof getStoredLessonFlashcardDeckConfig>>,
): Promise<ResolvedLessonFlashcardCard[]> {
  if (deck.groupDraws.length === 0) return deck.cards;

  const folders = await selectQuestionBankFolders(db, orgId);
  const authoredBankIds = new Set(deck.cards.map((card) => card.questionBankId).filter((id): id is number => typeof id === "number"));
  const drawn: ResolvedLessonFlashcardCard[] = [];
  for (const group of deck.groupDraws) {
    const folderIds = collectQuestionBankDescendantFolderIds(folders, group.folderId, orgId);
    if (folderIds.length === 0) continue;
    const candidates: Array<{
      id: number;
      stem: string;
      flashcardFront: string | null;
      flashcardBack: string | null;
      flashcardHint: string | null;
      flashcardBackImageUrl: string | null;
      dataJson: string;
    }> = await db.select({
      id: questionBankItems.id,
      stem: questionBankItems.stem,
      flashcardFront: questionBankItems.flashcardFront,
      flashcardBack: questionBankItems.flashcardBack,
      flashcardHint: questionBankItems.flashcardHint,
      flashcardBackImageUrl: questionBankItems.flashcardBackImageUrl,
      dataJson: questionBankItems.dataJson,
    }).from(questionBankItems).where(and(
      eq(questionBankItems.orgId, orgId),
      eq(questionBankItems.questionType, "flashcard"),
      inArray(questionBankItems.folderId, folderIds),
    ));
    const eligible = candidates.filter((card) => {
      const front = (card.flashcardFront || card.stem).trim();
      return Boolean(front) && Boolean(card.flashcardBack?.trim())
        && !authoredBankIds.has(card.id)
        && !drawn.some((existing) => existing.questionBankId === card.id);
    });
    drawn.push(...shuffleLessonFlashcards(eligible).slice(0, group.count).map((card): ResolvedLessonFlashcardCard => ({
      questionBankId: card.id,
      front: card.flashcardFront || card.stem,
      back: card.flashcardBack || "",
      hint: card.flashcardHint || undefined,
      imageUrl: getFlashcardImageUrl(card.dataJson),
      backImageUrl: card.flashcardBackImageUrl || undefined,
      sourceKey: questionBankLessonFlashcardSourceKey(card.id),
    })));
  }
  return [...deck.cards, ...drawn];
}

/** Validates whether submitted dynamic outcome keys remain in the active org's configured draw pools. */
export async function getAllowedLessonFlashcardBankCards(
  db: any,
  orgId: number,
  deck: NonNullable<ReturnType<typeof getStoredLessonFlashcardDeckConfig>>,
): Promise<Map<number, string>> {
  if (deck.groupDraws.length === 0) return new Map();
  const folders = await selectQuestionBankFolders(db, orgId);
  const cards = new Map<number, string>();
  for (const group of deck.groupDraws) {
    const folderIds = collectQuestionBankDescendantFolderIds(folders, group.folderId, orgId);
    if (folderIds.length === 0) continue;
    const rows: Array<{ id: number; stem: string; flashcardFront: string | null; flashcardBack: string | null }> = await db.select({ id: questionBankItems.id, stem: questionBankItems.stem, flashcardFront: questionBankItems.flashcardFront, flashcardBack: questionBankItems.flashcardBack }).from(questionBankItems).where(and(
      eq(questionBankItems.orgId, orgId),
      eq(questionBankItems.questionType, "flashcard"),
      inArray(questionBankItems.folderId, folderIds),
    ));
    for (const row of rows) {
      const front = (row.flashcardFront || row.stem).trim();
      if (front && row.flashcardBack?.trim()) cards.set(row.id, front);
    }
  }
  return cards;
}
