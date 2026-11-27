// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { COURSE360_MOBILE_SYNC_INVERSES, restoreCourse360MobileSyncSource } from "./course360MobileSyncPreservation";
import { restoreCourse360MobileEditorSource } from "./course360MobileEditorPreservation";

const BASELINE_HASHES: Readonly<Record<string, string>> = {
  "client/src/pages/admin/FunnelPageEditor.tsx": "11f3c747cfa17df3aa12128b215489603d80a9d5706a163684d4c5b0367438a8",
  "client/src/pages/admin/SitePageBuilder.tsx": "4174ce699682ffb83969ac5392c4e542818e1c02a53aeebdcd4b6c672ed06cea",
  "client/src/pages/admin/LandingPageBuilder.tsx": "3f5e77c0e49d263bc943be3cd844e0511141debebd2e5e969020273c0619d295",
  "client/src/pages/lms/LandingPageBuilder.tsx": "059d77a951859ac626c83b3e3ae6ee0fb92ee118e06e0afce0e405d13033b5f0",
  "client/src/pages/marketing/FunnelPageEditor.tsx": "05f23f7c823b04c342cac61a795d37131bca932be77fb72c686f0925d530af9b",
};
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
function evidence(path: string, text: string) {
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const handlers: string[] = [], bindings: string[] = [], calls: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(ast);
      if (/^on[A-Z]/.test(name)) handlers.push(node.getText(ast));
      if (["value", "defaultValue", "checked", "defaultChecked", "href", "src", "disabled"].includes(name)) bindings.push(node.getText(ast));
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      /^(?:mutate|mutateAsync|useMutation|useQuery|invalidate|refetch|setItem|removeItem)$/.test(node.expression.name.text)) calls.push(node.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast); return { handlers, bindings, calls };
}
function extraAfterOriginal(original: string[], current: string[]) {
  let cursor = 0; const extras: string[] = [];
  for (const value of current) { if (value === original[cursor]) cursor++; else extras.push(value); }
  expect(cursor, "all existing handlers remain in exact original order").toBe(original.length);
  return extras;
}

