import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "./lib/csvSafety";

const routerSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
const builderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
const exportStart = routerSource.indexOf("exportEnrollmentsCSV: protectedProcedure");
const exportEnd = routerSource.indexOf("// ─── Affiliate Course Settings", exportStart);
const exportSource = routerSource.slice(exportStart, exportEnd);

describe("Course360 course participant export", () => {
  it("neutralizes spreadsheet formulas without changing ordinary CSV quoting", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("\"'=SUM(A1:A2)\"");
    expect(escapeCsvCell(" +cmd")).toBe("\"' +cmd\"");
    expect(escapeCsvCell("@unsafe")).toBe("\"'@unsafe\"");
    expect(escapeCsvCell('A "quoted" value')).toBe('"A ""quoted"" value"');
    expect(escapeCsvCell("learner@example.com")).toBe('"learner@example.com"');
  });

  it("scopes every row to the server-resolved active organization", () => {
    expect(exportSource).toContain("const orgId = await requireActiveEnrollmentOrg(ctx.user.id, ctx.user.role)");
    expect(exportSource).toContain("eq(lmsCourses.orgId, orgId)");
    expect(exportSource).toContain("inArray(lmsEnrollments.courseId, exportCourseIds)");
    expect(exportSource).toContain("eq(lmsOrders.orgId, orgId)");
    expect(routerSource).toContain("isActive: organizations.isActive");
    expect(routerSource).toContain("The active organization is unavailable.");
  });

  it("exports approved profile fields while excluding payment and Stripe-session data", () => {
    expect(exportSource).toContain("credentials: users.credentials");
    expect(exportSource).toContain("specialty: users.specialty");
    expect(exportSource).toContain("location: users.location");
    expect(exportSource).toContain("escapeCsvCell(r.credentials)");
    expect(exportSource).not.toContain("orderAmount");
    expect(exportSource).not.toContain("orderStatus");
    expect(exportSource).not.toContain("stripeSessionId");
    expect(exportSource).not.toContain("Order Amount ($)");
    expect(exportSource).not.toContain("Stripe Session ID");
  });

  it("renders a structured safe preview instead of reparsing CSV data in the browser", () => {
    expect(exportSource).toContain("preview = allRows.slice(0, 10)");
    expect(builderSource).toContain("(exportData.preview ?? []).map");
    expect(builderSource).not.toContain('exportData.csv.split("\\n").slice(1, 11)');
  });
});
