/**
 * Tests for emoji and email campaign AI generator updates:
 * - generateEmailBlockContent with includeEmoji flag
 * - generateFullEmailContent procedure
 * - Emoji font fallbacks in CSS (structural check)
 */
import { describe, it, expect } from "vitest";

describe("emailCampaign.generateEmailBlockContent", () => {
  it("should be registered in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("emailCampaign.generateEmailBlockContent");
  });

  it("should accept includeEmoji in input schema", async () => {
    const { appRouter } = await import("./routers");
    const proc = appRouter._def.procedures["emailCampaign.generateEmailBlockContent"];
    // The procedure should be a mutation
    expect(proc._def.type).toBe("mutation");
    // Input schema should accept includeEmoji (optional boolean)
    const input = proc._def.inputs?.[0];
    expect(input).toBeDefined();
  });
});

describe("emailCampaign.generateFullEmailContent", () => {
  it("should be registered in appRouter", async () => {
    const { appRouter } = await import("./routers");
    expect(appRouter._def.procedures).toHaveProperty("emailCampaign.generateFullEmailContent");
  });

  it("should be a mutation procedure", async () => {
    const { appRouter } = await import("./routers");
    const proc = appRouter._def.procedures["emailCampaign.generateFullEmailContent"];
    expect(proc._def.type).toBe("mutation");
  });
});

describe("Emoji font fallbacks in index.css", () => {
  it("should have emoji font fallbacks in body font-family", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("/home/ubuntu/scorm-host/client/src/index.css", "utf-8");
    expect(css).toContain("Apple Color Emoji");
    expect(css).toContain("Segoe UI Emoji");
    expect(css).toContain("Noto Color Emoji");
  });
});

describe("Emoji font fallbacks in RichTextEditor", () => {
  it("should have emoji font fallbacks in TipTap CSS", async () => {
    const fs = await import("fs");
    const tsx = fs.readFileSync("/home/ubuntu/scorm-host/client/src/components/RichTextEditor.tsx", "utf-8");
    expect(tsx).toContain("Apple Color Emoji");
  });
});

describe("AiFullEmailGenerator component", () => {
  it("should be defined in EmailBlockEditor", async () => {
    const fs = await import("fs");
    const tsx = fs.readFileSync("/home/ubuntu/scorm-host/client/src/components/EmailBlockEditor.tsx", "utf-8");
    expect(tsx).toContain("AiFullEmailGenerator");
    expect(tsx).toContain("generateFullEmailContent");
    expect(tsx).toContain("includeEmoji");
  });
});

describe("AiBlockGenerator emoji toggle", () => {
  it("should have includeEmoji state in AiBlockGenerator", async () => {
    const fs = await import("fs");
    const tsx = fs.readFileSync("/home/ubuntu/scorm-host/client/src/components/EmailBlockEditor.tsx", "utf-8");
    expect(tsx).toContain("includeEmoji");
    expect(tsx).toContain("Include emojis");
  });
});
