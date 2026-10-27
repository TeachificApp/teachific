import { describe, expect, it } from "vitest";

// Prefer the Course360-specific project secret. The generic variable may be
// supplied by an older environment and must not shadow a newly rotated token.
const cloudflareToken = process.env.COURSE360_CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
const shouldVerifyCloudflareToken = process.env.RUN_CLOUDFLARE_TOKEN_CONNECTION_TEST === "true";

describe.runIf(cloudflareToken && shouldVerifyCloudflareToken)("Cloudflare API token connection", () => {
  it("validates the configured token without exposing its value", async () => {
    const response = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: {
        Authorization: `Bearer ${cloudflareToken}`,
      },
    });

    const body = (await response.json()) as {
      success?: boolean;
      errors?: Array<{ code?: number; message?: string }>;
    };

    expect(response.ok, JSON.stringify(body.errors ?? [])).toBe(true);
    expect(body.success).toBe(true);
  }, 20_000);
});
