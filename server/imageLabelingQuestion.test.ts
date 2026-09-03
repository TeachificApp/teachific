import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gradeImageLabelingAnswer, isCompleteImageLabelingAnswer } from "../shared/imageLabeling";
import { validateImageLabelingQuestions } from "./lib/imageLabelingQuestion";

const targets = [
  { id: "target-heart", labelId: "label-heart" },
  { id: "target-lung", labelId: "label-lung" },
];

describe("Course360 image-labeling question grading", () => {
  it("requires a learner response for every configured image target", () => {
    expect(isCompleteImageLabelingAnswer(targets, { "target-heart": "label-heart" })).toBe(false);
    expect(gradeImageLabelingAnswer(targets, { "target-heart": "label-heart" })).toBe(false);
  });

  it("awards credit only for the exact configured target-to-label assignments", () => {
    expect(gradeImageLabelingAnswer(targets, {
      "target-heart": "label-heart",
      "target-lung": "label-lung",
    })).toBe(true);
    expect(gradeImageLabelingAnswer(targets, {
      "target-heart": "label-lung",
      "target-lung": "label-heart",
    })).toBe(false);
  });

  it("allows an incomplete author draft but requires a complete unique mapping before publication", () => {
    const draft = JSON.stringify([{
      id: "image-labeling-question",
      type: "image_labeling",
      image: null,
      data: {
        labels: [{ id: "label-heart", text: "Heart" }, { id: "label-lung", text: "Lung" }],
        targets: [{ id: "target-heart", x: 40, y: 50, labelId: "" }],
      },
    }]);
    expect(validateImageLabelingQuestions(draft)).toBeNull();
    expect(validateImageLabelingQuestions(draft, true)).toContain("Add an image");

    const publishable = JSON.stringify([{
      id: "image-labeling-question",
      type: "image_labeling",
      image: { url: "https://cdn.example.test/diagram.png", alt: "Diagram" },
      data: {
        labels: [{ id: "label-heart", text: "Heart" }, { id: "label-lung", text: "Lung" }],
        targets: [
          { id: "target-heart", x: 40, y: 50, labelId: "label-heart" },
          { id: "target-lung", x: 60, y: 50, labelId: "label-lung" },
        ],
      },
    }]);
    expect(validateImageLabelingQuestions(publishable, true)).toBeNull();

    const duplicateAssignment = JSON.stringify([{
      type: "image_labeling",
      image: { url: "https://cdn.example.test/diagram.png" },
      data: {
        labels: [{ id: "label-one", text: "One" }, { id: "label-two", text: "Two" }],
        targets: [
          { id: "target-one", x: 20, y: 30, labelId: "label-one" },
          { id: "target-two", x: 50, y: 70, labelId: "label-one" },
        ],
      },
    }]);
    expect(validateImageLabelingQuestions(duplicateAssignment, true)).toContain("different available label");
  });

  it("wires the Quiz Creator-only type through authoring, preview, public delivery, and safe export rejection", () => {
    const typeSource = readFileSync(new URL("../client/src/quiz-creator/types/quiz.ts", import.meta.url), "utf8");
    const listSource = readFileSync(new URL("../client/src/quiz-creator/components/QuestionList.tsx", import.meta.url), "utf8");
    const editorSource = readFileSync(new URL("../client/src/quiz-creator/components/QuestionEditor.tsx", import.meta.url), "utf8");
    const previewSource = readFileSync(new URL("../client/src/quiz-creator/components/QuizPreview.tsx", import.meta.url), "utf8");
    const publicPlayerSource = readFileSync(new URL("../client/src/pages/PublicQuizPlayerPage.tsx", import.meta.url), "utf8");
    const routerSource = readFileSync(new URL("./quizMakerRouter.ts", import.meta.url), "utf8");

    expect(typeSource).toContain('"image_labeling"');
    expect(listSource).toContain('image_labeling: "Image Labeling"');
    expect(editorSource).toContain('question.type === "image_labeling"');
    expect(previewSource).toContain("<ImageLabelingInteraction");
    expect(publicPlayerSource).toContain("<ImageLabelingInteraction");
    expect(routerSource).toContain("validateImageLabelingQuestions(input.questionsJson)");
    expect(routerSource).toContain("Image-labeling questions are delivered in Quiz Creator and cannot be exported to the Question Bank.");
  });
});
