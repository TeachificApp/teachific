import { createCreatorPrimitives, readCreatorDocument, serializeCreatorJson, type CreatorCourse } from "./course360CreatorModel";
import { createCreatorRenderer } from "./course360CreatorRenderer";

/** Self-contained SCORM adapter; exceptions and false provider results never become success. */
export function createCreatorScorm(win: Window, version: string) {
  const v12 = version === "scorm12"; const key = v12 ? "API" : "API_1484_11"; let api: any; let initialized = false; let finished = false; let error = "";
  function find(start: any) { let current = start; for (let i = 0; i < 8 && current; i++) { try { if (current[key]) return current[key]; if (current.parent === current) break; current = current.parent; } catch { break; } } return null; }
  function call(name: string, ...args: any[]) {
    try { const value = api?.[name]?.(...args); const errorCode = api?.[v12 ? "LMSGetLastError" : "GetLastError"]?.(); if (errorCode && String(errorCode) !== "0") error = String(errorCode); return value; }
    catch { error = "SCORM API request failed"; return "false"; }
  }
  const truth = (value: any) => value === true || value === "true";
  return {
    init() { if (initialized || finished || version === "html5") return initialized; api = find(win); if (!api) { try { api = find(win.opener); } catch {} } if (!api) { error = "LMS API unavailable; learning remains available without tracking."; return false; } initialized = truth(call(v12 ? "LMSInitialize" : "Initialize", "")); if (!initialized) error ||= "LMS initialization rejected"; return initialized; },
    getValue(k: string) { return initialized && !finished ? String(call(v12 ? "LMSGetValue" : "GetValue", k) ?? "") : ""; },
    setValue(k: string, value: any) { return initialized && !finished && truth(call(v12 ? "LMSSetValue" : "SetValue", k, String(value))); },
    commit() { return initialized && !finished && truth(call(v12 ? "LMSCommit" : "Commit", "")); },
    finish() { if (!initialized || finished) return false; finished = true; return truth(call(v12 ? "LMSFinish" : "Terminate", "")); },
    get initialized() { return initialized; }, get finished() { return finished; }, get error() { return error; },
  };
}

