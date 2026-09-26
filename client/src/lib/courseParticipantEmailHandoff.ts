import type { AudienceFilter } from "@shared/emailCampaignAudience";

/**
 * UI-only handoff for creating a campaign from an administration screen.
 * The server remains the authority for active-organization and resource ownership
 * validation when previewing, saving, scheduling, or sending the campaign.
 */
export type ParticipantAudienceHandoff = Pick<
  AudienceFilter,
  "activeAccessCourseIds" | "inCohortGroupIds" | "workshopInstanceIds" | "userStatus"
>;

/** @deprecated Use ParticipantAudienceHandoff for new participant handoffs. */
export type CourseParticipantAudienceHandoff = Pick<
  AudienceFilter,
  "activeAccessCourseIds" | "userStatus"
>;

function parsePositiveId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function getParticipantAudienceHandoff(search: string): ParticipantAudienceHandoff | null {
  const params = new URLSearchParams(search);
  const courseId = parsePositiveId(params.get("courseId"));
  const cohortGroupId = parsePositiveId(params.get("cohortGroupId"));
  const workshopInstanceId = parsePositiveId(params.get("workshopInstanceId"));

  // A composer can begin with one explicit participant source. Reject conflicting
  // route hints rather than silently widening the audience in the browser.
  const sourceCount = Number(Boolean(courseId)) + Number(Boolean(cohortGroupId)) + Number(Boolean(workshopInstanceId));
  if (sourceCount !== 1) return null;

  if (courseId) {
    return { activeAccessCourseIds: [courseId], inCohortGroupIds: [], workshopInstanceIds: [], userStatus: "active" };
  }
  if (cohortGroupId) {
    return { activeAccessCourseIds: [], inCohortGroupIds: [cohortGroupId], workshopInstanceIds: [], userStatus: "active" };
  }
  return { activeAccessCourseIds: [], inCohortGroupIds: [], workshopInstanceIds: [workshopInstanceId!], userStatus: "active" };
}

export function getCourseParticipantAudienceHandoff(search: string): CourseParticipantAudienceHandoff | null {
  const handoff = getParticipantAudienceHandoff(search);
  return handoff?.activeAccessCourseIds.length
    ? { activeAccessCourseIds: handoff.activeAccessCourseIds, userStatus: handoff.userStatus }
    : null;
}

export function getCourseParticipantCampaignPath(courseId: number): string {
  if (!Number.isSafeInteger(courseId) || courseId < 1) {
    throw new Error("A valid course is required to email active participants.");
  }
  return `/marketing/email?${new URLSearchParams({ courseId: String(courseId) }).toString()}`;
}

export function getCohortGroupParticipantCampaignPath(cohortGroupId: number): string {
  if (!Number.isSafeInteger(cohortGroupId) || cohortGroupId < 1) {
    throw new Error("A valid cohort group is required to email active participants.");
  }
  return `/marketing/email?${new URLSearchParams({ cohortGroupId: String(cohortGroupId) }).toString()}`;
}

export function getWorkshopInstanceParticipantCampaignPath(workshopInstanceId: number): string {
  if (!Number.isSafeInteger(workshopInstanceId) || workshopInstanceId < 1) {
    throw new Error("A valid workshop instance is required to email active participants.");
  }
  return `/marketing/email?${new URLSearchParams({ workshopInstanceId: String(workshopInstanceId) }).toString()}`;
}
