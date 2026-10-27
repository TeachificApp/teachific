import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getFlashcardDecksByOrg = vi.hoisted(() => vi.fn());
const createFlashcardDeck = vi.hoisted(() => vi.fn());
const getFlashcardDeckById = vi.hoisted(() => vi.fn());
const getCardsByDeck = vi.hoisted(() => vi.fn());
const invokeLLM = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getOrgIdForUserWithFallback,
  requireOrgAdmin,
}));

vi.mock("./lmsDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lmsDb")>()),
  getFlashcardDecksByOrg,
  createFlashcardDeck,
  getFlashcardDeckById,
  getCardsByDeck,
}));

vi.mock("./_core/llm", () => ({ invokeLLM }));

const { lmsRouter } = await import("./lmsRouter");

function caller(role = "org_admin") {
  return lmsRouter.createCaller({
    user: { id: 101, role, email: "admin@example.test" },
    req: { headers: {}, socket: {} },
  } as any);
}

describe("Course360 legacy Flashcard administration scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(undefined);
    getFlashcardDecksByOrg.mockResolvedValue([{ id: 41, orgId: 7, title: "Current school deck" }]);
    createFlashcardDeck.mockResolvedValue({ id: 42, orgId: 7, title: "New deck" });
    getFlashcardDeckById.mockResolvedValue({ id: 41, orgId: 7, title: "Current school deck" });
    getCardsByDeck.mockResolvedValue([{ id: 51, deckId: 41, front: "Question", back: "Answer" }]);
    invokeLLM.mockResolvedValue({
      choices: [{ message: { content: '[{"front":"Question","back":"Answer"}]' } }],
    });
  });

  it("lists and creates decks only in the server-resolved active organization", async () => {
    await expect(caller().flashcards.listDecks()).resolves.toEqual([
      expect.objectContaining({ id: 41, orgId: 7 }),
    ]);
    await caller().flashcards.createDeck({
      title: "New deck",
      description: "Scoped authoring",
      category: "Learning",
      orgId: 7,
    });

    expect(getFlashcardDecksByOrg).toHaveBeenCalledWith(7);
    expect(createFlashcardDeck).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7,
      createdBy: 101,
      title: "New deck",
    }));
    expect(requireOrgAdmin).toHaveBeenCalledWith(101, "org_admin", 7);
  });

  it("rejects a stale or forged organization hint before listing, creating, or generating", async () => {
    const requests = [
      () => caller().flashcards.listDecks({ orgId: 8 }),
      () => caller().flashcards.createDeck({ orgId: 8, title: "Wrong school" }),
      () => caller().flashcards.generateAI({ orgId: 8, topic: "Wrong school content" }),
    ];

    for (const request of requests) {
      await expect(request()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Switch to the flashcard deck's organization before managing its flashcards.",
      });
    }

    expect(getFlashcardDecksByOrg).not.toHaveBeenCalled();
    expect(createFlashcardDeck).not.toHaveBeenCalled();
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("rejects another organization's deck before deleting it or reading and saving its cards", async () => {
    getFlashcardDeckById.mockResolvedValue({ id: 91, orgId: 8, title: "Other school deck" });

    const requests = [
      () => caller().flashcards.deleteDeck({ id: 91 }),
      () => caller().flashcards.getCards({ deckId: 91 }),
      () => caller().flashcards.saveCards({
        deckId: 91,
        cards: [{ front: "Question", back: "Answer", sortOrder: 0 }],
      }),
    ];
    for (const request of requests) {
      await expect(request()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "This flashcard deck belongs to another organization.",
      });
    }
    expect(getCardsByDeck).not.toHaveBeenCalled();
  });

  it("keeps AI generation within the active organization and retains author context", async () => {
    await expect(caller().flashcards.generateAI({
      orgId: 7,
      topic: "Cardiology",
      count: 3,
      context: "Focus on terminology.",
    })).resolves.toEqual({ cards: [{ front: "Question", back: "Answer" }] });

    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining("Create 3 flashcards about: Cardiology") }),
        expect.objectContaining({ content: expect.stringContaining("Focus on terminology.") }),
      ]),
    }));
  });
});
