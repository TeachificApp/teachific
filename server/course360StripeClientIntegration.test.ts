import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const made = vi.hoisted(() => ({ stripe: vi.fn(function (this: any, key: string) { this.mockKey = key; }) }));
vi.mock("stripe", () => ({ default: made.stripe }));
beforeEach(() => {
  vi.resetModules(); made.stripe.mockClear();
  vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", ""); vi.stubEnv("STRIPE_LIVE_SECRET_KEY", ""); vi.stubEnv("STRIPE_SECRET_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("platform Stripe client alias integration", () => {
  it("uses the protected Course360 alias before legacy live and native test values", async () => {
    vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", " sk_live_mock_course360 "); vi.stubEnv("STRIPE_LIVE_SECRET_KEY", "sk_live_mock_legacy"); vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock_native");
    const { getStripeClient } = await import("./lib/stripeClient");
    getStripeClient(); expect(made.stripe).toHaveBeenLastCalledWith("sk_live_mock_course360", expect.any(Object));
  });
  it("refreshes the cached client only when the selected key changes", async () => {
    vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", "sk_live_mock_one");
    const { getStripeClient } = await import("./lib/stripeClient");
    const first = getStripeClient(); expect(getStripeClient()).toBe(first);
    vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", "sk_live_mock_two");
    expect(getStripeClient()).not.toBe(first); expect(made.stripe).toHaveBeenCalledTimes(2);
  });
  it("preserves the explicit native test helper instead of routing it to the live account", async () => {
    vi.stubEnv("COURSE360_STRIPE_SECRET_KEY", "sk_live_mock_course360"); vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock_native");
    const { getTestStripeClient } = await import("./lib/stripeClient");
    getTestStripeClient(); expect(made.stripe).toHaveBeenLastCalledWith("sk_test_mock_native", expect.any(Object));
  });
  it("fails without configured credentials rather than constructing an eager client", async () => {
    const { getStripeClient } = await import("./lib/stripeClient");
    expect(() => getStripeClient()).toThrow("not configured"); expect(made.stripe).not.toHaveBeenCalled();
  });
});
