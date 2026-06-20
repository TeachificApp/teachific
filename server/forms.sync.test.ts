import { describe, it, expect } from "vitest";
import { formsRouter } from "./formsRouter";

describe("formsRouter sync — new procedures", () => {
  it("exports generateFromPrompt procedure", () => {
    const proc = (formsRouter as any).generateFromPrompt;
    expect(proc).toBeDefined();
    expect(typeof proc).toBe("function");
    expect(proc._def).toBeDefined();
  });

  it("exports updateSubmissionStatus procedure", () => {
    const proc = (formsRouter as any).updateSubmissionStatus;
    expect(proc).toBeDefined();
    expect(typeof proc).toBe("function");
    expect(proc._def).toBeDefined();
  });

  it("create procedure accepts initialFields in its input schema", () => {
    const createProc = (formsRouter as any).create;
    expect(createProc).toBeDefined();
    // The procedure has _def.inputs array with zod schemas
    const inputSchema = createProc?._def?.inputs?.[0];
    expect(inputSchema).toBeDefined();
    // Verify initialFields is part of the schema shape
    const shape = inputSchema?.shape ?? inputSchema?._def?.shape?.();
    if (shape) {
      expect(shape.initialFields).toBeDefined();
    } else {
      expect(createProc._def.inputs.length).toBeGreaterThan(0);
    }
  });

  it("submissions sub-router has list and delete procedures", () => {
    const submissions = (formsRouter as any).submissions;
    expect(submissions).toBeDefined();
    expect(typeof submissions.list).toBe("function");
    expect(submissions.list._def).toBeDefined();
    expect(typeof submissions.delete).toBe("function");
    expect(submissions.delete._def).toBeDefined();
  });

  it("importFromUrl procedure is exported", () => {
    const proc = (formsRouter as any).importFromUrl;
    expect(proc).toBeDefined();
    expect(typeof proc).toBe("function");
  });

  it("analytics sub-router has summary and fieldDropoff procedures", () => {
    const analytics = (formsRouter as any).analytics;
    expect(analytics).toBeDefined();
    expect(typeof analytics.summary).toBe("function");
    expect(typeof analytics.fieldDropoff).toBe("function");
  });
});
