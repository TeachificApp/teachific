// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { getCourse360MediaLibraryHref } from "../client/src/lib/course360MediaLibrary";

const state = vi.hoisted(() => ({
  studioQueries: 0, studioActive: true,
  creatorExport: vi.fn(), quizExport: vi.fn(), updateSlide: vi.fn(),
  saveQuiz: vi.fn(), markSaved: vi.fn(), invalidateQuizzes: vi.fn(), setSlides: vi.fn(),
  preview: vi.fn(), error: vi.fn(), success: vi.fn(),
  quizStore: null as any,
  creatorSuccess: null as null | ((data: any) => void),
  quizSuccess: null as null | ((data: any) => void),
  slides: [{ id: 1, title: "Retained slide", slideIndex: 0, contentJson: '{"blocks":[]}', background: "#0f172a" }],
}));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ useQuery: () => ({ data, isLoading: false }) });
  const mutation = () => ({ useMutation: () => ({ mutate: vi.fn(), mutateAsync: state.updateSlide, isPending: false }) });
  const exchange = () => ({ useMutation: () => ({ mutateAsync: vi.fn(async () => { throw new Error("Unexpected AI/PPTX operation in retained media tests"); }), isPending: false }) });
  return { trpc: {
    forms: { media: { list: query({ items: [], total: 0 }) } },
    billing: { getStudioSubscription: { useQuery: () => { state.studioQueries++; return { data: { tier: "desktop", isActive: state.studioActive, isPaid: true, platformSupport: false }, isLoading: false }; } } },
    auth: { logout: mutation() },
    authoring: {
      getProject: query({ id: 7, title: "Retained course", orgId: 11, settingsJson: "{}" }),
      listSlides: { useQuery: () => ({ data: state.slides, isLoading: false }) },
      previewPackage: { useQuery: () => ({ refetch: state.preview }) },
      addSlide: mutation(), deleteSlide: mutation(), updateSlide: mutation(), updateProject: mutation(),
      generateAiDraft: exchange(), importPptxDraft: exchange(), previewExchangeDraft: exchange(), applyExchangeDraft: exchange(), exportPptx: exchange(),
      exportPackage: { useMutation: (options: any) => { state.creatorSuccess = options.onSuccess; return { mutate: state.creatorExport, mutateAsync: state.creatorExport, isPending: false }; } },
    },
    quizMaker: {
      getPublishStatus: query({ isPublished: false }),
      saveQuiz: { useMutation: () => ({ mutateAsync: state.saveQuiz, isPending: false }) },
      exportScorm: { useMutation: (options: any) => { state.quizSuccess = options.onSuccess; return { mutate: state.quizExport, isPending: false }; } },
    },
    useUtils: () => ({
      authoring: { listSlides: { invalidate: vi.fn(), setData: state.setSlides }, getProject: { invalidate: vi.fn() } },
      quizMaker: { listQuizzes: { invalidate: state.invalidateQuizzes } },
    }),
  } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 3, name: "Org author", role: "user" }, loading: false }) }));
