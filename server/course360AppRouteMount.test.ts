import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const current = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const baseline = execFileSync("git", ["show", "e5386003:client/src/App.tsx"], { cwd: "/home/ubuntu/scorm-host", encoding: "utf8" });
const paths = (source: string) => [...source.matchAll(/<Route\s+path=(?:\{)?["']([^"']+)["']/g)].map(match => match[1]);
describe("additive app billing recovery routes", () => {
  it.each([["/studio/billing", "studio"], ["/creator/billing", "creator"], ["/quiz-creator-app/billing", "quiz_creator"]])("mounts %s for the matching app without a school billing redirect", (route, app) => {
    expect(current).toContain(`<Route path="${route}">{() => <Course360AppBillingPage app="${app}" />}</Route>`);
  });
  it("resolves Creator billing before the project-ID route", () => {
    expect(current.indexOf('<Route path="/creator/billing"')).toBeLessThan(current.indexOf('<Route path="/creator/:projectId"'));
  });
  it("retains every original named route and route count", () => {
    const original = paths(baseline), now = paths(current);
    for (const path of new Set(original)) expect(now.filter(value => value === path).length).toBeGreaterThanOrEqual(original.filter(value => value === path).length);
  });
  it("retains the original denied browser policy and supplies prlimit additively", () => {
    const core = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    expect(core).toContain("camera=(), microphone=(), geolocation=()");
    const docker = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
    expect(docker).toContain("RUN apk add --no-cache util-linux && command -v prlimit");
  });
});
