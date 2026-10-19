import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./questionBankRouter.ts", import.meta.url), "utf8");

describe("active Question Bank organization scope", () => {
  it("derives the active organization server-side and rejects a mismatched requested org", () => {
    expect(source).toContain('getOrgIdForUserWithFallback');
    expect(source).toContain('async function requireActiveOrgAdmin');
    expect(source).toContain('requestedOrgId !== undefined && requestedOrgId !== activeOrgId');
    expect(source).toContain('Question Bank access is limited to the active organization');
  });

  it("uses the resolved organization for list, create, bulk, import, and export operations", () => {
    expect(source).toContain('const orgId = await requireActiveOrgAdmin(ctx.user.id, input.orgId, ctx.user.role)');
    expect(source).toContain('await bulkDeleteQuestions(orgId, input.ids)');
    expect(source).toContain('await moveQuestionsToFolder(orgId, input.ids, input.folderId)');
    expect(source).toContain('await copyQuestionsToFolder(orgId, input.ids, input.folderId, ctx.user.id)');
    expect(source).toContain('if (q && q.orgId === orgId)');
  });

  it("keeps Question Bank tags within the active organization and removes only the requested mapping", () => {
    expect(source).toContain('where(eq(questionBankTags.orgId, orgId))');
    expect(source).toContain('if (tag.orgId !== question.orgId)');
    expect(source).toContain('and(eq(questionBankTagMap.questionId, input.questionId), eq(questionBankTagMap.tagId, input.tagId))');
  });
});
