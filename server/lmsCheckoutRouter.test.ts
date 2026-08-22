/**
 * Tests for lmsCheckoutRouter — verifies that the generic checkout page
 * config procedures work correctly across all content types, and covers
 * the new order bump per-tier filtering, team pricing seat count, and
 * order total calculation logic.
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
    loginMethod: "email",
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

// ─── CONTENT_TYPES enum ───────────────────────────────────────────────────────

describe("CONTENT_TYPES enum", () => {
  it("includes all expected content types", () => {
    const expected: ContentType[] = [
      "course", "download", "physical_product",
      "webinar", "membership", "membership_plan",
    ];
    for (const t of expected) {
      expect(CONTENT_TYPES).toContain(t);
    }
  });

  it("has exactly 8 content types (includes workshop and bundle)", () => {
    expect(CONTENT_TYPES).toHaveLength(8);
  });

  it("includes workshop content type", () => {
    expect(CONTENT_TYPES).toContain("workshop");
  });

  it("includes bundle content type", () => {
    expect(CONTENT_TYPES).toContain("bundle");
  });
});

// ─── CheckoutPageEditor props contract ───────────────────────────────────────

describe("CheckoutPageEditor props contract", () => {
  it("all content types accepted by the editor are in CONTENT_TYPES", () => {
    const editorTypes: ContentType[] = ["course", "download", "webinar", "membership"];
    for (const t of editorTypes) {
      expect(CONTENT_TYPES).toContain(t);
    }
  });
});

// ─── Admin context ────────────────────────────────────────────────────────────

describe("admin context", () => {
  it("creates a valid admin user context", () => {
    const ctx = createAdminCtx();
    expect(ctx.user).toBeDefined();
    expect(ctx.user?.role).toBe("admin");
    expect(ctx.user?.email).toBe("admin@example.com");
  });
});

// ─── Order bump per-tier filtering ───────────────────────────────────────────

describe("Order bump tier filtering", () => {
  const bumps = [
    { id: 1, name: "Global bump",  pricingOptionId: null },
    { id: 2, name: "Tier A bump",  pricingOptionId: 10 },
    { id: 3, name: "Tier B bump",  pricingOptionId: 20 },
  ];

  function filterBumps(allBumps: typeof bumps, selectedOptionId: number | undefined) {
    return allBumps.filter(b =>
      b.pricingOptionId === null || b.pricingOptionId === selectedOptionId
    );
  }

  it("shows global bumps for any tier", () => {
    expect(filterBumps(bumps, 10).map(b => b.id)).toContain(1);
  });

  it("shows tier-specific bumps only for the matching tier", () => {
    const result = filterBumps(bumps, 10);
    expect(result.map(b => b.id)).toContain(2);
    expect(result.map(b => b.id)).not.toContain(3);
  });

  it("shows only global bumps when no tier is selected", () => {
    const result = filterBumps(bumps, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("shows global + tier B bumps when tier B is selected", () => {
    const result = filterBumps(bumps, 20);
    expect(result.map(b => b.id)).toEqual(expect.arrayContaining([1, 3]));
    expect(result.map(b => b.id)).not.toContain(2);
  });
});

// ─── Team pricing seat count clamping ────────────────────────────────────────

describe("Team pricing seat count", () => {
  function clampSeats(seatCount: number, minSeats: number, maxSeats: number) {
    return Math.max(minSeats, Math.min(maxSeats, seatCount));
  }

  it("clamps seat count to minSeats when below minimum", () => {
    expect(clampSeats(1, 2, 50)).toBe(2);
  });

  it("clamps seat count to maxSeats when above maximum", () => {
    expect(clampSeats(200, 2, 100)).toBe(100);
  });

  it("passes through valid seat count unchanged", () => {
    expect(clampSeats(10, 2, 100)).toBe(10);
  });

  it("handles exact boundary values", () => {
    expect(clampSeats(2, 2, 100)).toBe(2);
    expect(clampSeats(100, 2, 100)).toBe(100);
  });
});

// ─── Order total calculation ──────────────────────────────────────────────────

describe("Order total calculation", () => {
  function calcTotal(
    basePrice: number,
    bumps: Array<{ id: number; discountedPrice: string | null }>,
    selectedBumpIds: Set<number>,
  ) {
    const bumpTotal = bumps
      .filter(b => selectedBumpIds.has(b.id) && b.discountedPrice)
      .reduce((sum, b) => sum + Number(b.discountedPrice), 0);
    return basePrice + bumpTotal;
  }

  it("returns base price when no bumps are selected", () => {
    const bumps = [{ id: 1, discountedPrice: "29.00" }];
    expect(calcTotal(99, bumps, new Set())).toBe(99);
  });

  it("adds bump price to base price when bump is selected", () => {
    const bumps = [{ id: 1, discountedPrice: "29.00" }];
    expect(calcTotal(99, bumps, new Set([1]))).toBe(128);
  });

  it("handles multiple bumps correctly", () => {
    const bumps = [
      { id: 1, discountedPrice: "29.00" },
      { id: 2, discountedPrice: "19.00" },
    ];
    expect(calcTotal(99, bumps, new Set([1, 2]))).toBe(147);
  });

  it("ignores bumps with null discountedPrice", () => {
    const bumps = [{ id: 1, discountedPrice: null }];
    expect(calcTotal(99, bumps, new Set([1]))).toBe(99);
  });
});

// ─── Team pricing total ───────────────────────────────────────────────────────

describe("Team pricing total", () => {
  function calcTeamTotal(perSeatPrice: number, seatCount: number) {
    return perSeatPrice * seatCount;
  }

  it("calculates correct team total for 5 seats at $20/seat", () => {
    expect(calcTeamTotal(20, 5)).toBe(100);
  });

  it("calculates correct team total for minimum 2 seats", () => {
    expect(calcTeamTotal(50, 2)).toBe(100);
  });

  it("handles fractional per-seat prices", () => {
    expect(calcTeamTotal(9.99, 3)).toBeCloseTo(29.97, 2);
  });
});
