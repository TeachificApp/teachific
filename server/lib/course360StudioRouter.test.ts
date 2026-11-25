import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { orgMediaLibrary, videoClips, mediaFolders } from "../../drizzle/schema";
import { makeStudioTranscriptEnvelope } from "../../client/src/lib/studioCaptionDocument";
const f = vi.hoisted(() => ({ db: null as any, user: { id: 101, role: "org_admin" } as any,
  active: vi.fn(), capability: vi.fn(), inspect: vi.fn(), store: vi.fn(), source: vi.fn(), render: vi.fn(), speech: vi.fn(), highlights: vi.fn(), getDb: vi.fn(), fallback: vi.fn(), auth: vi.fn() }));
vi.mock("../db", async original => ({ ...(await original<any>()), getDb: f.getDb, getOrgIdForUserWithFallback: f.fallback }));
vi.mock("../formsRouter", () => ({ requireActiveMediaOrganization: f.active }));
vi.mock("./course360AppCapabilities", () => ({ requireCourse360AppCapability: f.capability }));
vi.mock("./course360StudioStorage", async original => ({ ...(await original<any>()), inspectStudioRegistration: f.inspect, storeStudioFile: f.store }));
vi.mock("./course360StudioRender", async original => ({ ...(await original<any>()), withStudioSource: f.source, renderStudioLocal: f.render, extractStudioAudio: vi.fn(async () => ({ bytes: Buffer.from("speech"), duration: 4 })) }));
vi.mock("./course360StudioIntelligence", async original => ({ ...(await original<any>()), transcribeStudioSpeech: f.speech, generateStudioSemanticHighlights: f.highlights }));
vi.mock("../authHelper", () => ({ authenticateRequest: f.auth }));
const { lmsRouter } = await import("../lmsRouter");
const { default: chunked } = await import("../chunkedUploadRoutes");
const dialect = new MySqlDialect();
function fakeDb() {
  const rows = new Map<any, any[]>([
    [orgMediaLibrary, [{ id: 44, orgId: 7, uploadedBy: 101, fileKey: "historical/unscoped-key.mp4", url: "https://cdn.test/original", filename: "original.webm", mimeType: "video/webm", fileSize: 4, folderId: null, transcriptJson: null, captionsUrl: null }, { id: 55, orgId: 8, fileKey: "org-8/foreign.webm" }]],
    [videoClips, [{ id: 70, orgId: 7, mediaItemId: 44, startSec: 1, endSec: 2, label: "Owned clip" }, { id: 71, orgId: 7, mediaItemId: 99, startSec: 1, endSec: 2 }]], [mediaFolders, []],
  ]);
  const writes: any[] = [], queries: any[] = [];
  function matching(row: any, condition: any) {
    if (!condition) return true;
    const query = dialect.sqlToQuery(condition); queries.push(query);
    return [...query.sql.matchAll(/`[^`]+`\.`([^`]+)` = \?/g)].every((match, i) => row[match[1]] === query.params[i]);
  }
  const db: any = { rows, writes, queries,
    select: vi.fn(() => {
      let table: any, condition: any;
      const result = () => (rows.get(table) ?? []).filter(row => matching(row, condition));
      const chain: any = { from: (v: any) => { table = v; return chain; }, where: (v: any) => { condition = v; return chain; }, limit: async (n: number) => result().slice(0, n), then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject) }; return chain;
    }),
    insert: vi.fn((table: any) => ({ values: (value: any) => {
      const result = () => { const id = 90 + writes.length; writes.push({ kind: "insert", table, value }); rows.get(table)?.push({ id, ...value }); return [{ id, insertId: id }]; };
      return { $returningId: async () => result(), then: (resolve: any) => Promise.resolve(result()).then(resolve) };
    } })),
    update: vi.fn((table: any) => ({ set: (value: any) => ({ where: async (condition: any) => {
      writes.push({ kind: "update", table, value, query: dialect.sqlToQuery(condition) });
      let affectedRows = 0; for (const row of rows.get(table) ?? []) if (matching(row, condition)) { Object.assign(row, value); affectedRows++; }
      return [{ affectedRows }];
    } }) })),
  }; return db;
}
function media() { return lmsRouter.createCaller({ user: f.user, req: { headers: {}, socket: {} }, res: {} } as any).media; }
async function route(path: string, body: Record<string, any>, params: Record<string, any> = {}) {
  const layer = (chunked as any).stack.find((entry: any) => entry.route?.path === path);
  const res: any = { code: 200, payload: undefined, status(code: number) { this.code = code; return this; }, json(payload: any) { this.payload = payload; return this; } };
  await layer.route.stack.at(-1).handle({ body, params, headers: {}, file: undefined }, res);
  return res;
}
beforeEach(() => {
  vi.clearAllMocks(); f.db = fakeDb(); f.user = { id: 101, role: "org_admin" }; f.getDb.mockResolvedValue(f.db); f.auth.mockImplementation(async () => f.user);
  f.active.mockImplementation(async (_user, hint) => { if (hint !== undefined && hint !== 7) throw new Error("stale school"); return 7; });
  f.capability.mockResolvedValue({ orgId: 7, access: { isActive: true, isInTrial: false }, isPaid: true, hasManualGrant: false });
  f.inspect.mockImplementation(async (key, url) => ({ key, url, mimeType: "video/mp4", size: 123 }));
  f.store.mockImplementation(async (key) => ({ key, url: `https://cdn.test/${key}` }));
  f.source.mockImplementation(async (_key, _signal, work) => work("/mock/source", { duration: 4 }, "/home/ubuntu/course360-repairs"));
  f.render.mockResolvedValue({ output: "/mock/derivative", size: 100, probe: { duration: 1, width: 320, height: 180, videoCodec: "h264", audioCodec: "aac" }, transcript: { words: [], segments: [], duration: 1 }, ranges: [{ startSec: 1, endSec: 2 }] });
  f.speech.mockResolvedValue({ words: [{ id: 0, start: 0, end: 1, word: "owned" }], segments: [{ id: 0, start: 0, end: 1, text: "owned" }], language: "el", duration: 4, studio: { timingSource: "provider-words" } });
});

