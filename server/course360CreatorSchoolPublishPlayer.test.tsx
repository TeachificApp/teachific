// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
const m = vi.hoisted(() => ({ zip: "", calls: [] as any[] }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 30 } }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { mediaRepo: { getScormZipUrl: { useQuery: (input: any, options: any) => { m.calls.push([input, options]); return { data: { mode: "clientZip", zipUrl: m.zip, title: "Published retained lesson" }, isLoading: false, isError: false }; } }, getMediaEmbedUrl: { useQuery: () => ({ data: undefined, isLoading: false, isError: false }) } } } }));
import { MediaEmbedIframe } from "../client/src/components/MediaEmbedIframe";
import { buildCreatorSchoolArtifact } from "./course360CreatorSchoolPublishArtifact";
// The installed JS-only dependency still executes the actual learner HTML.
const { JSDOM }: { JSDOM: new (html: string, options: { runScripts: "dangerously"; url: string }) => { window: Pick<Window, "document" | "close"> } } = createRequire(`${process.cwd()}/package.json`)("jsdom");
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Actual CoursePlayer MediaEmbedIframe → ScormPlayer school artifact linkage", () => {
  it("resolves protected numeric LMS course scope and launches actual retained HTML5 ZIP through real client Blob extraction", async () => {
    m.zip = "/api/media/creator-school/scorm-zip?access=mock"; m.calls = [];
    const db: any = {}; // no bound media: artifact helper must not call a DB boundary
    const artifact = await buildCreatorSchoolArtifact(db, 7, { id: 5, title: "Retained published lesson", settingsJson: "{}" }, [{ id: 20, title: "Learner", background: "#12324a", contentJson: JSON.stringify({ blocks: [{ id: "t", type: "text", x: 10, y: 10, width: 600, height: 100, content: "Real enrolled Creator content" }] }) }], false);
    const blobs = new Map<string, Blob>(); let id = 0;
    vi.stubGlobal("Blob", (await import("node:buffer")).Blob);
    const makeBlob = vi.fn((blob: Blob) => { const key = `blob:course360-test-${++id}`; blobs.set(key, blob); return key; });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: makeBlob });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const responseBytes = new Uint8Array(artifact.bytes);
    const fetch = vi.fn(async () => ({ ok: true, headers: { get: (key: string) => key === "content-type" ? "application/zip" : String(responseBytes.length) }, body: { getReader: () => { let done = false; return { read: async () => done ? { done: true } : (done = true, { done: false, value: responseBytes }) }; } } }));
    vi.stubGlobal("fetch", fetch);
    render(<MediaEmbedIframe src="/api/media/creator-school/scorm/" courseId={10} title="Published retained lesson" />);
    const iframe = await screen.findByTitle("Published retained lesson"); await waitFor(() => expect(iframe.tagName).toBe("IFRAME"));
    expect(m.calls[0]).toEqual([{ slug: "creator-school", courseId: 10 }, { enabled: true }]);
    expect(fetch).toHaveBeenCalledWith(`${window.location.origin}${m.zip}`, { credentials: "same-origin" });
    expect(makeBlob).toHaveBeenCalled(); const launch = blobs.get(iframe.getAttribute("src")!)!; const html = await launch.text();
    expect(html).toContain("mountCreatorCourse"); expect(html).toContain("createCreatorRenderer"); expect(html).toContain("Real enrolled Creator content");
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://learner.invalid" }); expect(dom.window.document.getElementById("slide-area")!.textContent).toContain("Real enrolled Creator content"); dom.window.close();
    expect(Buffer.from(html).length).toBeGreaterThan(0);
  });
});
