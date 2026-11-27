// @vitest-environment jsdom
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { formatCourse360BrandName } from "../shared/course360DisplayBrand";
import { Course360SchoolTrack, Course360ContentTrack } from "../client/src/components/Course360MarketingTracks";
import { Course360CrossToolOffers, type Course360CrossToolOffersProps } from "../client/src/components/Course360CrossToolOffers";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";

// CSS variables/color-mix are not reliably computed by JSDOM. Assert parsed CSS
// declarations and actual SSR class usage instead of unsupported computed styles.
const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const css = postcss.parse(source("client/src/styles/course360PlatformPalette.css"));
const rules: Array<{ selector: string; declarations: Record<string, string> }> = [];
css.walkRules(rule => {
  const declarations: Record<string, string> = {};
  rule.walkDecls(decl => { declarations[decl.prop] = decl.value; });
  rules.push({ selector: rule.selector, declarations });
});
function declarations(selector: string) {
  const rule = rules.find(candidate => candidate.selector === selector);
  expect(rule, `Missing palette selector ${selector}`).toBeDefined();
  return rule!.declarations;
}
const tokens = rules.find(rule => rule.declarations["--c360-teal"])!.declarations;
const staticDOM = (element: React.ReactElement) => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(element);
  return container;
};
function hasClasses(element: Element | null, ...classes: string[]) {
  expect(element).not.toBeNull();
  for (const className of classes) expect(element!.classList.contains(className), className).toBe(true);
}
function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g)!.map(value => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const ready: NonNullable<Course360CrossToolOffersProps["readiness"]> = {
  builder_creator_web: { monthly: true, annual: true },
  pro_creator_web: { monthly: true, annual: true },
};

describe("Course360 opt-in blue-teal/aqua palette", () => {
  it("defines the approved palette only on explicitly opted-in controls", () => {
    expect(tokens).toMatchObject({
      "--c360-teal": "#24abbc", "--c360-aqua": "#4ad9e0", "--c360-navy": "#0b1d35",
      "--c360-ink-color": "#0b1d35", "--c360-action-color": "#24abbc", "--c360-action-text": "#0b1d35", "--c360-soft-color": "#eaf9fb",
    });
    expect(declarations(".c360-action")).toEqual({ "background-color": "var(--c360-action-color)", color: "var(--c360-action-text)" });
    expect(declarations(".c360-text").color).toBe("var(--c360-ink-color)");
    expect(declarations(".c360-soft")["background-color"]).toBe("var(--c360-soft-color)");
    expect(declarations(".c360-ink").color).toBe("var(--c360-navy)");
  });

  it.each([["#24abbc", 6.14], ["#4ad9e0", 9.90], ["#eaf9fb", 15.66]] as const)("keeps navy text contrast against %s at approximately %s:1", (background, expected) => {
    const ratio = contrast(tokens["--c360-action-text"], background);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(expected, 2);
  });

  it("uses aqua focus on navy rather than low-contrast action focus", () => {
    expect(declarations(".c360-focus-aqua-outline:focus-visible")["outline-color"]).toBe("var(--c360-aqua)");
    expect(contrast(tokens["--c360-aqua"], tokens["--c360-navy"])).toBeGreaterThanOrEqual(3);
    const content = staticDOM(<Course360ContentTrack />).querySelector("#create-content")!;
    hasClasses(content, "bg-[#0b1d35]");
    const controls = content.querySelectorAll("button, a");
    expect(controls).toHaveLength(5);
    controls.forEach(control => {
      hasClasses(control, "c360-focus-aqua-outline", "focus-visible:outline-2");
      expect(control.classList.contains("c360-focus-outline")).toBe(false);
    });
  });

  it("renders the actual school track with opt-in action, outline, border and soft accent", () => {
    const school = staticDOM(<Course360SchoolTrack />);
    hasClasses(school.querySelector('a[href="#pricing"]'), "c360-action", "c360-hover-action", "c360-focus-outline");
    expect(school.querySelectorAll(".c360-soft")).toHaveLength(3);
    expect(school.querySelectorAll(".c360-aqua-border")).toHaveLength(1);
    expect(school.querySelectorAll("svg.c360-text")).toHaveLength(3);
    expect(school.textContent).toContain("Your school's identity stays separate");
    expect(school.innerHTML).not.toMatch(/(?:text|bg|border)-teal-\d/);
  });

  it("renders actual content cards with aqua accents and unchanged standalone destinations", () => {
    const content = staticDOM(<Course360ContentTrack />);
    expect(content.querySelectorAll("article")).toHaveLength(3);
    expect(content.querySelectorAll("svg.c360-aqua-text")).toHaveLength(3);
    for (const href of ["/creator-pro", "/studio-pro", "/quiz-creator-pro"]) {
      hasClasses(content.querySelector(`a[href="${href}"]`), "c360-hover-soft", "c360-focus-aqua-outline", "bg-white", "text-slate-900");
    }
    expect(content.innerHTML).not.toMatch(/(?:text|bg|border)-teal-\d/);
  });

  it("renders both actual ready package cards with action classes without invoking checkout", () => {
    const checkout = vi.fn(async () => {});
    const packages = staticDOM(<Course360CrossToolOffers catalogStatus="ready" readiness={ready} onCheckout={checkout} />);
    const articles = packages.querySelectorAll("article");
    expect(articles).toHaveLength(2);
    for (const offer of Object.values(COURSE360_CROSS_TOOL_OFFERS)) {
      const button = packages.querySelector(`button[aria-label="Continue with ${formatCourse360BrandName(offer.name)}"]`) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      hasClasses(button, "c360-action", "c360-hover-action", "c360-focus-outline");
    }
    hasClasses(packages.querySelector('[aria-labelledby="pro_creator_web-heading"]'), "c360-border", "c360-soft-subtle");
    expect(packages.textContent).toContain("$169.97");
    expect(packages.textContent).toContain("$249.97");
    expect(checkout).not.toHaveBeenCalled();
  });

  it("retains gray caller-requested disabled package colors without recoloring opacity-only selection", () => {
    const packages = staticDOM(<Course360CrossToolOffers />);
    const buttons = packages.querySelectorAll<HTMLButtonElement>('button[aria-label^="Continue with"]');
    expect(buttons).toHaveLength(2);
    buttons.forEach(button => {
      expect(button.disabled).toBe(true);
      hasClasses(button, "c360-action", "disabled:bg-slate-200", "disabled:text-slate-600", "disabled:cursor-not-allowed");
    });
    expect(declarations(".c360-action:disabled:is(.disabled\\:bg-slate-200)")["background-color"]).toBe("#e2e8f0");
    expect(declarations(".c360-action:disabled:is(.disabled\\:text-slate-600)").color).toBe("#475569");
    const selected = packages.querySelector('button[aria-pressed="true"]');
    hasClasses(selected, "c360-action", "disabled:opacity-60");
    expect(selected!.classList.contains("disabled:bg-slate-200")).toBe(false);
    expect(declarations(".c360-hover-action:hover:not(:disabled)")["background-color"]).toBe("var(--c360-aqua)");
    expect(declarations(".c360-hover-soft:hover:not(:disabled)")["background-color"]).toBe("var(--c360-soft-color)");
  });

  it("keeps bootstrap loading spinners' transparent top gap with a specific opt-in rule", () => {
    expect(declarations(".c360-border.border-t-transparent")["border-top-color"]).toBe("transparent");
    for (const path of ["client/src/AppBootstrap.tsx", "client/src/BootstrapShell.tsx"]) {
      const text = source(path);
      expect(text).toMatch(/className="[^"]*animate-spin[^"]*c360-border border-t-transparent"/);
      expect(text).not.toContain("border-teal-700");
      expect(text).toContain("c360-action");
      expect(text).toContain("c360-focus-ring");
    }
  });

  it("keeps organization fallbacks opt-in and reads rather than redefines school tokens", () => {
    const orgRules = rules.filter(rule => rule.selector.startsWith(".lms-org-theme "));
    expect(orgRules).toHaveLength(4);
    const tokenRule = orgRules.find(rule => rule.declarations["--c360-action-color"])!;
    expect(tokenRule.declarations).toMatchObject({
      "--c360-action-color": "var(--org-primary, #24abbc)",
      "--c360-ink-color": "var(--org-primary, #0b1d35)",
      "--c360-action-text": "var(--org-button-text, #ffffff)",
      "--c360-aqua": "var(--org-accent, #4ad9e0)",
    });
    expect(declarations(".lms-org-theme .c360-action")["background-color"]).toBe("var(--org-button, var(--c360-action-color))");
    orgRules.forEach(rule => expect(rule.selector).toMatch(/\.c360-/));
    css.walkDecls(decl => expect(decl.prop).not.toMatch(/^--org-/));
    const host = document.createElement("div");
    host.className = "lms-org-theme";
    host.innerHTML = '<button class="bg-teal-700">School-authored control</button><button class="c360-action">Opt-in control</button>';
    // Selector isolation is supported even where custom-property computation is not.
    rules.forEach(rule => expect(host.querySelector(".bg-teal-700")!.matches(rule.selector)).toBe(false));
    expect(host.querySelector(".c360-action")!.matches(".lms-org-theme .c360-action")).toBe(true);
  });

  it("does not introduce global variables, unmarked selectors, Tailwind replacements or important overrides", () => {
    expect(rules.length).toBeGreaterThan(15);
    rules.forEach(rule => {
      expect(rule.selector).toContain(".c360-");
      expect(rule.selector).not.toMatch(/:root|:global|(^|[,\s])(?:html|body|button|input|a)(?=[\s,:.{]|$)/);
      const names = [...rule.selector.matchAll(/\.([a-z][a-z0-9-]*)/g)].map(match => match[1]);
      expect(names.every(name => name.startsWith("c360-") || ["lms-org-theme", "border-t-transparent", "disabled"].includes(name) || (rule.selector.startsWith(":has(> .c360-setup-claims)") && ["border-teal-100", "bg-teal-50"].includes(name)))).toBe(true);
    });
    css.walkDecls(decl => {
      expect(decl.important).toBeFalsy();
      if (decl.prop.startsWith("--")) expect(decl.prop.startsWith("--c360-") || (decl.prop === "--tw-ring-color" && decl.parent!.type === "rule" && [".c360-focus-ring:focus", ':has(> .c360-setup-claims) > a[href="/login"]:focus-visible'].includes(decl.parent!.selector))).toBe(true);
    });
    expect(source("client/src/BootstrapShell.tsx")).toContain('import "./styles/course360PlatformPalette.css";');
    expect(source("client/src/index.css")).not.toContain("--c360-");
  });

  it("opts checkout and account recovery into the new colors while retaining semantic error and warning styles", () => {
    const checkout = source("client/src/components/Course360CrossToolCheckout.tsx");
    expect(checkout).toContain('DialogContent className="bg-white text-slate-900 c360-aqua-border');
    expect(checkout).toContain("c360-accent");
    expect(checkout).toContain("c360-soft");
    expect(checkout).toContain("disabled:bg-slate-200 disabled:text-slate-600");
    expect(checkout).toContain("bg-amber-50");
    expect(checkout).toContain("text-red-800");
    const claims = source("client/src/components/Course360PaidSchoolClaims.tsx");
    expect(claims).toContain("c360-aqua-border c360-soft-subtle");
    expect(claims).toContain("disabled:opacity-50");
    expect(claims).toContain("text-red-800");
    const setup = source("client/src/pages/auth/AccountSetupPage.tsx");
    expect(setup).toContain('style={{ background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }}');
    expect(setup).not.toContain("c360-");
    expect(claims).toContain('className="c360-setup-claims ');
    expect(declarations(":has(> .c360-setup-claims) > .border-teal-100.bg-teal-50")["background-color"]).toBe("var(--c360-soft-color)");
    expect(declarations(':has(> .c360-setup-claims) > a[href="/login"]').color).toBe("var(--c360-navy)");
    for (const text of [checkout, claims]) expect(text).not.toMatch(/(?:text|bg|border|accent|ring|outline)-teal-\d/);
  });

  it("uses the same approved blue-teal for decorative landing feature accents only", () => {
    const landing = source("client/src/pages/LandingPage.tsx");
    const featureBlock = landing.slice(landing.indexOf("const FEATURES = ["), landing.indexOf("\n];", landing.indexOf("const FEATURES = [")));
    expect(featureBlock.match(/color: TEAL/g)).toHaveLength(10);
    expect(featureBlock).not.toMatch(/color: "#/);
    expect(landing).toContain('const TEAL = "#24abbc"');
  });
});