describe("Studio actual lms router contracts", () => {
  it("generic list remains independent of Studio entitlement and preserves original historical keys", async () => {
    const result = await media().listOrgMedia({ orgId: 7 });
    expect(result).toHaveLength(1); expect(result[0].fileKey).toBe("historical/unscoped-key.mp4");
    expect(f.capability).not.toHaveBeenCalled(); expect(f.fallback).not.toHaveBeenCalled();
  });
  it("extractClip registers a new derivative only and ignores caller source URL", async () => {
    const original = JSON.stringify(f.db.rows.get(orgMediaLibrary)[0]);
    const result = await media().extractClip({ mediaItemId: 44, clipId: 70, sourceUrl: "http://127.0.0.1/private" });
    expect(result).toMatchObject({ ok: true, mediaItemId: 90, mimeType: "video/mp4" });
    expect(result.url).not.toBe("https://cdn.test/original");
    expect(f.source.mock.calls[0][0]).toBe("historical/unscoped-key.mp4");
    expect(f.render.mock.calls[0][3]).toMatchObject({ startSec: 1, endSec: 2 });
    expect(f.db.writes).toHaveLength(1); expect(f.db.writes[0].kind).toBe("insert");
    expect(JSON.stringify(f.db.rows.get(orgMediaLibrary)[0])).toBe(original);
  });
  it("renderEditedVideo checks Web entitlement, registers truthful derivative metadata, and returns the agreed shape", async () => {
    f.capability.mockResolvedValue({ orgId: 7, access: { isActive: true, isInTrial: true }, isPaid: false, hasManualGrant: false });
    const result = await media().renderEditedVideo({ mediaItemId: 44, startSec: 1, endSec: 2, burnCaptions: true });
    expect(result).toMatchObject({ mediaItemId: 90, mimeType: "video/mp4" });
    expect(f.capability).toHaveBeenCalledWith(101, "studio", "web");
    expect(f.render.mock.calls[0][3]).toMatchObject({ burnCaptions: true, watermark: true });
    expect(JSON.parse(f.db.writes[0].value.transcriptJson).studio).toMatchObject({ sourceMediaItemId: 44, sourceKey: "historical/unscoped-key.mp4", watermark: true });
  });
  it("rejects foreign media, mismatched saved clip and invalid/missing clip ranges before writes", async () => {
    await expect(media().renderEditedVideo({ mediaItemId: 55 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(media().extractClip({ mediaItemId: 44, clipId: 71 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(media().extractClip({ mediaItemId: 44, clipId: 70, startSec: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(media().extractClip({ mediaItemId: 44 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(media().saveClip({ mediaItemId: 44, startSec: 3, endSec: -2, label: "invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(media().saveClip({ mediaItemId: 44, startSec: 1, endSec: 5, label: "too long" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(f.db.writes).toEqual([]);
  });
  it("fails closed for expired entitlement and selection drift before storage/processing", async () => {
    f.capability.mockRejectedValue(new Error("expired"));
    await expect(media().renderEditedVideo({ mediaItemId: 44 })).rejects.toThrow("expired");
    expect(f.source).not.toHaveBeenCalled(); expect(f.store).not.toHaveBeenCalled();
    f.capability.mockResolvedValue({ orgId: 8, access: { isActive: true } });
    await expect(media().generateHighlights({ mediaItemId: 44 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("transcribe resolves owned key, ignores arbitrary fileUrl and returns retained API fields", async () => {
    const result = await media().transcribe({ mediaItemId: 44, fileUrl: "http://127.0.0.1/private" });
    expect(f.source.mock.calls[0][0]).toBe("historical/unscoped-key.mp4");
    expect(result).toMatchObject({ ok: true, transcript: [{ text: "owned" }], text: "owned", language: "el" });
    await expect(media().transcribe({ fileUrl: "https://arbitrary.test/audio" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("returns existing timed transcript without another provider charge on reopen", async () => {
    f.db.rows.get(orgMediaLibrary)[0].transcriptJson = JSON.stringify({ segments: [{ id: 0, start: 0, end: 4, text: "segment only words" }], language: "fr", duration: 4 });
    const result = await media().generateCaptions({ mediaItemId: 44 });
    expect(result.words).toHaveLength(3); expect(result.language).toBe("fr");
    expect(f.speech).not.toHaveBeenCalled(); expect(f.source).not.toHaveBeenCalled();
  });
  it("updates captions with additive client envelope, original language and unknown fields", async () => {
    const item = f.db.rows.get(orgMediaLibrary)[0];
    const original = { words: [{ id: 0, start: 0, end: 1, word: "original" }], segments: [{ id: 0, start: 0, end: 1, text: "original" }], language: "fr", duration: 4, originalUnknown: { x: 1 } };
    item.transcriptJson = JSON.stringify(original);
    const update = { ...original, words: [{ id: 0, start: 0, end: 1, word: "edited" }], studioEdit: { version: 1, sourceMediaItemId: 44, revision: 1, captionStyle: { fontFamily: "DejaVu Sans", textColor: "#ff00ff" }, showCaptions: true, presetId: "neon" } };
    const result = await media().updateCaptions({ mediaItemId: 44, transcriptJson: JSON.stringify(update) });
    const saved = JSON.parse(result.transcriptJson); expect(saved.originalUnknown).toEqual({ x: 1 }); expect(saved.language).toBe("fr");
    expect(saved.studioEdit).toEqual(update.studioEdit); expect(saved.studio.originalTranscript.words[0].word).toBe("original");
    expect(f.db.writes[0].query.sql).toContain("<=>");
    await expect(media().updateCaptions({ mediaItemId: 44, transcriptJson: JSON.stringify(update) })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(media().updateCaptions({ mediaItemId: 44, transcriptJson: JSON.stringify({ ...update, studioEdit: { ...update.studioEdit, sourceMediaItemId: 55 } }) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("re-edits a reloaded derivative using its own ID while retaining original source provenance and bytes", async () => {
    const source = f.db.rows.get(orgMediaLibrary)[0];
    const style = { textColor: "#ffffff", bgColor: "#000000", bgOpacity: .75, bold: true, italic: false, shadow: false, fontSize: 22, emojiEnabled: false, fontFamily: "DejaVu Sans" };
    source.transcriptJson = makeStudioTranscriptEnvelope({ language: "fr", sourceMetadata: { keep: true } }, [{ id: 0, start: 0, end: 1, word: "source" }], [{ id: 0, start: 0, end: 1, text: "source" }], { version: 1, sourceMediaItemId: 44, revision: 1, captionStyle: style, showCaptions: true, presetId: "classic" }, 4);
    const sourceBefore = JSON.stringify(source);
    f.render.mockResolvedValueOnce({ output: "/mock/derivative", size: 100, probe: { duration: 1, width: 320, height: 180, videoCodec: "h264", audioCodec: "aac" }, transcript: { ...JSON.parse(source.transcriptJson), duration: 1 }, ranges: [{ startSec: 0, endSec: 1 }] });
    const first = await media().renderEditedVideo({ mediaItemId: 44, startSec: 0, endSec: 1 });
    const derivative = f.db.rows.get(orgMediaLibrary).find((row: any) => row.id === first.mediaItemId);
    const reloaded = JSON.parse(derivative.transcriptJson);
    expect(reloaded.studio.sourceMediaItemId).toBe(44); expect(reloaded.studioEdit.sourceMediaItemId).toBe(44);
    const edited = makeStudioTranscriptEnvelope(reloaded, [{ id: 0, start: 0, end: 1, word: "derivative edited" }], [{ id: 0, start: 0, end: 1, text: "derivative edited" }], { ...reloaded.studioEdit, sourceMediaItemId: derivative.id, revision: reloaded.studioEdit.revision + 1 }, 1);
    f.source.mockImplementation(async (_key, _signal, work) => work("/mock/derivative", { duration: 1 }, "/home/ubuntu/course360-repairs"));
    const saved = await media().updateCaptions({ mediaItemId: derivative.id, transcriptJson: edited, expectedRevision: reloaded.studio.revision ?? 0 });
    expect(JSON.parse(saved.transcriptJson).studioEdit.sourceMediaItemId).toBe(derivative.id);
    expect(JSON.parse(saved.transcriptJson).studio.sourceMediaItemId).toBe(44);
    expect(JSON.parse(saved.transcriptJson).sourceMetadata).toEqual({ keep: true });
    await media().renderEditedVideo({ mediaItemId: derivative.id });
    expect(f.source.mock.calls.at(-1)?.[0]).toBe(derivative.fileKey);
    expect(JSON.stringify(source)).toBe(sourceBefore);
    expect(f.db.writes.map((write: any) => write.kind)).toEqual(["insert", "update", "insert"]);
  });
  it("registration uses authoritative object MIME/size instead of browser metadata", async () => {
    const result = await media().saveMediaItem({ fileName: "same.webm", fileKey: "org-7/media/key", url: "https://cdn.test/org-7/media/key", fileSize: 999, mimeType: "fake/type" });
    expect(result).toMatchObject({ ok: true, id: 90 }); expect(f.db.writes[0].value).toMatchObject({ mimeType: "video/mp4", fileSize: 123, filename: "same.webm" });
    f.inspect.mockRejectedValue(new Error("URL/key mismatch"));
    await expect(media().saveMediaItem({ fileName: "forged", fileKey: "org-7/media/key", url: "https://evil.test/other", fileSize: 1, mimeType: "video/mp4" })).rejects.toThrow("URL/key mismatch");
    await expect(media().saveRecording({ filename: "no upload", url: "https://video.test" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("generates highlights from the owned transcript and probe, not URLs or browser markers", async () => {
    f.db.rows.get(orgMediaLibrary)[0].transcriptJson = JSON.stringify({ words: [], segments: [] });
    f.highlights.mockResolvedValue({ clips: [{ startSec: 1, endSec: 2, label: "fixture" }] });
    const result = await media().generateHighlights({ mediaItemId: 44 });
    expect(result.clips[0].label).toBe("fixture"); expect(f.highlights).toHaveBeenCalledWith(expect.objectContaining({ words: [] }), 4, expect.any(AbortSignal));
    expect(f.db.writes).toEqual([]);
  });
});

describe("Studio actual chunked media scope handlers", () => {
  it("uses persisted shared media guard for initiation and rejects browser IDs instead of falling back", async () => {
    const ok = await route("/media/initiate", { filename: "recording.webm", totalChunks: 1, orgId: 7 });
    expect(ok.code).toBe(200); expect(f.active).toHaveBeenCalledWith(101, 7); expect(f.fallback).not.toHaveBeenCalled();
    expect((await route("/media/initiate", { filename: "recording.webm", totalChunks: 1, orgId: "7stale" })).code).toBe(400);
    expect((await route("/media/initiate", { filename: "recording.webm", totalChunks: 1, orgId: 8 })).code).toBe(403);
    f.active.mockRejectedValue(new Error("no persisted selection")); f.user.role = "site_owner";
    expect((await route("/media/initiate", { filename: "recording.webm", totalChunks: 1 })).code).toBe(403);
    expect(f.fallback).not.toHaveBeenCalled();
  });
  it("rechecks persisted selection/permission on each chunk and binds session identity", async () => {
    const initiated = await route("/media/initiate", { filename: "recording.webm", totalChunks: 1 });
    const uploadId = initiated.payload.uploadId;
    f.active.mockRejectedValue(new Error("selection changed"));
    const denied = await route("/media/chunk/:uploadId", { chunkIndex: 0 }, { uploadId });
    expect(denied.code).toBe(403); expect(f.active).toHaveBeenLastCalledWith(101, 7);
    f.user.id = 102;
    expect((await route("/media/chunk/:uploadId", { chunkIndex: 0 }, { uploadId })).code).toBe(403);
    expect(f.store).not.toHaveBeenCalled();
  });
});
