import { createCreatorPrimitives, type CreatorBlock } from "./course360CreatorModel";
export interface CreatorRenderContext {
  answer?: any; result?: any; attempts?: number; state?: any; editor?: boolean;
  onAnswer?: (answer: any, redraw?: boolean) => void; onSubmit?: () => void; onAction?: (action: any) => void; onState?: (state: any) => void;
}
/** No external dependencies: packaged runtime and React editor invoke this same renderer. */
export function createCreatorRenderer(p: ReturnType<typeof createCreatorPrimitives>) {
  function renderBlock(doc: Document, block: CreatorBlock, context: CreatorRenderContext = {}) {
    const root = doc.createElement("div"); root.className = "creator-block creator-block-" + block.type; root.dataset.blockId = block.id;
    Object.assign(root.style, { width: "100%", height: "100%", overflow: "auto", boxSizing: "border-box", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "18px", lineHeight: "1.5", color: "#ffffff", ...p.safeStyle(block.style) });
    const text = (parent: Node, value: string) => parent.appendChild(doc.createTextNode(value || ""));
    const button = (label: string, click: () => void) => { const b = doc.createElement("button"); b.type = "button"; b.textContent = label; b.style.cssText = "cursor:pointer;padding:8px 12px;margin:3px;border-radius:6px;border:1px solid #64748b;background:#12324a;color:white;font:inherit"; b.onclick = click; return b; };
    const image = (src: unknown, alt: string) => { const img = doc.createElement("img"); const url = p.safeUrl(src, true); if (url) img.src = url; img.alt = alt || ""; img.draggable = false; img.style.cssText = "width:100%;height:100%;object-fit:contain"; img.style.objectFit = p.safeStyle(block.style).objectFit || "contain"; return img; };
    if (block.type === "text") {
      root.style.padding = p.safeStyle(block.style).padding || "4px 8px";
      if (block.contentHtml && block.contentMode !== "plain") root.appendChild(p.richText(doc, block.contentHtml)); else text(root, block.content || "");
    } else if (block.type === "shape") { root.style.backgroundColor = p.safeStyle(block.style).backgroundColor || "#24abbc"; }
    else if (block.type === "image") { if (p.safeUrl(block.src, true)) root.appendChild(image(block.src, block.alt || "")); else text(root, "Choose an image from the main account Media Library."); }
    else if (block.type === "video" || block.type === "audio") {
      const media = doc.createElement(block.type); const url = p.safeUrl(block.src, true); if (url) media.src = url;
      media.controls = !context.editor; media.preload = "metadata"; media.style.cssText = "width:100%;height:100%;object-fit:contain";
      if (block.type === "video") (media as HTMLVideoElement).playsInline = true;
      root.appendChild(media); if (!url) text(root, "Choose " + block.type + " from the main account Media Library.");
    } else if (block.type === "button") {
      const b = button(block.content || "Button", () => context.onAction?.(block.action || { kind: "next" }));
      Object.assign(b.style, p.safeStyle(block.style), { width: "100%", height: "100%", margin: "0" }); if (context.editor) b.tabIndex = -1; root.appendChild(b);
    } else if (block.type === "assessment" && block.assessment) {
      const q = block.assessment; const prompt = doc.createElement("p"); prompt.textContent = q.prompt; prompt.style.margin = "0 0 10px"; root.appendChild(prompt);
      const answer = context.answer; const locked = (context.attempts || 0) >= (q.maxAttempts || 3);
      const change = (value: any) => { if (!context.editor && !locked) context.onAnswer?.(value); };
      if (q.type === "multiple_choice" || q.type === "image_choice") {
        (q.options || []).forEach(o => {
          const label = doc.createElement("label"); label.style.cssText = "display:flex;align-items:center;gap:8px;padding:5px;cursor:pointer";
          const input = doc.createElement("input"); input.type = "checkbox"; input.disabled = locked || !!context.editor; input.checked = Array.isArray(answer) ? answer.includes(o.id) : answer === o.id;
          input.onchange = () => { const set = new Set(Array.isArray(answer) ? answer : answer ? [answer] : []); input.checked ? set.add(o.id) : set.delete(o.id); change([...set]); }; label.appendChild(input);
          if (q.type === "image_choice" && p.safeUrl(o.src, true)) { const img = image(o.src, o.text); img.style.width = "100px"; img.style.height = "64px"; label.appendChild(img); }
          text(label, o.text); root.appendChild(label);
        });
      } else if (q.type === "true_false") {
        [true, false].forEach(value => { const b = button(value ? "True" : "False", () => change(value)); b.setAttribute("aria-pressed", String(answer === value)); b.disabled = locked || !!context.editor; root.appendChild(b); });
      } else if (q.type === "matching") {
        (q.pairs || []).forEach(pair => {
          const label = doc.createElement("label"); label.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0"; text(label, pair.left);
          const select = doc.createElement("select"); select.setAttribute("aria-label", "Match " + pair.left); select.style.cssText = "max-width:65%;padding:6px;background:#12324a;color:white";
          const empty = doc.createElement("option"); empty.value = ""; empty.textContent = "Choose a match"; select.appendChild(empty);
          [...(q.pairs || [])].reverse().forEach(option => { const opt = doc.createElement("option"); opt.value = option.id; opt.textContent = option.right; select.appendChild(opt); });
          select.value = answer?.[pair.id] || ""; select.disabled = locked || !!context.editor;
          select.onchange = () => { const value = { ...(answer || {}), [pair.id]: select.value }; if (!select.value) delete value[pair.id]; change(value); };
          label.appendChild(select); root.appendChild(label);
        });
      } else if (q.type === "hotspot") {
        const surface = doc.createElement("div"); surface.style.cssText = "position:relative;width:100%;height:180px;background:#071a2b;border:1px solid #64748b";
        surface.appendChild(image(q.src, "Question image"));
        const mark = doc.createElement("span"); mark.textContent = "+"; mark.style.cssText = "position:absolute;color:#22d3ee;font-weight:bold;pointer-events:none;transform:translate(-50%,-50%)";
        if (answer && Number.isFinite(answer.x)) { mark.style.left = answer.x + "%"; mark.style.top = answer.y + "%"; surface.appendChild(mark); }
        surface.onclick = e => { const r = surface.getBoundingClientRect(); if (r.width && r.height) change({ x: Math.max(0, Math.min(100, (e.clientX - r.left) * 100 / r.width)), y: Math.max(0, Math.min(100, (e.clientY - r.top) * 100 / r.height)) }); }; root.appendChild(surface);
        const controls = doc.createElement("div"); text(controls, "Keyboard alternative — image position (%): ");
        ["x", "y"].forEach(axis => { const input = doc.createElement("input"); input.type = "number"; input.min = "0"; input.max = "100"; input.value = String(answer?.[axis] ?? 50); input.setAttribute("aria-label", "Hotspot " + axis); input.disabled = locked || !!context.editor; input.style.width = "65px"; input.onchange = () => change({ x: answer?.x ?? 50, y: answer?.y ?? 50, [axis]: Math.max(0, Math.min(100, Number(input.value))) }); controls.appendChild(input); }); root.appendChild(controls);
      } else {
        const input = q.type === "short_answer" ? doc.createElement("textarea") : doc.createElement("input"); input.value = typeof answer === "string" ? answer : "";
        input.setAttribute("aria-label", q.prompt); input.style.cssText = "width:100%;box-sizing:border-box;padding:8px;background:#12324a;color:white;border:1px solid #64748b"; input.disabled = locked || !!context.editor;
        // Updating on blur preserves caret/focus while the runtime redraws other controls.
        input.onchange = () => { if (!context.editor && !locked) context.onAnswer?.(input.value, false); }; root.appendChild(input);
        if (q.type === "short_answer") { const rubric = doc.createElement("small"); rubric.textContent = q.keywords?.length ? "Scoring: one equal share per required keyword/phrase, matched as whole words." : "Scoring: exact accepted answer after whitespace normalization."; root.appendChild(rubric); }
      }
      const submit = button("Submit answer", () => context.onSubmit?.()); submit.disabled = locked || !!context.editor; root.appendChild(submit);
      const feedback = doc.createElement("div"); feedback.setAttribute("role", "status"); feedback.setAttribute("aria-live", "polite");
      feedback.textContent = context.result ? context.result.feedback + " (" + context.result.earned + "/" + context.result.possible + " points; attempt " + context.attempts + ")" : ""; root.appendChild(feedback);
    } else if (block.type === "interaction" && block.interaction) {
      const interaction = block.interaction; const state = context.state || {}; const set = (s: any) => context.onState?.({ ...state, ...s });
      if (interaction.kind === "accordion") interaction.items.forEach(item => { const details = doc.createElement("details"); details.open = !!state[item.id]; const summary = doc.createElement("summary"); summary.textContent = item.title; details.appendChild(summary); const body = doc.createElement("p"); body.textContent = item.content; details.appendChild(body); details.ontoggle = () => { if (details.open !== !!state[item.id]) set({ [item.id]: details.open }); }; root.appendChild(details); });
      else if (interaction.kind === "flip_cards") interaction.items.forEach(item => { const b = button(state[item.id] ? item.content : item.title, () => set({ [item.id]: !state[item.id] })); b.setAttribute("aria-pressed", String(!!state[item.id])); b.setAttribute("aria-label", "Flip " + item.title); root.appendChild(b); });
      else if (interaction.kind === "matching_drag") {
        const items = interaction.items; const selected = state.selected;
        text(root, "Drag a term onto its definition, or select a term and then choose a definition. ");
        items.forEach(item => { const b = button(item.title, () => set({ selected: item.id })); b.draggable = true; b.ondragstart = e => e.dataTransfer?.setData("text/plain", block.id + ":" + item.id); b.setAttribute("aria-pressed", String(selected === item.id)); root.appendChild(b); });
        [...items].reverse().forEach(item => {
          const match = (id: string) => { if (items.some(i => i.id === id)) set({ matches: { ...(state.matches || {}), [item.id]: id }, selected: null }); };
          const b = button(item.content + (state.matches?.[item.id] ? " — " + (state.matches[item.id] === item.id ? "Correct" : "Try another match") : ""), () => { if (selected) match(selected); });
          b.ondragover = e => e.preventDefault(); b.ondrop = e => { e.preventDefault(); const data = e.dataTransfer?.getData("text/plain") || ""; if (data.startsWith(block.id + ":")) match(data.slice(block.id.length + 1)); }; root.appendChild(b);
        });
      } else {
        const nav = doc.createElement("div"); nav.setAttribute("role", interaction.kind === "tabs" ? "tablist" : "group");
        const active = state.active || interaction.items[0]?.id;
        interaction.items.forEach((item, i) => { const b = button((interaction.kind === "timeline" ? String(i + 1) + ". " : "") + item.title, () => set({ active: item.id })); b.setAttribute("aria-selected", String(active === item.id)); if (interaction.kind === "tabs") b.setAttribute("role", "tab"); nav.appendChild(b); }); root.appendChild(nav);
        const panel = doc.createElement("div"); panel.setAttribute("role", "tabpanel"); panel.textContent = interaction.items.find(i => i.id === active)?.content || ""; panel.style.padding = "12px"; root.appendChild(panel);
      }
    } else { text(root, "Unsupported saved block: " + block.type); }
    return root;
  }
  return { renderBlock };
}
export const creatorRenderer = createCreatorRenderer(createCreatorPrimitives());
