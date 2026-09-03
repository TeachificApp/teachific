import { describe, expect, it } from "vitest";
import { resolveScormHealthAlertAppBaseUrl } from "./lib/scormHealthAlerts";

describe("Course360 SCORM health alerts", () => {
  it("keeps an explicit non-retired platform URL for the global platform-administrator workflow", () => {
    expect(resolveScormHealthAlertAppBaseUrl("https://ops.course360.app/")).toBe("https://ops.course360.app");
  });

  it("rejects a retired platform URL and returns the Course360 platform fallback", () => {
    const resolved = resolveScormHealthAlertAppBaseUrl("https://teachific.app/");
    expect(resolved).toContain("course360");
    expect(resolved).not.toContain("teachific");
  });
});
