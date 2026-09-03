/**
 * TeachificCreator™ — Authoring Router
 * Handles project CRUD, slide management, and SCORM/HTML5 export generation.
 */
import { z } from "zod";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb, getOrgIdForUserWithFallback } from "./db";
import { authoringProjects, authoringSlides, users } from "../drizzle/schema";
import { storagePut } from "./storage";
import JSZip from "jszip";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

async function requireActiveAuthoringOrg(userId: number, userRole: string): Promise<number> {
  const orgId = await getOrgIdForUserWithFallback(userId, userRole);
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Select an organization before managing creator projects" });
  return orgId;
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
  project: { title: string },
  slides: Array<{ title: string; contentJson: string | null; background: string | null; notes: string | null }>,
  scormVersion: "scorm12" | "scorm2004" | "html5",
  showWatermark = false
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
  );

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
  // ── Projects ──────────────────────────────────────────────────────────────

  listProjects: protectedProcedure
    .input(z.object({ orgId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
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
      // Create a default first slide
      await db.insert(authoringSlides).values({
        projectId,
        slideIndex: 0,
        title: "Title Slide",
        slideType: "content",
        layout: "title",
        background: "#0f172a",
        contentJson: defaultSlideContent(),
      });
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

      for (const slide of slides) {
        await db.insert(authoringSlides).values({
          projectId: newProjectId,
          slideIndex: slide.slideIndex,
          title: slide.title,
          slideType: slide.slideType,
          contentJson: slide.contentJson,
          layout: slide.layout,
          background: slide.background,
          notes: slide.notes,
        });
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
        afterIndex: z.number().optional(),
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
        contentJson: JSON.stringify({ blocks: [] }),
      });
      return { id: Number((result as any).insertId) };
    }),

  updateSlide: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        contentJson: z.string().optional(),
        layout: z.string().optional(),
        background: z.string().optional(),
        notes: z.string().optional(),
        nextSlideId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...updates } = input;
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
      // Verify ownership via project
      const [slide] = await db.select().from(authoringSlides).where(eq(authoringSlides.id, id));
      if (!slide) throw new TRPCError({ code: "NOT_FOUND" });
      const [proj] = await db
        .select()
        .from(authoringProjects)
        .where(and(eq(authoringProjects.id, slide.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));
      if (!proj) throw new TRPCError({ code: "FORBIDDEN" });

      await db.update(authoringSlides).set(updates).where(eq(authoringSlides.id, id));
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const orgId = await requireActiveAuthoringOrg(ctx.user.id, ctx.user.role);
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
      const [userRow] = await db.select({
        creatorAccess: users.creatorAccess,
        creatorTrialEndsAt: users.creatorTrialEndsAt,
      }).from(users).where(eq(users.id, ctx.user.id));
      const creatorAccess = (userRow as any)?.creatorAccess ?? "none";
      const trialEndsAt = (userRow as any)?.creatorTrialEndsAt ?? null;
      const isTrialing = creatorAccess !== "none" && trialEndsAt && new Date(trialEndsAt) > new Date();
      const isPaidCreator = creatorAccess !== "none" && !isTrialing;
      const showWatermark = !isPaidCreator; // free or trial users get watermark

      // Build ZIP
      const zip = new JSZip();

      const html = buildCourseHtml(project, slides, input.format, showWatermark);
      zip.file("index.html", html);

      // Add course data JS
      zip.file(
        "course.js",
        `// TeachificCreator™ Course Data\nvar COURSE_TITLE = ${JSON.stringify(project.title)};\nvar SLIDE_COUNT = ${slides.length};\n`
      );

      if (input.format === "scorm12") {
        zip.file("imsmanifest.xml", buildScorm12Manifest(project));
        zip.file("scorm12-api.js", SCORM12_API_JS);
        // Standard SCORM 1.2 schema files (stubs)
        zip.file("imscp_rootv1p1p2.xsd", "<!-- SCORM 1.2 schema stub -->"); 
        zip.file("adlcp_rootv1p2.xsd", "<!-- SCORM 1.2 adlcp schema stub -->");
      } else if (input.format === "scorm2004") {
        zip.file("imsmanifest.xml", buildScorm2004Manifest(project));
        zip.file("scorm2004-api.js", SCORM2004_API_JS);
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

      const fileKey = `authoring/${ctx.user.id}/exports/${input.projectId}-${input.format}-${randomSuffix()}.zip`;
      const { url } = await storagePut(fileKey, zipBuffer, "application/zip");

      // Update project with last published info
      await db
        .update(authoringProjects)
        .set({
          lastPublishedUrl: url,
          lastPublishedFormat: input.format,
          status: "published",
        })
        .where(and(eq(authoringProjects.id, input.projectId), eq(authoringProjects.userId, ctx.user.id), eq(authoringProjects.orgId, orgId)));

      return { url, format: input.format };
    }),

  // ── User role ─────────────────────────────────────────────────────────────

  getMyCreatorRole: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const [user] = await db.select({
      creatorAccess: users.creatorAccess,
      creatorTrialEndsAt: users.creatorTrialEndsAt,
    }).from(users).where(eq(users.id, ctx.user.id));
    const role = (user as any)?.creatorAccess ?? "none";
    const trialEndsAt = (user as any)?.creatorTrialEndsAt ?? null;
    const isInTrial = role !== "none" && trialEndsAt && new Date(trialEndsAt) > new Date();
    const isPaid = role !== "none" && !isInTrial;
    return { role, trialEndsAt, isInTrial, isPaid };
  }),

  setCreatorRole: protectedProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["none", "web", "desktop", "bundle"]) }))
    .mutation(async ({ ctx, input }) => {
      // Only site_owner / site_admin can set roles
      if (!["site_owner", "site_admin"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(users)
        .set({ creatorAccess: input.role })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  // ── Admin: list all Creator users ────────────────────────────────────────
  adminListCreatorUsers: protectedProcedure.query(async ({ ctx }) => {
    if (!["site_owner", "site_admin"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      creatorAccess: users.creatorAccess,
      creatorTrialEndsAt: users.creatorTrialEndsAt,
      createdAt: users.createdAt,
    }).from(users).orderBy(users.createdAt);
    return allUsers.map((u) => ({
      ...u,
      creatorAccess: (u.creatorAccess ?? "none") as "none" | "web" | "desktop" | "bundle",
    }));
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
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ creatorAccess: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
