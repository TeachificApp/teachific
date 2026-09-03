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
  parseISpringQuizFromBuffer: vi.fn().mockRejectedValue(new Error("Not an iSpring package")),
}));

vi.mock("./lib/iSpringImageImporter", () => ({
  rewriteStorageRefs: (content: string) => content,
  uploadISpringImagesFromZip: vi.fn().mockResolvedValue(new Map([
    ["images/question.png", "https://media.example.test/question.png"],
    ["images/choice.png", "https://media.example.test/choice.png"],
  ])),
}));

const qtiXml = `<?xml version="1.0"?><questestinterop><assessment><item><presentation><material><mattext>Identify the image <matimage uri="images/question.png" /></mattext></material><response_lid rcardinality="single"><render_choice><response_label ident="a"><material><mattext>Correct <matimage uri="images/choice.png" /></mattext></material></response_label></render_choice></response_lid></presentation><resprocessing><respcondition><conditionvar><varequal>a</varequal></conditionvar></respcondition></resprocessing></item></assessment></questestinterop>`;
vi.mock("adm-zip", () => ({
  default: class MockZip { getEntries() { return [{ entryName: "assessment.xml", getData: () => Buffer.from(qtiXml) }]; } },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const { quizBankRouter } = await import("./routers/quizBankRouter");

function createAdminContext(): TrpcContext {
  return {
    user: { id: 9, openId: "org-admin", email: "admin@example.test", name: "Organization administrator", loginMethod: "manus", role: "org_admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Course360 generic QTI SCORM Question Bank media import", () => {
  beforeEach(() => {
    queryRows.length = 0;
    insertedRows.length = 0;
    fetchMock.mockReset().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([80, 75, 3, 4]).buffer });
  });

  it("preserves package-contained QTI question and choice images through parse and active-organization confirmation", async () => {
    const caller = quizBankRouter.createCaller(createAdminContext());
    queryRows.push(
      [{ orgId: activeOrgId }],
      [{ source: "scorm", fileUrl: "https://media.example.test/assessment.zip", filename: "assessment.zip" }],
    );
    const parsed = await caller.parseImportFile({ jobId: 55 });
    expect(parsed.questions[0]).toMatchObject({
      mediaType: "image", mediaUrl: "https://media.example.test/question.png",
      choices: [expect.objectContaining({ mediaType: "image", mediaUrl: "https://media.example.test/choice.png" })],
    });

    queryRows.push(
      [{ orgId: activeOrgId }],
      [{ orgId: activeOrgId }],
      [{ orgId: activeOrgId, parsedQuestions: parsed.questions }],
    );
    await caller.confirmImport({ jobId: 55, bankId: 12, orgId: activeOrgId });
    expect(insertedRows[0]).toEqual(expect.objectContaining({ orgId: activeOrgId, mediaUrl: "https://media.example.test/question.png" }));
    expect(insertedRows[1]).toEqual([expect.objectContaining({ mediaUrl: "https://media.example.test/choice.png", mediaType: "image" })]);
  });
});
