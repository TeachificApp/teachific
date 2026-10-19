import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getStoredInlineLessonFlashcardBlock,
  normalizeInlineLessonFlashcardOutcomes,
} from "./lib/inlineLessonFlashcards";

const routerSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayer.tsx", import.meta.url), "utf8");

describe("inline lesson flashcard result contract", () => {
  const contentBlocks = JSON.stringify([{
    id: "deck-1",
    type: "lesson_flashcard",
    data: {
      title: "Core terms",
      cards: [
        { front: "Term one", back: "Definition one" },
        { front: "Term two", back: "Definition two" },
      ],
    },
  }]);

  it("uses only the stored deck and a complete unique outcome for every card", () => {
    const deck = getStoredInlineLessonFlashcardBlock(contentBlocks, "deck-1");
    expect(deck?.title).toBe("Core terms");
    expect(deck?.cards).toHaveLength(2);
    expect(normalizeInlineLessonFlashcardOutcomes(deck!.cards, [
      { cardKey: "0", gotIt: true },
      { cardKey: "1", gotIt: false },
    ])).toMatchObject({ score: 50, gotItCount: 1, cardCount: 2 });
    expect(normalizeInlineLessonFlashcardOutcomes(deck!.cards, [{ cardKey: "0", gotIt: true }])).toBeNull();
    expect(normalizeInlineLessonFlashcardOutcomes(deck!.cards, [
      { cardKey: "0", gotIt: true },
      { cardKey: "0", gotIt: false },
    ])).toBeNull();
    expect(normalizeInlineLessonFlashcardOutcomes(deck!.cards, [
      { cardKey: "0", gotIt: true },
      { cardKey: "2", gotIt: false },
    ])).toBeNull();
  });

  it("keeps malformed or incomplete decks out of the result path", () => {
    expect(getStoredInlineLessonFlashcardBlock("not json", "deck-1")).toBeNull();
    expect(getStoredInlineLessonFlashcardBlock(JSON.stringify([{
      id: "deck-1",
      type: "lesson_flashcard",
      data: { cards: [{ front: "Missing back" }] },
    }]), "deck-1")).toBeNull();
  });

  it("requires active organization and enrollment scope before saving or reading learner history", () => {
    expect(routerSource).toContain("submitInlineLessonFlashcards: protectedProcedure");
    expect(routerSource).toContain("const activeOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);");
    expect(routerSource).toContain("const enrollment = await getActiveEnrollment(db as any, ctx.user.id, course.id);");
    expect(routerSource).toContain("eq(lmsInlineQuizAttempts.orgId, activeOrgId)");
    expect(routerSource).toContain("eq(lmsInlineQuizAttempts.enrollmentId, enrollment.id)");
    expect(routerSource).toContain("getMyInlineModuleAttempts: protectedProcedure.query");
    expect(routerSource).toContain("eq(lmsCourses.orgId, activeOrgId)");
  });

  it("records study outcomes only after a learner reviews every card outside admin preview", () => {
    expect(playerSource).toContain("submitInlineLessonFlashcards.useMutation");
    expect(playerSource).toContain("Object.keys(nextOutcomes).length === deck.length");
    expect(playerSource).toContain("!isAdminPreview && !recordedAttemptRef.current");
    expect(playerSource).toContain("flashcardBlockId={String(block.id)}");
  });
});
