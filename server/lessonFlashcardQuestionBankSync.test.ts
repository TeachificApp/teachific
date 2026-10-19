import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeLessonFlashcardForBank, parseBlocks } from "./lib/lessonQuizQuestionBankSync";

const syncSource = readFileSync(new URL("./lib/lessonQuizQuestionBankSync.ts", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

describe("lesson flashcard Question Bank synchronization", () => {
  it("keeps only complete, bounded author cards", () => {
    expect(normalizeLessonFlashcardForBank({
      front: "  Front of card ",
      back: " Back of card ",
      hint: " Helpful cue ",
      imageUrl: "https://cdn.example.test/front.png",
      backImageUrl: "https://cdn.example.test/back.png",
    })).toEqual({
      front: "Front of card",
      back: "Back of card",
      hint: "Helpful cue",
      imageUrl: "https://cdn.example.test/front.png",
      backImageUrl: "https://cdn.example.test/back.png",
    });
    expect(normalizeLessonFlashcardForBank({ front: "Front", back: "" })).toBeNull();
    expect(normalizeLessonFlashcardForBank({ front: "", back: "Back" })).toBeNull();
    expect(normalizeLessonFlashcardForBank({ front: "x".repeat(20_001), back: "Back" })).toBeNull();
    expect(parseBlocks("invalid JSON")).toEqual([]);
  });

  it("uses source identity and organization scope to update rather than duplicate cards", () => {
    const pageBuilderSync = syncSource.slice(
      syncSource.indexOf("export async function syncLessonQuizBlocksToQuestionBank"),
      syncSource.indexOf("/** Synchronize a legacy lms_quiz_questions"),
    );
    expect(syncSource).toContain('eq(questionBankItems.orgId, course.orgId)');
    expect(syncSource).toContain('eq(questionBankItems.sourceLessonId, lessonId)');
    expect(syncSource).toContain('eq(questionBankItems.sourceBlockId, sourceBlockId)');
    expect(syncSource).toContain('eq(questionBankItems.sourceCardIndex, sourceCardIndex)');
    expect(pageBuilderSync).toContain('questionType: "flashcard" as const');
    expect(pageBuilderSync).toContain('ensureLessonFlashcardFolder');
    expect(pageBuilderSync).toContain('lessonQuizFolderId ??=');
    expect(pageBuilderSync).toContain('lessonFlashcardFolderId ??=');
  });

  it("keeps flashcard reuse additive to the existing Question Bank schema", () => {
    expect(schemaSource).toContain('"flashcard"');
    expect(schemaSource).toContain('flashcardFront: longtext("flashcard_front")');
    expect(schemaSource).toContain('sourceCardIndex: int("source_card_index")');
    expect(schemaSource).toContain('question_bank_items_flashcard_source_idx');
  });
});
