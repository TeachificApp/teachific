import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./routers/workshopRouter.ts", import.meta.url), "utf8");

function publicProcedureSlice(name: string, nextName: string) {
  const start = source.indexOf(`${name}: publicProcedure`);
  const end = source.indexOf(`${nextName}: publicProcedure`, start);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("Course360 learner workshop enrollment privacy", () => {
  it("resolves every public workshop response from the verified request organization", () => {
    const publicRouter = source.slice(source.indexOf("export const workshopPublicRouter"), source.indexOf("// ─── Learner Router"));
    expect(source).toContain('import { resolvePublicOrganizationScope } from "../lib/publicOrgRequestScope";');
    expect(publicRouter).toContain("resolvePublicWorkshopOrganization(db, ctx.req)");
    expect(publicRouter).toContain("eq(workshops.orgId, publicOrganizationId)");
  });

  it("does not serialize capacity, enrollment counts, or remaining seats to learners", () => {
    const seatAvailability = publicProcedureSlice("getSeatAvailability", "getInstancePage");
    const instancePage = publicProcedureSlice("getInstancePage", "getBySlug");

    expect(source).toContain("toPublicWorkshopInstance");
    expect(source).toContain("enrollmentOpen");
    expect(source).toContain("hideEnrollmentPresentation");
    expect(seatAvailability.slice(seatAvailability.lastIndexOf("return {"))).not.toMatch(/\b(capacity|enrolled|remaining|isFull)\b/);
    expect(instancePage.slice(instancePage.lastIndexOf("return {"))).not.toMatch(/\b(capacity|enrolledCount|seatsRemaining|isSoldOut|meetingUrl)\b/);
  });

  it("keeps the browser-side seat block free of learner count rendering", () => {
    const blockSource = readFileSync(new URL("../client/src/components/RemainingSeatsBlock.tsx", import.meta.url), "utf8");
    expect(blockSource).not.toMatch(/data\.(seatsRemaining|enrolledCount|remaining|capacity)/);
    expect(blockSource).not.toContain("Remaining Seats Block");
  });
});
