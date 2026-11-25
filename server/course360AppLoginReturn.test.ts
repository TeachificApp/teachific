import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { getCourse360MainAppReturnUrl } from "../client/src/lib/course360AppLoginReturn";
import { course360AppPurchasePath } from "../shared/course360AppPurchaseIntent";

describe("main-account app login returns", () => {
  it.each(["https://course360.app", "https://3000-preview.manus.computer", "http://localhost:3000"])("preserves main/preview origin and exact reviewed intent on %s", origin => {
    const path = course360AppPurchasePath({ app: "creator", tier: "bundle", interval: "annual" });
    expect(getCourse360MainAppReturnUrl(path, origin)).toBe(origin + path);
  });
  it.each(["https://school.course360.app", "https://school.example.com", "https://course360.app.attacker.test"])("centralizes app billing from %s without selecting a school", origin => {
    expect(getCourse360MainAppReturnUrl("/quiz-creator-app/billing?selected=expired", origin)).toBe("https://course360.app/quiz-creator-app/billing?selected=expired");
  });
  it.each(["//attacker.test", "https://attacker.test", "/creator-evil", "/lms", "/creator\\evil", "/%2fcreator", "/creator%5cevil", ""])("does not claim unsupported or hostile return paths: %s", path => {
    expect(getCourse360MainAppReturnUrl(path, "https://course360.app")).toBeNull();
  });
  it("executes the actual login-success handler without redirecting app intent into the user's school", () => {
    const source = readFileSync(new URL("../client/src/pages/auth/LoginPage.tsx", import.meta.url), "utf8");
    const tree = ts.createSourceFile("LoginPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let callback: ts.Node | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "login" && node.initializer && ts.isCallExpression(node.initializer)) {
        const options = node.initializer.arguments[0];
        if (options && ts.isObjectLiteralExpression(options)) callback = options.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(tree) === "onSuccess") && (options.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(tree) === "onSuccess") as ts.PropertyAssignment).initializer;
      }
      ts.forEachChild(node, visit);
    };
    visit(tree); expect(callback).toBeTruthy();
    const js = ts.transpileModule(`const handler = ${callback!.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const assign = vi.fn(), orgNavigation = vi.fn();
    const handler = new Function("getCourse360MainAppReturnUrl", "returnTo", "window", "utils", "localStorage", "CACHE_KEY", "getRootAppUrl", "getSubdomain", "getOrgSubdomainUrl", "navigate", `${js}; return handler;`)(getCourse360MainAppReturnUrl, "/studio-pro?purchaseApp=studio&accessTier=web&interval=annual", { location: { origin: "https://course360.app", assign } }, { auth: { me: { setData: vi.fn() } } }, { setItem: vi.fn() }, "cache", vi.fn(), () => null, orgNavigation, vi.fn());
    handler({ user: { id: 101, role: "org_admin" }, orgSlug: "independent-school" });
    expect(assign).toHaveBeenCalledWith("https://course360.app/studio-pro?purchaseApp=studio&accessTier=web&interval=annual");
    expect(orgNavigation).not.toHaveBeenCalled();
    expect(source).toContain('window.location.href = getOrgSubdomainUrl(orgSlug, returnTo || "/lms")');
  });
});
