import { describe, expect, it } from "vitest";
import {
  authoredLessonFlashcardSourceKey,
  normalizeLessonFlashcardGroupDraws,
  parseLessonFlashcardSourceKey,
  questionBankLessonFlashcardSourceKey,
} from "./lib/lessonFlashcardGroupDraws";
import { collectQuestionBankDescendantFolderIds } from "./lib/questionBankFolderQueries";
import { getStoredLessonFlashcardDeckConfig } from "./lib/resolveLessonFlashcardDeck";

describe("lesson flashcard Question Bank group draws", () => {
  it("keeps valid, unique group draw configurations bounded", () => {
    expect(normalizeLessonFlashcardGroupDraws([
      { folderId: 12, folderName: "Review", count: 250 },
      { folderId: 12, folderName: "Duplicate", count: 3 },
      { folderId: 0, folderName: "Invalid", count: 3 },
      { folderId: 14, folderName: "", count: 2.9 },
    ])).toEqual([
      { folderId: 12, folderName: "Review", count: 200 },
      { folderId: 14, folderName: "Question Bank group 14", count: 2 },
    ]);
  });

  it("does not traverse another organization’s Question Bank folders", () => {
    const folders = [
      { id: 1, orgId: 7, parentId: null, name: "Root" },
      { id: 2, orgId: 7, parentId: 1, name: "Child" },
      { id: 3, orgId: 9, parentId: 1, name: "Other organization" },
    ];
    expect(collectQuestionBankDescendantFolderIds(folders, 1, 7)).toEqual([1, 2]);
    expect(collectQuestionBankDescendantFolderIds(folders, 3, 7)).toEqual([]);
  });

  it("produces stable, validated source keys for authored and bank cards", () => {
    expect(authoredLessonFlashcardSourceKey(4)).toBe("manual:4");
    expect(questionBankLessonFlashcardSourceKey(21)).toBe("bank:21");
    expect(parseLessonFlashcardSourceKey("manual:4")).toEqual({ kind: "manual", index: 4 });
    expect(parseLessonFlashcardSourceKey("bank:21")).toEqual({ kind: "bank", questionBankId: 21 });
    expect(parseLessonFlashcardSourceKey("bank:invalid")).toBeNull();
  });

  it("allows a group-only deck while rejecting a blank deck", () => {
    expect(getStoredLessonFlashcardDeckConfig(JSON.stringify([{
      id: "deck-1",
      type: "lesson_flashcard",
      data: { title: "Review", cards: [], questionBankGroupDraws: [{ folderId: 4, folderName: "Bank", count: 3 }] },
    }]), "deck-1")).toMatchObject({ id: "deck-1", cards: [], groupDraws: [{ folderId: 4, count: 3 }] });
    expect(getStoredLessonFlashcardDeckConfig(JSON.stringify([{
      id: "blank",
      type: "lesson_flashcard",
      data: { cards: [] },
    }]), "blank")).toBeNull();
  });
});
