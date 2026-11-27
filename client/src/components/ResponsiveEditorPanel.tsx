import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Settings2 } from "lucide-react";
import "./responsiveEditorPanel.css";

// A phone requesting Desktop site commonly has a 980px layout viewport.
// Pointer detection also covers touch tablets with a desktop-sized viewport.
export const COMPACT_EDITOR_QUERY = "(max-width: 1023px), (pointer: coarse)";

export function isCompactEditorViewport(): boolean {
  return typeof window !== "undefined" && (
    typeof window.matchMedia === "function"
      ? window.matchMedia(COMPACT_EDITOR_QUERY).matches
      : window.innerWidth < 1024
  );
}

export function useCompactEditor(): boolean {
  const [compact, setCompact] = useState(isCompactEditorViewport);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const update = () => setCompact(window.innerWidth < 1024);
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const media = window.matchMedia(COMPACT_EDITOR_QUERY);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}

interface ResponsiveEditorPanelProps {
  selectionKey?: string | null;
  title: string;
  desktopWidth: number;
  className?: string;
  children: ReactNode;
}

/** Presentation only: never serializes blocks, saves data, or remounts children
 * when the viewport or panel visibility changes. The parent row is relative. */
export default function ResponsiveEditorPanel({ selectionKey, title, desktopWidth, className = "", children }: ResponsiveEditorPanelProps) {
  const compact = useCompactEditor();
  const [open, setOpen] = useState(!!selectionKey);
  const id = useId();
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (selectionKey && compact) setOpen(true);
  }, [selectionKey, compact]);

  useEffect(() => {
    if (!compact) return;
    if (open) backRef.current?.focus({ preventScroll: true });
    else if (wasOpen.current) toggleRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
    if (!open) return;
    // The page toolbar remains usable; only the canvas covered by this panel
    // is excluded from keyboard/screen-reader navigation until it is shown.
    const siblings: Array<{ element: HTMLElement; inert: boolean }> = [];
    let sibling = panelRef.current?.previousElementSibling;
    while (sibling) {
      if (sibling instanceof HTMLElement) {
        siblings.push({ element: sibling, inert: sibling.inert });
        sibling.inert = true;
      }
      sibling = sibling.previousElementSibling;
    }
    return () => { for (const { element, inert } of siblings) element.inert = inert; };
  }, [compact, open]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const panel = panelRef.current;
      if (!panel) return;
      // Keep the bottom controls reachable when the on-screen keyboard opens.
      // This is relative to the canvas row, not to a guessed header height.
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const top = panel.parentElement?.getBoundingClientRect().top ?? 0;
      const availableHeight = Math.max(0, visibleBottom - Math.max(top, viewport?.offsetTop ?? 0));
      panel.style.setProperty("--editor-visible-height", `${availableHeight}px`);
      panel.style.setProperty("--editor-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      panel.style.setProperty("--editor-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      // In landscape or with a keyboard, the toolbar can leave virtually no
      // canvas height. Expand this same mounted settings instance, not a copy.
      panel.dataset.expandedViewport = compact && availableHeight < 260 ? "true" : "false";
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, [compact, open]);

  const close = () => { setOpen(false); };
  return (
    <>
      {compact && !open && (
        <button ref={toggleRef} type="button" className="c360-editor-panel-toggle" aria-controls={id} aria-expanded={false} onClick={() => setOpen(true)}>
          <Settings2 size={16} aria-hidden="true" /> {title}
        </button>
      )}
      <aside
        ref={panelRef}
        id={id}
        aria-label={title}
        hidden={compact && !open}
        data-compact={compact ? "true" : "false"}
        className={`c360-responsive-editor-panel ${className}`}
        style={{ width: compact ? "100%" : desktopWidth }}
        onKeyDown={event => {
          if (compact && event.key === "Tab" && !event.defaultPrevented && panelRef.current?.dataset.expandedViewport === "true" && !(event.target as HTMLElement).closest('[role="dialog"], [role="listbox"], [role="menu"]')) {
            const controls = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"], [contenteditable="true"]')).filter(control => control.getClientRects().length > 0 && !control.closest('[hidden], [inert]'));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
          if (compact && event.key === "Escape" && !event.defaultPrevented && !(event.target as HTMLElement).closest('[role="dialog"], [role="listbox"], [role="menu"]')) {
            event.stopPropagation(); close();
          }
        }}
      >
        {compact && (
          <div className="c360-editor-panel-mobile-header">
            <button ref={backRef} type="button" onClick={close} aria-label="Back to canvas" className="c360-editor-panel-back"><ArrowLeft size={18} aria-hidden="true" /> Back to canvas</button>
            <span>{title}</span>
          </div>
        )}
        {children}
      </aside>
    </>
  );
}
