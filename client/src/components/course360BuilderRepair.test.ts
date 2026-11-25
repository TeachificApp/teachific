// @vitest-environment jsdom
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { builderRowsForOrg, cloneLessonBuilderBlocks, compareBuilderLibraryOrder, parseLessonBuilderBlocks } from "./lessonBuilderState";

// Extract the real named component from its owned source, not a reimplementation.
// This avoids importing unrelated admin/payment/media modules into the test runtime.
const source = readFileSync(process.env.COURSE360_BUILDER_BASELINE_SOURCE || "client/src/pages/lms/CourseBuilderPage.tsx", "utf8");
const ast = ts.createSourceFile("CourseBuilderPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "LessonEditorPage")!;
const compiled = ts.transpileModule(component.getText(ast).replace(/^export /, ""), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const Primitive = ({ children, ...props }: any) => React.createElement("div", { className: props.className }, children);
const Button = ({ children, size, variant, ...props }: any) => React.createElement("button", props, children);
const Input = (props: any) => React.createElement("input", props);
const Label = (props: any) => React.createElement("label", props);
const Switch = ({ checked, onCheckedChange, ...props }: any) => React.createElement("button", { ...props, role: "switch", type: "button", onClick: () => onCheckedChange(!checked), "aria-checked": checked }, "Toggle");
const Dialog = ({ open, children }: any) => open ? React.createElement("div", { role: "dialog" }, children) : null;
let fullLesson: any;
let mutation: ReturnType<typeof vi.fn>;
let contentDirtyCallback: ((dirty: boolean) => void) | undefined;
let editedBlocks: any[];
const fakeBlockEditor = React.forwardRef((props: any, ref: any) => {
  const [blocks, setBlocks] = useState(props.initialBlocks);
  const blocksRef = useRef(blocks); blocksRef.current = blocks;
  useImperativeHandle(ref, () => ({ getBlocks: () => blocksRef.current, markSaved: () => props.onDirtyChange(false), openAddBlock: () => {}, openSaveLessonTemplate: () => {} }));
  useEffect(() => { contentDirtyCallback = props.onDirtyChange; }, [props.onDirtyChange]);
  return React.createElement("button", { onClick: () => { editedBlocks = [{ id: "edited", type: "text", data: { html: "new blocks" } }]; setBlocks(editedBlocks); props.onDirtyChange(true); } }, "Edit test block");
});
const trpc: any = {
  lmsAdmin: {
    getLessonAdmin: { useQuery: () => ({ data: fullLesson, isLoading: !fullLesson, error: null, refetch: vi.fn() }) },
    getLessonsWithBlocks: { useQuery: () => ({ data: [] }) },
    getCourse: { useQuery: () => ({ data: { id: 5, slug: "sample", orgId: 7, sections: [] } }) },
    updateLesson: { useMutation: () => ({ isPending: false, mutateAsync: mutation, mutate: (payload: unknown, options: any) => { void mutation(payload).then(() => options?.onSuccess?.()).catch(() => {}); } }) },
  },
};
const iconNames = ["ArrowLeft", "Save", "X", "ChevronLeft", "ChevronRight", "Loader2", "CheckCircle", "Video", "Clock", "User", "Lock", "Sparkles", "Plus", "LayoutTemplate", "AlertTriangle"];
const imports: Record<string, any> = {
  React, useState, useEffect, useRef, trpc, parseLessonBuilderBlocks,
  toast: { success: vi.fn(), error: vi.fn() }, Button, Input, Label, Switch, Dialog,
  Select: Primitive, SelectTrigger: Primitive, SelectValue: Primitive, SelectContent: Primitive, SelectItem: Primitive,
  LessonEffectEditor: () => null, MediaPickerDialog: () => null, LessonBlockEditor: fakeBlockEditor,
  DialogContent: Primitive, DialogHeader: Primitive, DialogTitle: Primitive,
};
for (const name of iconNames) imports[name] = () => null;
const LessonEditorPage = new Function(...Object.keys(imports), `${compiled}\nreturn LessonEditorPage;`)(...Object.values(imports));
const lesson = { id: 1, courseId: 5, title: "Saved lesson", type: "text", content: "saved text", contentBlocks: "[]", lessonStatus: "published" };

const sheetSource = readFileSync("client/src/components/lms/LessonEditorSheet.tsx", "utf8");
const sheetAst = ts.createSourceFile("LessonEditorSheet.tsx", sheetSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const flashcardNode = sheetAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "FlashcardEditor")!;
const flashcardCompiled = ts.transpileModule(flashcardNode.getText(sheetAst), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const flashcardImports = { React, useState, useCallback, useEffect, Button, Label, Textarea: (props: any) => React.createElement("textarea", props), Plus: () => null, X: () => null };
const FlashcardEditor = new Function(...Object.keys(flashcardImports), `${flashcardCompiled}\nreturn FlashcardEditor;`)(...Object.values(flashcardImports));

beforeEach(() => { fullLesson = { ...lesson }; mutation = vi.fn().mockResolvedValue({ success: true }); editedBlocks = []; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function mount(extra: any = {}) {
  const props = { lesson, onClose: vi.fn(), onSaved: vi.fn(), onSavedAndClose: vi.fn(), ...extra };
  const view = render(React.createElement(LessonEditorPage, props));
  return { ...view, props };
}

// These are actual component events and mutation payloads; every service hook is mocked.
describe("Course360 builder repair actual lesson component", () => {
  it("keeps author title drafts when the full lesson refetches", () => {
    const view = mount();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Local draft" } });
    fullLesson = { ...lesson, title: "New server snapshot", content: "server changed" };
    view.rerender(React.createElement(LessonEditorPage, view.props));
    expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).value).toBe("Local draft");
  });
  it("does not replace hydrated text when a background full-record refetch arrives", async () => {
    const view = mount();
    fullLesson = { ...lesson, content: "background replacement" };
    view.rerender(React.createElement(LessonEditorPage, view.props));
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
    expect(mutation.mock.calls[0][0].content).toBe("saved text");
  });
  it("blocks save while a heavy full lesson is not loaded", () => {
    fullLesson = undefined; mount();
    const save = screen.getByRole("button", { name: "Save", exact: true });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(save); expect(mutation).not.toHaveBeenCalled();
  });
  it("keeps blocks mounted across tab changes and saves both settings and blocks", async () => {
    mount();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "Lesson Editor", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Edit test block" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
    expect(mutation.mock.calls[0][0]).toMatchObject({ id: 1, title: "Updated title", contentBlocks: JSON.stringify(editedBlocks) });
  });
  it("does not close or mark a failed save clean and allows retry", async () => {
    mutation.mockRejectedValueOnce(new Error("mock write failure"));
    const { props } = mount();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Keep on failure" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & Close", exact: true }));
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByRole("button", { name: "Save & Close", exact: true }) as HTMLButtonElement).disabled).toBe(false));
    expect(props.onSavedAndClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep Editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & Close", exact: true }));
    await waitFor(() => expect(props.onSavedAndClose).toHaveBeenCalledTimes(1));
    expect(mutation.mock.calls[1][0].title).toBe("Keep on failure");
  });
  it("does not clear content dirty state when only settings are changed", async () => {
    const { props } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Lesson Editor", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Edit test block" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    expect(screen.getByRole("dialog")).toBeTruthy(); expect(props.onClose).not.toHaveBeenCalled();
  });
  it("does not overwrite corrupted saved content with empty blocks", () => {
    fullLesson = { ...lesson, contentBlocks: "{broken" }; mount();
    expect((screen.getByRole("button", { name: "Save", exact: true }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Lesson Editor", exact: true }));
    expect(screen.getByRole("alert").textContent).toContain("existing content has not been changed");
    expect(mutation).not.toHaveBeenCalled();
  });
  it("protects the back-arrow close action when local settings are dirty", () => {
    const { props } = mount(); fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "unsaved" } });
    fireEvent.click(screen.getByRole("button", { name: "Close lesson editor" }));
    expect(screen.getByRole("dialog")).toBeTruthy(); expect(props.onClose).not.toHaveBeenCalled();
  });
  it("suppresses duplicate save clicks while a mutation is unresolved", async () => {
    let resolve: (() => void) | undefined; mutation.mockImplementation(() => new Promise<void>(done => { resolve = done; })); mount();
    const save = screen.getByRole("button", { name: "Save", exact: true }); fireEvent.click(save); fireEvent.click(save);
    expect(mutation).toHaveBeenCalledTimes(1); await act(async () => resolve?.());
  });
  it("restores full record settings on first hydration rather than shallow defaults", () => {
    fullLesson = { ...lesson, title: "Full record title", lessonStatus: "draft", durationMinutes: 14 };
    mount(); expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).value).toBe("Full record title");
    expect((screen.getAllByRole("spinbutton")[0] as HTMLInputElement).value).toBe("14");
    expect(screen.getByText("Hidden from learners — only admins can see this lesson.")).toBeTruthy();
  });
  it("honors cancel when navigating away from a content draft", () => {
    const onNavigateLesson = vi.fn(); vi.spyOn(window, "confirm").mockReturnValue(false);
    mount({ nextLesson: { id: 2, title: "Next lesson" }, onNavigateLesson });
    fireEvent.click(screen.getByRole("button", { name: "Lesson Editor", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Edit test block" }));
    fireEvent.click(screen.getByTitle("Next lesson →"));
    expect(window.confirm).toHaveBeenCalledTimes(1); expect(onNavigateLesson).not.toHaveBeenCalled();
  });
  it("marks discussion switch changes dirty for the existing close confirmation", () => {
    mount(); fireEvent.click(document.getElementById("edit-comments-enabled")!);
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("Course360 builder content and tenant rules", () => {
  it("sorts saved positive positions ahead of unset positions without modifying data", () => {
    const items = [{ libraryOrder: 0 }, { libraryOrder: 2 }, { libraryOrder: null }, { libraryOrder: 1 }];
    expect([...items].sort(compareBuilderLibraryOrder).map(row => row.libraryOrder)).toEqual([1, 2, 0, null]);
    expect(items[0].libraryOrder).toBe(0);
  });
  it("filters picker rows to exactly the active school, rejecting missing ownership", () => {
    const rows = [{ id: 1, orgId: 7 }, { id: 2, orgId: 8 }, { id: 3, orgId: null }, { id: 4 }];
    expect(builderRowsForOrg(rows, 7).map(row => row.id)).toEqual([1]);
    expect(builderRowsForOrg(rows, null)).toEqual([]);
  });
  it("clones nested column block identifiers, retaining quiz IDs and all content", () => {
    const original: any[] = [{ id: "column", type: "column_layout", data: { leftBlocks: [{ id: "child", type: "lesson_quiz", data: { questions: [{ id: "question-keep", question: "Existing content" }] } }], rightBlocks: [], settings: "keep" } }];
    let id = 0; const copies = cloneLessonBuilderBlocks(original, () => `fresh-${++id}`);
    expect(copies[0].id).toBe("fresh-1"); expect(copies[0].data.leftBlocks[0].id).toBe("fresh-2");
    expect(copies[0].data.leftBlocks[0].data.questions[0].id).toBe("question-keep");
    copies[0].data.leftBlocks[0].data.questions[0].question = "Changed copy";
    expect(original[0].data.leftBlocks[0].data.questions[0].question).toBe("Existing content");
  });
  it.each(["{bad", "null", "{}", '[{"id":"x"}]'])("blocks malformed saved block data %s", raw => {
    expect(parseLessonBuilderBlocks(raw).error).toBeTruthy();
  });
  it("permits intentionally empty and valid existing lessons", () => {
    expect(parseLessonBuilderBlocks(null)).toEqual({ blocks: [], error: null });
    expect(parseLessonBuilderBlocks("[]")).toEqual({ blocks: [], error: null });
    expect(parseLessonBuilderBlocks(JSON.stringify([{ id: "old", type: "text", data: { html: "keep" } }])).blocks[0].data.html).toBe("keep");
  });
});

describe("Course360 simple lesson flashcard hydration", () => {
  it("loads cards when the parent lesson hydrates after the first empty render", () => {
    const onChange = vi.fn(); const view = render(React.createElement(FlashcardEditor, { value: "[]", onChange }));
    view.rerender(React.createElement(FlashcardEditor, { value: JSON.stringify([{ front: "Existing front", back: "Existing back" }]), onChange }));
    expect((screen.getAllByRole("textbox")[0] as HTMLTextAreaElement).value).toBe("Existing front");
    expect((screen.getAllByRole("textbox")[1] as HTMLTextAreaElement).value).toBe("Existing back");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("edits cards without mutating unrelated stored card content", () => {
    const onChange = vi.fn(); const cards = [{ front: "First", back: "Keep first" }, { front: "Second", back: "Keep second" }];
    render(React.createElement(FlashcardEditor, { value: JSON.stringify(cards), onChange }));
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Author edit" } });
    expect(JSON.parse(onChange.mock.calls[0][0])).toEqual([{ front: "Author edit", back: "Keep first" }, cards[1]]);
    expect(cards[0].front).toBe("First");
  });
});
