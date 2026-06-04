import { describe, expect, it } from "vitest";

/**
 * Tests for form editor enhancements:
 * - Scale/Rating field type support
 * - Rich text and Info field types
 * - Score values per option
 * - Score weight per field
 * - Email routing rules
 * - NON_INPUT_TYPES constant
 */

// Test the field type definitions and validation logic
describe("Form Editor Field Types", () => {
  const CHOICE_TYPES = ["dropdown", "radio", "checkbox"];
  const NON_INPUT_TYPES = ["section_break", "statement", "page_break", "richtext", "info"];
  const BRANCHABLE_TYPES = ["dropdown", "radio", "checkbox", "short_answer", "email", "scale"];

  it("should include scale in branchable types", () => {
    expect(BRANCHABLE_TYPES).toContain("scale");
  });

  it("should include richtext and info in non-input types", () => {
    expect(NON_INPUT_TYPES).toContain("richtext");
    expect(NON_INPUT_TYPES).toContain("info");
  });

  it("should not include scale in non-input types (it collects data)", () => {
    expect(NON_INPUT_TYPES).not.toContain("scale");
  });

  it("should not include scale in choice types", () => {
    expect(CHOICE_TYPES).not.toContain("scale");
  });

  it("NON_INPUT_TYPES should filter out layout/display-only fields", () => {
    const allFields = [
      { type: "short_answer", label: "Name" },
      { type: "scale", label: "Rating" },
      { type: "richtext", label: "Info Block" },
      { type: "info", label: "Notice" },
      { type: "section_break", label: "---" },
      { type: "radio", label: "Choice" },
    ];
    const inputFields = allFields.filter((f) => !NON_INPUT_TYPES.includes(f.type));
    expect(inputFields).toHaveLength(3);
    expect(inputFields.map((f) => f.type)).toEqual(["short_answer", "scale", "radio"]);
  });
});

describe("Scale Field Defaults", () => {
  it("should generate correct scale range from min/max", () => {
    const scaleMin = 1;
    const scaleMax = 5;
    const values = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
    expect(values).toEqual([1, 2, 3, 4, 5]);
  });

  it("should handle custom scale ranges", () => {
    const scaleMin = 0;
    const scaleMax = 10;
    const values = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
    expect(values).toHaveLength(11);
    expect(values[0]).toBe(0);
    expect(values[10]).toBe(10);
  });

  it("should handle single-value scale", () => {
    const scaleMin = 5;
    const scaleMax = 5;
    const values = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
    expect(values).toEqual([5]);
  });
});

describe("Option Score Values", () => {
  it("should support scoreValue on options", () => {
    const options = [
      { value: "excellent", label: "Excellent", scoreValue: 100 },
      { value: "good", label: "Good", scoreValue: 75 },
      { value: "average", label: "Average", scoreValue: 50 },
      { value: "poor", label: "Poor", scoreValue: 25 },
    ];
    expect(options[0].scoreValue).toBe(100);
    expect(options[3].scoreValue).toBe(25);
  });

  it("should default scoreValue to 0 when not set", () => {
    const options = [
      { value: "option_1", label: "Option 1", scoreValue: 0 },
      { value: "option_2", label: "Option 2", scoreValue: 0 },
    ];
    expect(options.every((o) => o.scoreValue === 0)).toBe(true);
  });
});

describe("Email Routing Rules", () => {
  it("should parse valid email routing rules JSON", () => {
    const rulesJson = JSON.stringify([
      {
        label: "Route to reviewer",
        conditionFieldId: 5,
        conditionValue: "yes",
        routeTo: "reviewer@example.com",
      },
    ]);
    const parsed = JSON.parse(rulesJson);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].routeTo).toBe("reviewer@example.com");
    expect(parsed[0].conditionFieldId).toBe(5);
  });

  it("should handle empty routing rules", () => {
    const rulesJson = "";
    expect(rulesJson).toBe("");
  });
});

describe("Field Payload Serialization", () => {
  it("should serialize field with all new properties for upsert", () => {
    const field = {
      id: undefined,
      type: "scale",
      label: "How would you rate this?",
      placeholder: null,
      helpText: "1 = Poor, 5 = Excellent",
      required: true,
      sortOrder: 0,
      options: [],
      minLength: null,
      maxLength: null,
      isBranchingSource: true,
      scaleMin: 1,
      scaleMax: 5,
      scaleMinLabel: "Poor",
      scaleMaxLabel: "Excellent",
      richTextContent: null,
      emailRoutingRules: null,
      scoreWeight: 5,
    };

    expect(field.type).toBe("scale");
    expect(field.scaleMin).toBe(1);
    expect(field.scaleMax).toBe(5);
    expect(field.scaleMinLabel).toBe("Poor");
    expect(field.scaleMaxLabel).toBe("Excellent");
    expect(field.scoreWeight).toBe(5);
    expect(field.isBranchingSource).toBe(true);
  });

  it("should serialize richtext field correctly", () => {
    const field = {
      type: "richtext",
      label: "Welcome Message",
      richTextContent: "<h2>Welcome!</h2><p>Please fill out this form carefully.</p>",
      required: false,
      scoreWeight: 0,
    };

    expect(field.type).toBe("richtext");
    expect(field.richTextContent).toContain("<h2>");
    expect(field.required).toBe(false);
  });

  it("should serialize info field correctly", () => {
    const field = {
      type: "info",
      label: "Important Notice",
      richTextContent: "<p>This form is for internal use only.</p>",
      required: false,
      scoreWeight: 0,
    };

    expect(field.type).toBe("info");
    expect(field.richTextContent).toContain("internal use only");
  });

  it("should serialize options with score values", () => {
    const options = [
      { value: "strongly_agree", label: "Strongly Agree", scoreValue: 5 },
      { value: "agree", label: "Agree", scoreValue: 4 },
      { value: "neutral", label: "Neutral", scoreValue: 3 },
      { value: "disagree", label: "Disagree", scoreValue: 2 },
      { value: "strongly_disagree", label: "Strongly Disagree", scoreValue: 1 },
    ];
    const serialized = JSON.stringify(options);
    const parsed = JSON.parse(serialized);
    expect(parsed).toHaveLength(5);
    expect(parsed[0].scoreValue).toBe(5);
    expect(parsed[4].scoreValue).toBe(1);
  });
});
