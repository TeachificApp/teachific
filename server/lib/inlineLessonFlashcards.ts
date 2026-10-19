export type FlashcardOutcomeInput = {
  cardKey: string;
  gotIt: boolean;
};

type StoredFlashcard = {
  front?: unknown;
  back?: unknown;
};

type StoredFlashcardBlock = {
  id?: unknown;
  type?: unknown;
  data?: {
    cards?: unknown;
    title?: unknown;
  };
};

export function getStoredInlineLessonFlashcardBlock(contentBlocks: unknown, blockId: string) {
  let blocks: unknown = contentBlocks;
  if (typeof blocks === "string") {
    try {
      blocks = JSON.parse(blocks);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(blocks)) return null;

  const block = blocks.find((candidate): candidate is StoredFlashcardBlock =>
    Boolean(candidate)
    && typeof candidate === "object"
    && (candidate as StoredFlashcardBlock).type === "lesson_flashcard"
    && String((candidate as StoredFlashcardBlock).id ?? "") === blockId,
  );
  if (!block || !Array.isArray(block.data?.cards) || block.data.cards.length === 0) return null;

  const cards = block.data.cards.filter((card): card is StoredFlashcard =>
    Boolean(card)
    && typeof card === "object"
    && String((card as StoredFlashcard).front ?? "").trim().length > 0
    && String((card as StoredFlashcard).back ?? "").trim().length > 0,
  );
  return cards.length === block.data.cards.length ? {
    id: String(block.id),
    title: typeof block.data.title === "string" ? block.data.title.trim() : "",
    cards,
  } : null;
}

/**
 * A flashcard result is self-reported study data, not a graded quiz. Accept an
 * outcome only when the caller provided one unique Got It/Missed value for each
 * stored card position. Never trust an arbitrary card count from the client.
 */
export function normalizeInlineLessonFlashcardOutcomes(
  cards: StoredFlashcard[],
  outcomes: FlashcardOutcomeInput[],
) {
  const valuesByIndex = new Map<number, boolean>();
  for (const outcome of outcomes) {
    const index = Number(outcome.cardKey);
    if (!Number.isInteger(index) || index < 0 || index >= cards.length || valuesByIndex.has(index)) {
      return null;
    }
    valuesByIndex.set(index, outcome.gotIt);
  }
  if (valuesByIndex.size !== cards.length) return null;

  const normalized = cards.map((card, index) => ({
    cardKey: String(index),
    questionText: String(card.front ?? "Flashcard").trim(),
    gotIt: valuesByIndex.get(index) === true,
  }));
  const gotItCount = normalized.filter((outcome) => outcome.gotIt).length;
  return {
    outcomes: normalized,
    gotItCount,
    score: Math.round((gotItCount / cards.length) * 100),
    cardCount: cards.length,
  };
}
