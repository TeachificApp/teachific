import { describe, expect, it } from "vitest";
import { parseQuizFileQuestionBankItems } from "./lib/quizFileQuestionBankImport";

function makeQuizFile(questions: unknown[]): string {
  return `TEACHIFIC_QUIZ_V1\n${Buffer.from(JSON.stringify({ questions })).toString("base64")}`;
}

describe("Course360 .quiz Question Bank import", () => {
  it("preserves safe image media on imported image-choice questions and choices", () => {
    const [question] = parseQuizFileQuestionBankItems(makeQuizFile([{
      type: "image_choice",
      stem: "Identify the image",
      data: {
        imageUrl: "https://media.example.test/question.png",
        imageAlt: "An illustrated question",
        choices: [
          { label: "A", correct: true, imageUrl: "https://media.example.test/a.png", feedback: "Correct." },
          { label: "B", correct: false, imageUrl: "data:image/png;base64,AAAA" },
        ],
      },
    }]));

    expect(question).toMatchObject({
      questionType: "mc",
      mediaType: "image",
      mediaUrl: "https://media.example.test/question.png",
      mediaAlt: "An illustrated question",
    });
    expect(question.choices).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "A", mediaType: "image", mediaUrl: "https://media.example.test/a.png", feedback: "Correct." }),
      expect.objectContaining({ text: "B", mediaType: "image", mediaUrl: "data:image/png;base64,AAAA" }),
    ]));
  });

  it("preserves paired matching media but discards unsafe media protocols", () => {
    const [question] = parseQuizFileQuestionBankItems(makeQuizFile([{
      type: "matching",
      stem: "Match the pairs",
      data: {
        pairs: [
          { id: "pair-a", premise: "Premise", premiseImageUrl: "javascript:alert(1)", response: "Response", responseImageUrl: "https://media.example.test/response.png" },
        ],
      },
    }]));

    expect(question.questionType).toBe("matching");
    expect(question.choices).toEqual([
      expect.objectContaining({ text: "Premise", matchPairId: "pair-a", matchSide: "left", mediaType: "none", mediaUrl: undefined }),
      expect.objectContaining({ text: "Response", matchPairId: "pair-a", matchSide: "right", mediaType: "image", mediaUrl: "https://media.example.test/response.png" }),
    ]);
  });
});