export function mountCreatorCourse(win: Window, course: any, version: string, p: ReturnType<typeof createCreatorPrimitives>, renderer: ReturnType<typeof createCreatorRenderer>, api: ReturnType<typeof createCreatorScorm>) {
  const doc = win.document; const slides = course.slides || []; const settings = course.settings || {}; const width = Math.max(320, Math.min(4000, Number(settings.width) || 1000)); const height = Math.max(240, Math.min(4000, Number(settings.height) || 563));
  const brand = settings.creatorBrand || {};
  const font = p.safeStyle({ fontFamily: brand.fontFamily }).fontFamily; if (font) doc.body.style.fontFamily = font;
  const accent = p.safeStyle({ color: brand.accent }).color; if (accent) doc.getElementById("progress-fill")!.style.backgroundColor = accent;
  const logoUrl = p.safeUrl(brand.logoUrl, true); if (logoUrl) { const logo = doc.createElement("img"); logo.src = logoUrl; logo.alt = typeof brand.logoAlt === "string" ? brand.logoAlt : "Course logo"; logo.style.cssText = "max-width:100px;max-height:32px;object-fit:contain"; doc.getElementById("title-bar")!.prepend(logo); }
  const area = doc.getElementById("slide-area")!; const status = doc.getElementById("course-status")!; const next = doc.getElementById("btn-next") as HTMLButtonElement; const prev = doc.getElementById("btn-prev") as HTMLButtonElement;
  const key = "course360-creator:" + course.identity; const fresh = { current: 0, history: [] as number[], answers: {} as any, attempts: {} as any, results: {} as any, interactions: {} as any, completed: false };
  let state = fresh; let alive = true; const started = Date.now(); api.init();
  let saved = version === "html5" ? "" : api.getValue("cmi.suspend_data");
  if (version === "html5") { try { saved = win.localStorage.getItem(key) || ""; } catch {} }
  try {
    const parsed = JSON.parse(saved || "null");
    const record = (v: any) => !!v && typeof v === "object" && !Array.isArray(v);
    if (parsed?.identity === course.identity && Number.isInteger(parsed.current) && parsed.current >= 0 && parsed.current < slides.length && Array.isArray(parsed.history) && record(parsed.answers) && record(parsed.attempts) && record(parsed.results) && record(parsed.interactions)) {
      state = { ...fresh, ...parsed, history: parsed.history.filter((i: any) => Number.isInteger(i) && i >= 0 && i < slides.length).slice(-200) };
    }
  } catch {}
  if (!saved && version !== "html5") { const location = Number(api.getValue(version === "scorm12" ? "cmi.core.lesson_location" : "cmi.location")); if (Number.isInteger(location) && location >= 0 && location < slides.length) state.current = location; }
  // Regrade restored responses using current question contracts; never trust stored earned points.
  for (const slide of slides) for (const b of slide.blocks || []) if (b.assessment && state.results[slide.id + ":" + b.id]) {
    const stateId = slide.id + ":" + b.id;
    state.results[stateId] = p.grade(b.assessment, state.answers[stateId]);
    const attempts = Number(state.attempts[stateId]); state.attempts[stateId] = Number.isInteger(attempts) ? Math.max(0, Math.min(100, attempts)) : 0;
  }
  function assessments() { return slides.flatMap((s: any) => (s.blocks || []).filter((b: any) => b.assessment).map((b: any) => ({ ...b, stateId: s.id + ":" + b.id }))); }
  function summary() {
    const questions = assessments(); let earned = 0; let possible = 0; let requiredAnswered = true;
    questions.forEach((b: any) => { possible += b.assessment.points || 1; const result = state.results[b.stateId]; if (result) earned += result.earned; if (b.assessment.required && !result?.answered) requiredAnswered = false; });
    return { questions, earned, possible, requiredAnswered, percent: possible ? earned * 100 / possible : 100 };
  }
  function persist() {
    const json = JSON.stringify({ ...state, identity: course.identity });
    if (version === "html5") { try { win.localStorage.setItem(key, json); } catch { status.textContent = "This browser could not save progress locally."; } return; }
    api.setValue(version === "scorm12" ? "cmi.core.lesson_location" : "cmi.location", state.current);
    if (json.length <= (version === "scorm12" ? 4096 : 64000)) api.setValue("cmi.suspend_data", json); else status.textContent = "Progress exceeds the LMS suspend-data limit; only the current slide can be restored.";
    api.setValue(version === "scorm12" ? "cmi.core.exit" : "cmi.exit", state.completed ? "" : "suspend"); api.commit();
  }
  function finish() {
    if (state.completed) return;
    const score = summary(); const passing = Math.max(0, Math.min(100, Number.isFinite(Number(settings.passingScore)) && settings.passingScore != null ? Number(settings.passingScore) : 80));
    if (score.possible) {
      const prefix = version === "scorm12" ? "cmi.core.score." : "cmi.score."; api.setValue(prefix + "raw", score.percent); api.setValue(prefix + "min", 0); api.setValue(prefix + "max", 100); if (version === "scorm2004") api.setValue("cmi.score.scaled", score.percent / 100);
    }
    if (!score.requiredAnswered || (score.possible && score.percent < passing)) {
      if (score.requiredAnswered && score.possible) api.setValue(version === "scorm12" ? "cmi.core.lesson_status" : "cmi.success_status", "failed");
      persist(); status.textContent = !score.requiredAnswered ? "Submit every required assessment before completing." : "Your score is " + Math.round(score.percent) + "%. Review your answers; the passing score is " + passing + "%."; return; }
    state.completed = true;
    if (score.possible) {
      const prefix = version === "scorm12" ? "cmi.core.score." : "cmi.score."; api.setValue(prefix + "raw", score.percent); api.setValue(prefix + "min", 0); api.setValue(prefix + "max", 100);
      if (version === "scorm2004") api.setValue("cmi.score.scaled", score.percent / 100);
    }
    if (version === "scorm12") api.setValue("cmi.core.lesson_status", score.possible ? "passed" : "completed");
    if (version === "scorm2004") { api.setValue("cmi.completion_status", "completed"); if (score.possible) api.setValue("cmi.success_status", "passed"); }
    recordSessionTime(); persist(); api.finish(); status.textContent = "Course complete!"; next.disabled = true;
  }
  function go(index: number, push = true) {
    if (!Number.isInteger(index) || index < 0 || index >= slides.length) { status.textContent = "This action has no valid target in the course."; return; }
    if (push) { state.history.push(state.current); if (state.history.length > 200) state.history.shift(); }
    state.current = index; render(); persist();
  }
  function action(a: any) {
    if (!slides.length) return;
    if (a.kind === "back") { const last = state.history.pop(); if (last !== undefined) go(last, false); }
    else if (a.kind === "finish") finish();
    else if (a.kind === "slide") go(slides.findIndex((s: any) => s.id === a.targetSlideId));
    else if (a.kind === "url") { const url = p.safeUrl(a.url); if (/^https?:/.test(url)) win.open(url, "_blank", "noopener,noreferrer"); else status.textContent = "Unsafe or unsupported link blocked."; }
    else { const slide = slides[state.current]; if (slide.nextSlideId != null) go(slides.findIndex((s: any) => s.id === slide.nextSlideId)); else if (state.current + 1 < slides.length) go(state.current + 1); else finish(); }
  }
  function render() {
    if (!alive || !doc.getElementById("slide-title")) return;
    area.replaceChildren(); if (!slides.length) { status.textContent = "This course has no slides."; next.disabled = true; prev.disabled = true; return; }
    const slide = slides[state.current]; const stage = doc.createElement("div"); stage.className = "creator-stage"; stage.style.cssText = "position:relative;flex:none;transform-origin:center center"; stage.style.width = width + "px"; stage.style.height = height + "px";
    const background = p.safeStyle({ backgroundColor: slide.background }).backgroundColor; stage.style.backgroundColor = background || "#0f172a";
    const imageBackground = p.safeUrl(slide.background, true); if (imageBackground) { const img = doc.createElement("img"); img.src = imageBackground; img.alt = ""; img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover"; stage.appendChild(img); }
    (slide.blocks || []).forEach((block: any) => {
      const stateId = slide.id + ":" + block.id;
      const wrapper = doc.createElement("div"); wrapper.style.cssText = "position:absolute;box-sizing:border-box"; wrapper.style.left = (Number(block.x) || 0) + "px"; wrapper.style.top = (Number(block.y) || 0) + "px"; wrapper.style.width = Math.max(1, Number(block.width) || 400) + "px"; wrapper.style.height = Math.max(1, Number(block.height) || 60) + "px"; wrapper.style.zIndex = p.safeStyle(block.style).zIndex || "1";
      wrapper.appendChild(renderer.renderBlock(doc, block, {
        answer: state.answers[stateId], result: state.results[stateId], attempts: state.attempts[stateId], state: state.interactions[stateId],
        onAnswer(answer: any, redraw = true) { state.answers[stateId] = answer; delete state.results[stateId]; persist(); if (redraw) render(); },
        onSubmit() {
          if ((state.attempts[stateId] || 0) >= (block.assessment.maxAttempts || 3)) return;
          const result = p.grade(block.assessment, state.answers[stateId]); state.results[stateId] = result;
          if (result.answered) state.attempts[stateId] = (state.attempts[stateId] || 0) + 1;
          const index = assessments().findIndex((b: any) => b.stateId === stateId); const prefix = "cmi.interactions." + index + ".";
          api.setValue(prefix + "id", stateId); api.setValue(prefix + "type", ["multiple_choice", "image_choice", "true_false"].includes(block.assessment.type) ? "choice" : "fill-in");
          api.setValue(prefix + (version === "scorm12" ? "student_response" : "learner_response"), JSON.stringify(state.answers[stateId])); api.setValue(prefix + "result", result.correct ? "correct" : version === "scorm12" ? "wrong" : "incorrect");
          persist(); render();
        },
        onState(value: any) { state.interactions[stateId] = value; persist(); render(); }, onAction: action,
      })); stage.appendChild(wrapper);
    }); area.appendChild(stage);
    const fit = () => { const bounds = area.getBoundingClientRect(); stage.style.transform = "scale(" + Math.max(0.1, Math.min((bounds.width || width) / width, (bounds.height || height) / height)) + ")"; }; fit();
    doc.getElementById("slide-title")!.textContent = slide.title; doc.getElementById("slide-counter")!.textContent = (state.current + 1) + " / " + slides.length;
    doc.getElementById("progress-fill")!.style.width = ((state.current + 1) * 100 / slides.length) + "%";
    prev.disabled = state.history.length === 0 || settings.player?.allowBack === false; next.disabled = state.completed; next.textContent = slide.nextSlideId != null || state.current < slides.length - 1 ? "Next →" : "Finish ✓";
  }
  next.onclick = () => action({ kind: "next" }); prev.onclick = () => action({ kind: "back" });
  function recordSessionTime() {
    const seconds = Math.max(0, (Date.now() - started) / 1000);
    if (version === "scorm2004") api.setValue("cmi.session_time", "PT" + seconds.toFixed(2) + "S");
    else if (version === "scorm12") { const h = Math.floor(seconds / 3600); const m = Math.floor(seconds % 3600 / 60); const s = (seconds % 60).toFixed(2).padStart(5, "0"); api.setValue("cmi.core.session_time", String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + s); }
  }
  function close() { if (!alive) return; alive = false; recordSessionTime(); persist(); api.finish(); }
  win.addEventListener("pagehide", close); win.addEventListener("beforeunload", close); const resize = () => render(); win.addEventListener("resize", resize);
  const Observer = (win as any).ResizeObserver as typeof ResizeObserver | undefined;
  const observer = typeof Observer === "function" ? new Observer(resize) : null; observer?.observe(area);
  if (state.completed) { const score = summary(); const threshold = Number(settings.passingScore ?? 80); if (!score.requiredAnswered || (score.possible && score.percent < threshold)) state.completed = false; }
  render(); status.textContent = api.error || (state.completed ? "Course complete!" : "");
  return { getState: () => state, action, summary, destroy() { close(); observer?.disconnect(); win.removeEventListener("resize", resize); win.removeEventListener("pagehide", close); win.removeEventListener("beforeunload", close); } };
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
export function creatorRuntimePayload(course: CreatorCourse) {
  const settings = JSON.parse(course.settingsJson || "{}");
  const slides = course.slides.map(s => ({ ...s, blocks: readCreatorDocument(s.contentJson).blocks }));
  // Stable source identity prevents resuming a different revision under a reused project ID.
  let hash = 2166136261; const source = JSON.stringify({ settings, slides }); for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return { title: course.title, settings, slides, identity: String(course.id || "preview") + ":" + (hash >>> 0).toString(16) };
}
export function buildCreatorRuntimeHtml(course: CreatorCourse, version: "scorm12" | "scorm2004" | "html5") {
  const payload = creatorRuntimePayload(course);
  const script = `const p=(${createCreatorPrimitives.toString()})();const r=(${createCreatorRenderer.toString()})(p);const api=(${createCreatorScorm.toString()})(window,${serializeCreatorJson(version)});window.ScormAPI=api;window.CreatorRuntime=(${mountCreatorCourse.toString()})(window,${serializeCreatorJson(payload)},${serializeCreatorJson(version)},p,r,api);`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(course.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#071a2b;color:white;font-family:system-ui,sans-serif}#player{height:100dvh;min-height:320px;display:flex;flex-direction:column}#title-bar,#nav{padding:12px 20px;display:flex;align-items:center;gap:12px;background:#12324a}#slide-title{margin-left:auto}#slide-area{flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center}#progress-bar{flex:1;height:5px;background:#334155}#progress-fill{height:100%;background:#22d3ee}button{cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #22d3ee;outline-offset:2px}.nav-btn{padding:8px 16px;background:#0f766e;border:0;color:white;border-radius:6px}#course-status{padding:4px 20px;min-height:24px}#teachific-watermark{background:#189aa1;text-align:center;font-size:12px;padding:6px}#teachific-watermark a{color:#fff}@media(max-width:540px){#nav{padding:8px;gap:6px}.nav-btn{padding:8px}#title-bar{font-size:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}</style></head><body><div id="player"><div id="title-bar"><span id="course-title">${escapeHtml(course.title)}</span><span id="slide-title"></span></div><div id="slide-area"></div><div id="course-status" role="status" aria-live="polite"></div><div id="nav"><button class="nav-btn" id="btn-prev">← Back</button><div id="progress-bar"><div id="progress-fill"></div></div><span id="slide-counter"></span><button class="nav-btn" id="btn-next">Next →</button></div>${course.showWatermark ? '<div id="teachific-watermark">Created with Course360™ — <a href="https://course360.app" target="_blank" rel="noopener noreferrer">Upgrade to remove watermark</a></div>' : ""}</div><script>${script}</script></body></html>`;
}
