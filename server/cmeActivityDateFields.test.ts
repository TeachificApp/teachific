import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers/cmeActivityFormRouter.ts", import.meta.url), "utf8");
const dialogSource = readFileSync(new URL("../client/src/components/CmeActivityFormDialog.tsx", import.meta.url), "utf8");

describe("CME activity planning dates", () => {
  const fields = ["originalReleaseDate", "mostRecentReviewDate", "expirationDate"] as const;

  it("persists all required organization-scoped CME activity dates", () => {
    for (const field of fields) expect(schemaSource).toContain(`${field}: varchar`);
  });

  it("validates dates in the CME router and exposes date controls in the planning dialog", () => {
    for (const field of fields) {
      expect(routerSource).toContain(`${field}: z.string().max(64).optional().nullable()`);
      expect(dialogSource).toContain(`form.${field}`);
    }
    expect(dialogSource.match(/type="date"/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
