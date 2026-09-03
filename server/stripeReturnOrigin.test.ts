import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const getDb = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb }));

import { resolveProductCheckoutReturnOrigin } from "./stripeRouter";

function organizationLookup(customDomain: string | null, domainVerificationStatus: string | null) {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => Promise.resolve([{ customDomain, domainVerificationStatus }]),
  };
  return { select: vi.fn(() => chain) };
}

describe("Course360 protected Stripe return origins", () => {
  it("accepts approved platform origins without a membership lookup", async () => {
    await expect(resolveProductCheckoutReturnOrigin("https://course360.app", 101))
      .resolves.toBe("https://course360.app");
    expect(getDb).not.toHaveBeenCalled();
  });

  it("accepts only a member's verified custom organization domain", async () => {
    getDb.mockResolvedValue(organizationLookup("billing.academy.example.test", "verified"));

    await expect(resolveProductCheckoutReturnOrigin("https://billing.academy.example.test", 101))
      .resolves.toBe("https://billing.academy.example.test");
  });

  it("rejects attacker origins even when the member belongs to another verified organization", async () => {
    getDb.mockResolvedValue(organizationLookup("billing.academy.example.test", "verified"));

    await expect(resolveProductCheckoutReturnOrigin("https://attacker.example.test", 101))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: "Checkout return URL is not permitted" });
  });

  it("uses the validated origin for subscription checkout and billing-portal return URLs", () => {
    const source = readFileSync(new URL("./stripeRouter.ts", import.meta.url), "utf8");
    const subscriptionSlice = source.slice(source.indexOf("createCheckoutSession: protectedProcedure"), source.indexOf("// ── Create customer portal session"));
    const portalSlice = source.slice(source.indexOf("createPortalSession: protectedProcedure"), source.indexOf("// ── Change plan"));

    expect(subscriptionSlice).toContain("const returnOrigin = await resolveProductCheckoutReturnOrigin(input.origin, ctx.user.id);");
    expect(subscriptionSlice).toContain("success_url: `${returnOrigin}/billing?success=1&plan=${input.plan}&trial=1`");
    expect(subscriptionSlice).toContain("cancel_url: `${returnOrigin}/billing?cancelled=1`");
    expect(portalSlice).toContain("const returnOrigin = await resolveProductCheckoutReturnOrigin(input.origin, ctx.user.id);");
    expect(portalSlice).toContain("return_url: `${returnOrigin}/billing`");
  });
});
