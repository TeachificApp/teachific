// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { FakeRecorder, FakeAudio, FakeStream, captureFixture } from "./course360StudioCaptureFakes";
const state = vi.hoisted(() => ({ capability: { orgId: 11, isActive: true, reason: null } as any, capabilityLoading: false, media: [] as any, clips: [] as any[], saved: vi.fn(async () => ({ id: 41 })), update: vi.fn(async (input: any) => ({ captionsUrl: "/saved.vtt", transcriptJson: JSON.stringify({ ...JSON.parse(input.transcriptJson), studio: { revision: (input.expectedRevision ?? 0) + 1 } }) })), render: vi.fn(async () => ({ url: "/actual-render.mp4", mimeType: "video/mp4", mediaItemId: 9 })), highlights: vi.fn(async () => ({ clips: [{ startSec: 0, endSec: 2, label: "actual semantic" }] })), enqueue: vi.fn(), retry: vi.fn(), queryInput: null as any, denied: null as any }));
vi.mock("@/lib/trpc", () => {
  const empty: any[] = [];
  let lastMedia: any; let mediaEnvelope: any;
  const query = (data: () => any) => ({ useQuery: (input: any) => ({ data: data(), isLoading: false, refetch: vi.fn(), error: null }) });
  const mutation = (fn = vi.fn(async () => ({}))) => ({ useMutation: () => ({ mutateAsync: fn, mutate: vi.fn(), isPending: false }) });
  return { trpc: {
    billing: { getStudioSubscription: { useQuery: () => ({ data: state.capability, isLoading: state.capabilityLoading, error: null, refetch: vi.fn() }) } },
    useUtils: () => ({ lms: { media: { listOrgMedia: { invalidate: vi.fn() } } } }),
    lms: { media: { listOrgMedia: { useQuery: (input: any) => { state.queryInput = input; return { data: state.media, isLoading: false, refetch: vi.fn(), error: state.denied }; } }, saveMediaItem: mutation(state.saved), updateCaptions: mutation(state.update), renderEditedVideo: mutation(state.render), generateHighlights: mutation(state.highlights), generateCaptions: mutation(), listClips: query(() => state.clips), saveClip: mutation(), saveRecording: mutation(), deleteClip: mutation(), importFromUrl: mutation(), deleteOrgMedia: mutation(), bulkMoveToFolder: mutation() } },
    forms: { media: { list: query(() => { if (lastMedia !== state.media) { lastMedia = state.media; mediaEnvelope = { items: state.media }; } return mediaEnvelope; }) } },
    platformAdmin: { getLatestAppVersion: query(() => null) },
    packages: { list: query(() => empty), delete: mutation() },
    folders: { list: query(() => empty), create: mutation(), rename: mutation(), delete: mutation(), movePackage: mutation(), reorder: mutation() },
  } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "user" } }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "user" } }) }));
