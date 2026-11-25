// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { getCourse360MediaLibraryHref } from "../client/src/lib/course360MediaLibrary";

const state = vi.hoisted(() => ({
  studioQueries: 0,
  studioActive: true,
  creatorExport: vi.fn(),
  quizExport: vi.fn(),
  updateSlide: vi.fn(async () => undefined),
  cloudId: 9 as number | undefined,
  creatorSuccess: null as null | ((data: any) => void),
  quizSuccess: null as null | ((data: any) => void),
  success: vi.fn(),
  slides: [{ id: 1, title: "Retained slide", slideIndex: 0, contentJson: '{"blocks":[]}', background: "#0f172a" }],
}));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ useQuery: () => ({ data, isLoading: false }) });
  const mutation = () => ({ useMutation: () => ({ mutate: vi.fn(), mutateAsync: state.updateSlide, isPending: false }) });
  return { trpc: {
    billing: { getStudioSubscription: { useQuery: () => { state.studioQueries++; return { data: { tier: "desktop", isActive: state.studioActive, isPaid: true }, isLoading: false }; } } },
    auth: { logout: mutation() },
    authoring: {
      getProject: query({ id: 7, title: "Retained course", orgId: 11 }), listSlides: query(state.slides),
      addSlide: mutation(), deleteSlide: mutation(), updateSlide: mutation(), updateProject: mutation(),
      exportPackage: { useMutation: (options: any) => { state.creatorSuccess = options.onSuccess; return { mutate: state.creatorExport }; } },
    },
    quizMaker: {
      getPublishStatus: query({ isPublished: false }),
      exportScorm: { useMutation: (options: any) => { state.quizSuccess = options.onSuccess; return { mutate: state.quizExport, isPending: false }; } },
    },
    useUtils: () => ({ authoring: { listSlides: { invalidate: vi.fn() }, getProject: { invalidate: vi.fn() } } }),
  } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 3, name: "Org author", role: "user" }, loading: false }) }));
vi.mock("@/components/ProductSwitcher", () => ({ ProductSwitcher: () => null }));
vi.mock("wouter", () => ({
  Link: ({ href, children }: any) => React.createElement("a", { href }, children),
  useParams: () => ({ projectId: "7" }), useLocation: () => ["/creator/7", vi.fn()],
}));
vi.mock("sonner", () => ({ toast: { success: state.success, error: vi.fn() } }));
vi.mock("../client/src/pages/FilesPage", () => ({ default: () => React.createElement("div", null, "Existing org files") }));
vi.mock("../client/src/pages/QuizzesPage", () => ({ default: () => React.createElement("div", null, "Existing school quizzes") }));
vi.mock("../client/src/pages/FlashcardsPage", () => ({ default: () => React.createElement("div", null, "Existing flashcards") }));
vi.mock("../client/src/pages/RecordEditPage", () => ({ default: () => React.createElement("div", null, "Existing Studio recorder") }));
vi.mock("@/quiz-creator/store/quizStore", () => ({ useQuizStore: () => ({ quiz: { meta: { cloudId: state.cloudId, branchingEnabled: false }, questions: [] } }) }));
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
  state.studioQueries = 0; state.studioActive = true; state.cloudId = 9;
  state.creatorExport.mockClear(); state.quizExport.mockClear(); state.updateSlide.mockClear(); state.success.mockClear();
  window.history.replaceState({}, "", "/media-library");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in media UI tests"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
    expect(state.updateSlide).toHaveBeenCalled();
  });
  it("Creator sends the explicit optional library save without client-selected org ownership", async () => {
    const view = render(React.createElement(CreatorEditorPage));
    fireEvent.click(view.getByRole("button", { name: "Export" }));
    fireEvent.click(view.getByRole("checkbox"));
    fireEvent.click(view.getByRole("button", { name: "Export Package" }));
    await waitFor(() => expect(state.creatorExport).toHaveBeenCalledWith({ projectId: 7, format: "scorm12", saveToMediaLibrary: true }));
  });
  it("retains Quiz Creator download export and offers both library-save formats", () => {
    const view = render(React.createElement(QuizCreatorPage));
    fireEvent.click(view.getByRole("button", { name: "Export SCORM" }));
    fireEvent.click(view.getByRole("button", { name: "SCORM 1.2 Package" }));
    expect(state.quizExport).toHaveBeenLastCalledWith({ quizId: 9, format: "scorm12", saveToMediaLibrary: false });
    fireEvent.click(view.getByRole("button", { name: "SCORM 1.2 + Library" }));
    expect(state.quizExport).toHaveBeenLastCalledWith({ quizId: 9, format: "scorm12", saveToMediaLibrary: true });
    fireEvent.click(view.getByRole("button", { name: "SCORM 2004 + Library" }));
    expect(state.quizExport).toHaveBeenLastCalledWith({ quizId: 9, format: "scorm2004", saveToMediaLibrary: true });
  });
  it("does not send a save for an unsaved quiz", () => {
    state.cloudId = undefined;
    const view = render(React.createElement(QuizCreatorPage));
    fireEvent.click(view.getByRole("button", { name: "Export SCORM" }));
    fireEvent.click(view.getByRole("button", { name: "SCORM 1.2 + Library" }));
    expect(state.quizExport).not.toHaveBeenCalled();
  });
});
