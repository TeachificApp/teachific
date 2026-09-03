import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/admin/GeneralFormBuilder.tsx"),
  "utf8",
);
const generalFormRouterSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routers/generalFormRouter.ts"),
  "utf8",
);
const formEmbedRouteSource = fs.readFileSync(
  path.resolve(process.cwd(), "server/routes/formEmbedRoutes.ts"),
  "utf8",
);

describe("Course360 Form Builder public URL fallback", () => {
  it("uses Course360 only when a saved organization host is absent", () => {
    expect(source).toContain('const DEFAULT_HOST_DOMAIN = "course360.app"');
    expect(source).toContain("const domain = hostDomain || DEFAULT_HOST_DOMAIN;");
    expect(source).toContain("return `https://${domain}/forms/${slug}`;");
    expect(source).not.toContain('const DEFAULT_HOST_DOMAIN = "teachific.app"');
  });

  it("keeps saved form hosts and uses Course360 only as the server embed fallback", () => {
    expect(generalFormRouterSource).toContain('hostDomain: template?.hostDomain ?? "course360.app"');
    expect(formEmbedRouteSource).toContain('const hostDomain = template.hostDomain ?? "course360.app";');
    expect(formEmbedRouteSource).toContain('const embedUrl = `${baseUrl}/forms/${template.publicSlug}/embed?widget=${encodeURIComponent(widgetKey)}`;');
    expect(generalFormRouterSource).not.toContain('hostDomain: template?.hostDomain ?? "teachific.app"');
    expect(formEmbedRouteSource).not.toContain('const hostDomain = template.hostDomain ?? "teachific.app";');
  });
});
