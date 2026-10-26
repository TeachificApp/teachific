import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lmsRouterSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
const cohortAdminSource = readFileSync(new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url), "utf8");
const embeddedCheckoutSource = readFileSync(new URL("./embeddedCheckoutWebhook.ts", import.meta.url), "utf8");
const stripeWebhookSource = readFileSync(new URL("./stripeWebhookRoutes.ts", import.meta.url), "utf8");
const sendgridSource = readFileSync(new URL("./sendgrid.ts", import.meta.url), "utf8");

function procedureSource(source: string, name: string) {
  const start = source.indexOf(`${name}:`);
  const end = source.indexOf("\n  /**", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("organization transactional email routing", () => {
  it("routes a public free-preview confirmation through the verified course organization", () => {
    const freePreview = procedureSource(lmsRouterSource, "registerFreePreview");

    expect(freePreview).toContain("eq(lmsCourses.orgId, publicScope.id)");
    expect(freePreview).toContain("sendEmailViaOrg({");
    expect(freePreview).toContain("}, course.orgId)");
    expect(freePreview).not.toMatch(/\bsendEmail\s*\(/);
  });

  it("routes cohort learner notices using the course organization sender", () => {
    const sessionNotice = procedureSource(cohortAdminSource, "createCohortSession");
    const assignmentNotice = procedureSource(cohortAdminSource, "createCohortAssignment");

    for (const procedure of [sessionNotice, assignmentNotice]) {
      expect(procedure).toContain("getCohortNotificationRecipients(input.courseId, input.cohortGroupId)");
      expect(procedure).toContain("sendEmailViaOrg({");
      expect(procedure).toContain("}, course?.orgId)");
      expect(procedure).not.toMatch(/\bsendEmail\s*\(/);
    }
  });

  it("routes organization purchase alerts through the owning organization", () => {
    expect(embeddedCheckoutSource).toContain("sendEmailViaOrg({");
    expect(embeddedCheckoutSource).toContain("}, purchase.orgId).catch");

    const purchaseNotifier = stripeWebhookSource.slice(
      stripeWebhookSource.indexOf("async function notifyOrgAdminsOfPurchase"),
      stripeWebhookSource.indexOf("const router = express.Router()"),
    );
    expect(purchaseNotifier).toContain("sendEmailViaOrg({");
    expect(purchaseNotifier).toContain("}, orgId).catch");
    expect(purchaseNotifier).not.toContain("sendEmailCore");
  });

  it("uses an isolated SendGrid client for a tenant-specific delivery key", () => {
    expect(sendgridSource).toContain('import sgMail, { MailService } from "@sendgrid/mail";');
    expect(sendgridSource).toContain("const mailer = opts.apiKey ? new MailService() : sgMail;");
    expect(sendgridSource).toContain("if (opts.apiKey) mailer.setApiKey(apiKey);");
    expect(sendgridSource).not.toContain("sgMail.setApiKey(opts.apiKey)");
  });
});
