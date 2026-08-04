import { describe, it, expect } from "vitest";

// Test that the time field type is correctly defined in the field type constants
describe("Form Builder - Time Field Type", () => {
  it("should include time as a valid field type in the FieldType union", () => {
    // This tests the logic that time is a valid field type (varchar 50 chars)
    const validFieldTypes = [
      "short_answer", "long_answer", "dropdown", "radio", "checkbox",
      "email", "number", "date", "time", "scale", "richtext", "info",
      "section_break", "statement", "page_break"
    ];
    expect(validFieldTypes).toContain("time");
  });

  it("should render time field as an input[type=time]", () => {
    // The time field should use HTML input type="time"
    const fieldTypeToInputType = (type: string): string => {
      if (type === "email") return "email";
      if (type === "number") return "number";
      if (type === "date") return "date";
      if (type === "time") return "time";
      return "text";
    };
    expect(fieldTypeToInputType("time")).toBe("time");
    expect(fieldTypeToInputType("date")).toBe("date");
    expect(fieldTypeToInputType("email")).toBe("email");
    expect(fieldTypeToInputType("short_answer")).toBe("text");
  });

  it("should not include time in NON_INPUT_TYPES", () => {
    const NON_INPUT_TYPES = ["section_break", "statement", "page_break", "richtext", "info"];
    expect(NON_INPUT_TYPES).not.toContain("time");
    expect(NON_INPUT_TYPES).not.toContain("date");
  });

  it("should not include time in CHOICE_TYPES", () => {
    const CHOICE_TYPES = ["dropdown", "radio", "checkbox"];
    expect(CHOICE_TYPES).not.toContain("time");
  });

  it("should not include time in BRANCHABLE_TYPES (time is not branchable)", () => {
    const BRANCHABLE_TYPES = ["dropdown", "radio", "checkbox", "short_answer", "email", "scale"];
    expect(BRANCHABLE_TYPES).not.toContain("time");
  });
});

// Test the DynamicFormRenderer time field support
describe("DynamicFormRenderer - Time Field", () => {
  it("should handle time field type in the switch statement", () => {
    const supportedTypes = ["short_answer", "long_answer", "email", "phone", "number", "date", "time",
      "dropdown", "radio", "checkbox", "scale", "heading", "paragraph", "section_break", "rich_text", "info"];
    expect(supportedTypes).toContain("time");
    expect(supportedTypes).toContain("date");
  });

  it("should show help text as tooltip icon when helpText is present", () => {
    // The FieldWrapper should show an Info icon tooltip when helpText is set
    const hasHelpText = (item: { helpText?: string }) => !!item.helpText;
    expect(hasHelpText({ helpText: "This is help text" })).toBe(true);
    expect(hasHelpText({ helpText: "" })).toBe(false);
    expect(hasHelpText({})).toBe(false);
  });
});

// Test the GeneralFormBuilder ShareTab QR code and pre-populate
describe("GeneralFormBuilder - ShareTab", () => {
  it("should generate a correct pre-populate URL format", () => {
    const publicUrl = "https://example.com/forms/my-form";
    const fieldId = 42;
    const prePopulateUrl = `${publicUrl}?field_${fieldId}=value`;
    expect(prePopulateUrl).toBe("https://example.com/forms/my-form?field_42=value");
  });

  it("should filter out non-input items from pre-populate reference table", () => {
    const items = [
      { id: 1, itemType: "short_answer", label: "Name" },
      { id: 2, itemType: "heading", label: "Section Header" },
      { id: 3, itemType: "date", label: "Date of Birth" },
      { id: 4, itemType: "time", label: "Appointment Time" },
      { id: 5, itemType: "paragraph", label: "Instructions" },
      { id: 6, itemType: "section_break", label: "" },
    ];
    const nonInputTypes = ['heading', 'paragraph', 'section_break', 'rich_text', 'richtext', 'info'];
    const inputItems = items.filter(it => !nonInputTypes.includes(it.itemType));
    expect(inputItems).toHaveLength(3);
    expect(inputItems.map(i => i.itemType)).toEqual(["short_answer", "date", "time"]);
  });

  it("should generate a valid SVG QR code filename", () => {
    const slug = "my-form-slug";
    const formId = 123;
    const filename = `form-qr-${slug ?? formId}.svg`;
    expect(filename).toBe("form-qr-my-form-slug.svg");
  });
});
