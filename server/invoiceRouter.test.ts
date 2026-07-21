import { describe, it, expect } from "vitest";

describe("invoiceRouter module", () => {
  it("is importable without errors", async () => {
    const mod = await import("./routers/invoiceRouter");
    expect(mod.invoiceRouter).toBeDefined();
  });

  it("exports expected procedures", async () => {
    const { invoiceRouter } = await import("./routers/invoiceRouter");
    const router = invoiceRouter as any;
    expect(router._def?.procedures?.list).toBeDefined();
    expect(router._def?.procedures?.get).toBeDefined();
    expect(router._def?.procedures?.createManual).toBeDefined();
    expect(router._def?.procedures?.resend).toBeDefined();
    expect(router._def?.procedures?.listByUser).toBeDefined();
    expect(router._def?.procedures?.getStats).toBeDefined();
  });
});
