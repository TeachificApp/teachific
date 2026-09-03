import { describe, expect, it } from "vitest";
import { COURSE360_PLATFORM_EMAIL_IDENTITY } from "./_core/email";

describe("Course360 shared transactional email fallback identity", () => {
  it("uses Course360 only when an organization does not supply its own sender identity", () => {
    expect(COURSE360_PLATFORM_EMAIL_IDENTITY).toEqual({
      fromName: "Course360",
      fromEmail: "hello@course360.app",
    });
  });
});
