// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { parseCourse360MediaTags } from "../client/src/lib/course360MediaLibrary";

const state = vi.hoisted(() => ({ data: undefined as any, list: vi.fn(), update: vi.fn(), remove: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { forms: { media: {
  list: { useQuery: (input: any, options: any) => { state.list(input, options); return { data: state.data, refetch: vi.fn() }; } },
  upload: { useMutation: () => ({ mutate: state.upload }) },
  updateTags: { useMutation: () => ({ mutate: state.update }) },
  delete: { useMutation: () => ({ mutate: state.remove }) },
} } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { MediaLibraryPicker } from "../client/src/components/MediaLibraryPicker";

const row = (tags: unknown) => ({ id: 4, url: "https://assets.example.test/retained.png", filename: "Retained image.png", mimeType: "image/png", tags, fileSize: 512, createdAt: new Date("2026-01-01T00:00:00Z") });
function openPicker(onSelect = vi.fn()) {
  const view = render(React.createElement(MediaLibraryPicker, { orgId: 7, onSelect }));
  fireEvent.click(view.getByRole("button", { name: "Media Library" }));
  return view;
}
beforeEach(() => {
  vi.clearAllMocks(); state.data = undefined;
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in media picker tests"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Stored media tag compatibility", () => {
  it.each([
    ['["lesson","retained"]', ["lesson", "retained"]],
    [["lesson", "retained"], ["lesson", "retained"]],
    [null, []], [undefined, []], ["malformed JSON", []], ['{"tag":"not an array"}', []],
    ['[null,2,true,"valid"]', ["valid"]],
  ])("normalizes %j without modifying storage", (input, expected) => {
    expect(parseCourse360MediaTags(input)).toEqual(expected);
  });
});
describe("Retained media picker", () => {
  it("renders the actual paginated response and selects the retained asset with normalized tags", () => {
    const source = row('["lesson"]'); state.data = { items: [source], total: 1 };
    const onSelect = vi.fn(); const view = openPicker(onSelect);
    expect(view.getByText("Retained image.png")).toBeTruthy();
    expect(state.list).toHaveBeenLastCalledWith({ orgId: 7 }, { enabled: true });
    fireEvent.click(view.getByText("Retained image.png"));
    fireEvent.click(view.getByRole("button", { name: "Insert Selected" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 4, tags: ["lesson"], url: source.url }));
    expect(source.tags).toBe('["lesson"]');
    expect(state.list).toHaveBeenLastCalledWith({ orgId: 7 }, { enabled: false });
  });
  it("continues to render legacy array responses and array tags", () => {
    state.data = [row(["legacy"])]; const view = openPicker();
    expect(view.getByText("Retained image.png")).toBeTruthy();
    expect(view.getAllByText("legacy").length).toBeGreaterThan(0);
  });
  it("does not crash or lose an existing asset when its stored tags are malformed", () => {
    const source = row("historic unparsed tag"); state.data = { items: [source], total: 1 };
    const view = openPicker(); expect(view.getByText("Retained image.png")).toBeTruthy();
    expect(source.tags).toBe("historic unparsed tag");
    expect(state.update).not.toHaveBeenCalled(); expect(state.remove).not.toHaveBeenCalled();
  });
  it("retains search and normalized tag edits", () => {
    state.data = { items: [row('["retained"]')], total: 1 }; const view = openPicker();
    fireEvent.change(view.getByPlaceholderText("+ tag"), { target: { value: "new" } });
    fireEvent.keyDown(view.getByPlaceholderText("+ tag"), { key: "Enter" });
    expect(state.update).toHaveBeenCalledWith({ id: 4, tags: ["retained", "new"] });
    fireEvent.change(view.getByPlaceholderText("Search files..."), { target: { value: "absent" } });
    expect(view.queryByText("Retained image.png")).toBeNull();
    expect(state.remove).not.toHaveBeenCalled();
  });
  it("renders empty and unresolved list results safely", () => {
    const view = openPicker(); expect(view.getByText("No files yet. Upload your first file above.")).toBeTruthy();
    expect(state.upload).not.toHaveBeenCalled();
  });
});
