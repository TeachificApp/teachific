import JSZip from "jszip";
import { createHash } from "node:crypto";
import { readCreatorDocument, type CreatorBlock, type CreatorSlide } from "../shared/course360CreatorModel";
import { validateCreatorExchangeDraft, type CreatorExchangeDraft } from "../shared/course360CreatorExchangeDraft";
import { readCreatorPptxZip, validateCreatorPptxParts, resolvePptxRelationship, escapePptxXml as esc } from "./course360CreatorPptxSafePackage";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main", A = "http://schemas.openxmlformats.org/drawingml/2006/main", R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", REL = "http://schemas.openxmlformats.org/package/2006/relationships", CT = "application/vnd.openxmlformats-officedocument";
export const CREATOR_NATIVE_NAMESPACE = "urn:course360:creator:native:v1";
const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const emptyTree = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const relationships = (rows: { id: string; type: string; target: string }[]) => xmlHeader + `<Relationships xmlns="${REL}">${rows.map(r => `<Relationship Id="${r.id}" Type="${R}/${r.type}" Target="${esc(r.target)}"/>`).join("")}</Relationships>`;
function color(value: unknown, fallback = "FFFFFF") { if (typeof value !== "string") return fallback; const raw = value.replace(/^#/, ""); return /^[a-f\d]{6}$/i.test(raw) ? raw.toUpperCase() : /^[a-f\d]{3}$/i.test(raw) ? raw.split("").map(c => c + c).join("").toUpperCase() : fallback; }
const solid = (value: unknown, fallback = "FFFFFF") => `<a:solidFill><a:srgbClr val="${color(value, fallback)}"/></a:solidFill>`;
const emu = (n: number) => Math.round(n * 9525);
function transform(b: CreatorBlock) { return `<a:xfrm${typeof b.rotation === "number" ? ` rot="${Math.round(b.rotation * 60000)}"` : ""}><a:off x="${emu(b.x)}" y="${emu(b.y)}"/><a:ext cx="${emu(b.width)}" cy="${emu(b.height)}"/></a:xfrm>`; }
function visibleText(b: CreatorBlock) {
  if (b.type === "assessment") return `${b.assessment?.prompt || "Assessment"}\n${(b.assessment?.options || []).map(o => o.text).join("\n")}\n[Interactive assessment in Creator only]`;
  if (b.type === "interaction") return `${b.interaction?.kind || "Interaction"}\n${b.interaction?.items.map(i => `${i.title}\n${i.content}`).join("\n") || ""}\n[Interactive in Creator only]`;
  if (["audio", "video", "image"].includes(b.type)) return `[${b.type === "image" ? "Missing embedded image" : b.type + " playback in Creator only"}] ${b.alt || ""}`;
  return b.contentMode === "plain" || !b.contentHtml ? b.content || "" : b.contentHtml.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function textShape(b: CreatorBlock, id: number) {
  const st = b.style || {}, font = typeof st.fontFamily === "string" ? st.fontFamily.split(",")[0].replace(/['"]/g, "") : "Arial";
  const size = Math.round(Math.min(300, Math.max(1, Number(st.fontSize) || 20)) * 75);
  const paragraphs = visibleText(b).split("\n").map(line => `<a:p><a:pPr algn="${st.textAlign === "center" ? "ctr" : st.textAlign === "right" ? "r" : "l"}"/><a:r><a:rPr lang="en-US" sz="${size}" b="${st.fontWeight === "bold" ? 1 : 0}" i="${st.fontStyle === "italic" ? 1 : 0}"${st.textDecoration === "underline" ? ' u="sng"' : ""}>${solid(st.color)}<a:latin typeface="${esc(font)}"/></a:rPr><a:t xml:space="preserve">${esc(line)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`).join("");
  const fill = st.backgroundColor ? solid(st.backgroundColor) : "<a:noFill/>";
  const geom = b.pptxGeometry === "ellipse" || Number(st.borderRadius) >= Math.min(b.width, b.height) / 2 ? "ellipse" : Number(st.borderRadius) ? "roundRect" : "rect";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(b.id)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${transform(b)}<a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${fill}<a:ln w="${emu(Number(st.borderWidth) || 0)}">${st.borderColor ? solid(st.borderColor) : '<a:noFill/>'}</a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>${paragraphs || '<a:p/>'}</p:txBody></p:sp>`;
}
export function sniffCreatorPptxImage(bytes: Buffer, declared?: string) {
  let mime = "";
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = "image/png";
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = "image/jpeg";
  else if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString("ascii"))) mime = "image/gif";
  else if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") mime = "image/webp";
  if (!mime || (declared && declared !== mime) || bytes.length > 8 * 1024 * 1024) throw new Error("Only bounded embedded PNG/JPEG/GIF/WebP images are supported; image signatures must match.");
  return mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
}
/** Caller resolves owned asset bytes using course360CreatorMedia; no caller URL is fetched here. */
export async function exportCreatorEditablePptx(project: Record<string, any>, originalSlides: (CreatorSlide & Record<string, any>)[], resolvedSlides: CreatorSlide[], assetZip: JSZip) {
  if (!originalSlides.length || originalSlides.length > 100) throw new Error("Export between 1 and 100 slides.");
  const settings = JSON.parse(project.settingsJson || "{}"); const width = Number(settings.width) || 1000, height = Number(settings.height) || 563;
  if (width < 1 || height < 1 || width > 4000 || height > 4000) throw new Error("Unsupported slide canvas size.");
  const zip = new JSZip(), warnings: string[] = ["Editable text, raster images and basic shapes are supported. Assessments, interactions, audio/video and navigation have honest visible fallbacks; native configuration is retained in Course360 custom XML, not live PowerPoint interactivity."];
  const contentTypes: { part: string; type: string }[] = [], hashes: string[] = [], bindings: Record<string, string> = {};
  const media = new Map<string, string>(); let mediaBytes = 0;
  for (let i = 0; i < resolvedSlides.length; i++) {
    const slide = resolvedSlides[i], blocks = readCreatorDocument(slide.contentJson).blocks;
    const rels = [{ id: "rIdLayout", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" }]; let body = "";
    if (slide.notes) {
      rels.push({ id: "rIdNotes", type: "notesSlide", target: `../notesSlides/notesSlide${i + 1}.xml` });
      const paragraphs = slide.notes.split("\n").map(line => `<a:p><a:r><a:t xml:space="preserve">${esc(line)}</a:t></a:r></a:p>`).join("");
      zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`, xmlHeader + `<p:notes xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree>${emptyTree}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
      zip.file(`ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`, relationships([{ id: "rIdSlide", type: "slide", target: `../slides/slide${i + 1}.xml` }]));
      contentTypes.push({ part: `/ppt/notesSlides/notesSlide${i + 1}.xml`, type: `${CT}.presentationml.notesSlide+xml` });
    }
    for (let j = 0; j < blocks.length; j++) {
      const b = blocks[j];
      if (b.type === "image" && b.mediaId && b.src?.startsWith("assets/")) {
        let path = media.get(b.src);
        if (!path) { const entry = assetZip.file(b.src); if (!entry) throw new Error("Owned image bytes were not resolved."); const bytes = await entry.async("nodebuffer"), mime = sniffCreatorPptxImage(bytes); mediaBytes += bytes.length; if (mediaBytes > 24 * 1024 * 1024) throw new Error("PPTX media exceeds 24 MiB."); const ext = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[mime]; path = `ppt/media/image${media.size + 1}.${ext}`; zip.file(path, bytes); media.set(b.src, path); }
        const rid = `rIdImage${j + 1}`; rels.push({ id: rid, type: "image", target: "../media/" + path.split("/").pop() }); bindings[`${i}:${b.id}`] = path;
        body += `<p:pic><p:nvPicPr><p:cNvPr id="${j + 2}" name="${esc(b.id)}" descr="${esc(b.alt || "")}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${transform(b)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
      } else { body += textShape(b, j + 2); if (["image", "audio", "video"].includes(b.type)) warnings.push(`Slide ${i + 1}: ${b.type} is a labeled fallback unless a supported owned image was bound.`); if (b.contentHtml && b.contentMode !== "plain") warnings.push(`Slide ${i + 1}: rich HTML is plain editable text in PowerPoint; original HTML remains native.`); }
    }
    const xml = xmlHeader + `<p:sld xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld name="${esc(slide.title)}"><p:bg><p:bgPr>${solid(slide.background, "0F172A")}<a:effectLst/></p:bgPr></p:bg><p:spTree>${emptyTree}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
    hashes.push(hash(xml)); zip.file(`ppt/slides/slide${i + 1}.xml`, xml); zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, relationships(rels)); contentTypes.push({ part: `/ppt/slides/slide${i + 1}.xml`, type: `${CT}.presentationml.slide+xml` });
  }
  zip.file("ppt/presentation.xml", xmlHeader + `<p:presentation xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst>${resolvedSlides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${emu(width)}" cy="${emu(height)}" type="custom"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", relationships([{ id: "rIdMaster", type: "slideMaster", target: "slideMasters/slideMaster1.xml" }, { id: "rIdNative", type: "customXml", target: "../customXml/course360Creator.xml" }, ...resolvedSlides.map((_, i) => ({ id: `rId${i + 1}`, type: "slide", target: `slides/slide${i + 1}.xml` }))]));
  zip.file("_rels/.rels", relationships([{ id: "rId1", type: "officeDocument", target: "ppt/presentation.xml" }]));
  zip.file("ppt/slideLayouts/slideLayout1.xml", xmlHeader + `<p:sldLayout xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", relationships([{ id: "rId1", type: "slideMaster", target: "../slideMasters/slideMaster1.xml" }]));
  zip.file("ppt/slideMasters/slideMaster1.xml", xmlHeader + `<p:sldMaster xmlns:a="${A}" xmlns:r="${R}" xmlns:p="${P}"><p:cSld><p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rIdLayout"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", relationships([{ id: "rIdLayout", type: "slideLayout", target: "../slideLayouts/slideLayout1.xml" }, { id: "rIdTheme", type: "theme", target: "../theme/theme1.xml" }]));
  const themeColors = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].map((name, i) => `<a:${name}><a:srgbClr val="${["000000", "FFFFFF", "0F172A", "FFFFFF", "24ABBC", "4AD9E0", "12324A", "808080", "008080", "404040", "0000FF", "800080"][i]}"/></a:${name}>`).join("");
  zip.file("ppt/theme/theme1.xml", xmlHeader + `<a:theme xmlns:a="${A}" name="Course360"><a:themeElements><a:clrScheme name="Course360">${themeColors}</a:clrScheme><a:fontScheme name="System"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Basic"><a:fillStyleLst>${solid("#ffffff").repeat(3)}</a:fillStyleLst><a:lnStyleLst>${`<a:ln w="9525">${solid("#ffffff")}<a:prstDash val="solid"/></a:ln>`.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${solid("#ffffff").repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
  // Embed all server-resolved owned media, including native assessment/logo/audio/video bytes.
  // Non-image assets retain an honest visible fallback; no claim of PowerPoint playback/interactivity.
  const nativeAssets: Record<string, string> = {};
  for (const [source, entry] of Object.entries(assetZip.files)) {
    if (entry.dir) continue;
    if (!/^assets\/media-\d+\.(png|jpg|gif|webp|mp3|wav|ogg|m4a|webm|mp4|ogv)$/.test(source)) throw new Error("Unrecognized owned asset package path.");
    let path = media.get(source);
    if (!path) { const bytes = await entry.async("nodebuffer"); mediaBytes += bytes.length; if (mediaBytes > 24 * 1024 * 1024) throw new Error("PPTX media exceeds 24 MiB."); path = `ppt/media/native-${source.split("/").pop()}`; zip.file(path, bytes); }
    nativeAssets[source] = path;
  }
  // All original fields survive explicitly namespaced native payload; no HTML-disguised PPTX.
  zip.file("customXml/course360Creator.xml", xmlHeader + `<c360:native xmlns:c360="${CREATOR_NATIVE_NAMESPACE}" version="1"><c360:payload>${esc(JSON.stringify({ project, slides: originalSlides, hashes, bindings, nativeAssets }))}</c360:payload></c360:native>`);
  if (Object.keys(nativeAssets).length) zip.file("customXml/_rels/course360Creator.xml.rels", relationships(Object.entries(nativeAssets).map(([source, path], i) => ({ id: `rIdOwned${i + 1}`, type: /\.(png|jpg|gif|webp)$/.test(source) ? "image" : "media", target: "../" + path }))));
  contentTypes.push({ part: "/ppt/presentation.xml", type: `${CT}.presentationml.presentation.main+xml` }, { part: "/ppt/slideLayouts/slideLayout1.xml", type: `${CT}.presentationml.slideLayout+xml` }, { part: "/ppt/slideMasters/slideMaster1.xml", type: `${CT}.presentationml.slideMaster+xml` }, { part: "/ppt/theme/theme1.xml", type: `${CT}.theme+xml` });
  const nativeTypes = { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", webm: "video/webm", mp4: "video/mp4", ogv: "video/ogg" };
  zip.file("[Content_Types].xml", xmlHeader + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="webp" ContentType="image/webp"/>${Object.entries(nativeTypes).map(([extension, type]) => `<Default Extension="${extension}" ContentType="${type}"/>`).join("")}${contentTypes.map(c => `<Override PartName="${c.part}" ContentType="${c.type}"/>`).join("")}</Types>`);
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await validateCreatorPptxParts(readCreatorPptxZip(bytes));
  return { bytes, warnings: [...new Set(warnings)] };
}

const first = (node: any, key: string) => node?.[key]?.[0];
function descendants(node: any, name: string): any[] { if (!node || typeof node !== "object") return []; const out = node["#name"] === name ? [node] : []; for (const child of node.$$ || []) out.push(...descendants(child, name)); return out; }
const textValue = (node: any): string => typeof node === "string" ? node : node?._ || "";
function geometry(node: any, width: number, height: number) {
  const xf = descendants(node, "a:xfrm")[0], off = first(xf, "a:off")?.$, ext = first(xf, "a:ext")?.$;
  if (!off || !ext) return { x: 0, y: 0, width: width / 2, height: height / 3 };
  const values = [off.x, off.y, ext.cx, ext.cy].map(Number);
  if (values.some(v => !Number.isFinite(v)) || values[2] <= 0 || values[3] <= 0) throw new Error("Invalid slide geometry.");
  return { x: values[0] / 9525, y: values[1] / 9525, width: values[2] / 9525, height: values[3] / 9525, ...(xf.$?.rot ? { rotation: Number(xf.$.rot) / 60000 } : {}) };
}
function readFill(node: any) { const c = first(node, "a:solidFill"); const v = first(c, "a:srgbClr")?.$?.val; return v && /^[a-f\d]{6}$/i.test(v) ? "#" + v : undefined; }
/** Bounded import is review-only; assets are byte drafts, never auto-uploaded or caller URL fetched. */
export async function importCreatorEditablePptx(bytes: Buffer, title = "Imported PowerPoint") {
  const parts = readCreatorPptxZip(bytes), xml = await validateCreatorPptxParts(parts);
  const pres = xml.get("ppt/presentation.xml")["p:presentation"], size = first(pres, "p:sldSz")?.$;
  const width = Number(size?.cx) / 9525, height = Number(size?.cy) / 9525;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 4000 || height > 4000) throw new Error("Unsupported PowerPoint slide size.");
  const pRels = xml.get("ppt/_rels/presentation.xml.rels").Relationships.Relationship || [];
  const ids = first(pres, "p:sldIdLst")?.["p:sldId"] || [];
  if (!ids.length || ids.length > 100) throw new Error("Import between 1 and 100 slides.");
  const warnings = ["PowerPoint import supports editable text, basic shapes and embedded raster images. Complex groups/charts/SmartArt, master/theme inheritance, transitions and live interactivity are not reproduced."], assets: CreatorExchangeDraft["assets"] = [], slides: CreatorExchangeDraft["slides"] = [], assetMap = new Map<string, string>();
  const ensureAsset = (path: string) => { let id = assetMap.get(path); if (id) return id; const data = parts.get(path); if (!data) throw new Error("Missing embedded picture."); const mimeType = sniffCreatorPptxImage(data); id = `pptx-asset-${assets.length + 1}`; assetMap.set(path, id); assets.push({ id, filename: path.split("/").pop()!, mimeType, base64: data.toString("base64") }); return id; };
  let native: any = null;
  const nativeXml = xml.get("customXml/course360Creator.xml");
  if (nativeXml) { const root = nativeXml["c360:native"]; if (root?.$?.["xmlns:c360"] !== CREATOR_NATIVE_NAMESPACE || root?.$?.version !== "1") throw new Error("Invalid Creator native namespace."); const payload = textValue(first(root, "c360:payload")); if (payload.length > 6 * 1024 * 1024) throw new Error("Native configuration too large."); native = JSON.parse(payload); if (!Array.isArray(native.slides) || native.slides.length !== ids.length || !Array.isArray(native.hashes)) throw new Error("Invalid native slide configuration."); }
  for (let i = 0; i < ids.length; i++) {
    const rid = ids[i].$?.["r:id"], rel = pRels.find((r: any) => r.$.Id === rid && r.$.Type === `${R}/slide`);
    if (!rel) throw new Error("Slide relationship is missing.");
    const path = resolvePptxRelationship("ppt/presentation.xml", rel.$.Target), s = xml.get(path)?.["p:sld"];
    if (!s) throw new Error("Invalid slide XML.");
    const cSld = first(s, "p:cSld"), tree = first(cSld, "p:spTree"), relPath = path.replace(/([^/]+)$/, "_rels/$1.rels"), rels = xml.get(relPath)?.Relationships?.Relationship || [];
    const blocks: CreatorBlock[] = [];
    for (const node of tree?.$$ || []) {
      const kind = node["#name"]; if (!["p:sp", "p:pic"].includes(kind)) { if (["p:grpSp", "p:graphicFrame", "p:cxnSp"].includes(kind)) warnings.push(`Slide ${i + 1}: unsupported ${kind} omitted from visible import.`); continue; }
      const name = descendants(node, "p:cNvPr")[0]?.$?.name || `pptx-${i}-${blocks.length}`;
      const geom = geometry(node, width, height); const spPr = first(node, "p:spPr");
      if (kind === "p:pic") { const blip = descendants(node, "a:blip")[0], r = rels.find((r: any) => r.$.Id === blip?.$?.["r:embed"] && r.$.Type === `${R}/image`); if (!r) throw new Error("Embedded picture relationship is missing."); const mediaPath = resolvePptxRelationship(path, r.$.Target); blocks.push({ id: name, type: "image", ...geom, src: "", importedAssetId: ensureAsset(mediaPath), alt: descendants(node, "p:cNvPr")[0]?.$?.descr || "Imported PowerPoint image" }); }
      else {
        const tx = first(node, "p:txBody"), paras = tx?.["a:p"] || [], content = paras.map((p: any) => (p.$$ || []).map((r: any) => r["#name"] === "a:br" ? "\n" : descendants(r, "a:t").map(textValue).join("")).join("")).join("\n");
        const run = descendants(node, "a:rPr")[0], pPr = first(paras[0], "a:pPr")?.$, prst = first(spPr, "a:prstGeom")?.$?.prst;
        blocks.push({ id: name, type: tx && content ? "text" : "shape", ...geom, content, contentMode: "plain", pptxGeometry: prst || "rect", style: { ...(readFill(spPr) ? { backgroundColor: readFill(spPr)! } : {}), color: readFill(run) || "#ffffff", fontSize: Number(run?.$?.sz) / 75 || 20, fontWeight: run?.$?.b === "1" ? "bold" : "normal", fontStyle: run?.$?.i === "1" ? "italic" : "normal", textAlign: pPr?.algn === "ctr" ? "center" : pPr?.algn === "r" ? "right" : "left", fontFamily: first(run, "a:latin")?.$?.typeface || "Arial", ...(prst === "ellipse" ? { borderRadius: Math.min(geom.width, geom.height) / 2 } : prst === "roundRect" ? { borderRadius: 8 } : {}) } });
      }
    }
    if (new Set(blocks.map(b => b.id)).size !== blocks.length) blocks.forEach((b, j) => b.id = `pptx-${i}-${j}`);
    let slide: any = { id: i + 1, title: cSld?.$?.name || `Slide ${i + 1}`, background: readFill(first(first(cSld, "p:bg"), "p:bgPr")) || "#ffffff", contentJson: JSON.stringify({ blocks }), notes: null };
    const noteRel = rels.find((r: any) => r.$.Type === `${R}/notesSlide`);
    if (noteRel) { const notesPath = resolvePptxRelationship(path, noteRel.$.Target); const notesNode = xml.get(notesPath)?.["p:notes"]; slide.notes = descendants(notesNode, "a:p").map(p => descendants(p, "a:t").map(textValue).join("")).join("\n"); }
    if (native) {
      const original = structuredClone(native.slides[i]); const doc = readCreatorDocument(original.contentJson);
      if (native.hashes[i] !== hash(parts.get(path)!)) {
        const visible = new Map(blocks.map(b => [b.id, b]));
        doc.blocks = doc.blocks.map(b => { const imported = visible.get(b.id); if (!imported) return b; if (!["text", "shape", "image"].includes(b.type)) return b; return { ...b, ...imported, type: b.type, style: { ...b.style, ...imported.style }, ...(b.type === "text" ? { contentMode: "plain" } : {}) }; });
        for (const b of blocks) if (!doc.blocks.some(o => o.id === b.id)) doc.blocks.push(b);
        warnings.push(`Slide ${i + 1}: visible edits merged additively; deleted native elements are retained to avoid losing interactive configuration.`);
      }
      for (const b of doc.blocks) { const mediaPath = native.bindings?.[`${i}:${b.id}`]; if (mediaPath && b.type === "image") { b.importedAssetId = ensureAsset(mediaPath); b.src = ""; delete b.mediaId; } }
      const rebound = doc.blocks.some(b => b.importedAssetId);
      slide = { ...original, ...(native.hashes[i] !== hash(parts.get(path)!) ? { title: slide.title, background: slide.background } : {}), ...(noteRel && slide.notes !== (original.notes || "") ? { notes: slide.notes } : {}), contentJson: native.hashes[i] === hash(parts.get(path)!) && !rebound ? original.contentJson : JSON.stringify(doc) };
    }
    slides.push(slide);
  }
  const draft = validateCreatorExchangeDraft({ version: 1, source: "pptx", title: native?.project?.title || title, description: native?.project?.description || "", settingsJson: native?.project?.settingsJson || JSON.stringify({ width, height, theme: "light" }), ...(native ? { nativeProject: native.project } : {}), slides, assets, warnings });
  return draft;
}
