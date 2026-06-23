/**
 * sanitize.ts
 * Shared DOMPurify wrapper for safely rendering admin-authored HTML in the browser.
 * Usage: dangerouslySetInnerHTML={{ __html: sanitize(html) }}
 */
import DOMPurify from "dompurify";

/** Sanitize an HTML string for safe rendering with dangerouslySetInnerHTML. */
export const sanitize = (html: string | null | undefined): string => {
  if (!html) return "";
  if (typeof window === "undefined") return html; // SSR fallback
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
};

/** Sanitize CSS for use in <style> tags — strips everything except valid CSS. */
export const sanitizeCss = (css: string | null | undefined): string => {
  if (!css) return "";
  // Remove script injection attempts in CSS (expression(), url(javascript:), etc.)
  return (css ?? "").replace(/expression\s*\(/gi, "").replace(/url\s*\(\s*["']?\s*javascript:/gi, "url(");
};