vi.mock("@/hooks/useOrgScope", () => ({ useOrgScope: () => ({ orgId: 11 }) }));
vi.mock("@/components/ProductSwitcher", () => ({ ProductSwitcher: () => null }));
vi.mock("@/components/creator/CreatorOwnedImageControls", () => ({ CreatorOwnedImageControls: () => null }));
vi.mock("@/components/creator/CreatorSchoolPublishControls", () => ({ CreatorSchoolPublishControls: () => null }));
vi.mock("wouter", () => ({
  Link: ({ href, children }: any) => React.createElement("a", { href }, children),
  useParams: () => ({ projectId: "7" }), useLocation: () => ["/creator/7", vi.fn()],
}));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("../client/src/pages/FilesPage", () => ({ default: () => React.createElement("div", null, "Existing org files") }));
vi.mock("../client/src/pages/QuizzesPage", () => ({ default: () => React.createElement("div", null, "Existing school quizzes") }));
vi.mock("../client/src/pages/FlashcardsPage", () => ({ default: () => React.createElement("div", null, "Existing flashcards") }));
vi.mock("../client/src/pages/RecordEditPage", () => ({ default: () => React.createElement("div", null, "Existing Studio recorder") }));
// Boundary-only store: the production useQuizCurrentCloudSave hook remains actual.
vi.mock("@/quiz-creator/store/quizStore", () => {
  const useQuizStore = Object.assign(() => state.quizStore, {
    getState: () => state.quizStore,
    setState: (patch: any) => { state.quizStore = { ...state.quizStore, ...patch }; },
  });
  return { useQuizStore };
});
vi.mock("@/quiz-creator/components/QuizDraftRecoveryRuntime", () => ({ QuizDraftRecoveryRuntime: () => null }));
vi.mock("@/quiz-creator/components/EditorToolbar", () => ({ EditorToolbar: () => React.createElement("div", null, "Retained Quiz toolbar") }));
vi.mock("@/quiz-creator/components/QuestionList", () => ({ QuestionList: () => null }));
vi.mock("@/quiz-creator/components/QuestionEditor", () => ({ QuestionEditor: () => null }));
vi.mock("@/quiz-creator/components/QuizSettings", () => ({ QuizSettings: () => null }));
vi.mock("@/quiz-creator/components/LicenseManager", () => ({ LicenseManager: () => null }));
vi.mock("@/quiz-creator/components/QuizPreview", () => ({ QuizPreview: () => null }));
vi.mock("@/quiz-creator/components/CloudQuizBrowser", () => ({ CloudQuizBrowser: () => null }));
vi.mock("@/quiz-creator/components/ShareDialog", () => ({ ShareDialog: () => null }));
vi.mock("@/quiz-creator/components/BrandingPanel", () => ({ default: () => null }));
vi.mock("@/quiz-creator/components/QuizAnalyticsPanel", () => ({ default: () => null }));
vi.mock("@/quiz-creator/components/BranchingFlowVisualizer", () => ({ BranchingFlowVisualizer: () => null }));
import MediaLibraryPage from "../client/src/pages/MediaLibraryPage";
import StudioDashboard from "../client/src/pages/StudioDashboard";
import CreatorEditorPage from "../client/src/pages/CreatorEditorPage";
import QuizCreatorPage from "../client/src/pages/QuizCreatorPage";

