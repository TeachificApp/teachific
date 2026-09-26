import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");
const editorSource = readFileSync(new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../client/src/pages/marketing/EmailCampaignDashboard.tsx", import.meta.url), "utf8");

describe("scheduled campaign lifecycle safeguards", () => {
  it("creates a replacement task only for the active organization's scheduled campaign", () => {
    const rescheduleSlice = routerSource.slice(
      routerSource.indexOf("rescheduleCampaign: protectedProcedure"),
      routerSource.indexOf("// ── Admin: cancel a scheduled campaign"),
    );
    expect(rescheduleSlice).toContain("const orgId = await requireActiveEmailMarketingOrg(ctx.user)");
    expect(rescheduleSlice).toContain("await requireCampaignForOrg(db, input.id, orgId)");
    expect(rescheduleSlice).toContain('campaign.status !== "scheduled"');
    expect(rescheduleSlice).toContain("organizationLocalScheduleToUtc(input.scheduledLocalTime, orgContext.timezone)");
    expect(rescheduleSlice).toContain("await validateAudienceScopeForOrg(db, input.audienceFilter, orgId)");
    expect(rescheduleSlice).toContain("await validateSenderProfileForOrg(db, input.senderProfileId, orgId)");
    expect(rescheduleSlice).toContain("const job = await createHeartbeatJob");
    expect(rescheduleSlice).toContain("scheduleCronTaskUid: job.taskUid");
    expect(rescheduleSlice).toContain("await deleteHeartbeatJob(campaign.scheduleCronTaskUid, sessionToken)");
    expect(rescheduleSlice.indexOf("const job = await createHeartbeatJob")).toBeLessThan(
      rescheduleSlice.indexOf("scheduleCronTaskUid: job.taskUid"),
    );
  });

  it("keeps existing scheduled tasks from being silently converted into drafts", () => {
    const draftSlice = routerSource.slice(
      routerSource.indexOf("saveDraft: protectedProcedure"),
      routerSource.indexOf("// ─── Lead Capture Widgets"),
    );
    expect(draftSlice).toContain('existingCampaign.status !== "draft"');
    expect(draftSlice).toContain("Use the reschedule action or cancel the scheduled campaign");

    const deleteSlice = routerSource.slice(
      routerSource.indexOf("deleteCampaign: protectedProcedure"),
      routerSource.indexOf("// ── Admin: option lists for audience builder"),
    );
    expect(deleteSlice).toContain("campaign.scheduleCronTaskUid");
    expect(deleteSlice).toContain("await deleteHeartbeatJob(campaign.scheduleCronTaskUid, sessionToken)");

    const cancelSlice = routerSource.slice(
      routerSource.indexOf("cancelScheduled: protectedProcedure"),
      routerSource.indexOf("// ── Admin: sender profiles"),
    );
    expect(cancelSlice).toContain("scheduledAt: null, scheduledTimezone: null");
  });

  it("refuses delivery when the campaign organization becomes inactive", () => {
    const deliverySlice = routerSource.slice(
      routerSource.indexOf("export async function executeCampaignSend"),
      routerSource.indexOf("// ─── Scheduled campaign cron"),
    );
    expect(deliverySlice).toContain("select({ isActive: organizations.isActive })");
    expect(deliverySlice).toContain("if (!organization?.isActive)");
    expect(deliverySlice).toContain('errorMessage: "Campaign organization is inactive."');
  });

  it("reschedules in place from the editor without creating another campaign", () => {
    expect(editorSource).toContain("trpc.emailCampaign.rescheduleCampaign.useMutation");
    expect(editorSource).toContain("rescheduleMutation.mutate({ id: campaignId, ...schedulePayload })");
    expect(editorSource).toContain("Use Reschedule to save changes to a scheduled campaign.");
    expect(editorSource).toContain('isScheduledCampaign ? "Reschedule" : "Schedule"');
    expect(editorSource).toContain("campaign.scheduledTimezone ?? \"UTC\"");
    expect(editorSource).toContain("senderProfileId,");
    expect(dashboardSource).toContain("trpc.emailCampaign.cancelScheduled.useMutation");
    expect(dashboardSource).toContain("Cancel schedule and return to draft");
  });
});
