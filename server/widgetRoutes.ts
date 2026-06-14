/**
 * Widget Routes — Serves embeddable course card and curriculum widgets.
 * 
 * Endpoints:
 *   GET /api/widget/card/:slug   → Returns JS that injects a course card widget
 *   GET /api/widget/curriculum/:slug → Returns JS that injects a curriculum widget
 *   GET /api/widget/data/:slug   → Returns JSON course data for widgets
 * 
 * The embed code is a lightweight <script> tag that loads from the server,
 * so styles auto-update without requiring changes to already-embedded widgets.
 */
import { Router } from "express";
import { getDb } from "./db";
import { lmsCourses, lmsSections, lmsLessons } from "../drizzle/schema";
import { eq, asc } from "drizzle-orm";

const widgetRouter = Router();

// ─── JSON data endpoint for widgets ──────────────────────────────────────────
widgetRouter.get("/data/:slug", async (req, res) => {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const [course] = await db.select({
      id: lmsCourses.id,
      slug: lmsCourses.slug,
      title: lmsCourses.title,
      subtitle: lmsCourses.subtitle,
      description: lmsCourses.description,
      coverImageUrl: lmsCourses.coverImageUrl,
      thumbnailUrl: lmsCourses.thumbnailUrl,
      price: lmsCourses.price,
      isFree: lmsCourses.isFree,
      pricingType: lmsCourses.pricingType,
      currency: lmsCourses.currency,
      primaryColor: lmsCourses.primaryColor,
      accentColor: lmsCourses.accentColor,
      type: lmsCourses.type,
    }).from(lmsCourses).where(eq(lmsCourses.slug, req.params.slug)).limit(1);

    if (!course) return res.status(404).json({ error: "Course not found" });

    // Get sections and lessons for curriculum
    const sections = await db.select({
      id: lmsSections.id,
      title: lmsSections.title,
      position: lmsSections.position,
    }).from(lmsSections).where(eq(lmsSections.courseId, course.id)).orderBy(asc(lmsSections.position));

    const lessons = await db.select({
      id: lmsLessons.id,
      sectionId: lmsLessons.sectionId,
      title: lmsLessons.title,
      type: lmsLessons.type,
      position: lmsLessons.position,
      durationMinutes: lmsLessons.durationMinutes,
    }).from(lmsLessons).where(eq(lmsLessons.courseId, course.id)).orderBy(asc(lmsLessons.position));

    const curriculum = sections.map(s => ({
      ...s,
      lessons: lessons.filter(l => l.sectionId === s.id),
    }));

    // Lessons without a section (top-level)
    const topLevelLessons = lessons.filter(l => !l.sectionId);

    res.json({
      course,
      curriculum,
      topLevelLessons,
    });
  } catch (err) {
    console.error("Widget data error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Course Card Widget JS ───────────────────────────────────────────────────
widgetRouter.get("/card/:slug", async (req, res) => {
  const { slug } = req.params;
  const showCurriculum = req.query.curriculum === "1";
  const origin = `${req.protocol}://${req.get("host")}`;

  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=300"); // 5 min cache

  res.send(`
(function() {
  var slug = ${JSON.stringify(slug)};
  var origin = ${JSON.stringify(origin)};
  var showCurriculum = ${showCurriculum};
  var dataUrl = origin + "/api/widget/data/" + slug;
  var courseUrl = origin + "/courses/" + slug;

  // Find the script tag that loaded this widget
  var scripts = document.querySelectorAll('script[src*="/api/widget/card/' + slug + '"]');
  var scriptEl = scripts[scripts.length - 1];
  if (!scriptEl) return;

  // Create container
  var container = document.createElement("div");
  container.className = "teachific-widget teachific-card-widget";
  scriptEl.parentNode.insertBefore(container, scriptEl.nextSibling);

  // Inject styles
  if (!document.getElementById("teachific-widget-styles")) {
    var style = document.createElement("style");
    style.id = "teachific-widget-styles";
    style.textContent = getWidgetStyles();
    document.head.appendChild(style);
  }

  // Fetch data and render
  fetch(dataUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) { container.innerHTML = '<p style="color:#999;font-size:14px;">Course not available</p>'; return; }
      container.innerHTML = renderCard(data, courseUrl, showCurriculum);
      // Apply course's primary color dynamically to buttons and accents
      var color = data.course.primaryColor || '#179ca3';
      var btns = container.querySelectorAll('.tw-card-btn');
      for (var i = 0; i < btns.length; i++) { btns[i].style.background = color; }
      var prices = container.querySelectorAll('.tw-price-amount');
      for (var j = 0; j < prices.length; j++) { prices[j].style.color = color; }
    })
    .catch(function() {
      container.innerHTML = '<p style="color:#999;font-size:14px;">Unable to load course widget</p>';
    });

  function renderCard(data, url, withCurriculum) {
    var c = data.course;
    var img = c.coverImageUrl || c.thumbnailUrl || "";
    var price = c.isFree ? "Free" : formatPrice(c.price, c.currency);
    var pricingLabel = getPricingLabel(c);
    var html = '<div class="tw-card">';
    if (img) {
      html += '<div class="tw-card-img"><img src="' + escHtml(img) + '" alt="' + escHtml(c.title) + '" /></div>';
    }
    html += '<div class="tw-card-body">';
    html += '<h3 class="tw-card-title">' + escHtml(c.title) + '</h3>';
    if (c.subtitle) html += '<p class="tw-card-subtitle">' + escHtml(c.subtitle) + '</p>';
    if (c.description) {
      var desc = c.description.replace(/<[^>]*>/g, "").substring(0, 150);
      if (c.description.length > 150) desc += "…";
      html += '<p class="tw-card-desc">' + escHtml(desc) + '</p>';
    }
    html += '<div class="tw-card-price">';
    html += '<span class="tw-price-amount">' + price + '</span>';
    if (pricingLabel) html += '<span class="tw-price-label">' + pricingLabel + '</span>';
    html += '</div>';
    html += '<a href="' + escHtml(url) + '?checkout=1" target="_blank" rel="noopener" class="tw-card-btn">Enroll Now</a>';
    html += '</div>';

    if (withCurriculum && data.curriculum && data.curriculum.length > 0) {
      html += renderCurriculumSection(data);
    }

    html += '</div>';
    return html;
  }

  function renderCurriculumSection(data) {
    var html = '<div class="tw-curriculum">';
    html += '<h4 class="tw-curriculum-title">Course Curriculum</h4>';
    data.curriculum.forEach(function(section) {
      html += '<div class="tw-section">';
      html += '<div class="tw-section-header">' + escHtml(section.title) + ' <span class="tw-section-count">(' + section.lessons.length + ' lessons)</span></div>';
      html += '<ul class="tw-lesson-list">';
      section.lessons.forEach(function(lesson) {
        var icon = getTypeIcon(lesson.type);
        var dur = lesson.durationMinutes ? ' <span class="tw-lesson-dur">' + lesson.durationMinutes + ' min</span>' : "";
        html += '<li class="tw-lesson-item">' + icon + ' ' + escHtml(lesson.title) + dur + '</li>';
      });
      html += '</ul></div>';
    });
    if (data.topLevelLessons && data.topLevelLessons.length > 0) {
      html += '<ul class="tw-lesson-list">';
      data.topLevelLessons.forEach(function(lesson) {
        var icon = getTypeIcon(lesson.type);
        var dur = lesson.durationMinutes ? ' <span class="tw-lesson-dur">' + lesson.durationMinutes + ' min</span>' : "";
        html += '<li class="tw-lesson-item">' + icon + ' ' + escHtml(lesson.title) + dur + '</li>';
      });
      html += '</ul>';
    }
    html += '</div>';
    return html;
  }

  function getTypeIcon(type) {
    switch(type) {
      case "video": case "video_text": return '<svg class="tw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      case "quiz": return '<svg class="tw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      case "download": return '<svg class="tw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      default: return '<svg class="tw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }
  }

  function formatPrice(price, currency) {
    var num = parseFloat(price);
    if (isNaN(num) || num === 0) return "Free";
    var symbol = currency === "usd" ? "$" : currency === "eur" ? "€" : currency === "gbp" ? "£" : currency.toUpperCase() + " ";
    return symbol + num.toFixed(2);
  }

  function getPricingLabel(c) {
    if (c.isFree) return "";
    switch(c.pricingType) {
      case "subscription": return "/ month";
      case "payment_plan": return "payment plan";
      case "trial_then_subscription": return "after free trial";
      default: return "";
    }
  }

  function escHtml(str) {
    if (!str) return "";
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function getWidgetStyles() {
    return \`
      .teachific-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .tw-card { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; max-width: 400px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .tw-card-img { width: 100%; height: 200px; overflow: hidden; }
      .tw-card-img img { width: 100%; height: 100%; object-fit: cover; }
      .tw-card-body { padding: 20px; }
      .tw-card-title { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #111827; line-height: 1.3; }
      .tw-card-subtitle { margin: 0 0 8px; font-size: 14px; color: #6b7280; line-height: 1.4; }
      .tw-card-desc { margin: 0 0 16px; font-size: 13px; color: #6b7280; line-height: 1.5; }
      .tw-card-price { margin-bottom: 16px; display: flex; align-items: baseline; gap: 6px; }
      .tw-price-amount { font-size: 24px; font-weight: 700; color: #179ca3; }
      .tw-price-label { font-size: 13px; color: #6b7280; }
      .tw-card-btn { display: block; width: 100%; padding: 12px 24px; background: #179ca3; color: #fff; text-align: center; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px; transition: background 0.2s; box-sizing: border-box; }
      .tw-card-btn:hover { background: #148a90; }
      .tw-curriculum { border-top: 1px solid #e5e7eb; padding: 20px; }
      .tw-curriculum-title { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #111827; }
      .tw-section { margin-bottom: 12px; }
      .tw-section-header { font-size: 14px; font-weight: 600; color: #374151; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
      .tw-section-count { font-weight: 400; color: #9ca3af; font-size: 12px; }
      .tw-lesson-list { list-style: none; margin: 0; padding: 0; }
      .tw-lesson-item { display: flex; align-items: center; gap: 8px; padding: 6px 0 6px 12px; font-size: 13px; color: #4b5563; }
      .tw-lesson-dur { color: #9ca3af; font-size: 11px; margin-left: auto; }
      .tw-icon { width: 14px; height: 14px; flex-shrink: 0; color: #179ca3; }
    \`;
  }
})();
  `.trim());
});

// ─── Curriculum-only Widget JS ───────────────────────────────────────────────
widgetRouter.get("/curriculum/:slug", async (req, res) => {
  const { slug } = req.params;
  const showCard = req.query.card === "1";
  const origin = `${req.protocol}://${req.get("host")}`;

  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=300");

  res.send(`
(function() {
  var slug = ${JSON.stringify(slug)};
  var origin = ${JSON.stringify(origin)};
  var showCard = ${showCard};
  var dataUrl = origin + "/api/widget/data/" + slug;
  var courseUrl = origin + "/courses/" + slug;

  var scripts = document.querySelectorAll('script[src*="/api/widget/curriculum/' + slug + '"]');
  var scriptEl = scripts[scripts.length - 1];
  if (!scriptEl) return;

  var container = document.createElement("div");
  container.className = "teachific-widget teachific-curriculum-widget";
  scriptEl.parentNode.insertBefore(container, scriptEl.nextSibling);

  if (!document.getElementById("teachific-widget-styles")) {
    var style = document.createElement("style");
    style.id = "teachific-widget-styles";
    style.textContent = getWidgetStyles();
    document.head.appendChild(style);
  }

  fetch(dataUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) { container.innerHTML = '<p style="color:#999;font-size:14px;">Course not available</p>'; return; }
      container.innerHTML = renderCurriculum(data, courseUrl, showCard);
      // Apply course's primary color dynamically
      var color = data.course.primaryColor || '#179ca3';
      var icons = container.querySelectorAll('.tw-icon');
      for (var i = 0; i < icons.length; i++) { icons[i].style.color = color; }
      var links = container.querySelectorAll('.tw-curriculum-link');
      for (var j = 0; j < links.length; j++) { links[j].style.color = color; }
      var btns = container.querySelectorAll('.tw-card-btn');
      for (var k = 0; k < btns.length; k++) { btns[k].style.background = color; }
      var prices = container.querySelectorAll('.tw-price-amount');
      for (var l = 0; l < prices.length; l++) { prices[l].style.color = color; }
    })
    .catch(function() {
      container.innerHTML = '<p style="color:#999;font-size:14px;">Unable to load curriculum widget</p>';
    });

  function renderCurriculum(data, url, withCard) {
    var c = data.course;
    var html = '<div class="tw-curriculum-widget-wrap">';

    if (withCard) {
      var img = c.coverImageUrl || c.thumbnailUrl || "";
      html += '<div class="tw-mini-card">';
      if (img) html += '<img src="' + escHtml(img) + '" alt="' + escHtml(c.title) + '" class="tw-mini-card-img" />';
      html += '<div class="tw-mini-card-info">';
      html += '<h3 class="tw-mini-card-title">' + escHtml(c.title) + '</h3>';
      if (c.subtitle) html += '<p class="tw-mini-card-sub">' + escHtml(c.subtitle) + '</p>';
      html += '</div></div>';
    }

    html += '<div class="tw-curriculum-body">';
    html += '<h4 class="tw-curriculum-title">Course Curriculum</h4>';

    var totalLessons = 0;
    data.curriculum.forEach(function(section) {
      totalLessons += section.lessons.length;
      html += '<div class="tw-section">';
      html += '<div class="tw-section-header">' + escHtml(section.title) + ' <span class="tw-section-count">(' + section.lessons.length + ' lessons)</span></div>';
      html += '<ul class="tw-lesson-list">';
      section.lessons.forEach(function(lesson) {
        var icon = getTypeIcon(lesson.type);
        var dur = lesson.durationMinutes ? ' <span class="tw-lesson-dur">' + lesson.durationMinutes + ' min</span>' : "";
        html += '<li class="tw-lesson-item">' + icon + ' ' + escHtml(lesson.title) + dur + '</li>';
      });
      html += '</ul></div>';
    });
    if (data.topLevelLessons && data.topLevelLessons.length > 0) {
      totalLessons += data.topLevelLessons.length;
      html += '<ul class="tw-lesson-list">';
      data.topLevelLessons.forEach(function(lesson) {
        var icon = getTypeIcon(lesson.type);
        var dur = lesson.durationMinutes ? ' <span class="tw-lesson-dur">' + lesson.durationMinutes + ' min</span>' : "";
        html += '<li class="tw-lesson-item">' + icon + ' ' + escHtml(lesson.title) + dur + '</li>';
      });
      html += '</ul>';
    }

    html += '<div class="tw-curriculum-footer">';
    html += '<span class="tw-curriculum-stats">' + totalLessons + ' lessons</span>';
    html += '<a href="' + escHtml(url) + '" target="_blank" rel="noopener" class="tw-curriculum-link">View Course →</a>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function getTypeIcon(type) {
    switch(type) {
      case "video": case "video_text": return '<svg class="tw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      case "quiz": return '<svg class="tw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      case "download": return '<svg class="tw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      default: return '<svg class="tw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }
  }

  function escHtml(str) {
    if (!str) return "";
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function getWidgetStyles() {
    return \`
      .teachific-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .tw-curriculum-widget-wrap { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; max-width: 500px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .tw-mini-card { display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; }
      .tw-mini-card-img { width: 80px; height: 56px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
      .tw-mini-card-info { flex: 1; min-width: 0; }
      .tw-mini-card-title { margin: 0; font-size: 15px; font-weight: 700; color: #111827; line-height: 1.3; }
      .tw-mini-card-sub { margin: 4px 0 0; font-size: 12px; color: #6b7280; }
      .tw-curriculum-body { padding: 20px; }
      .tw-curriculum-title { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #111827; }
      .tw-section { margin-bottom: 12px; }
      .tw-section-header { font-size: 14px; font-weight: 600; color: #374151; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
      .tw-section-count { font-weight: 400; color: #9ca3af; font-size: 12px; }
      .tw-lesson-list { list-style: none; margin: 0; padding: 0; }
      .tw-lesson-item { display: flex; align-items: center; gap: 8px; padding: 6px 0 6px 12px; font-size: 13px; color: #4b5563; }
      .tw-lesson-dur { color: #9ca3af; font-size: 11px; margin-left: auto; }
      .tw-icon { width: 14px; height: 14px; flex-shrink: 0; color: #179ca3; }
      .tw-curriculum-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
      .tw-curriculum-stats { font-size: 12px; color: #6b7280; }
      .tw-curriculum-link { font-size: 13px; font-weight: 600; color: #179ca3; text-decoration: none; }
      .tw-curriculum-link:hover { text-decoration: underline; }
      .tw-card { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; max-width: 400px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
      .tw-card-img { width: 100%; height: 200px; overflow: hidden; }
      .tw-card-img img { width: 100%; height: 100%; object-fit: cover; }
      .tw-card-body { padding: 20px; }
      .tw-card-title { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #111827; line-height: 1.3; }
      .tw-card-subtitle { margin: 0 0 8px; font-size: 14px; color: #6b7280; line-height: 1.4; }
      .tw-card-desc { margin: 0 0 16px; font-size: 13px; color: #6b7280; line-height: 1.5; }
      .tw-card-price { margin-bottom: 16px; display: flex; align-items: baseline; gap: 6px; }
      .tw-price-amount { font-size: 24px; font-weight: 700; color: #179ca3; }
      .tw-price-label { font-size: 13px; color: #6b7280; }
      .tw-card-btn { display: block; width: 100%; padding: 12px 24px; background: #179ca3; color: #fff; text-align: center; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px; transition: background 0.2s; box-sizing: border-box; }
      .tw-card-btn:hover { background: #148a90; }
    \`;
  }
})();
  `.trim());
});

export default widgetRouter;