beforeEach(() => {
  vi.clearAllMocks();
  state.studioQueries = 0; state.studioActive = true;
  state.slides = [{ id: 1, title: "Retained slide", slideIndex: 0, contentJson: '{"blocks":[]}', background: "#0f172a" }];
  state.quizStore = {
    quiz: { meta: { id: "retained-native-id", title: "Current edited quiz", description: "Keep metadata", cloudId: 9, nativeRevision: 4, branchingEnabled: false, futureMeta: { preserved: true } }, questions: [{ id: "q-current", type: "tf", stem: "Current edit", points: 0.25, data: { correct: true } }] },
    isDirty: true, markSaved: state.markSaved,
  };
  state.saveQuiz.mockResolvedValue({ id: 9, revision: 5 });
  state.updateSlide.mockResolvedValue(undefined); state.creatorExport.mockResolvedValue(undefined);
  state.invalidateQuizzes.mockResolvedValue(undefined);
  state.setSlides.mockImplementation((_input: any, update: any) => { state.slides = update(state.slides); });
  state.preview.mockResolvedValue({ data: { html: "<html>Actual preview boundary</html>", warnings: [] } });
  window.history.replaceState({}, "", "/media-library");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in media UI tests"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function quizExportMenu() {
  const view = render(React.createElement(QuizCreatorPage));
  fireEvent.click(view.getByRole("button", { name: "Export SCORM" }));
  return view;
}

describe("Main Course360 account owns the library", () => {
  it.each(["course360.app", "www.course360.app", "localhost", "127.0.0.1", "preview.manus.space", "3000-preview.manus.computer"])("retains main/preview navigation on %s", (host) => {
    expect(getCourse360MediaLibraryHref("library", host)).toBe("/media-library#library");
  });
  it.each(["sona.course360.app", "school.example.com", "course360.app.attacker.com"])("centralizes %s without an org-selection query", (host) => {
    expect(getCourse360MediaLibraryHref("quizzes", host)).toBe("https://course360.app/media-library#quizzes");
  });
  it("renders the existing organization library without querying Studio entitlement", () => {
    state.studioActive = false;
    const view = render(React.createElement(MediaLibraryPage));
    expect(view.container.textContent).toContain("Included with your main Course360 account");
    expect(view.container.textContent).toContain("Existing org files");
    expect(state.studioQueries).toBe(0);
    for (const label of ["Content Library", "Course360 Studio™", "Quizzes", "Flashcards"]) expect(view.getByRole("button", { name: label })).toBeTruthy();
  });
  it("preserves all retained tabs and old upload hash compatibility", () => {
    window.history.replaceState({}, "", "/media-library#upload");
    const view = render(React.createElement(MediaLibraryPage));
    expect(view.container.textContent).toContain("Existing org files");
    fireEvent.click(view.getByRole("button", { name: "Flashcards" }));
    expect(view.container.textContent).toContain("Existing flashcards");
    fireEvent.click(view.getByRole("button", { name: "Course360 Studio™" }));
    expect(view.container.textContent).toContain("Existing Studio recorder");
  });
  it("Studio no longer advertises independent library storage allowances", () => {
    const view = render(React.createElement(StudioDashboard));
    expect(view.container.textContent).toContain("main Course360 account");
    expect(view.container.textContent).not.toMatch(/50 GB storage|5 GB storage|Unlimited storage/);
    expect(view.container.textContent).toContain("Desktop app access");
  });
});

describe("Authoring exports can save to the main-account library", () => {
  it("preserves default Creator download-only export", async () => {
    const view = render(React.createElement(CreatorEditorPage));
    fireEvent.click(view.getByRole("button", { name: "Export" }));
    expect((view.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "Export Package" }));
    await waitFor(() => expect(state.creatorExport).toHaveBeenCalledWith({ projectId: 7, format: "scorm12", saveToMediaLibrary: false }));
    expect(state.updateSlide).toHaveBeenCalled(); expect(state.setSlides).toHaveBeenCalledWith({ projectId: 7 }, expect.any(Function));
    expect(state.updateSlide.mock.invocationCallOrder[0]).toBeLessThan(state.creatorExport.mock.invocationCallOrder[0]);
  });
  it("Creator sends the explicit optional library save without client-selected org ownership", async () => {
    const view = render(React.createElement(CreatorEditorPage));
    fireEvent.click(view.getByRole("button", { name: "Export" }));
    fireEvent.click(view.getByRole("checkbox"));
    fireEvent.click(view.getByRole("button", { name: "Export Package" }));
    await waitFor(() => expect(state.creatorExport).toHaveBeenCalledWith({ projectId: 7, format: "scorm12", saveToMediaLibrary: true }));
  });
  it("Creator current-slide persistence failure blocks library export and retains the source draft", async () => {
    state.updateSlide.mockRejectedValueOnce(new Error("Creator current save failed"));
    const original = structuredClone(state.slides), view = render(React.createElement(CreatorEditorPage));
    fireEvent.click(view.getByRole("button", { name: "Export" }));
    fireEvent.click(view.getByRole("checkbox"));
    fireEvent.click(view.getByRole("button", { name: "Export Package" }));
    await waitFor(() => expect(view.container.textContent).toContain("Creator current save failed"));
    expect(state.creatorExport).not.toHaveBeenCalled(); expect(state.setSlides).not.toHaveBeenCalled();
    expect(state.slides).toEqual(original); expect(view.container.textContent).toContain("Retained slide");
  });
  it("Creator preview waits for current save and renders the sandboxed preview without exporting", async () => {
    const view = render(React.createElement(CreatorEditorPage));
    fireEvent.click(view.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(view.getByTitle("Creator learner preview")).toBeTruthy());
    const frame = view.getByTitle("Creator learner preview");
    expect(frame.getAttribute("srcdoc")).toBe("<html>Actual preview boundary</html>");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-popups");
    expect(state.updateSlide.mock.invocationCallOrder[0]).toBeLessThan(state.preview.mock.invocationCallOrder[0]);
    expect(state.creatorExport).not.toHaveBeenCalled(); expect(state.studioQueries).toBe(0);
  });
  it("retains Quiz Creator download export and offers both library-save formats after saving current edits", async () => {
    const view = quizExportMenu();
    for (const [label, format, saveToMediaLibrary] of [["SCORM 1.2 Package", "scorm12", false], ["SCORM 1.2 + Library", "scorm12", true], ["SCORM 2004 + Library", "scorm2004", true]] as const) {
      fireEvent.click(view.getByRole("button", { name: label }));
      await waitFor(() => expect(state.quizExport).toHaveBeenLastCalledWith({ quizId: 9, format, saveToMediaLibrary }));
    }
    expect(state.saveQuiz).toHaveBeenCalledTimes(3); expect(state.markSaved).toHaveBeenCalledTimes(3);
    expect(JSON.parse(state.saveQuiz.mock.calls[0][0].questionsJson)).toEqual(state.quizStore.quiz.questions);
    expect(state.saveQuiz.mock.calls[0][0]).toMatchObject({ quizId: 9, expectedRevision: 4 });
  });
  it("does not send a save for an unsaved quiz", () => {
    state.quizStore.quiz.meta.cloudId = undefined;
    const view = quizExportMenu();
    fireEvent.click(view.getByRole("button", { name: "SCORM 1.2 + Library" }));
    expect(state.quizExport).not.toHaveBeenCalled(); expect(state.saveQuiz).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledWith("Save your quiz to cloud first before exporting.");
  });
  it("persistence failure blocks library export and retains current unsaved edits", async () => {
    const current = structuredClone(state.quizStore.quiz);
    state.saveQuiz.mockRejectedValueOnce(new Error("Current save failed"));
    const view = quizExportMenu();
    fireEvent.click(view.getByRole("button", { name: "SCORM 1.2 + Library" }));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith("Current save failed"));
    expect(state.quizExport).not.toHaveBeenCalled(); expect(state.markSaved).not.toHaveBeenCalled();
    expect(state.quizStore.quiz).toEqual(current); expect(state.quizStore.isDirty).toBe(true);
  });
  it("waits for actual current-save completion and uses the returned cloud ID before export", async () => {
    let finish!: (result: any) => void;
    state.saveQuiz.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const current = structuredClone(state.quizStore.quiz), view = quizExportMenu();
    fireEvent.click(view.getByRole("button", { name: "SCORM 2004 + Library" }));
    expect(state.saveQuiz).toHaveBeenCalledWith({ quizId: 9, title: current.meta.title, description: current.meta.description, questionsJson: JSON.stringify(current.questions), settingsJson: JSON.stringify(current.meta), expectedRevision: 4 });
    expect(state.quizExport).not.toHaveBeenCalled();
    finish({ id: 19, revision: 6 });
    await waitFor(() => expect(state.quizExport).toHaveBeenCalledWith({ quizId: 19, format: "scorm2004", saveToMediaLibrary: true }));
    expect(state.quizStore.quiz.meta).toEqual({ ...current.meta, cloudId: 19, nativeRevision: 6 });
    expect(state.quizStore.isDirty).toBe(false); expect(state.markSaved).toHaveBeenCalledWith("Current edited quiz (cloud)");
    expect(state.invalidateQuizzes.mock.invocationCallOrder[0]).toBeLessThan(state.quizExport.mock.invocationCallOrder[0]);
  });
  it("intervening edits remain dirty and block a stale library export", async () => {
    let finish!: (result: any) => void;
    state.saveQuiz.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = quizExportMenu();
    fireEvent.click(view.getByRole("button", { name: "SCORM 1.2 + Library" }));
    state.quizStore.quiz.questions[0].stem = "Newer retained edit";
    finish({ id: 9, revision: 5 });
    await waitFor(() => expect(state.error).toHaveBeenCalledWith(expect.stringContaining("New edits were made while saving")));
    expect(state.quizExport).not.toHaveBeenCalled(); expect(state.markSaved).not.toHaveBeenCalled();
    expect(state.quizStore.quiz.questions[0].stem).toBe("Newer retained edit"); expect(state.quizStore.isDirty).toBe(true);
  });
});
