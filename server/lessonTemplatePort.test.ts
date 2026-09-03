import { describe, expect, it } from "vitest";
import { cloneLessonTemplateBlocks } from "./routers/lmsCourseBuilderRouter";

describe("Course360 organization-scoped lesson template insertion", () => {
  it("creates fresh identifiers for copied top-level and nested column blocks", () => {
    const source = JSON.stringify([{
      id: "source-parent",
      type: "columns",
      data: { columns: [{ blocks: [{ id: "source-child", type: "text", data: { content: "Template text" } }] }] },
    }]);
    const copied = cloneLessonTemplateBlocks(source) as Array<{ id: string; data: { columns: Array<{ blocks: Array<{ id: string }> }> } }>;
    expect(copied).toHaveLength(1);
    expect(copied[0].id).not.toBe("source-parent");
    expect(copied[0].data.columns[0].blocks[0].id).not.toBe("source-child");
  });

  it("rejects malformed saved template block data rather than inserting it", () => {
    expect(() => cloneLessonTemplateBlocks("not-json")).toThrow("The saved lesson template has invalid block data");
  });
});
