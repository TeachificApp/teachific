import { TRPCError } from "@trpc/server";

/**
 * Ensures a Quiz Bank record belongs to the organization resolved for the
 * authenticated request, rather than permitting a caller to switch scope by
 * supplying an arbitrary bank identifier.
 */
export function assertActiveQuizBankOrganization(activeOrgId: number | null | undefined, bankOrgId: number) {
  if (!activeOrgId || activeOrgId !== bankOrgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This Question Bank is not available in the active organization.",
    });
  }
}
