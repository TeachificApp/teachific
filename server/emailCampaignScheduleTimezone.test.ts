import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  formatUtcForOrganizationDateTimeInput,
  organizationLocalScheduleToUtc,
} from "../shared/emailCampaignSchedule";

const routerSource = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");
const editorSource = readFileSync(new URL("../client/src/pages/EmailCampaignEditor.tsx", import.meta.url), "utf8");
const orgSettingsSource = readFileSync(new URL("../client/src/pages/OrgSettingsPage.tsx", import.meta.url), "utf8");
const orgRouterSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

describe("organization-local campaign scheduling", () => {
  it("converts a normal organization-local datetime into an exact UTC instant", () => {
    const instant = organizationLocalScheduleToUtc("2026-01-15T09:30", "America/New_York");
    expect(instant.toISOString()).toBe("2026-01-15T14:30:00.000Z");
    expect(formatUtcForOrganizationDateTimeInput(instant, "America/New_York")).toBe("2026-01-15T09:30");
  });

  it("rejects nonexistent and ambiguous daylight-saving wall-clock times", () => {
    expect(() => organizationLocalScheduleToUtc("2026-03-08T02:30", "America/New_York"))
      .toThrow("does not exist");
    expect(() => organizationLocalScheduleToUtc("2026-11-01T01:30", "America/New_York"))
      .toThrow("occurs twice");
  });

  it("keeps a normal post-fallback schedule unambiguous", () => {
    const instant = organizationLocalScheduleToUtc("2026-11-01T03:30", "America/New_York");
    expect(instant.toISOString()).toBe("2026-11-01T08:30:00.000Z");
  });

  it("uses the server-resolved organization timezone rather than browser date parsing", () => {
    const scheduleSlice = routerSource.slice(
      routerSource.indexOf("scheduleCampaign: protectedProcedure"),
      routerSource.indexOf("// ── Admin: cancel a scheduled campaign"),
    );
    expect(scheduleSlice).toContain("scheduledLocalTime");
    expect(scheduleSlice).toContain("organizationLocalScheduleToUtc(input.scheduledLocalTime, orgContext.timezone)");
    expect(scheduleSlice).toContain("scheduledAt,");
    expect(scheduleSlice).toContain("scheduledTimezone: orgContext.timezone");
    expect(scheduleSlice).toContain("cron: cronExpressionForDate(scheduledAt)");
    expect(scheduleSlice).not.toContain("input.scheduledAt");
  });

  it("exposes the active organization timezone in settings and the campaign composer", () => {
    expect(orgRouterSource).toContain("timezone: z.string().refine(isValidOrganizationTimeZone");
    expect(orgRouterSource).toContain("getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(orgSettingsSource).toContain("ORGANIZATION_TIME_ZONES");
    expect(orgSettingsSource).toContain("Organization timezone");
    expect(editorSource).toContain("scheduledLocalTime: scheduledAt");
    expect(editorSource).toContain("Times use your organization timezone ({organizationTimeZone})");
    expect(editorSource).not.toContain("scheduledAt: new Date(scheduledAt)");
  });
});
