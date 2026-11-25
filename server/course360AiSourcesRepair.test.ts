import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
const mocks = vi.hoisted(() => ({ storageGet: vi.fn(), fetch: vi.fn() }));
vi.mock("./storage", () => ({ storageGet: mocks.storageGet }));
import { buildCourseSourceContext, getOwnedCourse360SourceKey, extractLegacyPowerPointText } from "./lib/course360AiCourseSource";
import { buildCourse360SourceMessage } from "./lib/course360AiCourseSourceMessage";
import { canUseCourse360AdvancedAi, normalizeCourse360SourceMime, COURSE360_PPTX_MIME, COURSE360_PPT_MIME } from "./lib/course360AiSourceMetadata";
const owner = { orgId: 17, userId: 8 };
const source = { url: "https://untrusted.example/ai-generation-sources/17/8/course.pdf", storageKey: "ai-generation-sources/17/8/course.pdf", mimeType: "application/pdf", name: "course.pdf" };
function bytesResponse(bytes: Buffer, headers?: Record<string, string>) { return new Response(bytes as any, { headers }); }
async function pptx() {
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="1" r:id="r2"/><p:sldId id="2" r:id="r1"/></p:sldIdLst></p:presentation>');
  zip.file("ppt/_rels/presentation.xml.rels", '<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>');
  zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Second in presentation</a:t></a:r></a:p></p:sld>');
  zip.file("ppt/slides/slide2.xml", '<p:sld xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>First </a:t></a:r><a:r><a:t>topic</a:t></a:r></a:p><a:tbl><a:tr><a:tc><a:p><a:r><a:t>Table fact</a:t></a:r></a:p></a:tc></a:tr></a:tbl></p:sld>');
  zip.file("ppt/slides/_rels/slide2.xml.rels", '<Relationships><Relationship Id="notes" Target="../notesSlides/notesSlide1.xml"/></Relationships>');
  zip.file("ppt/notesSlides/notesSlide1.xml", '<p:notes xmlns:p="p" xmlns:a="a"><a:p><a:r><a:t>Speaker detail</a:t></a:r></a:p></p:notes>');
  return zip.generateAsync({ type: "nodebuffer" });
}
beforeEach(() => { mocks.storageGet.mockReset().mockResolvedValue({ url: "https://storage.test/owned-signed" }); mocks.fetch.mockReset(); vi.stubGlobal("fetch", mocks.fetch); });
afterEach(() => vi.unstubAllGlobals());
describe("Course360 owned course sources repair", () => {
  it("normalizes modern and legacy PowerPoint browser MIME aliases", () => { expect(normalizeCourse360SourceMime("application/octet-stream", "SOURCE.PPTX")).toBe(COURSE360_PPTX_MIME); expect(normalizeCourse360SourceMime(COURSE360_PPTX_MIME, "source.ppt")).toBe(COURSE360_PPT_MIME); expect(normalizeCourse360SourceMime("text/plain", "notes.txt")).toBeUndefined(); });
  it.each([["pro", "active", true], ["enterprise", "trialing", true], ["builder", "active", false], ["starter", "active", false], ["pro", "past_due", false]])("requires active Pro source entitlement: %s %s", (plan, status, allowed) => { expect(canUseCourse360AdvancedAi(String(plan), String(status))).toBe(allowed); });
  it.each(["ai-generation-sources/18/8/course.pdf", "ai-generation-sources/17/9/course.pdf", "ai-generation-sources/17/8/../course.pdf", "ai-generation-sources/17/8/a%2fpdf", "ai-generation-sources/17/8/"])("rejects a forged tenant key %s before storage calls", async key => { await expect(buildCourse360SourceMessage("Write", [{ ...source, storageKey: key }], owner, { openAiNativePdf: false })).rejects.toThrow("active organization"); expect(mocks.storageGet).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled(); });
  it("supports legacy returned URLs by resolving only the school-owned key", () => { expect(getOwnedCourse360SourceKey({ ...source, storageKey: undefined }, owner)).toBe(source.storageKey); });
  it("attaches original PDF bytes natively for OpenAI without fetching a client URL", async () => { const bytes = Buffer.from("%PDF-1.7\nORIGINAL\n%%EOF"); mocks.fetch.mockResolvedValue(bytesResponse(bytes)); const result = await buildCourse360SourceMessage("Write", [source], owner, { openAiNativePdf: true }); expect((result as any)[1]).toEqual({ type: "file", file: { filename: "course.pdf", file_data: `data:application/pdf;base64,${bytes.toString("base64")}` } }); expect(mocks.fetch.mock.calls[0][0]).toBe("https://storage.test/owned-signed"); });
  it("preserves Forge native URL PDFs, image order and original sources", async () => { const sources = [source, { ...source, name: "image.png", storageKey: "ai-generation-sources/17/8/image.png", mimeType: "image/png" }]; const original = JSON.stringify(sources); const result = await buildCourse360SourceMessage("Write", sources, owner, { openAiNativePdf: false }); expect((result as any)[1].type).toBe("file_url"); expect((result as any)[2].type).toBe("image_url"); expect(JSON.stringify(sources)).toBe(original); expect(mocks.fetch).not.toHaveBeenCalled(); });
  it("extracts presentation order, runs, tables and speaker notes without saving originals", async () => { mocks.fetch.mockResolvedValue(bytesResponse(await pptx())); const text = await buildCourseSourceContext([{ ...source, name: "course.pptx", storageKey: "ai-generation-sources/17/8/course.pptx", mimeType: COURSE360_PPTX_MIME }], owner); expect(text).toContain("First topic"); expect(text).toContain("Table fact"); expect(text).toContain("Speaker detail"); expect(text.indexOf("First topic")).toBeLessThan(text.indexOf("Second in presentation")); });
  it("rejects malformed PDFs, too-large advertised downloads and a fourth source", async () => { mocks.fetch.mockResolvedValue(bytesResponse(Buffer.from("NOT PDF"))); await expect(buildCourse360SourceMessage("Write", [source], owner, { openAiNativePdf: true })).rejects.toThrow("corrupt"); mocks.fetch.mockResolvedValue(bytesResponse(Buffer.from("%PDF-"), { "content-length": String(50 * 1024 * 1024 + 1) })); await expect(buildCourse360SourceMessage("Write", [source], owner, { openAiNativePdf: true })).rejects.toThrow("50 MB"); await expect(buildCourse360SourceMessage("Write", [source, source, source, source], owner, { openAiNativePdf: false })).rejects.toThrow("three"); });
  it("extracts actual legacy PPT text in a bounded worker", async () => { const text = Buffer.from("Legacy slide facts", "utf16le"); const header = Buffer.alloc(8); header.writeUInt16LE(0x0fa0, 2); header.writeUInt32LE(text.length, 4); const cfb = XLSX.CFB.utils.cfb_new(); XLSX.CFB.utils.cfb_add(cfb, "PowerPoint Document", Buffer.concat([header, text])); const buffer = Buffer.from(XLSX.CFB.write(cfb, { type: "buffer" })); await expect(extractLegacyPowerPointText(buffer)).resolves.toContain("Legacy slide facts"); });
  it("rejects malformed legacy PPT before creating a worker", async () => { await expect(extractLegacyPowerPointText(Buffer.from("wrong"))).rejects.toThrow("corrupt"); });
});