afterEach(cleanup);
describe("Exact mobile source sync preservation", () => {
  it("pins only five existing UI files to the independently archived 1485060f baseline", () => {
    expect(COURSE360_MOBILE_SYNC_INVERSES.map(file => file.path).sort()).toEqual(Object.keys(BASELINE_HASHES).sort());
    for (const file of COURSE360_MOBILE_SYNC_INVERSES) expect(file.baselineSha256).toBe(BASELINE_HASHES[file.path]);
  });
  for (const file of COURSE360_MOBILE_SYNC_INVERSES) {
    it(`${file.path}: reconstructs every old byte with unique exact reversible fragments`, () => {
      const current = read(file.path);
      expect(sha(current)).toBe(file.approvedSha256);
      const original = restoreCourse360MobileSyncSource(file.path, current);
      expect(sha(original)).toBe(BASELINE_HASHES[file.path]);
      expect(restoreCourse360MobileSyncSource(file.path, original)).toBe(original);
      let reapplied = original;
      for (const pair of file.pairs) {
        expect(current.split(pair.after).length - 1).toBe(1);
        expect(reapplied.split(pair.before).length - 1).toBe(1);
        reapplied = reapplied.replace(pair.before, pair.after);
      }
      expect(reapplied).toBe(current);
    });
    it(`${file.path}: rejects missing, duplicated, edited, partial and outside-hunk changes in both applicable layers`, () => {
      const current = read(file.path), pair = file.pairs[0];
      const partial = current.replace(pair.after, pair.before) + (file.pairs.length === 1 ? "/* incomplete extra change */" : "");
      for (const invalid of [current.replace(pair.after, ""), current + pair.after, current.replace(pair.after, pair.after + "/* unexpected byte */"), partial, current + "\n"]) {
        expect(() => restoreCourse360MobileSyncSource(file.path, invalid)).toThrow();
        expect(() => restoreCourse360MobileEditorSource(file.path, invalid)).toThrow();
      }
    });
    it(`${file.path}: keeps every save, query, disabled condition, resource and form binding exact`, () => {
      const current = read(file.path), original = restoreCourse360MobileSyncSource(file.path, current);
      const before = evidence(file.path, original), after = evidence(file.path, current);
      expect(after.bindings).toEqual(before.bindings);
      expect(after.calls).toEqual(before.calls);
      const extra = extraAfterOriginal(before.handlers, after.handlers);
      expect(extra).toEqual(file.path.endsWith("FunnelPageEditor.tsx") ? ["onSelectChildBlock={childId => setSelectedId(childId)}"] : file.path.endsWith("SitePageBuilder.tsx") ? ["onClick={() => setSelectedId(null)}"] : []);
    });
  }
  it("does not normalize aliases, server code, authentication or the original fixtures", () => {
    const text = read("client/src/pages/admin/LandingPageBuilder.tsx");
    for (const path of ["./client/src/pages/admin/LandingPageBuilder.tsx", "client/src/pages/admin/LandingPageBuilder.tsx.bak", "server/routers.ts", "client/src/App.tsx", "client/src/_core/hooks/useAuth.ts"]) {
      expect(restoreCourse360MobileSyncSource(path, text)).toBe(text);
    }
    expect(read("server/fixtures/course360MobileEditorInverse.json")).toContain('"baselineCommit": "8dd13f463bfa269cd848ea48a2efdf0b35955af7"');
    expect(read("server/course360CrossToolMobilePreservation.test.ts")).toContain('expect(sha256(current)).toBe(file.approvedSha256)');
  });
  it("retains actual routed funnel identity, org-scoped picker inputs, and the server's existing legacy write guard", () => {
    const app = read("client/src/App.tsx"), router = read("server/routers/funnelRouter.ts"), funnel = read("client/src/pages/marketing/FunnelPageEditor.tsx");
    expect(app).toContain('import FunnelPageEditor from "./pages/marketing/FunnelPageEditor"');
    expect(funnel).toContain('const landingBlockOrgInput = useMemo(() => orgId ? { orgId } : undefined, [orgId])');
    expect(funnel).toContain('getCoursesWithLandingBlocks.useQuery(landingBlockOrgInput');
    expect(funnel).toContain('getDownloadsWithLandingBlocks.useQuery(landingBlockOrgInput');
    expect(funnel).toContain('getProductsWithLandingBlocks.useQuery(landingBlockOrgInput');
    expect(router).toContain('await requireCourse360BuilderSchool(ctx)');
    expect(router).toContain('updatePage: legacyUnavailableProcedure');
    expect(router).toContain('Use funnel360; existing content is preserved.');
  });
});

/** Render the actual production Save JSX, not a rewritten label imitation. The
 * editor shell is tested separately; this catches icon-only/conditional-label drift. */
function sourceSaveControl(path: string) {
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const controls: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "Button" &&
      node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "onClick" && attribute.initializer?.getText(ast) === "{handleSave}") && node.getText(ast).includes('compact ? "Save" : "Save Page"')) controls.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast); expect(controls).toHaveLength(1);
  const js = ts.transpileModule(`function Control({ compact, isSaving, handleSave }) { return (${controls[0]}); }`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function("React", "Button", "Save", `${js}; return Control;`)(React, (props: any) => <button {...props} />, () => <svg aria-hidden="true" />) as React.ComponentType<{ compact: boolean; isSaving: boolean; handleSave: () => void }>;
}
describe("Actual-source landing Save controls", () => {
  for (const path of ["client/src/pages/admin/LandingPageBuilder.tsx", "client/src/pages/lms/LandingPageBuilder.tsx", "client/src/pages/admin/FunnelPageEditor.tsx", "client/src/pages/marketing/FunnelPageEditor.tsx"]) {
    it.each([true, false])(`${path}: renders visible compact=%s Save label and unchanged callback`, compact => {
      const Control = sourceSaveControl(path), save = vi.fn();
      const view = render(<Control compact={compact} isSaving={false} handleSave={save} />);
      const button = view.getByRole("button");
      expect(button.textContent?.trim()).toBe(compact ? "Save" : "Save Page");
      fireEvent.click(button); expect(save).toHaveBeenCalledTimes(1);
      view.rerender(<Control compact={compact} isSaving={true} handleSave={save} />);
      expect(button.textContent?.trim()).toBe("Saving…");
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button); expect(save).toHaveBeenCalledTimes(1);
    });
  }
});
