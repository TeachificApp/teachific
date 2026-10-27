import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const getUserById = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const getDb = vi.hoisted(() => vi.fn());
const storagePresignedPut = vi.hoisted(() => vi.fn());

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getOrgIdForUserWithFallback,
  getUserById,
  requireOrgAdmin,
  getDb,
}));
vi.mock("./storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./storage")>()),
  storagePresignedPut,
}));

const { lmsRouter } = await import("./lmsRouter");

function caller() {
  return lmsRouter.createCaller({
    user: { id: 101, role: "org_admin", email: "admin@example.test" },
    req: { headers: {}, socket: {} },
  } as any);
}

function emptySelectDb() {
  const limit = vi.fn().mockResolvedValue([]);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return {
    select: vi.fn().mockReturnValue({ from }),
    _where: where,
  } as any;
}

describe("Course360 legacy Media Library active-organization scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserById.mockResolvedValue({ id: 101, role: "org_admin" });
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(undefined);
    getDb.mockResolvedValue(emptySelectDb());
    storagePresignedPut.mockResolvedValue({
      uploadUrl: "https://uploads.example.test/media",
      fileUrl: "https://cdn.example.test/media.png",
      key: "ignored-by-test",
    });
  });

  it("issues upload credentials only under the server-resolved organization prefix", async () => {
    await expect(caller().media.getUploadUrl({
      orgId: 7,
      fileName: "Team photo.PNG",
      folder: "Course images / banners",
      contentType: "image/png",
    })).resolves.toEqual(expect.objectContaining({ orgId: 7, folder: "course-images-banners" }));

    expect(storagePresignedPut).toHaveBeenCalledWith(
      expect.stringMatching(/^org-7\/course-images-banners\/[A-Za-z0-9_-]{12}\.PNG$/),
      "image/png",
    );
    expect(requireOrgAdmin).toHaveBeenCalledWith(101, "org_admin", 7);
  });

  it("rejects stale or forged organization hints before media reads, uploads, imports, and transcription", async () => {
    const requests = [
      () => caller().media.getUploadUrl({ orgId: 8, fileName: "other.png" }),
      () => caller().media.listOrgMedia({ orgId: 8 }),
      () => caller().media.saveMediaItem({
        orgId: 8,
        fileName: "other.png",
        mimeType: "image/png",
        fileSize: 1,
        fileKey: "org-8/media/other.png",
        url: "https://cdn.example.test/other.png",
      }),
      () => caller().media.importFromUrl({ orgId: 8, url: "https://example.test/video.mp4" }),
      () => caller().media.transcribe({ orgId: 8, fileUrl: "https://example.test/audio.mp3" }),
    ];

    for (const request of requests) {
      await expect(request()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Switch to the media library's organization before managing media.",
      });
    }
    expect(storagePresignedPut).not.toHaveBeenCalled();
  });

  it("rejects untrusted or another-school storage keys before registering media", async () => {
    await expect(caller().media.saveMediaItem({
      orgId: 7,
      fileName: "foreign.png",
      mimeType: "image/png",
      fileSize: 1,
      fileKey: "org-8/media/foreign.png",
      url: "https://cdn.example.test/foreign.png",
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Media storage key does not belong to the active organization.",
    });

    await expect(caller().media.saveRecording({
      orgId: 7,
      filename: "recording.webm",
      url: "https://cdn.example.test/recording.webm",
      fileKey: "unscoped/recording.webm",
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Recording file key does not belong to the active organization.",
    });
  });

  it("rejects a foreign folder reference before attaching or filtering active-school media", async () => {
    await expect(caller().media.saveMediaItem({
      orgId: 7,
      folderId: 88,
      fileName: "banner.png",
      mimeType: "image/png",
      fileSize: 1,
      fileKey: "org-7/media/banner.png",
      url: "https://cdn.example.test/banner.png",
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "This media folder belongs to another organization.",
    });

    await expect(caller().media.listOrgMedia({ orgId: 7, folderId: 88 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "This media folder belongs to another organization.",
    });
  });

  it("rejects an inaccessible media ID before deletion, captioning, or clip creation", async () => {
    const requests = [
      () => caller().media.deleteOrgMedia({ id: 44 }),
      () => caller().media.generateCaptions({ mediaItemId: 44, orgId: 7 }),
      () => caller().media.saveClip({ mediaItemId: 44, orgId: 7, label: "Segment" }),
    ];

    for (const request of requests) {
      await expect(request()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "This media item belongs to another organization.",
      });
    }
  });

  it("keeps every legacy media mutator on the shared active-scope and tenant-reference guards", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("./lmsRouter.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("requireActiveLegacyMediaOrg(ctx, input.orgId)");
    expect(source).toContain("requireLegacyMediaItemInActiveOrg(ctx, input.mediaItemId, input.orgId)");
    expect(source).toContain("requireLegacyMediaFolderInActiveOrg(db, orgId, input.folderId)");
    expect(source).toContain("requireLegacyMediaClipInActiveOrg(ctx, input.id, input.orgId)");
    expect(source).toContain("captions/org-${orgId}/");
    expect(source).toContain("const audioUrl = mediaItem.url;");
    expect(source).toContain("Media storage key does not belong to the active organization.");
  });
});
