import type { AudienceFilter } from "@shared/emailCampaignAudience";

/**
 * UI-only handoff for creating a campaign from a course administration screen.
 * The server remains the authority for active-organization and course ownership
 * validation when previewing, saving, scheduling, or sending the campaign.
 */
export type CourseParticipantAudienceHandoff = Pick<
  AudienceFilter,
  "activeAccessCourseIds" | "userStatus"
>;

function parsePositiveId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function getCourseParticipantAudienceHandoff(
  search: string,
): CourseParticipantAudienceHandoff | null {
  const courseId = parsePositiveId(new URLSearchParams(search).get("courseId"));
  if (!courseId) return null;

  return {
    activeAccessCourseIds: [courseId],
    userStatus: "active",
  };
}

export function getCourseParticipantCampaignPath(courseId: number): string {
  if (!Number.isSafeInteger(courseId) || courseId < 1) {
    throw new Error("A valid course is required to email active participants.");
  }
  return `/marketing/email?${new URLSearchParams({ courseId: String(courseId) }).toString()}`;
}
