import { describe, expect, it } from "vitest";
import {
  isInteractiveMediaPackage,
  parseMediaRepoSlug,
  resolveLessonMediaScormUrl,
} from "../shared/mediaRepoDisplay";

describe("Course360 SCORM lesson display resolver", () => {
  it("identifies SCORM, .quiz, and ZIP packages as interactive media", () => {
    expect(isInteractiveMediaPackage("scorm", "lesson.pdf")).toBe(true);
    expect(isInteractiveMediaPackage("document", "assessment.quiz")).toBe(true);
    expect(isInteractiveMediaPackage("document", "lesson.zip")).toBe(true);
    expect(isInteractiveMediaPackage("document", "handout.pdf")).toBe(false);
  });

  it("converts media-repository embed lessons to protected SCORM playback", () => {
    expect(resolveLessonMediaScormUrl({
      type: "embed",
      embedUrl: "/api/media/scorm%20package/embed",
    }, null)).toBe("/api/media/scorm%20package/scorm/");
    expect(parseMediaRepoSlug("https://academy.example.test/api/media/scorm%20package/download?version=1")).toBe("scorm package");
  });

  it("uses media metadata for legacy download lessons while keeping plain documents as downloads", () => {
    expect(resolveLessonMediaScormUrl({
      type: "download",
      content: "/api/media/quiz-one/download",
    }, {
      slug: "quiz-one",
      mediaType: "zip",
      fileName: "quiz-one.quiz",
    })).toBe("/api/media/quiz-one/scorm/");
    expect(resolveLessonMediaScormUrl({
      type: "download",
      content: "/api/media/handout/download",
    }, {
      slug: "handout",
      mediaType: "document",
      fileName: "handout.pdf",
    })).toBeNull();
  });
});
