import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const activeOrgId = 42;
const queryRows: unknown[][] = [];
const insertedRows: unknown[] = [];

function queuedQuery() {
  const rows = queryRows.shift() ?? [];
  return {
    limit: async () => rows,
    then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
  };
}

const mockDb = {
  select: () => ({ from: () => ({ where: () => queuedQuery() }) }),
  update: () => ({ set: () => ({ where: async () => undefined }) }),
  insert: () => ({
    values: async (values: unknown) => {
      insertedRows.push(values);
      return [{ insertId: insertedRows.length === 1 ? 901 : 902 }];
    },
  }),
};

vi.mock("./db", () => ({
  getDb: async () => mockDb,
  getOrgIdForUserWithFallback: async () => activeOrgId,
  requireOrgAdmin: async () => activeOrgId,
}));

vi.mock("./lib/iSpringQuizParser", () => ({
  parseISpringQuizFromBuffer: vi.fn().mockResolvedValue({
    allImageRefs: ["question.png", "choice.png"],
    groups: [{
      name: "Module 1",
      questions: [{
        type: "mcq",
        questionText: "Which image is shown?",
        questionHtml: "<p>Which image is shown?</p>",
        imageRefs: ["question.png"],
        explanationText: "Review the image.",
        answers: [{ text: "Correct option", html: "Correct option", isCorrect: true, imageRef: "choice.png" }],
      }],
    }],
  }),
}));

vi.mock("./lib/iSpringImageImporter", () => ({
  rewriteStorageRefs: (content: string) => content,
  uploadISpringImagesFromZip: vi.fn().mockResolvedValue(new Map([
    ["question.png", "https://media.example.test/question.png"],
    ["choice.png", "https://media.example.test/choice.png"],
  ])),
}));

vi.mock("adm-zip", () => ({
  default: class MockZip { getEntries() { return []; } },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { quizBankRouter } = await import("./routers/quizBankRouter");

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 9, openId: "org-admin", email: "admin@example.test", name: "Organization administrator",
      loginMethod: "manus", role: "org_admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Course360 iSpring Question Bank media import", () => {
  beforeEach(() => {
    queryRows.length = 0;
    insertedRows.length = 0;
    fetchMock.mockReset().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([80, 75, 3, 4]).buffer });
  });

  it("persists parsed iSpring question and choice media under the active organization", async () => {
    const caller = quizBankRouter.createCaller(createAdminContext());
    queryRows.push(
      [{ orgId: activeOrgId }],
      [{ source: "scorm", fileUrl: "https://media.example.test/lesson.zip", filename: "lesson.zip" }],
    );

    const parsed = await caller.parseImportFile({ jobId: 55 });
    expect(parsed.questions[0]).toMatchObject({
      mediaType: "image",
      mediaUrl: "https://media.example.test/question.png",
      choices: [expect.objectContaining({ mediaUrl: "https://media.example.test/choice.png" })],
    });

    queryRows.push(
      [{ orgId: activeOrgId }],
      [{ orgId: activeOrgId }],
      [{ orgId: activeOrgId, parsedQuestions: parsed.questions }],
    );
    await caller.confirmImport({ jobId: 55, bankId: 12, orgId: activeOrgId });

    expect(insertedRows[0]).toEqual(expect.objectContaining({
      orgId: activeOrgId,
      bankId: 12,
      mediaType: "image",
      mediaUrl: "https://media.example.test/question.png",
    }));
    expect(insertedRows[1]).toEqual([expect.objectContaining({
      mediaType: "image",
      mediaUrl: "https://media.example.test/choice.png",
    })]);
  });
});
