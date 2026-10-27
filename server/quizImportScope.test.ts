import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const importRouteSource = readFileSync(new URL("./quizImportRoutes.ts", import.meta.url), "utf8");
const questionBankSource = readFileSync(new URL("./questionBankRouter.ts", import.meta.url), "utf8");
const stagedQuizBankSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
const importWizardSource = readFileSync(new URL("../client/src/pages/QuestionBankImportPage.tsx", import.meta.url), "utf8");
const fileDetailSource = readFileSync(new URL("../client/src/pages/FileDetailPage.tsx", import.meta.url), "utf8");
const iSpringMediaSource = readFileSync(new URL("./lib/iSpringImageImporter.ts", import.meta.url), "utf8");

describe("Course360 SCORM and .quiz import isolation", () => {
  it("derives the import organization from the authenticated active admin context", () => {
    expect(importRouteSource).toContain("async function requireActiveQuestionBankImportOrg");
    expect(importRouteSource).toContain("getOrgIdForUserWithFallback(user.id, user.role)");
    expect(importRouteSource).toContain("await requireOrgAdmin(user.id, user.role, orgId)");
    expect(importRouteSource).toContain("Select an active organization before importing questions.");
  });

  it("accepts native hosting only for the active organization's staged import key", () => {
    expect(importRouteSource).toContain("question-bank-imports/${orgId}/");
    expect(importRouteSource).toContain("isOwnedStagedImportKey(hostedPackageKey, orgId)");
    expect(importRouteSource).toContain("The hosted package does not belong to the active organization.");
    expect(importRouteSource).toContain("const packageId = Number((createdPackage as { insertId?: number }).insertId);");
    expect(importRouteSource).not.toContain("orderBy(desc(contentPackages.createdAt))");
    expect(importRouteSource).toContain('router.get("/bank-import/package/:packageId/download"');
    expect(importRouteSource).toContain("originalZipUrl: `/api/quiz/bank-import/package/${packageId}/download`");
    expect(importRouteSource).not.toContain("originalZipUrl: downloadUrl");
  });

  it("resolves hosted-package extraction from the server-owned package record instead of a browser storage key", () => {
    expect(importRouteSource).toContain("const { packageId } = req.body");
    expect(importRouteSource).toContain("const contentPackage = await getPackageById(packageId);");
    expect(importRouteSource).toContain("contentPackage.orgId !== orgId");
    expect(fileDetailSource).toContain("JSON.stringify({ packageId })");
    expect(fileDetailSource).not.toContain("JSON.stringify({ packageKey:");
  });

  it("keeps imported SCORM and .quiz media under the owning organization", () => {
    expect(iSpringMediaSource).toContain("question-bank/org-${orgId}/ispring");
    expect(importRouteSource).toContain("uploadISpringImagesFromZip(zipEntries, allRefs, orgId)");
    expect(importRouteSource).toContain("uploadISpringImagesFromZip(zipEntries, parsed.allImageRefs, orgId)");
    expect(stagedQuizBankSource).toContain("uploadISpringImagesFromZip(zip.getEntries(), parsed.allImageRefs, importJobAccess.orgId)");
    expect(stagedQuizBankSource).toContain("uploadISpringImagesFromZip(zip.getEntries(), qtiImageRefs, importJobAccess.orgId)");
  });

  it("rejects Question Bank folder references outside the active organization", () => {
    expect(questionBankSource).toContain("async function requireQuestionBankFolderInOrg");
    expect(questionBankSource).toContain("The selected Question Bank folder does not belong to the active organization");
    expect(questionBankSource).toContain("await requireQuestionBankFolderInOrg(input.folderId, orgId)");
    expect(questionBankSource).toContain("A Question Bank folder cannot be its own parent");
  });

  it("keeps the existing host, bank, and host-plus-bank choices while removing legacy platform copy", () => {
    expect(importWizardSource).toContain('importMode === "native-only" || importMode === "both"');
    expect(importWizardSource).toContain('importMode === "bank-only" || importMode === "both"');
    expect(importWizardSource).toContain("Course360 .quiz archive");
    expect(importWizardSource).toContain("Course360-compatible Excel file");
    expect(fileDetailSource).toContain("Course360 .quiz");
    expect(importWizardSource).not.toContain("iSpring/Teachific");
  });
});
