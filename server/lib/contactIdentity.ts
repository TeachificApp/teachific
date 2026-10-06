export type ContactIdentityMatch = {
  id: number;
  orgId: number;
};

export type ContactIdentityResolution =
  | { kind: "new" }
  | { kind: "existing"; contactId: number }
  | { kind: "conflict"; emailContactId: number; phoneContactId: number };

/** Normalizes an email only for same-organization identity matching. */
export function normalizeContactEmail(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

/**
 * Normalizes a phone number to a conservative international-comparison key.
 * It deliberately never attempts country-specific number rewriting.
 */
export function normalizeContactPhone(value?: string | null): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const hasLeadingPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 20) return null;
  return `${hasLeadingPlus ? "+" : ""}${digits}`;
}

/**
 * Resolves identity candidates that have already been constrained to one organization.
 * Matching records from a different organization are never valid inputs to this function.
 */
export function resolveContactIdentity(
  emailMatch?: ContactIdentityMatch | null,
  phoneMatch?: ContactIdentityMatch | null,
): ContactIdentityResolution {
  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
    return {
      kind: "conflict",
      emailContactId: emailMatch.id,
      phoneContactId: phoneMatch.id,
    };
  }
  const existing = emailMatch ?? phoneMatch;
  return existing ? { kind: "existing", contactId: existing.id } : { kind: "new" };
}

/** Converts a full name into safe first/last-name candidates without guessing. */
export function splitContactName(value?: string | null): { firstName: string | null; lastName: string | null } {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
