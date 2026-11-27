import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { COURSE360_MOBILE_EDITOR_INVERSES, restoreCourse360MobileEditorSource } from "./course360MobileEditorPreservation";
import { restoreCourse360MobileSyncSource } from "./course360MobileSyncPreservation";

// Independently fixed raw-byte originals from 8dd13f463bfa269cd848ea48a2efdf0b35955af7.
// No git execution, retained backup access, environment files, provider, DB or network is needed.
const ORIGINAL_HASHES: Readonly<Record<string, string>> = {
  "client/src/components/LessonBlockEditor.tsx": "d9583b666f6b740efd3572f9b4689692dc81a44b7ffc75f9a97d5353413e8bc1",
  "client/src/pages/admin/LandingPageBuilder.tsx": "11dd04ad7a80dd3a83708e8b5a3e8dfb1eaceff1321f8bcd4ecf7c4ace25d449",
  "client/src/pages/lms/CourseBuilderPage.tsx": "0942eb19413bc3c5ce16f37fce3303f7f108c960bd059119eda1fcb16c1c9308",
  "client/src/pages/lms/LandingPageBuilder.tsx": "561f1e9751b2c0f83dc7a657d156e0b5d61b5750a3fcffd2f2ee6c8defc2ec32",
};
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const source = (path: string): string => restoreCourse360MobileSyncSource(path, readFileSync(resolve(process.cwd(), path), "utf8"));
const count = (text: string, fragment: string): number => text.split(fragment).length - 1;

function evidence(path: string, text: string) {
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const handlers: string[] = [], bindings: string[] = [], mutations: string[] = [], copy: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(ast);
      if (/^on[A-Z]/.test(name)) handlers.push(node.getText(ast));
      if (["value", "defaultValue", "checked", "defaultChecked", "href", "src", "disabled"].includes(name)) bindings.push(node.getText(ast));
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        /^(?:mutate|mutateAsync|useMutation|useQuery|invalidate|refetch|setItem|removeItem)$/.test(node.expression.name.text)) mutations.push(node.getText(ast));
    if (ts.isJsxText(node)) {
      const content = node.text.replace(/\s+/g, " ").trim();
      if (content) copy.push(content);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { handlers, bindings, mutations, copy };
}

function additionsAfterRetainingOriginalOrder(original: readonly string[], current: readonly string[]): string[] {
  const additions: string[] = [];
  let cursor = 0;
  for (const item of current) {
    if (item === original[cursor]) cursor += 1;
    else additions.push(item);
  }
  expect(cursor, "every original item survives in exact original order").toBe(original.length);
  return additions;
}

// The only behavior addition approved after the layout repair: select a column child
// and provide an explicit touch-sized Edit block settings action. Existing callbacks stay exact.
const SELECTION_ADDITIONS = [
  "onSelect={onSelectChild ? () => onSelectChild(b.id) : undefined}",
  "onClick={onSelect ? e => { if ((e.target as HTMLElement).closest('[data-drag-handle]')) return; e.stopPropagation(); onSelect(); } : undefined}",
  "onClick={e => { e.stopPropagation(); onSelect(); }}",
  "onSelectChild={onSelectChildBlock}",
  "onSelectChild={onSelectChildBlock}",
  "onSelectChildBlock={childId => setSelectedId(childId)}",
];

