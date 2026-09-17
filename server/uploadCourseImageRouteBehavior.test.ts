import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  user: { id: 5, role: "org_admin" } as any,
  activeOrgId: 11 as number | null,
  requireOrgAdmin: vi.fn(),
  storagePutStream: vi.fn(),
}));

vi.mock("./authHelper", () => ({
  authenticateRequest: vi.fn(async () => fixture.user),
}));
vi.mock("./db", () => ({
  getOrgIdForUserWithFallback: vi.fn(async () => fixture.activeOrgId),
  requireOrgAdmin: fixture.requireOrgAdmin,
}));
vi.mock("./storage", () => ({
  storagePutStream: fixture.storagePutStream,
}));

import imageUploadRouter from "./uploadCourseImageRoute";

function routeHandler() {
  const layer = (imageUploadRouter as any).stack.find((entry: any) => entry.route?.path === "/");
  return layer.route.stack.at(-1).handle as (req: any, res: any) => Promise<void>;
}

function responseMock() {
  const response: any = {};
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  return response;
}

function requestWithFile(mimetype: string) {
  return {
    headers: {},
    file: { path: "/tmp/course360-upload-route-test", mimetype, originalname: "untrusted.html" },
  } as any;
}

describe("Course360 rich-text image upload route authorization", () => {
  beforeEach(() => {
    fixture.user = { id: 5, role: "org_admin" };
    fixture.activeOrgId = 11;
    fixture.requireOrgAdmin.mockReset().mockResolvedValue(11);
    fixture.storagePutStream.mockReset().mockResolvedValue({ url: "https://storage.test/image.png" });
  });

  it("rejects authenticated users without an active organization administrator context", async () => {
    fixture.activeOrgId = null;
    const response = responseMock();
    await routeHandler()(requestWithFile("image/png"), response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "Organization administrator access is required." });
    expect(fixture.storagePutStream).not.toHaveBeenCalled();
  });

  it("rejects non-image uploads before writing to storage", async () => {
    const response = responseMock();
    await routeHandler()(requestWithFile("application/pdf"), response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: "Upload a PNG, JPEG, GIF, WebP, or AVIF image." });
    expect(fixture.storagePutStream).not.toHaveBeenCalled();
  });

  it("stores authorized images under the server-resolved organization prefix", async () => {
    const response = responseMock();
    await routeHandler()(requestWithFile("image/png"), response);
    expect(fixture.requireOrgAdmin).toHaveBeenCalledWith(5, "org_admin", 11);
    expect(fixture.storagePutStream).toHaveBeenCalledWith(
      expect.stringMatching(/^course-images\/org-11\/\d+-[A-Za-z0-9_-]{8}\.png$/),
      "/tmp/course360-upload-route-test",
      "image/png",
    );
    expect(response.json).toHaveBeenCalledWith({ url: "https://storage.test/image.png" });
  });
});
