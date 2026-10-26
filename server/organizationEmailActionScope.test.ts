import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminUserRouterSource = readFileSync(
  new URL("./routers/adminUserRouter.ts", import.meta.url),
  "utf8",
);
const cmeDisclosureRouterSource = readFileSync(
  new URL("./routers/cmeDisclosureRouter.ts", import.meta.url),
  "utf8",
);
const generalFormRouterSource = readFileSync(
  new URL("./routers/generalFormRouter.ts", import.meta.url),
  "utf8",
);
const formAnalyticsSource = readFileSync(
  new URL("../client/src/components/admin/FormAnalyticsDeep.tsx", import.meta.url),
  "utf8",
);
const formActionsSource = readFileSync(
  new URL("./lib/generalFormActions.ts", import.meta.url),
  "utf8",
);

function procedureSource(source: string, name: string) {
  const start = source.indexOf(`${name}:`);
  const docEnd = source.indexOf("\n  /**", start + 1);
  const sectionEnd = source.indexOf("\n  // ───", start + 1);
  const end = [docEnd, sectionEnd].filter(index => index !== -1).sort((a, b) => a - b)[0];
  return source.slice(start, end);
}

describe("organization transactional email action scope", () => {
  it("uses the active organization sender for member password, membership, and purchase access emails", () => {
    const passwordReset = procedureSource(adminUserRouterSource, "sendPasswordReset");
    const membershipConfirmation = procedureSource(adminUserRouterSource, "resendMembershipConfirmation");
    const purchaseAccess = procedureSource(adminUserRouterSource, "resendAccessEmail");

    for (const procedure of [passwordReset, membershipConfirmation, purchaseAccess]) {
      expect(procedure).toContain("sendEmailViaOrg({");
      expect(procedure).toContain("}, orgId);");
      expect(procedure).not.toMatch(/await sendEmail\s*\(/);
    }
    expect(membershipConfirmation).not.toContain("Teachific membership");
  });

  it("uses the already-authorized CME organization sender for disclosure requests", () => {
    const disclosureEmail = procedureSource(cmeDisclosureRouterSource, "sendDisclosureEmail");

    expect(disclosureEmail).toContain("const orgId = await resolveOrgId");
    expect(disclosureEmail).toContain("await assertCmeEnabled(orgId");
    expect(disclosureEmail).toContain("sendEmailViaOrg({");
    expect(disclosureEmail).toContain("}, orgId);");
    expect(disclosureEmail).not.toMatch(/await sendEmail\s*\(/);
  });

  it("requires exact form organization authorization and members-only recipients for follow-up emails", () => {
    const analytics = procedureSource(generalFormRouterSource, "getDropOffAnalytics");
    const abandoners = procedureSource(generalFormRouterSource, "getDropOffAbandonerEmails");
    const followUp = procedureSource(generalFormRouterSource, "sendDropOffFollowUp");

    expect(generalFormRouterSource).toContain("async function requireFormAdminForTemplate");
    expect(generalFormRouterSource).toContain("requireOrgAdmin(ctx.user.id, ctx.user.role, template.orgId)");
    expect(analytics).toContain("requireFormAdminForTemplate(ctx, db, input.templateId)");
    expect(abandoners).toContain("const orgId = await requireFormAdminForTemplate(ctx, db, input.templateId)");
    expect(abandoners).toContain("SELECT userId FROM org_members WHERE orgId = ${orgId}");
    expect(followUp).toContain("const orgId = await requireFormAdminForTemplate(ctx, db, input.templateId)");
    expect(followUp).toContain("eq(orgMembers.orgId, orgId)");
    expect(followUp).toContain("leftJoin(emailUnsubscribes");
    expect(followUp).toContain("isNull(emailUnsubscribes.id)");
    expect(followUp).toContain("sendEmailViaOrg({");
    expect(followUp).toContain("}, orgId);");
    expect(followUp).not.toMatch(/await sendEmail\s*\(/);
  });

  it("removes source-project brand selection from the form follow-up composer", () => {
    expect(formAnalyticsSource).toContain("this form’s organization email settings");
    expect(formAnalyticsSource).not.toContain('const [brand, setBrand]');
    expect(formAnalyticsSource).not.toContain("brandMode: brand");
    expect(formAnalyticsSource).not.toContain("Teachific</option>");
  });

  it("delivers configured form notifications with the exact form organization sender", () => {
    expect(formActionsSource).toContain("orgId: number;");
    expect(formActionsSource).toContain("sendEmailViaOrg({");
    expect(formActionsSource).toContain("}, orgId);");
    expect(formActionsSource).toContain("lines.join(\"\\n\"), context.orgId");
    expect(formActionsSource).not.toMatch(/sendEmail\(\{ to, subject, html:/);

    const updateSubmission = procedureSource(generalFormRouterSource, "updateSubmissionResponses");
    const bulkUpdate = procedureSource(generalFormRouterSource, "bulkUpdateSubmissions");
    const publicSubmission = procedureSource(generalFormRouterSource, "submitForm");
    for (const procedure of [updateSubmission, bulkUpdate, publicSubmission]) {
      expect(procedure).toContain("orgId: template.orgId");
    }
  });
});