describe("Course360 exact mobile editor preservation", () => {
  it("confines the inverse manifest to the four independently pinned original paths", () => {
    expect(COURSE360_MOBILE_EDITOR_INVERSES.map(file => file.path).sort()).toEqual(Object.keys(ORIGINAL_HASHES).sort());
    for (const file of COURSE360_MOBILE_EDITOR_INVERSES) expect(file.baselineSha256).toBe(ORIGINAL_HASHES[file.path]);
  });
  for (const file of COURSE360_MOBILE_EDITOR_INVERSES) {
    describe(file.path, () => {
      it("reconstructs every original byte and independently fixed baseline hash", () => {
        const current = source(file.path);
        expect(sha256(current)).toBe(file.approvedSha256);
        const original = restoreCourse360MobileEditorSource(file.path, current);
        expect(sha256(original)).toBe(ORIGINAL_HASHES[file.path]);
        expect(restoreCourse360MobileEditorSource(file.path, original)).toBe(original);
      });
      it("has exact unique reversible hunk fragments and no fuzzy JSX normalization", () => {
        const current = source(file.path);
        let original = current;
        for (const pair of file.pairs) {
          expect(pair.before).not.toBe(pair.after);
          expect(count(current, pair.after)).toBe(1);
          expect(count(original, pair.after)).toBe(1);
          original = original.replace(pair.after, pair.before);
        }
        expect(sha256(original)).toBe(ORIGINAL_HASHES[file.path]);
        let reapplied = original;
        for (const pair of file.pairs) {
          expect(count(reapplied, pair.before)).toBe(1);
          reapplied = reapplied.replace(pair.before, pair.after);
        }
        expect(reapplied).toBe(current);
      });
      it("fails closed for missing, duplicated, edited and partially restored approved fragments", () => {
        const current = source(file.path), first = file.pairs[0];
        expect(() => restoreCourse360MobileEditorSource(file.path, current.replace(first.after, ""))).toThrow(/exactly one/);
        expect(() => restoreCourse360MobileEditorSource(file.path, current + first.after)).toThrow(/exactly one/);
        expect(() => restoreCourse360MobileEditorSource(file.path, current.replace(first.after, first.after + "\n/* unexpected byte */\n"))).toThrow();
        expect(() => restoreCourse360MobileEditorSource(file.path, current.replace(first.after, first.before))).toThrow();
      });
      it("detects even a single additional byte outside the approved hunks", () => {
        expect(() => restoreCourse360MobileEditorSource(file.path, source(file.path) + "\n")).toThrow(/Unexpected mobile-editor source bytes/);
      });
      it("retains all original handlers in exact byte order with only explicitly approved child-selection additions", () => {
        const current = source(file.path);
        const before = evidence(file.path, restoreCourse360MobileEditorSource(file.path, current));
        const after = evidence(file.path, current);
        const added = additionsAfterRetainingOriginalOrder(before.handlers, after.handlers);
        const expected = file.path.endsWith("LessonBlockEditor.tsx")
          ? ["onSelectChildBlock={childId => setSelectedBlockId(childId)}"]
          : file.path.endsWith("LandingPageBuilder.tsx") ? SELECTION_ADDITIONS : [];
        expect(added).toEqual(expected);
      });
      it("keeps original form values, resources, destinations, disabled conditions and mutation calls exact", () => {
        const current = source(file.path);
        const before = evidence(file.path, restoreCourse360MobileEditorSource(file.path, current));
        const after = evidence(file.path, current);
        expect(after.bindings).toEqual(before.bindings);
        expect(after.mutations).toEqual(before.mutations);
        const addedCopy = additionsAfterRetainingOriginalOrder(before.copy, after.copy);
        expect(addedCopy).toEqual(file.path.endsWith("LandingPageBuilder.tsx") ? ["Edit block settings"] : []);
      });
    });
  }
  it("passes all other files and near-matching path aliases through byte-identically", () => {
    const current = source("client/src/pages/admin/LandingPageBuilder.tsx");
    for (const path of ["client/src/App.tsx", "server/routers.ts", "shared/course360Pricing.ts", "./client/src/pages/admin/LandingPageBuilder.tsx", "client/src/pages/admin/LandingPageBuilder.tsx.bak"]) {
      expect(restoreCourse360MobileEditorSource(path, current)).toBe(current);
    }
  });
  it("leaves all 70 old normalized hashes and the original literal scan independently active", () => {
    const suite = source("server/course360CrossToolTrademarkConsistency.test.ts");
    expect(suite).toContain('"client/src/pages/admin/LandingPageBuilder.tsx": "4039dde0647e21e81454a7a2af9fd6cc2d571968351f2d220e324dd28e86c793"');
    expect(suite).toContain("expect(Object.keys(NORMALIZED_TRADEMARK_SOURCE_HASHES)).toHaveLength(70)");
    expect(suite).toContain("normalizeTrademark(restoreCourse360MobileEditorSource(file, text))");
    expect(suite).toContain("findUnmarkedClientLiterals(file, text)");
  });
});
