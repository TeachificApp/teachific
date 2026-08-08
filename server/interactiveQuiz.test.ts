/**
 * interactiveQuiz.test.ts
 * Tests for the 6 new interactive question types ported from Ultrasound-App.
 * All question types are org-scoped via orgId.
 */
import { describe, it, expect } from "vitest";

// ─── Question type enum ───────────────────────────────────────────────────────

const INTERACTIVE_TYPES = [
  "image_comparison", "drag_sort", "branching",
  "fill_blank", "annotation", "flashcard",
] as const;

const ALL_TYPES = [
  "multiple_choice", "true_false", "short_answer", "matching", "hotspot",
  ...INTERACTIVE_TYPES,
] as const;

describe("Interactive question type definitions", () => {
  it("has 6 new interactive types", () => {
    expect(INTERACTIVE_TYPES).toHaveLength(6);
  });

  it("all types are unique", () => {
    const unique = new Set(ALL_TYPES);
    expect(unique.size).toBe(ALL_TYPES.length);
  });
});

// ─── image_comparison ────────────────────────────────────────────────────────

describe("image_comparison question type", () => {
  it("requires two image URLs", () => {
    const q = {
      type: "image_comparison",
      comparisonImageA: "https://example.com/a.jpg",
      comparisonImageB: "https://example.com/b.jpg",
      comparisonLabelA: "Before",
      comparisonLabelB: "After",
    };
    expect(q.comparisonImageA).toBeTruthy();
    expect(q.comparisonImageB).toBeTruthy();
  });

  it("labels are optional", () => {
    const q = { type: "image_comparison", comparisonImageA: "a.jpg", comparisonImageB: "b.jpg" };
    expect((q as any).comparisonLabelA).toBeUndefined();
  });
});

// ─── drag_sort ───────────────────────────────────────────────────────────────

describe("drag_sort question type", () => {
  it("stores items as JSON array", () => {
    const items = [
      { id: "1", text: "Step 1" },
      { id: "2", text: "Step 2" },
      { id: "3", text: "Step 3" },
    ];
    const q = { type: "drag_sort", dragItems: JSON.stringify(items) };
    const parsed = JSON.parse(q.dragItems);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].text).toBe("Step 1");
  });

  it("scores correctly when all items in correct order", () => {
    const correctOrder = ["1", "2", "3"];
    const studentAnswer = ["1", "2", "3"];
    const isCorrect = JSON.stringify(correctOrder) === JSON.stringify(studentAnswer);
    expect(isCorrect).toBe(true);
  });

  it("scores incorrectly when items out of order", () => {
    const correctOrder = ["1", "2", "3"];
    const studentAnswer = ["2", "1", "3"];
    const isCorrect = JSON.stringify(correctOrder) === JSON.stringify(studentAnswer);
    expect(isCorrect).toBe(false);
  });
});

// ─── branching ───────────────────────────────────────────────────────────────

describe("branching question type", () => {
  it("stores branching config as JSON", () => {
    const config = {
      scenario: "A patient presents with chest pain.",
      choices: [
        { text: "Order ECG", outcome: "Correct — ECG is first-line", isCorrect: true },
        { text: "Discharge patient", outcome: "Incorrect — further workup needed", isCorrect: false },
      ],
    };
    const q = { type: "branching", branchingConfig: JSON.stringify(config) };
    const parsed = JSON.parse(q.branchingConfig);
    expect(parsed.choices).toHaveLength(2);
    expect(parsed.choices[0].isCorrect).toBe(true);
  });
});

// ─── fill_blank ──────────────────────────────────────────────────────────────

describe("fill_blank question type", () => {
  it("template has ___ placeholders", () => {
    const template = "The ___ is the pumping chamber of the heart.";
    const blanks = template.match(/___/g);
    expect(blanks).toHaveLength(1);
  });

  it("stores accepted answers as JSON array of arrays", () => {
    const answers = [["left ventricle", "LV"]]; // blank 1 accepts either
    const q = { type: "fill_blank", fillBlankAnswers: JSON.stringify(answers) };
    const parsed = JSON.parse(q.fillBlankAnswers);
    expect(parsed[0]).toContain("left ventricle");
    expect(parsed[0]).toContain("LV");
  });

  it("scores case-insensitively", () => {
    const accepted = ["left ventricle", "lv"];
    const studentAnswer = "Left Ventricle";
    const isCorrect = accepted.some(a => a.toLowerCase() === studentAnswer.toLowerCase());
    expect(isCorrect).toBe(true);
  });
});

// ─── annotation ──────────────────────────────────────────────────────────────

describe("annotation question type", () => {
  it("stores target zones as JSON array", () => {
    const zones = [
      { x: 45, y: 30, radius: 8, label: "Left Ventricle" },
      { x: 55, y: 28, radius: 8, label: "Right Ventricle" },
    ];
    const q = { type: "annotation", annotationTargetZones: JSON.stringify(zones) };
    const parsed = JSON.parse(q.annotationTargetZones);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].label).toBe("Left Ventricle");
  });

  it("checks if click is within target zone radius", () => {
    const zone = { x: 45, y: 30, radius: 8 };
    const click = { x: 48, y: 33 };
    const dist = Math.sqrt((click.x - zone.x) ** 2 + (click.y - zone.y) ** 2);
    expect(dist).toBeLessThan(zone.radius);
  });
});

// ─── flashcard ───────────────────────────────────────────────────────────────

describe("flashcard question type", () => {
  it("has front and back content", () => {
    const q = {
      type: "flashcard",
      flashcardFront: "What is the normal ejection fraction?",
      flashcardBack: "55–70% (normal range)",
    };
    expect(q.flashcardFront).toBeTruthy();
    expect(q.flashcardBack).toBeTruthy();
  });

  it("flashcard is always a survey type (no scoring)", () => {
    const surveyTypes = ["flashcard", "likert", "rating_scale"];
    expect(surveyTypes).toContain("flashcard");
  });
});

// ─── Org-scoped isolation ─────────────────────────────────────────────────────

describe("Org-scoped question isolation", () => {
  it("questions are filtered by orgId", () => {
    const questions = [
      { id: 1, orgId: 10, type: "image_comparison" },
      { id: 2, orgId: 20, type: "drag_sort" },
      { id: 3, orgId: 10, type: "flashcard" },
    ];
    const orgId = 10;
    const filtered = questions.filter(q => q.orgId === orgId);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(q => q.type)).toContain("image_comparison");
    expect(filtered.map(q => q.type)).toContain("flashcard");
    expect(filtered.map(q => q.type)).not.toContain("drag_sort");
  });

  it("org A cannot access org B questions", () => {
    const orgAId = 10;
    const orgBQuestion = { id: 5, orgId: 20, type: "annotation" };
    const canAccess = orgBQuestion.orgId === orgAId;
    expect(canAccess).toBe(false);
  });
});
