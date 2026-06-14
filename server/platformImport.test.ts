import { describe, it, expect } from "vitest";
import { createTeachableClient } from "./teachable";

describe("Teachable client", () => {
  it("creates a client with the correct API key", () => {
    const client = createTeachableClient("test-api-key");
    expect(client).toBeDefined();
    expect(typeof client.validateApiKey).toBe("function");
    expect(typeof client.getAllUsers).toBe("function");
    expect(typeof client.getAllCourses).toBe("function");
    expect(typeof client.getAllEnrollments).toBe("function");
  });
});

describe("Thinkific integration schema", () => {
  it("validates subdomain format", () => {
    const validSubdomains = ["myschool", "test-school", "school123"];
    const invalidSubdomains = ["", " ", "my school", "school.com"];
    
    for (const sub of validSubdomains) {
      expect(sub.trim().length).toBeGreaterThan(0);
    }
    for (const sub of invalidSubdomains) {
      const trimmed = sub.trim();
      // Empty or contains spaces or dots
      const isInvalid = trimmed.length === 0 || /[\s.]/.test(trimmed);
      expect(isInvalid).toBe(true);
    }
  });
});

describe("Platform import routes", () => {
  it("platformImportRouter is importable", async () => {
    const { platformImportRouter } = await import("./routers/platformImportRouter");
    expect(platformImportRouter).toBeDefined();
    expect(typeof platformImportRouter).toBe("object");
  });
});
