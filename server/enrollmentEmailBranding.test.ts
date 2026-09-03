import { describe, expect, it } from "vitest";
import { buildEnrollmentEmailWrapper } from "./lib/enrollmentEmail";

describe("Course360 enrollment email fallback identity", () => {
  it("uses Course360 platform identity without changing the supplied content", () => {
    const html = buildEnrollmentEmailWrapper("<p>Access is ready.</p>");

    expect(html).toContain("Course360™ Learning");
    expect(html).toContain("https://course360.app");
    expect(html).toContain("<p>Access is ready.</p>");
    expect(html).not.toContain("Teachific");
    expect(html).not.toContain("teachific.com");
  });
});
