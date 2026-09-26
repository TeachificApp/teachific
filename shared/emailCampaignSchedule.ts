import { getLocalHms, getLocalYmd, zonedTimeToUtc } from "./cohortSessionDates";

export const DEFAULT_ORGANIZATION_TIMEZONE = "UTC";

export const ORGANIZATION_TIME_ZONES = [
  "UTC",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "America/Vancouver", "America/Mexico_City", "America/Sao_Paulo", "America/Buenos_Aires",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid",
  "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Istanbul", "Europe/Moscow",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Singapore",
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Australia/Melbourne",
  "Pacific/Auckland",
] as const;

export type LocalScheduleParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Returns true only for IANA zones that the current runtime can format. */
export function isValidOrganizationTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Falls back only for legacy/invalid persisted organization values. */
export function normalizeOrganizationTimeZone(value: unknown): string {
  return isValidOrganizationTimeZone(value) ? value : DEFAULT_ORGANIZATION_TIMEZONE;
}

export function parseLocalScheduleDateTime(value: string): LocalScheduleParts {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error("Choose a valid local date and time.");
  }
  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute] = match;
  const parts: LocalScheduleParts = {
    year: Number(rawYear),
    month: Number(rawMonth),
    day: Number(rawDay),
    hour: Number(rawHour),
    minute: Number(rawMinute),
  };
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  if (
    parts.month < 1 || parts.month > 12 ||
    parts.day < 1 || parts.day > 31 ||
    parts.hour > 23 || parts.minute > 59 ||
    probe.getUTCFullYear() !== parts.year ||
    probe.getUTCMonth() + 1 !== parts.month ||
    probe.getUTCDate() !== parts.day
  ) {
    throw new Error("Choose a valid calendar date and time.");
  }
  return parts;
}

function matchesLocalScheduleParts(instant: Date, parts: LocalScheduleParts, timeZone: string): boolean {
  const localDate = getLocalYmd(instant, timeZone);
  const localTime = getLocalHms(instant, timeZone);
  return (
    localDate.y === parts.year &&
    localDate.m === parts.month &&
    localDate.d === parts.day &&
    localTime.h === parts.hour &&
    localTime.mi === parts.minute
  );
}

/**
 * Converts an organization-local datetime-local value into one unambiguous UTC instant.
 * DST-gap and DST-fold values are rejected instead of silently moving or guessing a send time.
 */
export function organizationLocalScheduleToUtc(localDateTime: string, timeZone: string): Date {
  const normalizedTimeZone = normalizeOrganizationTimeZone(timeZone);
  if (normalizedTimeZone !== timeZone) {
    throw new Error("The organization timezone is invalid. Update it before scheduling a campaign.");
  }
  const parts = parseLocalScheduleDateTime(localDateTime);
  const instant = zonedTimeToUtc(
    { y: parts.year, m: parts.month, d: parts.day },
    { h: parts.hour, mi: parts.minute, s: 0 },
    normalizedTimeZone,
  );

  if (!matchesLocalScheduleParts(instant, parts, normalizedTimeZone)) {
    throw new Error("This local time does not exist because of a daylight-saving change. Choose another time.");
  }

  // A local datetime repeated when clocks fall back maps to two different UTC instants.
  // Do not guess which occurrence the author meant.
  for (let minutes = 15; minutes <= 180; minutes += 15) {
    for (const direction of [-1, 1]) {
      const alternate = new Date(instant.getTime() + direction * minutes * 60_000);
      if (matchesLocalScheduleParts(alternate, parts, normalizedTimeZone)) {
        throw new Error("This local time occurs twice because of a daylight-saving change. Choose another time.");
      }
    }
  }

  return instant;
}

/** Format a UTC instant for a datetime-local control in the organization time zone. */
export function formatUtcForOrganizationDateTimeInput(instant: Date, timeZone: string): string {
  const normalizedTimeZone = normalizeOrganizationTimeZone(timeZone);
  const localDate = getLocalYmd(instant, normalizedTimeZone);
  const localTime = getLocalHms(instant, normalizedTimeZone);
  return `${localDate.y}-${String(localDate.m).padStart(2, "0")}-${String(localDate.d).padStart(2, "0")}T${String(localTime.h).padStart(2, "0")}:${String(localTime.mi).padStart(2, "0")}`;
}

export function formatUtcForOrganizationSchedule(instant: Date, timeZone: string): string {
  const normalizedTimeZone = normalizeOrganizationTimeZone(timeZone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: normalizedTimeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(instant);
}
