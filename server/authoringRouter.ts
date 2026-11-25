/**
 * TeachificCreator™ — Authoring Router
 * Handles project CRUD, slide management, and SCORM/HTML5 export generation.
 */
import { z } from "zod";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb, getUserById, getOrgMember } from "./db";
import { requireCourse360AppCapability, requireCourse360AppOrganization } from "./lib/course360AppCapabilities";
import { readCreatorDocument, validateCreatorDocument, creatorPrimitives, creatorAssessmentSchema } from "../shared/course360CreatorModel";
import { seedCreatorTemplate, seedCreatorLayout, CREATOR_LAYOUTS } from "../shared/course360CreatorLayouts";
import { buildCreatorRuntimeHtml, createCreatorScorm } from "../shared/course360CreatorRuntime";
import { resolveCreatorMedia, resolveCreatorProjectMedia } from "./course360CreatorMedia";
import { authoringProjects, authoringSlides, users, orgMembers } from "../drizzle/schema";
import { storagePut } from "./storage";
import JSZip from "jszip";
import { getCourse360PaymentAppAccess, setCourse360PaymentManualRole } from "./lib/course360PaymentLedger";

import { creatorExchangeProcedures } from "./course360CreatorExchangeProcedures";
// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

async function requireActiveAuthoringOrg(userId: number, _userRole?: string, requestedOrgId?: number): Promise<number> {
  const scope = await requireCourse360AppCapability(userId, "creator", "web");
  if (requestedOrgId !== undefined && requestedOrgId !== scope.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Switch to the requested school before authoring." });
  return scope.orgId;
}

// Default slide content for a new project
function defaultSlideContent() {
  return JSON.stringify({
    blocks: [
      {
        id: "title-1",
        type: "text",
        x: 80,
        y: 120,
        width: 840,
        height: 80,
        content: "Click to edit title",
        style: { fontSize: 40, fontWeight: "bold", color: "#ffffff", textAlign: "center" },
      },
      {
        id: "subtitle-1",
        type: "text",
        x: 120,
        y: 220,
        width: 760,
        height: 50,
        content: "Click to edit subtitle",
        style: { fontSize: 22, color: "#94a3b8", textAlign: "center" },
      },
    ],
  });
}

// ─── SCORM 1.2 Manifest ───────────────────────────────────────────────────────
function buildScorm12Manifest(project: { title: string; id: number | bigint }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.teachific.creator.${project.id}" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
    http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${escapeXml(project.title)}</title>
      <item identifier="item1" identifierref="resource1">
        <title>${escapeXml(project.title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="scorm12-api.js"/>
      <file href="course.js"/>
    </resource>
  </resources>
</manifest>`;
}

// ─── SCORM 2004 Manifest ──────────────────────────────────────────────────────
function buildScorm2004Manifest(project: { title: string; id: number | bigint }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.teachific.creator.${project.id}"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3p2"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3p2"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3p2"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>${escapeXml(project.title)}</title>
      <item identifier="item1" identifierref="resource1">
        <title>${escapeXml(project.title)}</title>
        <imsss:sequencing>
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource1" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
      <file href="scorm2004-api.js"/>
      <file href="course.js"/>
    </resource>
  </resources>
</manifest>`;
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── SCORM 1.2 API Wrapper ────────────────────────────────────────────────────
const SCORM12_API_JS = `
// TeachificCreator™ SCORM 1.2 API Wrapper
var API = null;
function findAPI(win) {
  var attempts = 0;
  while (win.API == null && win.parent != null && win.parent != win) {
    attempts++;
    if (attempts > 7) return null;
    win = win.parent;
  }
  return win.API;
}
function getAPI() {
  if (API == null) {
    API = findAPI(window);
    if (API == null && window.opener != null) API = findAPI(window.opener);
  }
  return API;
}
var ScormAPI = {
  initialized: false,
  init: function() {
    var api = getAPI();
    if (api) { api.LMSInitialize(""); this.initialized = true; }
  },
  finish: function() {
    var api = getAPI();
    if (api && this.initialized) { api.LMSFinish(""); }
  },
  setValue: function(element, value) {
    var api = getAPI();
    if (api && this.initialized) api.LMSSetValue(element, value);
  },
  getValue: function(element) {
    var api = getAPI();
    if (api && this.initialized) return api.LMSGetValue(element);
    return "";
  },
  commit: function() {
    var api = getAPI();
    if (api && this.initialized) api.LMSCommit("");
  },
  setComplete: function() {
    this.setValue("cmi.core.lesson_status", "completed");
    this.setValue("cmi.core.exit", "");
    this.commit();
  },
  setScore: function(raw, min, max) {
    this.setValue("cmi.core.score.raw", raw);
    this.setValue("cmi.core.score.min", min || 0);
    this.setValue("cmi.core.score.max", max || 100);
    this.commit();
  }
};
window.ScormAPI = ScormAPI;
`;

// ─── SCORM 2004 API Wrapper ───────────────────────────────────────────────────
const SCORM2004_API_JS = `
// TeachificCreator™ SCORM 2004 API Wrapper
var API_1484_11 = null;
function findAPI(win) {
  var attempts = 0;
  while (win.API_1484_11 == null && win.parent != null && win.parent != win) {
    attempts++;
    if (attempts > 7) return null;
    win = win.parent;
  }
  return win.API_1484_11;
}
function getAPI() {
  if (API_1484_11 == null) {
    API_1484_11 = findAPI(window);
    if (API_1484_11 == null && window.opener != null) API_1484_11 = findAPI(window.opener);
  }
  return API_1484_11;
}
var ScormAPI = {
  initialized: false,
  init: function() {
    var api = getAPI();
    if (api) { api.Initialize(""); this.initialized = true; }
  },
  finish: function() {
    var api = getAPI();
    if (api && this.initialized) { api.Terminate(""); }
  },
  setValue: function(element, value) {
    var api = getAPI();
    if (api && this.initialized) api.SetValue(element, value);
  },
  getValue: function(element) {
    var api = getAPI();
    if (api && this.initialized) return api.GetValue(element);
    return "";
  },
  commit: function() {
    var api = getAPI();
    if (api && this.initialized) api.Commit("");
  },
  setComplete: function() {
    this.setValue("cmi.completion_status", "completed");
    this.setValue("cmi.success_status", "passed");
    this.commit();
  },
  setScore: function(raw, min, max) {
    this.setValue("cmi.score.raw", raw);
    this.setValue("cmi.score.min", min || 0);
    this.setValue("cmi.score.max", max || 100);
    this.setValue("cmi.score.scaled", raw / (max || 100));
    this.commit();
  }
};
window.ScormAPI = ScormAPI;
`;

// ─── Course Player HTML ───────────────────────────────────────────────────────
function buildCourseHtml(
  project: { title: string; id?: number; settingsJson?: string | null },
  slides: Array<{ id?: number; title: string; contentJson: string | null; background: string | null; notes: string | null; nextSlideId?: number | null }>,
  scormVersion: "scorm12" | "scorm2004" | "html5",
  showWatermark = false
) {
  return buildCreatorRuntimeHtml({ ...project, slides: slides.map((s, i) => ({ ...s, id: s.id ?? i + 1 })), showWatermark }, scormVersion);
}
// Retained historical reader for backwards inspection; active exports use the shared runtime above.
function buildHistoricalCourseHtml(
  project: { title: string },
  slides: Array<{ title: string; contentJson: string | null; background: string | null; notes: string | null }>,
  scormVersion: "scorm12" | "scorm2004" | "html5", showWatermark = false
) {
  const apiScript =
    scormVersion === "scorm12"
      ? '<script src="scorm12-api.js"></script>'
      : scormVersion === "scorm2004"
      ? '<script src="scorm2004-api.js"></script>'
      : "";

  const slidesData = JSON.stringify(
    slides.map((s, i) => ({
      index: i,
      title: s.title,
      background: s.background || "#0f172a",
      blocks: (() => {
        try {
          return JSON.parse(s.contentJson || "{}").blocks || [];
        } catch {
          return [];
        }
      })(),
    }))
  ).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeXml(project.title)}</title>
  ${apiScript}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #fff; height: 100vh; display: flex; flex-direction: column; }
    #player { flex: 1; display: flex; flex-direction: column; }
    #slide-area { flex: 1; position: relative; overflow: hidden; }
    .slide { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; opacity: 0; transition: opacity 0.4s; pointer-events: none; }
    .slide.active { opacity: 1; pointer-events: all; }
    .block { position: absolute; }
    .block-text { font-size: 18px; line-height: 1.5; }
    #nav { height: 60px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-between; padding: 0 24px; gap: 16px; }
    #progress-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
    #progress-fill { height: 100%; background: #24abbc; transition: width 0.3s; }
    button.nav-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
    button.nav-btn:hover { background: rgba(255,255,255,0.2); }
    button.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    #slide-counter { font-size: 13px; color: rgba(255,255,255,0.5); min-width: 80px; text-align: center; }
    #title-bar { height: 48px; background: rgba(0,0,0,0.6); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; padding: 0 24px; }
    #course-title { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.8); }
    #slide-title { font-size: 13px; color: #24abbc; margin-left: auto; }
  </style>
</head>
<body>
<div id="player">
  <div id="title-bar">
    <span id="course-title">${escapeXml(project.title)}</span>
    <span id="slide-title"></span>
  </div>
  <div id="slide-area"></div>
  <div id="nav" style="display:flex;align-items:center;gap:16px;padding:0 24px;">
    <button class="nav-btn" id="btn-prev" onclick="prevSlide()">← Back</button>
    <div id="progress-bar"><div id="progress-fill"></div></div>
    <span id="slide-counter"></span>
    <button class="nav-btn" id="btn-next" onclick="nextSlide()">Next →</button>
  </div>
</div>
<script src="course.js"></script>
<script>
  var SLIDES = ${slidesData};
  var current = 0;
  var scormVersion = "${scormVersion}";

  function renderSlides() {
    var area = document.getElementById('slide-area');
    area.innerHTML = '';
    SLIDES.forEach(function(slide, i) {
      var div = document.createElement('div');
      div.className = 'slide' + (i === 0 ? ' active' : '');
      div.id = 'slide-' + i;
      div.style.background = slide.background || '#0f172a';
      (slide.blocks || []).forEach(function(block) {
        var el = document.createElement('div');
        el.className = 'block block-' + block.type;
        el.style.left = (block.x || 0) + 'px';
        el.style.top = (block.y || 0) + 'px';
        el.style.width = (block.width || 400) + 'px';
        el.style.height = (block.height || 60) + 'px';
        if (block.style) {
          Object.assign(el.style, {
            fontSize: (block.style.fontSize || 18) + 'px',
            fontWeight: block.style.fontWeight || 'normal',
            color: block.style.color || '#fff',
            textAlign: block.style.textAlign || 'left',
          });
        }
        el.textContent = block.content || '';
        div.appendChild(el);
      });
      area.appendChild(div);
    });
  }

  function updateNav() {
    var slide = SLIDES[current];
    document.getElementById('slide-title').textContent = slide ? slide.title : '';
    document.getElementById('slide-counter').textContent = (current + 1) + ' / ' + SLIDES.length;
    document.getElementById('btn-prev').disabled = current === 0;
    document.getElementById('btn-next').textContent = current === SLIDES.length - 1 ? 'Finish ✓' : 'Next →';
    var pct = SLIDES.length > 1 ? (current / (SLIDES.length - 1)) * 100 : 100;
    document.getElementById('progress-fill').style.width = pct + '%';
    document.querySelectorAll('.slide').forEach(function(s, i) {
      s.classList.toggle('active', i === current);
    });
    if (scormVersion !== 'html5' && window.ScormAPI) {
      ScormAPI.setValue(scormVersion === 'scorm12' ? 'cmi.core.lesson_location' : 'cmi.location', String(current));
      ScormAPI.commit();
    }
  }

  function nextSlide() {
    if (current < SLIDES.length - 1) {
      current++;
      updateNav();
    } else {
      if (scormVersion !== 'html5' && window.ScormAPI) {
        ScormAPI.setComplete();
        ScormAPI.finish();
      }
      alert('Course complete! Well done.');
    }
  }

  function prevSlide() {
    if (current > 0) { current--; updateNav(); }
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (scormVersion !== 'html5' && window.ScormAPI) ScormAPI.init();
    renderSlides();
    updateNav();
  });
</script>
${showWatermark ? `<div id="teachific-watermark" style="position:fixed;bottom:0;left:0;right:0;z-index:999999;pointer-events:none;display:flex;align-items:center;justify-content:center;padding:6px 16px;background:rgba(24,154,161,0.93);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:600;color:#fff;letter-spacing:0.02em;user-select:none;-webkit-user-select:none;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="margin-right:6px;flex-shrink:0" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Created with Course360™ — <a href="https://course360.app" target="_blank" rel="noopener" style="color:#4ad9e0;text-decoration:none;margin-left:4px;pointer-events:all;">Upgrade to remove watermark</a></div>` : ''}
</body>
</html>`;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const authoringRouter = router({
  ...creatorExchangeProcedures,
  // ── Projects ──────────────────────────────────────────────────────────────

  listProjects: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role, input.orgId);
      const rows = await db
        .select()
        .from(authoringProjects)
        .where(
          and(
            eq(authoringProjects.userId, ctx.user.id),
            eq(authoringProjects.orgId, orgId)
          )
        )
        .orderBy(desc(authoringProjects.updatedAt));
      return rows;
    }),

  getProject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      const [row] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, input.id), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  createProject: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255).default("Untitled Project"),
        description: z.string().optional(),
        orgId: z.number().optional(),
        template: z.enum(["blank", "training", "quiz", "scenario", "microlearn", "onboarding"]).optional().default("blank"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role, input.orgId);
      const [result] = await db.insert(authoringProjects).values({
        orgId,
        userId: ctx.user.id,
        title: input.title,
        description: input.description,
        settingsJson: JSON.stringify({
          theme: "dark",
          width: 1000,
          height: 563,
          language: "en",
          passingScore: 80,
          player: { showProgress: true, showNav: true, allowBack: true },
        }),
      });
      const projectId = Number((result as any).insertId);
      if (!Number.isSafeInteger(projectId) || projectId < 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Project could not be created." });
      const seeds = seedCreatorTemplate(input.template);
      const seededIds: number[] = [];
      for (let i = 0; i < seeds.length; i++) {
        const seed = seeds[i];
        // The blank choice keeps its exact historical first-slide defaults.
        const [created] = await db.insert(authoringSlides).values({ projectId, slideIndex: i, ...seed, ...(input.template === "blank" ? { title: "Title Slide", contentJson: defaultSlideContent() } : {}) });
        const id = Number((created as any).insertId);
        if (!Number.isSafeInteger(id) || id < 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Template creation was interrupted. The original project remains available." });
        seededIds.push(id);
      }
      if (input.template === "scenario") {
        const doc = readCreatorDocument(seeds[1].contentJson);
        let choice = 0;
        for (const block of doc.blocks) if (block.type === "button") block.action = { kind: "slide", targetSlideId: seededIds[2 + choice++] };
        await db.update(authoringSlides).set({ contentJson: JSON.stringify(doc) }).where(eq(authoringSlides.id, seededIds[1]));
      }
      return { id: projectId };
    }),

  updateProject: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        settingsJson: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        status: z.enum(["draft", "published"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      const [existing] = await db.select().from(authoringProjects).where(and(eq(authoringProjects.id, id), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (updates.settingsJson !== undefined) { try { const settings = JSON.parse(updates.settingsJson); if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error(); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid settings; existing project settings retained." }); } }
      if (updates.settingsJson !== undefined) await resolveCreatorProjectMedia(db, orgId, { title: existing.title, settingsJson: updates.settingsJson });
      await db
        .update(authoringProjects)
        .set(updates)
        .where(and(eq(authoringProjects.id, id), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      return { success: true };
    }),

  deleteProject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      const [project] = await db
        .select({ id: authoringProjects.id })
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, input.id), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      await db
        .delete(authoringSlides)
        .where(eq(authoringSlides.projectId, input.id));
      await db
        .delete(authoringProjects)
        .where(and(eq(authoringProjects.id, input.id), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      return { success: true };
    }),

  duplicateProject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      const [original] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, input.id), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });

      const [result] = await db.insert(authoringProjects).values({
        orgId: original.orgId,
        userId: ctx.user.id,
        title: `${original.title} (Copy)`,
        description: original.description,
        settingsJson: original.settingsJson,
        status: "draft",
      });
      const newProjectId = Number((result as any).insertId);

      const slides = await db
        .select()
        .from(authoringSlides)
        .where(eq(authoringSlides.projectId, input.id))
        .orderBy(asc(authoringSlides.slideIndex));

      if (!Number.isSafeInteger(newProjectId) || newProjectId < 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Copy creation failed; original project is unchanged." });
      const copied = new Map<number, number>();
      for (const slide of slides) {
        const [inserted] = await db.insert(authoringSlides).values({ projectId: newProjectId, slideIndex: slide.slideIndex, title: slide.title, slideType: slide.slideType, contentJson: slide.contentJson, layout: slide.layout, background: slide.background, notes: slide.notes });
        const id = Number((inserted as any).insertId);
        if (!Number.isSafeInteger(id) || id < 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Copy interrupted; original project is unchanged." });
        copied.set(Number(slide.id), id);
      }
      for (const slide of slides) {
        const updates: { contentJson?: string; nextSlideId?: number | null } = {};
        if (slide.nextSlideId != null) { const target = copied.get(Number(slide.nextSlideId)); if (!target) throw new TRPCError({ code: "BAD_REQUEST", message: "Original contains a missing branch target; original data retained." }); updates.nextSlideId = target; }
        if (slide.contentJson) {
          // Malformed legacy JSON is copied byte-for-byte; never reset it to empty blocks.
          let document; try { document = readCreatorDocument(slide.contentJson); } catch { document = null; }
          if (document) { let changed = false; for (const block of document.blocks) if (block.action?.kind === "slide") { const target = copied.get(block.action.targetSlideId!); if (!target) throw new TRPCError({ code: "BAD_REQUEST", message: "Original contains a missing button target; original data retained." }); block.action = { ...block.action, targetSlideId: target }; changed = true; } if (changed) updates.contentJson = JSON.stringify(document); }
        }
        if (Object.keys(updates).length) await db.update(authoringSlides).set(updates).where(eq(authoringSlides.id, copied.get(Number(slide.id))!));
      }
      return { id: newProjectId };
    }),

  // ── Slides ────────────────────────────────────────────────────────────────

  listSlides: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      const [proj] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, input.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });

      return db
        .select()
        .from(authoringSlides)
        .where(eq(authoringSlides.projectId, input.projectId))
        .orderBy(asc(authoringSlides.slideIndex));
    }),

  addSlide: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        afterIndex: z.number().int().min(-1).optional(),
        slideType: z.enum(["content", "quiz", "interaction", "scenario", "video"]).default("content"),
        layout: z.string().default("title-content"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      const [proj] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, input.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await db
        .select()
        .from(authoringSlides)
        .where(eq(authoringSlides.projectId, input.projectId))
        .orderBy(asc(authoringSlides.slideIndex));

      if (input.afterIndex !== undefined && input.afterIndex >= existing.length) throw new TRPCError({ code: "BAD_REQUEST", message: "The insertion position is no longer available. Reload the slide list." });
      const insertAt = input.afterIndex !== undefined ? input.afterIndex + 1 : existing.length;

      // Shift subsequent slides
      for (const slide of existing) {
        if (slide.slideIndex >= insertAt) {
          await db
            .update(authoringSlides)
            .set({ slideIndex: slide.slideIndex + 1 })
            .where(eq(authoringSlides.id, slide.id));
        }
      }

      const [result] = await db.insert(authoringSlides).values({
        projectId: input.projectId,
        slideIndex: insertAt,
        title: `Slide ${insertAt + 1}`,
        slideType: input.slideType,
        layout: input.layout,
        background: "#0f172a",
        contentJson: CREATOR_LAYOUTS.some(r => r.id === input.layout) ? JSON.stringify(seedCreatorLayout(input.layout)) : JSON.stringify({ blocks: [] }),
      });
      return { id: Number((result as any).insertId) };
    }),

  updateSlide: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().max(255).optional(),
        contentJson: z.string().max(1000000).optional(),
        layout: z.string().max(64).optional(),
        background: z.string().max(512).optional(),
        notes: z.string().max(200000).optional(),
        nextSlideId: z.number().int().positive().nullable().optional(),
        expectedContentJson: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, expectedContentJson, ...updates } = input;
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      // Verify ownership via project
      const [slide] = await db.select().from(authoringSlides).where(eq(authoringSlides.id, id));
      if (!slide) throw new TRPCError({ code: "NOT_FOUND" });
      const [proj] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, slide.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!proj) throw new TRPCError({ code: "FORBIDDEN" });

      if (expectedContentJson !== undefined && (slide.contentJson || "") !== expectedContentJson) throw new TRPCError({ code: "CONFLICT", message: "This slide changed in another editor. Your local draft is retained; reload explicitly before merging." });
      const siblings = await db.select().from(authoringSlides).where(eq(authoringSlides.projectId, slide.projectId));
      const validIds = new Set(siblings.map(s => Number(s.id)));
      if (updates.nextSlideId != null && (!validIds.has(updates.nextSlideId) || updates.nextSlideId === id)) throw new TRPCError({ code: "BAD_REQUEST", message: "Branch targets must be another slide in this project." });
      if (updates.contentJson !== undefined) {
        try {
          const document = validateCreatorDocument(updates.contentJson);
          for (const block of document.blocks) {
            if (block.action?.kind === "slide" && (!validIds.has(block.action.targetSlideId!) || block.action.targetSlideId === id)) throw new Error("Button targets must be another slide in this project.");
            if (block.action?.kind === "url" && !/^https?:/.test(creatorPrimitives.safeUrl(block.action.url))) throw new Error("Button URL must be a safe HTTP(S) link.");
          }
        } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid canvas document; original content retained." }); }
        await resolveCreatorMedia(db, orgId, [{ id, title: slide.title, contentJson: updates.contentJson, background: slide.background }]);
      }
      const result = await db.update(authoringSlides).set(updates).where(and(eq(authoringSlides.id, id), ...(expectedContentJson !== undefined ? [sql`COALESCE(${authoringSlides.contentJson}, '') = ${expectedContentJson}`] : [])));
      if (Array.isArray(result) && (result[0] as any)?.affectedRows === 0) throw new TRPCError({ code: "CONFLICT", message: "This slide changed before saving. Your draft is retained." });
      return { success: true };
    }),

  deleteSlide: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      const [slide] = await db.select().from(authoringSlides).where(eq(authoringSlides.id, input.id));
      if (!slide) throw new TRPCError({ code: "NOT_FOUND" });
      const [proj] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, slide.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!proj) throw new TRPCError({ code: "FORBIDDEN" });

      const siblings = await db.select().from(authoringSlides).where(eq(authoringSlides.projectId, slide.projectId));
      for (const sibling of siblings) {
        if (sibling.id === input.id) continue;
        if (sibling.nextSlideId === input.id) throw new TRPCError({ code: "CONFLICT", message: "Another slide branches here. Change that branch explicitly before deleting." });
        try { if (readCreatorDocument(sibling.contentJson).blocks.some(b => b.action?.kind === "slide" && b.action.targetSlideId === input.id)) throw new TRPCError({ code: "CONFLICT", message: "A button branches here. Change that action explicitly before deleting." }); } catch (error) { if (error instanceof TRPCError) throw error; }
      }
      await db.delete(authoringSlides).where(eq(authoringSlides.id, input.id));

      // Re-index remaining slides
      const remaining = await db
        .select()
        .from(authoringSlides)
        .where(eq(authoringSlides.projectId, slide.projectId))
        .orderBy(asc(authoringSlides.slideIndex));
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].slideIndex !== i) {
          await db
            .update(authoringSlides)
            .set({ slideIndex: i })
            .where(eq(authoringSlides.id, remaining[i].id));
        }
      }
      return { success: true };
    }),

  reorderSlides: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        orderedIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      const [proj] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, input.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });

      const allSlides = await db.select({ id: authoringSlides.id }).from(authoringSlides).where(eq(authoringSlides.projectId, input.projectId));
      if (new Set(input.orderedIds).size !== allSlides.length || input.orderedIds.length !== allSlides.length || allSlides.some(s => !input.orderedIds.includes(Number(s.id)))) throw new TRPCError({ code: "BAD_REQUEST", message: "Slide order must contain every project slide exactly once." });
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db
          .update(authoringSlides)
          .set({ slideIndex: i })
          .where(
            and(
              eq(authoringSlides.id, input.orderedIds[i]),
              eq(authoringSlides.projectId, input.projectId)
            )
          );
      }
      return { success: true };
    }),

  // ── Export ────────────────────────────────────────────────────────────────

  exportPackage: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        format: z.enum(["scorm12", "scorm2004", "html5"]),
        saveToMediaLibrary: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Library authority is the main account's persisted active organization,
      // independent of Creator's watermark/access policy and any Studio plan.
      const capability = await requireCourse360AppCapability(ctx.user.id, "creator", "web");
      let orgId: number;
      if (input.saveToMediaLibrary) {
        const { requireActiveMediaOrganization } = await import("./formsRouter");
        orgId = await requireActiveMediaOrganization(ctx.user.id);
      } else {
        orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      }
      if (orgId !== capability.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Creator and Media Library school selection must agree." });
      const [project] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, input.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const slides = await db
        .select()
        .from(authoringSlides)
        .where(eq(authoringSlides.projectId, input.projectId))
        .orderBy(asc(authoringSlides.slideIndex));

      // Check if user is on free/trial — apply watermark if so
      const creator = await getCourse360PaymentAppAccess(orgId, ctx.user.id, "creator");
      // Reviewed manual grants are independent provenance, never mislabeled paid.
      const showWatermark = !(creator.isPaid || creator.hasManualGrant);

      // Build ZIP
      const zip = new JSZip();

      if (!slides.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Add a slide before exporting." });
      const media = await resolveCreatorMedia(db, orgId, slides, zip);
      const validIds = new Set(slides.map(s => Number(s.id)));
      for (const slide of slides) {
        if (slide.nextSlideId != null && !validIds.has(Number(slide.nextSlideId))) throw new TRPCError({ code: "BAD_REQUEST", message: "A saved branch target is missing; repair it before exporting." });
        for (const block of readCreatorDocument(slide.contentJson).blocks) {
          if (block.action?.kind === "slide" && !validIds.has(block.action.targetSlideId!)) throw new TRPCError({ code: "BAD_REQUEST", message: "A button branch target is missing." });
          if (block.assessment) {
            const parsed = creatorAssessmentSchema.safeParse(block.assessment);
            if (!parsed.success) throw new TRPCError({ code: "BAD_REQUEST", message: "An assessment is incomplete or has no valid answer rubric. Edit it before exporting." });
            if (block.assessment.type === "hotspot" && !creatorPrimitives.safeUrl(block.assessment.src, true) && !block.assessment.mediaId) throw new TRPCError({ code: "BAD_REQUEST", message: "Bind a real question image before exporting a hotspot assessment." });
            if (block.assessment.type === "image_choice" && block.assessment.options?.some(o => !creatorPrimitives.safeUrl(o.src, true) && !o.mediaId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Bind an image to every image-choice option before exporting." });
          }
        }
      }
      const brandedProject = await resolveCreatorProjectMedia(db, orgId, project, zip);
      const html = buildCourseHtml(brandedProject, media.slides.map(s => ({ ...s, notes: s.notes ?? null })), input.format, showWatermark);
      zip.file("index.html", html);

      // Add course data JS
      zip.file(
        "course.js",
        `// TeachificCreator™ Course Data\nvar COURSE_TITLE = ${JSON.stringify(project.title)};\nvar SLIDE_COUNT = ${slides.length};\n`
      );

      if (input.format === "scorm12") {
        zip.file("imsmanifest.xml", buildScorm12Manifest(project));
        zip.file("scorm12-api.js", `window.ScormAPI=(${createCreatorScorm.toString()})(window,"scorm12");`);
        // Standard SCORM 1.2 schema files (stubs)
        zip.file("imscp_rootv1p1p2.xsd", "<!-- SCORM 1.2 schema stub -->"); 
        zip.file("adlcp_rootv1p2.xsd", "<!-- SCORM 1.2 adlcp schema stub -->");
      } else if (input.format === "scorm2004") {
        zip.file("imsmanifest.xml", buildScorm2004Manifest(project));
        zip.file("scorm2004-api.js", `window.ScormAPI=(${createCreatorScorm.toString()})(window,"scorm2004");`);
      }

      if (input.format !== "html5" && Object.keys(zip.files).some(path => path.startsWith("assets/"))) {
        const manifest = zip.file("imsmanifest.xml");
        if (manifest) zip.file("imsmanifest.xml", (await manifest.async("string")).replace("    </resource>", Object.keys(zip.files).filter(path => path.startsWith("assets/") && !zip.files[path].dir).map(path => `      <file href="${escapeXml(path)}"/>`).join("\n") + "\n    </resource>"));
      }
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

      if (input.saveToMediaLibrary) {
        const { getOrgStorageUsage } = await import("./db");
        const { usedBytes, maxBytes } = await getOrgStorageUsage(orgId);
        if (!Number.isSafeInteger(usedBytes) || usedBytes < 0 || !Number.isSafeInteger(maxBytes) || maxBytes < -1) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Media Library storage availability could not be verified." });
        }
        if (maxBytes !== -1 && usedBytes + zipBuffer.length > maxBytes) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This export exceeds the main account's Media Library storage allowance." });
        }
      }
      const fileKey = input.saveToMediaLibrary
        ? `org-${orgId}/media/creator-exports/${input.projectId}-${input.format}-${(await import("nanoid")).nanoid(16)}.zip`
        : `authoring/${ctx.user.id}/exports/${input.projectId}-${input.format}-${randomSuffix()}.zip`;
      const { url } = await storagePut(fileKey, zipBuffer, "application/zip");
      if (!creatorPrimitives.safeUrl(url)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Export storage returned an unsafe or missing download URL." });

      let mediaItemId: number | undefined;
      if (input.saveToMediaLibrary) {
        if (!url || typeof url !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Export upload did not return a Media Library URL." });
        const { orgMediaLibrary } = await import("../drizzle/schema");
        const [result] = await db.insert(orgMediaLibrary).values({
          orgId,
          uploadedBy: ctx.user.id,
          filename: `${project.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "course"}-${input.format}.zip`,
          mimeType: "application/zip",
          fileSize: zipBuffer.length,
          fileKey,
          url,
          source: "other",
          sourceId: project.id,
          tags: JSON.stringify(["creator", input.format]),
        });
        mediaItemId = Number((result as any)?.insertId);
        if (!Number.isSafeInteger(mediaItemId) || mediaItemId < 1) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Export could not be saved to the Media Library." });
        }
      }

      // Update project with last published info
      await db
        .update(authoringProjects)
        .set({
          lastPublishedUrl: url,
          lastPublishedFormat: input.format,
          status: "published",
        })
        .where(and(eq(authoringProjects.id, input.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));

      return { url, format: input.format, warnings: media.warnings, ...(mediaItemId !== undefined ? { mediaItemId } : {}) };
    }),

  previewPackage: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const capability = await requireCourse360AppCapability(ctx.user.id, "creator", "web");
    const [project] = await db.select().from(authoringProjects).where(and(eq(authoringProjects.id, input.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, capability.orgId)));
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    const slides = await db.select().from(authoringSlides).where(eq(authoringSlides.projectId, input.projectId)).orderBy(asc(authoringSlides.slideIndex));
    const media = await resolveCreatorMedia(db, capability.orgId, slides);
    const creator = await getCourse360PaymentAppAccess(capability.orgId, ctx.user.id, "creator");
    const brandedProject = await resolveCreatorProjectMedia(db, capability.orgId, project);
    return { html: buildCreatorRuntimeHtml({ ...brandedProject, id: project.id, slides: media.slides, showWatermark: !(creator.isPaid || creator.hasManualGrant) }, "html5"), warnings: media.warnings };
  }),

  // ── User role ─────────────────────────────────────────────────────────────

  getMyCreatorRole: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const { orgId } = await requireCourse360AppOrganization(ctx.user.id);
    const access = await getCourse360PaymentAppAccess(orgId, ctx.user.id, "creator");
    return { role: access.tier, trialEndsAt: access.trialEndsAt, isInTrial: access.isInTrial, isPaid: access.isPaid, hasManualGrant: access.hasManualGrant };
  }),

  setCreatorRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["none", "web", "desktop", "bundle"]) }))
    .mutation(async ({ ctx, input }) => {
      // Only site_owner / site_admin can set roles
      if (!["site_owner", "site_admin"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { orgId } = await requireCourse360AppOrganization(ctx.user.id);
      const user = await getUserById(ctx.user.id);
      if (!user || !["site_owner", "site_admin"].includes(user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      if (!await getOrgMember(orgId, input.userId)) throw new TRPCError({ code: "FORBIDDEN", message: "Select a user who belongs to this school." });
      await setCourse360PaymentManualRole({ orgId, userId: input.userId, product: "creator", tier: input.role,
        actorId: ctx.user.id, source: "platform-admin", reason: "Explicit authenticated administrator grant" });
      return { success: true };
    }),

  // ── Admin: list all Creator users ────────────────────────────────────────
  adminListCreatorUsers: protectedProcedure.query(async ({ ctx }) => {
    const { orgId } = await requireCourse360AppOrganization(ctx.user.id);
    const user = await getUserById(ctx.user.id);
    if (!user || !["site_owner", "site_admin"].includes(user.role)) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const schoolUsers = await db.select({ id: users.id, name: users.name, email: users.email, creatorAccess: users.creatorAccess, creatorTrialEndsAt: users.creatorTrialEndsAt, createdAt: users.createdAt }).from(users).innerJoin(orgMembers, eq(orgMembers.userId, users.id)).where(eq(orgMembers.orgId, orgId)).orderBy(users.createdAt);
    return Promise.all(schoolUsers.map(async u => ({ ...u, creatorAccess: (u.creatorAccess ?? "none") as "none" | "web" | "desktop" | "bundle", legacyCreatorAccess: u.creatorAccess, currentCreatorAccess: await getCourse360PaymentAppAccess(orgId, u.id, "creator"), orgId })));
  }),

  // ── Admin: set a user's Creator role (admin version) ────────────────────────
  adminSetCreatorRole: protectedProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["none", "web", "desktop", "bundle"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!["site_owner", "site_admin"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { orgId } = await requireCourse360AppOrganization(ctx.user.id);
      const user = await getUserById(ctx.user.id);
      if (!user || !["site_owner", "site_admin"].includes(user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      if (!await getOrgMember(orgId, input.userId)) throw new TRPCError({ code: "FORBIDDEN", message: "Select a user who belongs to this school." });
      await setCourse360PaymentManualRole({ orgId, userId: input.userId, product: "creator", tier: input.role,
        actorId: ctx.user.id, source: "platform-admin", reason: "Explicit authenticated administrator grant" });
      return { success: true };
    }),
});
