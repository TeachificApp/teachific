import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { COURSE360_VERIFIED_PAYMENT_IDENTITY as identity, verifyCourse360PaymentBootstrap, type Course360PaymentBootstrapDependencies } from "./course360PaymentBootstrap";

function fixture(): Course360PaymentBootstrapDependencies {
  return {
    readiness: { ready: true, secretMode: "live", publishableMode: "live", webhookConfigured: true },
    retrieveOwnAccount: vi.fn(async () => ({ id: identity.accountId, charges_enabled: true })),
    retrieveEndpoint: vi.fn(async () => ({ id: identity.endpointId, url: identity.endpointUrl, status: "enabled", livemode: true, enabled_events: ["*"] })),
    probeSchema: vi.fn(async () => undefined), configure: vi.fn(),
  };
}
describe("verified Course360 platform bootstrap", () => {
  it("configures only after independently verified own account, endpoint and schema", async () => {
    const deps = fixture();
    expect(await verifyCourse360PaymentBootstrap(deps)).toMatchObject({ ready: true, providerReadOnly: true });
    expect(deps.retrieveEndpoint).toHaveBeenCalledWith(identity.endpointId);
    expect(deps.configure).toHaveBeenCalledTimes(1);
    expect(deps.configure).toHaveBeenCalledWith(identity);
  });
  it.each([{ ready: false }, { secretMode: "test" }, { publishableMode: "test" }, { webhookConfigured: false }])("rejects missing/mixed/test credentials before any provider call: %j", async patch => {
    const deps = fixture(); Object.assign(deps.readiness, patch);
    await expect(verifyCourse360PaymentBootstrap(deps)).rejects.toMatchObject({ category: "credentials" });
    expect(deps.retrieveOwnAccount).not.toHaveBeenCalled(); expect(deps.configure).not.toHaveBeenCalled();
  });
  it.each([{ id: "acct_otherSchool" }, { charges_enabled: false }])("rejects a foreign or unavailable own account: %j", async patch => {
    const deps = fixture(); deps.retrieveOwnAccount = vi.fn(async () => ({ id: identity.accountId, charges_enabled: true, ...patch }));
    await expect(verifyCourse360PaymentBootstrap(deps)).rejects.toMatchObject({ category: "account" });
    expect(deps.retrieveEndpoint).not.toHaveBeenCalled(); expect(deps.configure).not.toHaveBeenCalled();
  });
  it.each([{ id: "we_otherEndpoint" }, { url: "https://other-school.example/api/stripe/webhook" }, { status: "disabled" }, { livemode: false }, { enabled_events: ["invoice.paid"] }])("rejects unverified endpoint identity, mode or events: %j", async patch => {
    const deps = fixture(); deps.retrieveEndpoint = vi.fn(async () => ({ id: identity.endpointId, url: identity.endpointUrl, status: "enabled", livemode: true, enabled_events: ["*"], ...patch }));
    await expect(verifyCourse360PaymentBootstrap(deps)).rejects.toMatchObject({ category: "endpoint" });
    expect(deps.probeSchema).not.toHaveBeenCalled(); expect(deps.configure).not.toHaveBeenCalled();
  });
  it("denies configuration on provider failure and redacts raw details", async () => {
    const deps = fixture(); deps.retrieveOwnAccount = vi.fn(async () => { throw new Error("private provider detail"); });
    await expect(verifyCourse360PaymentBootstrap(deps)).rejects.toThrow("Course360 payment bootstrap blocked (provider).");
    expect(deps.configure).not.toHaveBeenCalled();
  });
  it("denies configuration on missing or incompatible schema", async () => {
    const deps = fixture(); deps.probeSchema = vi.fn(async () => { throw new Error("private SQL detail"); });
    await expect(verifyCourse360PaymentBootstrap(deps)).rejects.toMatchObject({ category: "schema" });
    expect(deps.configure).not.toHaveBeenCalled();
  });
  it("retains old security/startup hooks and additively installs media runtime binaries", () => {
    const root = readFileSync(new URL("../_core/index.ts", import.meta.url), "utf8");
    expect(root.indexOf("await bootstrapConfiguredCourse360PaymentLedger()")).toBeLessThan(root.indexOf('app.use("/api/stripe"'));
    expect(root).toContain('camera=(), microphone=(), geolocation=()');
    expect(root).toContain("await ensureStripePlans()"); expect(root).toContain("await ensureAppVersions()");
    expect(root).toContain('process.env.COURSE360_VERIFY_PAYMENT_BOOTSTRAP === "1"');
    const docker = readFileSync(new URL("../../Dockerfile", import.meta.url), "utf8");
    expect(docker).toContain("RUN apk add --no-cache ffmpeg fontconfig font-dejavu font-liberation");
    expect(docker).toContain('CMD ["node", "dist/index.js"]');
  });
});
