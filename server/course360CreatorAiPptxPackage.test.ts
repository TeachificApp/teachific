import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { exportCreatorEditablePptx, importCreatorEditablePptx } from "./course360CreatorPptxExchange";
import { readCreatorPptxZip, validateCreatorPptxParts, parseCreatorPptxXml } from "./course360CreatorPptxSafePackage";
import { createCreatorAssessment } from "../shared/course360CreatorModel";
import { validateCreatorExchangeDraft } from "../shared/course360CreatorExchangeDraft";
const project = { id: 5, title: "Original & editable", description: "Preserve description", userId: 3, orgId: 7, status: "published", lastPublishedFormat: "scorm12", settingsJson: JSON.stringify({ width: 1000, height: 563, extension: { keep: true }, player: { allowBack: false } }), thumbnailUrl: "https://owned.invalid/legacy.png" };
const slide = () => ({ id: 21, projectId: 5, title: "Original", slideIndex: 0, background: "#12324a", notes: "Speaker notes retained", layout: "title", slideType: "content", extensionField: { keep: true }, contentJson: JSON.stringify({ metadata: { original: true }, blocks: [{ id: "text", type: "text", x: 28, y: 40, width: 390, height: 80, content: "A < B & editable", contentHtml: "<p>Original rich content</p>", contentMode: "plain", custom: "keep", style: { fontSize: 30, fontFamily: "Georgia", fontStyle: "italic", color: "#ff6600" } }, { id: "shape", type: "shape", x: 550, y: 80, width: 150, height: 150, style: { borderRadius: 75, backgroundColor: "#24abbc" } }, { id: "question", type: "assessment", x: 50, y: 200, width: 400, height: 200, assessment: createCreatorAssessment("short_answer") }, { id: "interaction", type: "interaction", x: 500, y: 270, width: 400, height: 200, interaction: { kind: "tabs", items: [{ id: "one", title: "Title", content: "Full native config" }] } }] }) });
async function exported() { const s = slide(); return exportCreatorEditablePptx(project, [s] as any, [s], new JSZip()); }
async function modify(fn: (zip: JSZip) => void | Promise<void>) { const zip = await JSZip.loadAsync((await exported()).bytes); await fn(zip); return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }); }
describe("Creator actual editable PPTX standards package", () => {
  it("creates valid PresentationML parts and editable text/shapes, not screenshots/HTML", async () => {
    const { bytes, warnings } = await exported(); const parts = readCreatorPptxZip(bytes); const xml = await validateCreatorPptxParts(parts);
    expect(xml.size).toBeGreaterThan(7); const visible = parts.get("ppt/slides/slide1.xml")!.toString();
    expect(visible).toContain("<a:t xml:space=\"preserve\">A &lt; B &amp; editable</a:t>"); expect(visible).toContain('x="266700"'); expect(visible).toContain('val="FF6600"'); expect(visible).toContain('prst="ellipse"'); expect(visible).toContain("Interactive assessment in Creator only"); expect(visible).not.toContain("<html");
    expect(warnings.join(" ")).toContain("not live PowerPoint interactivity"); expect(parts.get("customXml/course360Creator.xml")!.toString()).toContain("urn:course360:creator:native:v1");
  });
  it("own untouched round-trip retains full native config, settings, HTML, assessments, interactions, notes and arbitrary fields", async () => {
    const draft = await importCreatorEditablePptx((await exported()).bytes); expect(draft.nativeProject).toEqual(project); expect(draft.settingsJson).toBe(project.settingsJson); expect(draft.slides[0]).toEqual(slide()); expect(JSON.parse(draft.slides[0].contentJson).blocks[2].assessment.keywords).toEqual(["learning", "practice"]);
  });
  it("imports external editable text/geometry/colors and does not require own metadata", async () => {
    const bytes = await modify(zip => { zip.remove("customXml/course360Creator.xml"); const rel = zip.file("ppt/_rels/presentation.xml.rels")!; return rel.async("string").then(raw => { zip.file(rel.name, raw.replace(/<Relationship Id="rIdNative"[^>]*\/>/, "")); }); });
    const draft = await importCreatorEditablePptx(bytes); const doc = JSON.parse(draft.slides[0].contentJson); expect(doc.blocks[0].content).toBe("A < B & editable"); expect(doc.blocks[0]).toMatchObject({ x: 28, y: 40, width: 390, height: 80, style: { fontSize: 30, fontStyle: "italic", color: "#FF6600" } }); expect(draft.nativeProject).toBeUndefined();
  });
  it("own visible PowerPoint text edits merge without deleting native extension or interactive configuration", async () => {
    const bytes = await modify(async zip => { const part = zip.file("ppt/slides/slide1.xml")!; zip.file(part.name, (await part.async("string")).replace("A &lt; B &amp; editable", "Owner edited in PowerPoint")); });
    const draft = await importCreatorEditablePptx(bytes); const doc = JSON.parse(draft.slides[0].contentJson); expect(doc.blocks[0].content).toBe("Owner edited in PowerPoint"); expect(doc.blocks[0].custom).toBe("keep"); expect(doc.blocks[0].contentHtml).toBe("<p>Original rich content</p>"); expect(doc.blocks[2].assessment.type).toBe("short_answer"); expect(doc.metadata.original).toBe(true);
  });
  it("embeds resolved owned raster bytes and imports them as review-only media drafts", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMfoAAAAASUVORK5CYII=", "base64"); const assets = new JSZip(); assets.file("assets/media-99.png", png);
    const original = { ...slide(), contentJson: JSON.stringify({ blocks: [{ id: "image", type: "image", x: 10, y: 20, width: 300, height: 200, mediaId: 99, src: "https://caller.invalid/not-byte-authority", alt: "Owned picture" }] }) };
    const resolved = { ...original, contentJson: original.contentJson.replace("https://caller.invalid/not-byte-authority", "assets/media-99.png") };
    const result = await exportCreatorEditablePptx(project, [original] as any, [resolved], assets); const zip = await JSZip.loadAsync(result.bytes); expect(await zip.file("ppt/media/image1.png")!.async("nodebuffer")).toEqual(png);
    const draft = await importCreatorEditablePptx(result.bytes); expect(draft.assets[0].base64).toBe(png.toString("base64")); expect(JSON.parse(draft.slides[0].contentJson).blocks[0]).toMatchObject({ importedAssetId: "pptx-asset-1", src: "" }); expect(draft.nativeProject).toEqual(project);
  });
  it("rejects invalid package XML/entities, external relationships, macros, traversal and zipbombs", async () => {
    await expect(importCreatorEditablePptx(Buffer.from("not pptx"))).rejects.toThrow();
    for (const alter of [
      (zip: JSZip) => { zip.file("ppt/vbaProject.bin", "macro"); },
      (zip: JSZip) => { zip.file("../escape.xml", "unsafe"); },
      (zip: JSZip) => { zip.file("ppt/bomb.xml", "x".repeat(13 * 1024 * 1024)); },
      (zip: JSZip) => { zip.file("ppt/presentation.xml", '<!DOCTYPE x [<!ENTITY bad SYSTEM "file:///etc/passwd">]><x>&bad;</x>'); },
      async (zip: JSZip) => { const f = zip.file("ppt/_rels/presentation.xml.rels")!; zip.file(f.name, (await f.async("string")).replace('Target="slides/slide1.xml"', 'TargetMode="External" Target="https://evil.invalid/slide.xml"')); },
      async (zip: JSZip) => { const f = zip.file("ppt/_rels/presentation.xml.rels")!; zip.file(f.name, (await f.async("string")).replace('Target="slides/slide1.xml"', 'Target="../../../escape.xml"')); },
    ]) await expect(importCreatorEditablePptx(await modify(alter))).rejects.toThrow();
  });
  it("rejects corruption, unsafe draft URLs, and truncated full lesson text", async () => {
    const bytes = (await exported()).bytes; const corrupt = Buffer.from(bytes); corrupt[60] ^= 1; expect(() => readCreatorPptxZip(corrupt)).toThrow();
    await expect(parseCreatorPptxXml("<a><b></a>")).rejects.toThrow();
    const draft = await importCreatorEditablePptx(bytes); const doc = JSON.parse(draft.slides[0].contentJson); doc.blocks[0].action = { kind: "url", url: "javascript:alert(1)" }; draft.slides[0].contentJson = JSON.stringify(doc); expect(() => validateCreatorExchangeDraft(draft)).toThrow();
    const lesson = await importCreatorEditablePptx(bytes); lesson.fullLessonText = "short text"; expect(() => validateCreatorExchangeDraft(lesson)).toThrow("1,500");
  });
});

describe("Editable PPTX notes and byte-preserving native fields", () => {
  it("writes actual notes XML and imports an owner PowerPoint note edit without replacing slide content", async () => {
    const bytes = await modify(async zip => { const notes = zip.file("ppt/notesSlides/notesSlide1.xml")!; expect(notes).toBeTruthy(); zip.file(notes.name, (await notes.async("string")).replace("Speaker notes retained", "Owner edited these notes in PowerPoint")); });
    const draft = await importCreatorEditablePptx(bytes); expect(draft.slides[0].notes).toBe("Owner edited these notes in PowerPoint"); expect(draft.slides[0].contentJson).toBe(slide().contentJson);
  });
  it("untouched native JSON whitespace and legacy extension keys are not normalized away", async () => {
    const s = slide(); s.contentJson = JSON.stringify(JSON.parse(s.contentJson), null, 2);
    const result = await exportCreatorEditablePptx(project, [s] as any, [s], new JSZip()); const draft = await importCreatorEditablePptx(result.bytes); expect(draft.slides[0].contentJson).toBe(s.contentJson);
  });
});
