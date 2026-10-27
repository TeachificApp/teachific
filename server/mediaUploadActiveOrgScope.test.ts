import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  user: { id: 101, role: "org_admin" } as any,
  activeOrgId: 7 as number | null,
  requireOrgAdmin: vi.fn(),
  storagePutStream: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("./authHelper", () => ({
  authenticateRequest: vi.fn(async () => fixture.user),
}));
vi.mock("./db", () => ({
  getOrgIdForUserWithFallback: vi.fn(async () => fixture.activeOrgId),
  requireOrgAdmin: fixture.requireOrgAdmin,
  getDb: fixture.getDb,
}));
vi.mock("./storage", () => ({
  storagePutStream: fixture.storagePutStream,
}));

import mediaUploadRouter from "./mediaUploadRoutes";

function routeHandler(path: string) {
  const layer = (mediaUploadRouter as any).stack.find((entry: any) => entry.route?.path === path);
  return layer.route.stack.at(-1).handle as (req: any, res: any) => Promise<void>;
}

function responseMock() {
  const response: any = {};
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  return response;
}

function requestWithFile(body: Record<string, unknown> = {}) {
  return {
    headers: {},
    body,
    file: {
      path: "/tmp/course360-media-upload-test",
      mimetype: "image/png",
      originalname: "School Banner.png",
      size: 1234,
    },
  } as any;
}

function mediaLookupDb(item: any | null) {
  const limit = vi.fn().mockResolvedValue(item ? [item] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return {
    select: vi.fn().mockReturnValue({ from }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
  } as any;
}

describe("Course360 multipart Media Library active organization scope", () => {
  beforeEach(() => {
    fixture.user = { id: 101, role: "org_admin" };
    fixture.activeOrgId = 7;
    fixture.requireOrgAdmin.mockReset().mockResolvedValue(undefined);
    fixture.storagePutStream.mockReset().mockResolvedValue({
      key: "org-7/course-images/asset.png",
      url: "https://cdn.example.test/org-7/course-images/asset.png",
    });
    fixture.getDb.mockReset();
  });

  it("stores an authorized direct upload only beneath the active organization's prefix", async () => {
    const response = responseMock();
    await routeHandler("/")(requestWithFile({ orgId: "7", folder: "Course Images / Banners" }), response);

    expect(fixture.requireOrgAdmin).toHaveBeenCalledWith(101, "org_admin", 7);
    expect(fixture.storagePutStream).toHaveBeenCalledWith(
      expect.stringMatching(/^org-7\/course-images-banners\/\d+-[A-Za-z0-9_-]{8}-School_Banner\.png$/),
      "/tmp/course360-media-upload-test",
      "image/png",
    );
    expect(response.status).not.toHaveBeenCalled();
  });

  it("rejects a stale organization hint without writing a storage object", async () => {
    const response = responseMock();
    await routeHandler("/")(requestWithFile({ orgId: "8", folder: "media" }), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "Switch to the requested organization before uploading media." });
    expect(fixture.storagePutStream).not.toHaveBeenCalled();
  });

  it("requires an active organization even when a client omits its organization field", async () => {
    fixture.activeOrgId = null;
    const response = responseMock();
    await routeHandler("/")(requestWithFile(), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "Select an active organization before uploading media." });
    expect(fixture.storagePutStream).not.toHaveBeenCalled();
  });

  it("does not overwrite a media object from another organization", async () => {
    fixture.getDb.mockResolvedValue(mediaLookupDb({
      id: 44,
      orgId: 8,
      fileKey: "org-8/media/foreign.png",
      mimeType: "image/png",
    }));
    const response = responseMock();
    await routeHandler("/replace")(requestWithFile({ mediaItemId: "44" }), response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: "Media item not found in the active organization" });
    expect(fixture.storagePutStream).not.toHaveBeenCalled();
  });
});
