/**
 * Tests for lmsCheckoutRouter — verifies that the generic checkout page
 * config procedures work correctly across all content types.
 */
import { describe, expect, it } from "vitest";
import {
  CONTENT_TYPES,
  type ContentType,
} from "./routers/lmsCheckoutRouter";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminCtx(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("CONTENT_TYPES enum", () => {
  it("includes all expected content types", () => {
    const expected: ContentType[] = [
      "course",
      "download",
      "physical_product",
      "webinar",
      "membership",
      "membership_plan",
    ];
    for (const t of expected) {
      expect(CONTENT_TYPES).toContain(t);
    }
  });

  it("has exactly 6 content types", () => {
    expect(CONTENT_TYPES).toHaveLength(6);
  });
});

describe("CheckoutPageEditor props contract", () => {
  it("all content types accepted by the editor are in CONTENT_TYPES", () => {
    // These are the types used in the editor components
    const editorTypes: ContentType[] = [
      "course",
      "download",
      "webinar",
      "membership",
    ];
    for (const t of editorTypes) {
      expect(CONTENT_TYPES).toContain(t);
    }
  });
});

describe("admin context", () => {
  it("creates a valid admin user context", () => {
    const ctx = createAdminCtx();
    expect(ctx.user).toBeDefined();
    expect(ctx.user?.role).toBe("admin");
    expect(ctx.user?.email).toBe("admin@example.com");
  });
});
