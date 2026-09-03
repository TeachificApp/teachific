import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const render = vi.hoisted(() => vi.fn());

vi.mock("react-dom/client", () => ({
  createRoot: () => ({ render }),
}));

import { mountCourse360Bootstrap } from "../client/src/BootstrapShell";
import { isCourse360PlatformRoot } from "../client/src/lib/platformRoot";

function renderedText() {
  const collect = (node: unknown): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(collect).join("");
    if (node && typeof node === "object" && "props" in node) {
      return collect((node as { props?: { children?: unknown } }).props?.children);
    }
    return "";
  };

  return collect(render.mock.calls.at(-1)?.[0]);
}

describe("Course360 root bootstrap fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      location: { reload: vi.fn() },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders a loading shell immediately and a retryable fallback when App bootstrap rejects", async () => {
    mountCourse360Bootstrap({} as Element, () => Promise.reject(new Error("module unavailable")), 50);

    expect(renderedText()).toContain("Loading Course360");

    await Promise.resolve();
    await Promise.resolve();

    expect(renderedText()).toContain("We could not load this page.");
    expect(renderedText()).toContain("Retry loading Course360");
  });

  it("renders the same retryable fallback when App bootstrap does not resolve before the timeout", () => {
    mountCourse360Bootstrap({} as Element, () => new Promise(() => undefined), 50);

    expect(renderedText()).toContain("Loading Course360");
    vi.advanceTimersByTime(50);

    expect(renderedText()).toContain("We could not load this page.");
    expect(renderedText()).toContain("Retry loading Course360");
  });

  it("renders the resolved App bootstrap after the loading shell", async () => {
    const AppBootstrap = () => "Course360 application";
    mountCourse360Bootstrap({} as Element, () => Promise.resolve({ AppBootstrap }), 50);

    expect(renderedText()).toContain("Loading Course360");
    await Promise.resolve();

    expect(render.mock.calls.at(-1)?.[0]?.type).toBe(AppBootstrap);
  });

  it("keeps the full App graph deferred behind a visible suspense and retryable failure state", () => {
    const appBootstrapSource = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/AppBootstrap.tsx"),
      "utf8",
    );

    expect(appBootstrapSource).toContain('const DeferredApp = lazy(async () => {');
    expect(appBootstrapSource).toContain('await import("./pages/LandingPage")');
    expect(appBootstrapSource).toContain('await import("./App")');
    expect(appBootstrapSource).toContain("[Course360 App Load Error]");
    expect(appBootstrapSource).toContain("<Suspense fallback={<AppLoadFallback />}>");
    expect(appBootstrapSource).toContain("<DeferredApp />");
    expect(appBootstrapSource).toContain("Retry loading Course360");
  });

  it("loads the lightweight landing module only at a platform root and retains the full router for organization domains and nested routes", () => {
    expect(isCourse360PlatformRoot({ hostname: "course360.app", pathname: "/" })).toBe(true);
    expect(isCourse360PlatformRoot({ hostname: "scormhost-fjxmsdmk.manus.space", pathname: "/" })).toBe(true);
    expect(isCourse360PlatformRoot({ hostname: "academy.course360.app", pathname: "/" })).toBe(false);
    expect(isCourse360PlatformRoot({ hostname: "academy.example.org", pathname: "/" })).toBe(false);
    expect(isCourse360PlatformRoot({ hostname: "course360.app", pathname: "/login" })).toBe(false);
  });
});
