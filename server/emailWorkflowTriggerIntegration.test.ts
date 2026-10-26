import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("email workflow trigger integrations", () => {
  const engine = read("server/lib/emailWorkflowEngine.ts");
  const learnerRouter = read("server/routers/lmsRouter.ts");
  const checkout = read("server/lib/lmsCheckoutFulfillment.ts");
  const stripeWebhook = read("server/stripeWebhookRoutes.ts");
  const tracking = read("server/routes/emailTrackingRoutes.ts");

  it("retains the supported activity and engagement workflow trigger vocabulary", () => {
    expect(engine).toContain('"lesson_completed"');
    expect(engine).toContain('"course_completed"');
    expect(engine).toContain('"course_enrolled"');
    expect(engine).toContain('"purchase_completed"');
    expect(engine).toContain('"campaign_opened"');
    expect(engine).toContain('"campaign_clicked"');
  });

  it("emits learner completion and free-enrollment events with server-derived organization identifiers", () => {
    expect(learnerRouter).toContain('import { emitEmailWorkflowEvent } from "../lib/emailWorkflowEngine"');
    expect(learnerRouter).toContain('idempotencyKey: `lesson_completed:${course.orgId}:${enrollment.id}:${input.lessonId}`');
    expect(learnerRouter).toContain('idempotencyKey: `course_completed:${course.orgId}:${enrollment.id}`');
    expect(learnerRouter).toContain('idempotencyKey: `course_enrolled:${course.orgId}:${result.id}`');
    expect(learnerRouter).toContain('orgId: course.orgId, userId: ctx.user.id, courseId: course.id');
  });

  it("emits checkout events only after durable Course360 fulfillment and uses Stripe-session idempotency", () => {
    expect(checkout).toContain('if (customerEmail && course && (shouldRenew || !existingEnrollment))');
    expect(checkout).toContain('eventType: "purchase_completed"');
    expect(checkout).toContain('eventType: "course_enrolled"');
    expect(checkout).toContain('idempotencyKey: `purchase_completed:${course.orgId}:${sessionId}`');
    expect(checkout).toContain('idempotencyKey: `course_enrolled:${course.orgId}:${enrollment.id}`');
    expect(stripeWebhook).toContain('sourceType: "stripe_course_checkout"');
    expect(stripeWebhook).toContain('sourceType: "stripe_download_checkout"');
    expect(stripeWebhook).toContain('idempotencyKey: `purchase_completed:${download.orgId}:${session.id}`');
  });

  it("triggers campaign engagement only for the campaign recipient joined to its owning organization", () => {
    expect(tracking).toContain('innerJoin(emailCampaigns, eq(emailCampaigns.id, emailCampaignRecipients.campaignId))');
    expect(tracking).toContain('eventType: "campaign_opened"');
    expect(tracking).toContain('eventType: "campaign_clicked"');
    expect(tracking).toContain('idempotencyKey: `campaign_opened:${recipient.orgId}:${campaignId}:${recipient.id}`');
    expect(tracking).toContain('idempotencyKey: `campaign_clicked:${recipient.orgId}:${campaignId}:${recipient.id}`');
    expect(tracking).toContain('return res.redirect(302, targetUrl)');
  });
});