vi.mock("@/hooks/useOrgScope", () => ({ useOrgScope: () => ({ orgId: 11 }) }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => ({ isBuilder: true, isPro: true, isLoading: false }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/studio", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/ui/select", () => ({ Select: ({ children }: any) => <div>{children}</div>, SelectContent: ({ children }: any) => <div>{children}</div>, SelectTrigger: ({ children }: any) => <div>{children}</div>, SelectValue: () => null, SelectItem: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/ui/slider", () => ({ Slider: () => <div /> }));
vi.mock("../client/src/pages/UploadPage", () => ({ default: () => null }));
import RecordEditPage from "../client/src/pages/RecordEditPage";
import FilesPage from "../client/src/pages/FilesPage";
import { UploadQueueProvider, useUploadQueue } from "../client/src/contexts/UploadQueueContext";
vi.mock("./db", () => ({ getDb: async () => ({ select: () => ({ from: () => ({ where: async () => state.media }) }) }) }));
vi.mock("./formsRouter", () => ({ requireActiveMediaOrganization: async (_user: any, hint?: number) => { if (hint !== undefined && hint !== 11) throw new Error("stale school"); return 11; } }));
let fixture: ReturnType<typeof captureFixture>; let clicked: string[];
beforeEach(() => {
  state.capability = { orgId: 11, isActive: true, reason: null }; state.capabilityLoading = false;
  state.media = []; state.clips = []; state.denied = null; state.saved.mockClear(); state.update.mockClear(); state.render.mockClear(); state.highlights.mockClear();
  fixture = captureFixture(); clicked = [];
  vi.stubGlobal("MediaRecorder", FakeRecorder); vi.stubGlobal("MediaStream", FakeStream); vi.stubGlobal("AudioContext", FakeAudio);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: fixture.devices });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => fixture.context as any);
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", { configurable: true, value: fixture.canvas.captureStream });
  URL.createObjectURL = vi.fn(() => "blob:local-recording"); URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function() { clicked.push(this.getAttribute("href") ?? ""); });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("initiate") ? { uploadId: "offline" } : url.includes("finalize") ? { key: "org-11/lms-media/test.webm", url: "/stored.webm", fileName: "recording.webm", fileSize: 16, fileType: "video/webm" } : {} })));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function Probe({ persist }: { persist: (result: any) => Promise<void> }) {
  const queue = useUploadQueue(); const [id, setId] = useState("");
  return <><button onClick={() => setId(queue.enqueue({ file: new File(["bytes"], "sample.webm", { type: "video/webm" }), orgId: 11, onComplete: persist }))}>Enqueue</button><button onClick={() => queue.retry(id)}>Retry</button><output>{queue.items.map(item => `${item.status}:${item.progress}`).join(",")}</output></>;
}
describe("actual React queue persistence contract", () => {
  it("cannot report done before awaited metadata persistence", async () => {
    let finish: any; const persist = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const view = render(<UploadQueueProvider><Probe persist={persist} /></UploadQueueProvider>); fireEvent.click(view.getByText("Enqueue"));
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1)); expect(view.container.textContent).toContain("saving:95"); expect(view.container.textContent).not.toContain("done:100");
    await act(async () => finish()); await waitFor(() => expect(view.container.textContent).toContain("done:100"));
  });
  it("metadata retry reuses finalized object and only reports done after success", async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error("save denied")).mockResolvedValueOnce(undefined);
    const view = render(<UploadQueueProvider><Probe persist={persist} /></UploadQueueProvider>); fireEvent.click(view.getByText("Enqueue"));
    await waitFor(() => expect(view.container.textContent).toContain("error:95")); const uploads = (fetch as any).mock.calls.length;
    fireEvent.click(view.getByText("Retry")); await waitFor(() => expect(view.container.textContent).toContain("done:100"));
    expect((fetch as any).mock.calls.length).toBe(uploads); expect(persist).toHaveBeenCalledTimes(2);
  });
});
describe("actual RecordEdit handlers and list integration", () => {
  it("capture never mounts while persisted capability is loading or school hint mismatches", () => {
    state.capabilityLoading = true;
    const view = render(<UploadQueueProvider><RecordEditPage /></UploadQueueProvider>); expect(view.getByRole("status").textContent).toContain("Checking selected-school"); expect(fixture.devices.getUserMedia).not.toHaveBeenCalled();
    state.capabilityLoading = false; state.capability = { orgId: 22, isActive: true, platformSupport: true };
    view.rerender(<UploadQueueProvider><RecordEditPage /></UploadQueueProvider>); expect(view.getByText("Builder Plan Required")).toBeTruthy(); expect(fixture.devices.getUserMedia).not.toHaveBeenCalled();
  });
  it("video capture stays active through tab visibility and Studio tab change, with live mute and autosave", async () => {
    vi.useFakeTimers(); const view = render(<UploadQueueProvider><RecordEditPage /></UploadQueueProvider>);
    const start = view.container.querySelector('button.h-14.w-14')!; fireEvent.click(start);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(FakeRecorder.instances[0].state).toBe("recording");
    fireEvent.click(view.getByTitle("Mute microphone")); expect(fixture.mic.getAudioTracks()[0].enabled).toBe(false);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); fireEvent(document, new Event("visibilitychange"));
    fireEvent.click(view.getByRole("button", { name: "Upload Video" })); expect(FakeRecorder.instances[0].state).toBe("recording");
    await act(async () => FakeRecorder.instances[0].stop()); await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(state.saved).toHaveBeenCalledTimes(1); expect(state.saved.mock.calls[0][0]).toMatchObject({ orgId: 11, source: "direct", tags: ["recording"] });
  });
  it("audio handler autosaves without pressing manual save and retains paused duration", async () => {
    vi.useFakeTimers(); const view = render(<UploadQueueProvider><RecordEditPage /></UploadQueueProvider>); fireEvent.click(view.getByRole("button", { name: "Audio" }));
    const audioSection = view.getByText("Record your microphone directly to the Media Library").closest('div.flex-1')!;
    fireEvent.click(audioSection.querySelector('button.h-14.w-14')!);
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    const recorder = FakeRecorder.instances[0]; expect(recorder.stream.getVideoTracks()).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); recorder.stop(); await Promise.resolve(); });
    expect(state.saved).toHaveBeenCalledTimes(1); expect(state.saved.mock.calls[0][0].mimeType).toBe("audio/mp4"); expect(state.saved.mock.calls[0][0].tags).toContain("audio");
  });
  it("actual editor literal replacement, filler cleanup and undo feed persisted envelope and actual export output", async () => {
    const words = ["a[", "you", "know,", "end"].map((word, id) => ({ id, word, start: id, end: id + .8 }));
    state.media = [{ id: 9, url: "/original.webm", filename: "old.webm", mimeType: "video/webm", fileSize: 16, durationSeconds: 4, transcriptJson: JSON.stringify({ words, segments: [], language: "es", historical: true }) }];
    state.clips = [{ id: 7, label: "Saved clip", startSec: 0, endSec: 2 }];
    const view = render(<UploadQueueProvider><RecordEditPage /></UploadQueueProvider>); fireEvent.click(view.getByRole("button", { name: "Edit Video" })); fireEvent.click(view.getByText("old.webm"));
    fireEvent.click(view.getByRole("button", { name: "CC Style" })); fireEvent.click(view.getByRole("button", { name: /Fire/ }));
    fireEvent.click(view.getByRole("button", { name: "Find" })); fireEvent.change(view.getByPlaceholderText("Find word..."), { target: { value: "a[" } }); fireEvent.change(view.getByPlaceholderText("Replace with..."), { target: { value: "$&" } });
    fireEvent.click(view.getAllByRole("button", { name: "Find" }).at(-1)!); fireEvent.click(view.getByRole("button", { name: "Replace All" }));
    expect(view.getByRole("button", { name: "$&" })).toBeTruthy(); fireEvent.click(view.getByRole("button", { name: "Undo" })); expect(view.getByRole("button", { name: "a[" })).toBeTruthy(); fireEvent.click(view.getByRole("button", { name: "Redo" }));
    fireEvent.click(view.getByRole("button", { name: /Clean Fillers/ })); fireEvent.click(view.getByRole("button", { name: "Download Full Video" }));
    await waitFor(() => expect(state.render).toHaveBeenCalledWith({ mediaItemId: 9, burnCaptions: true })); expect(clicked).toContain("/actual-render.mp4"); expect(clicked).not.toContain("/original.webm");
    const envelope = JSON.parse(state.update.mock.calls[0][0].transcriptJson); expect(envelope.historical).toBe(true); expect(envelope.language).toBe("es"); expect(envelope.words[1].deleted).toBe(true); expect(envelope.words[2].deleted).toBe(true);
    expect(envelope.studioEdit.presetId).toBe("fire"); expect(envelope.studioEdit.captionStyle.fontFamily).toBe("Arial");
    fireEvent.click(view.getByTitle("Download clip")); await waitFor(() => expect(state.render).toHaveBeenCalledWith({ mediaItemId: 9, startSec: 0, endSec: 2, burnCaptions: true }));
    fireEvent.click(view.getByRole("button", { name: /Saved clip/ }));
    const video = view.container.querySelector('video[src="/original.webm"]')! as HTMLVideoElement; video.currentTime = 3; fireEvent.timeUpdate(video); expect(video.currentTime).toBe(2); expect(video.pause).toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Download Original" })); expect(clicked).toContain("/original.webm");
    fireEvent.click(view.getByRole("button", { name: "SRT (edited timing)" })); expect(URL.createObjectURL).toHaveBeenCalled();
  });
  it.each(["array", "envelope"])("actual Files page displays all rows from %s list with preserved type filters", shape => {
    const rows = Array.from({ length: 205 }, (_, id) => ({ id, filename: `record-${id}.webm`, mimeType: "video/webm", fileSize: 5, createdAt: new Date(), url: `/media-${id}` }));
    state.media = shape === "array" ? rows : { items: rows };
    const view = render(<FilesPage />); expect(view.getByText("record-204.webm")).toBeTruthy(); expect(state.queryInput).toEqual({ orgId: 11 });
    for (const label of ["All", "SCORM", "HTML", "Images", "Video", "Audio", "Documents", "ZIP"]) expect(view.getByRole("button", { name: label })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Video" })); expect(view.getByText("record-204.webm")).toBeTruthy();
  });
  it("actual authorized server list response renders a saved recording without app-gating ordinary library browse", async () => {
    state.media = [{ id: 41, orgId: 11, filename: "server-saved.webm", mimeType: "video/webm", fileSize: 16, url: "/saved", fileKey: "historical-key", createdAt: new Date() }];
    const source = fs.readFileSync("server/lmsRouter.ts", "utf8");
    const tree = ts.createSourceFile("lmsRouter.ts", source, ts.ScriptTarget.Latest, true);
    let callback = "";
    const visit = (node: any) => {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === "listOrgMedia") {
        const query = node.initializer;
        if (ts.isCallExpression(query) && ts.isPropertyAccessExpression(query.expression) && query.expression.name.text === "query") callback = query.arguments[0].getText(tree);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree); expect(callback).toBeTruthy();
    const code = ts.transpileModule(`const actualList = ${callback}; actualList;`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const authority = vi.fn(async () => 11);
    const fixtureDb = { select: () => ({ from: () => ({ where: async () => state.media }) }) };
    const actualList = vm.runInNewContext(code, {
      requireActiveLegacyMediaOrg: authority, requireLegacyMediaFolderInActiveOrg: vi.fn(async () => {}),
      require: (name: string) => name === "./db" ? { getDb: async () => fixtureDb } : name.includes("schema") ? { orgMediaLibrary: { orgId: "orgId", folderId: "folderId" } } : { eq: vi.fn(), and: vi.fn() },
    });
    const result = await actualList({ ctx: { user: { id: 1 } }, input: { orgId: 11 } });
    expect(authority).toHaveBeenCalledWith(expect.anything(), 11);
    state.media = result; const view = render(<FilesPage />); expect(view.getByText("server-saved.webm")).toBeTruthy(); expect(result[0].fileKey).toBe("historical-key");
  });
  it("Files query error displays retry rather than misleading no-content success", () => {
    state.denied = new Error("persisted school denied"); const view = render(<FilesPage />); expect(view.getByRole("alert").textContent).toContain("persisted school denied"); expect(view.container.textContent).not.toContain("No content yet");
  });
});
