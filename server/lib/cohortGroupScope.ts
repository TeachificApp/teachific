import { and, eq, isNull, or, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * Cohort delivery always includes course-wide items and, when a learner has an
 * assignment, that learner's own cohort-group items. It never includes another
 * group's private items.
 */
export function cohortLearnerGroupScope(
  cohortGroupIdColumn: AnyColumn,
  cohortGroupId: number | null | undefined,
): SQL {
  if (cohortGroupId == null) return isNull(cohortGroupIdColumn);
  return or(isNull(cohortGroupIdColumn), eq(cohortGroupIdColumn, cohortGroupId))
    ?? isNull(cohortGroupIdColumn);
}

/**
 * Build a learner-safe content condition for a cohort course. Callers may add
 * a published/cancelled lifecycle condition through `extra`.
 */
export function cohortLearnerContentWhere(
  courseIdColumn: AnyColumn,
  cohortGroupIdColumn: AnyColumn,
  courseId: number,
  cohortGroupId: number | null | undefined,
  extra?: SQL,
): SQL {
  const base = and(
    eq(courseIdColumn, courseId),
    cohortLearnerGroupScope(cohortGroupIdColumn, cohortGroupId),
  ) ?? eq(courseIdColumn, courseId);
  return extra ? (and(base, extra) ?? base) : base;
}

/**
 * Admin cohort editor lists include shared course content plus content assigned
 * to the selected group. Without a selected group, the editor intentionally
 * lists every cohort item for the course.
 */
export function cohortAdminContentWhere(
  courseIdColumn: AnyColumn,
  cohortGroupIdColumn: AnyColumn,
  courseId: number,
  cohortGroupId?: number | null,
  extra?: SQL,
): SQL {
  const groupScope = cohortGroupId == null
    ? undefined
    : or(isNull(cohortGroupIdColumn), eq(cohortGroupIdColumn, cohortGroupId));
  const base = groupScope
    ? (and(eq(courseIdColumn, courseId), groupScope) ?? eq(courseIdColumn, courseId))
    : eq(courseIdColumn, courseId);
  return extra ? (and(base, extra) ?? base) : base;
}

type CohortGroupForPreview = {
  id: number;
  startDate: Date | string | null;
  endDate: Date | string | null;
  status: string;
};

/**
 * Select a deterministic, non-private group for administrator-as-learner
 * preview when a preview URL does not identify one explicitly.
 */
export function selectCurrentCohortGroupId(
  groups: CohortGroupForPreview[],
  now = new Date(),
): number | undefined {
  const timestamp = now.getTime();
  const eligible = groups.filter((group) => !["draft", "archived"].includes(group.status));
  const current = eligible
    .filter((group) => {
      const start = group.startDate ? new Date(group.startDate).getTime() : Number.NEGATIVE_INFINITY;
      const end = group.endDate ? new Date(group.endDate).getTime() : Number.POSITIVE_INFINITY;
      return start <= timestamp && timestamp <= end;
    })
    .sort((a, b) => {
      const rank = (status: string) => status === "active" ? 0 : status === "open" ? 1 : 2;
      return rank(a.status) - rank(b.status)
        || new Date(b.startDate ?? 0).getTime() - new Date(a.startDate ?? 0).getTime()
        || a.id - b.id;
    });
  if (current[0]) return current[0].id;

  const upcoming = eligible
    .filter((group) => group.startDate && new Date(group.startDate).getTime() > timestamp)
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime() || a.id - b.id);
  if (upcoming[0]) return upcoming[0].id;

  return eligible
    .sort((a, b) => {
      const aStart = a.startDate ? new Date(a.startDate).getTime() : Number.POSITIVE_INFINITY;
      const bStart = b.startDate ? new Date(b.startDate).getTime() : Number.POSITIVE_INFINITY;
      return aStart - bStart || a.id - b.id;
    })[0]?.id;
}
