import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createCourseImageStorageKey,
  imageExtensionForMime,
  isAllowedCourseImageMime,
} from "./uploadCourseImageRoute";

const routeSource = readFileSync(new URL("./uploadCourseImageRoute.ts", import.meta.url), "utf8");

describe("Course360 rich-text image upload safeguards", () => {
  it("allows only supported image MIME types and derives trusted extensions", () => {
    expect(isAllowedCourseImageMime("image/png")).toBe(true);
    expect(isAllowedCourseImageMime("IMAGE/WEBP")).toBe(true);
    expect(isAllowedCourseImageMime("image/svg+xml")).toBe(false);
    expect(isAllowedCourseImageMime("application/pdf")).toBe(false);
    expect(isAllowedCourseImageMime(undefined)).toBe(false);
    expect(imageExtensionForMime("image/jpeg")).toBe("jpg");
    expect(imageExtensionForMime("image/png")).toBe("png");
    expect(imageExtensionForMime("text/html")).toBeUndefined();
  });

  it("names stored rich-text images beneath the active organization prefix", () => {
    expect(createCourseImageStorageKey(42, "png")).toMatch(/^course-images\/org-42\/\d+-[A-Za-z0-9_-]{8}\.png$/);
  });

  it("resolves administrator authority and does not return provider error text", () => {
    expect(routeSource).toContain("getOrgIdForUserWithFallback(user.id, user.role)");
    expect(routeSource).toContain("requireOrgAdmin(user.id, user.role, orgId)");
    expect(routeSource).toContain("limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES }");
    expect(routeSource).toContain("Upload a PNG, JPEG, GIF, WebP, or AVIF image.");
    expect(routeSource).toContain('res.status(500).json({ error: "Upload failed" });');
    expect(routeSource).not.toContain('error: err?.message');
  });
});
