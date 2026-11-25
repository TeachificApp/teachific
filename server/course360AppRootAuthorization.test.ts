import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
const source = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("routers.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
// Execute actual production procedure expressions with injected DB/provider boundaries.
// This is not a reimplementation of the authorization decisions.
function procedure(name: string, ancestor?: string) {
  let found: ts.PropertyAssignment | undefined;
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === name) {
      let parent: ts.Node | undefined = node.parent; let matches = !ancestor;
      while (parent) { if (ts.isPropertyAssignment(parent) && parent.name.getText(ast) === ancestor) matches = true; parent = parent.parent; }
      if (matches) found = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); if (!found) throw new Error(`Missing production procedure ${name}`);
  const emitted = ts.transpileModule(`(${found.initializer.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const chain: any = { input: () => chain, query: (handler: any) => handler, mutation: (handler: any) => handler };
  return vm.runInNewContext(emitted, { protectedProcedure: chain, publicProcedure: chain, adminProcedure: chain, z, TRPCError, requireCourse360AppCapability: m.require, requireCourse360AppOrganization: m.org, getCourse360AppCapabilityStatus: m.status, setCourse360PaymentManualRole: m.grant, getQuizById: m.quiz, createQuiz: m.create, Buffer, getUserById: m.user });
}
const m = { require: vi.fn(), org: vi.fn(), status: vi.fn(), grant: vi.fn(), quiz: vi.fn(), create: vi.fn(), user: vi.fn() };
const ctx = { user: { id: 10, role: "site_owner" } };
beforeEach(() => { vi.clearAllMocks(); m.require.mockRejectedValue(new Error("Capability denied before parsing/provider work")); m.org.mockResolvedValue({ orgId: 7, platformSupport: true }); m.status.mockResolvedValue({ orgId: 7, access: { tier: "web", isActive: true, isPaid: false, hasManualGrant: true, isInTrial: false }, platformSupport: false, reason: null }); });
describe("actual owned root authorization ranges", () => {
  it("XLS export denies before dynamic parser/import and source reads", async () => {
    await expect(procedure("exportXls")({ ctx, input: { quizId: 12 } })).rejects.toThrow("Capability denied");
    expect(m.require).toHaveBeenCalledWith(10, "quiz_creator", "web"); expect(m.quiz).not.toHaveBeenCalled();
  });
  it("XLS import denies before binary decoding/parser", async () => {
    await expect(procedure("importXls")({ ctx, input: { base64: "invalid" } })).rejects.toThrow("Capability denied");
    expect(m.require).toHaveBeenCalledWith(10, "quiz_creator", "web");
  });
  it("legacy quiz import rejects browser foreign-school hint before parsing or insert", async () => {
    m.require.mockResolvedValue({ orgId: 7 });
    await expect(procedure("importFromQuizMaker")({ ctx, input: { orgId: 8, quizFileContent: "not-a-quiz" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("Quiz role query uses canonical scoped status, not user global or expired-trial shortcuts", async () => {
    const result = await procedure("getMyRole", "quizCreator")({ ctx });
    expect(m.status).toHaveBeenCalledWith(10, "quiz_creator", "web");
    expect(result).toMatchObject({ orgId: 7, role: "web", isPaid: false, hasManualGrant: true }); expect(m.user).not.toHaveBeenCalled();
  });
  it("manual role writer uses selected school and scoped ledger provenance without updating global fields", async () => {
    await procedure("setUserRole", "quizCreator")({ ctx, input: { userId: 11, role: "bundle" } });
    expect(m.grant).toHaveBeenCalledWith({ orgId: 7, userId: 11, product: "quiz_creator", tier: "bundle", actorId: 10, source: "platform-admin", reason: "Explicit authenticated administrator grant", expiresAt: null });
    m.org.mockResolvedValue({ orgId: 7, platformSupport: false });
    await expect(procedure("setUserRole", "quizCreator")({ ctx, input: { userId: 11, role: "web" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("latest-version reader requires Desktop capability before metadata query", async () => {
    await expect(procedure("getLatestAppVersion")({ ctx, input: { product: "quizcreator" } })).rejects.toThrow("Capability denied");
    expect(m.require).toHaveBeenCalledWith(10, "quiz_creator", "desktop");
  });
});
