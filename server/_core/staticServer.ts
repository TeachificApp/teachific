import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

/**
 * Production static file server.
 * Serves the built client from dist/public.
 * For org subdomain requests (e.g. myorg.teachific.app), injects org-specific
 * OG meta tags (title, description, image) before serving index.html.
 * This file has NO vite imports so it can be safely bundled for production.
 */

/** Extract the org slug from the Host header, or null if on root domain */
function getOrgSlugFromHost(req: Request): string | null {
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  const hostname = host.split(":")[0].toLowerCase();

  // Only treat *.teachific.app as org subdomains
  if (!hostname.endsWith(".teachific.app")) return null;
  const sub = hostname.replace(/\.teachific\.app$/, "");
  if (!sub || sub === "www") return null;

  // Exclude reserved platform subdomains
  const RESERVED = new Set(["www", "learn", "app", "api", "admin", "mail", "status", "help", "cdn", "assets", "static", "media", "support", "docs"]);
  if (RESERVED.has(sub)) return null;
  if (sub.includes(".")) return null;

  return sub;
}

/** Fetch minimal org branding from the DB — returns null if not found */
async function getOrgBrandingBySlug(slug: string): Promise<{
  name: string;
  description: string | null;
  logoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoOgImageUrl: string | null;
} | null> {
  try {
    // Lazy import to avoid circular deps at module load time
    const { getDb } = await import("../db");
    const { organizations } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;
    const [org] = await db
      .select({
        name: organizations.name,
        description: organizations.description,
        logoUrl: organizations.logoUrl,
        seoTitle: organizations.seoTitle,
        seoDescription: organizations.seoDescription,
        seoOgImageUrl: organizations.seoOgImageUrl,
      })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return org ?? null;
  } catch {
    return null;
  }
}

/** Inject org-specific OG/Twitter meta tags into the HTML string */
function injectOrgMeta(html: string, org: {
  name: string;
  description: string | null;
  logoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoOgImageUrl: string | null;
}, slug: string): string {
  const title = org.seoTitle || org.name;
  const desc = org.seoDescription || org.description || `${org.name} — online courses and learning.`;
  const image = org.seoOgImageUrl || org.logoUrl || "";
  const url = `https://${slug}.teachific.app/`;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);

  // Replace OG tags
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}" />`);
  html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}" />`);
  html = html.replace(/<meta property="og:site_name"[^>]*>/, `<meta property="og:site_name" content="${esc(org.name)}" />`);
  if (image) {
    html = html.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}" />`);
  }

  // Replace Twitter Card tags
  html = html.replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  html = html.replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(desc)}" />`);
  if (image) {
    html = html.replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}" />`);
  }

  // Replace canonical
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);

  return html;
}

export function serveStatic(app: Express) {
  // In production, the server bundle is at dist/index.js and static files are at dist/public
  // import.meta.dirname is dist/ so public is at dist/public
  const distPath = path.resolve(import.meta.dirname, "public");
  const indexHtmlPath = path.resolve(distPath, "index.html");

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (SPA routing)
  app.use("*", async (req: Request, res: Response) => {
    const orgSlug = getOrgSlugFromHost(req);

    // For org subdomains, inject org-specific OG meta tags
    if (orgSlug) {
      try {
        const [html, branding] = await Promise.all([
          fs.promises.readFile(indexHtmlPath, "utf8"),
          getOrgBrandingBySlug(orgSlug),
        ]);
        if (branding) {
          const injected = injectOrgMeta(html, branding, orgSlug);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          // Cache for 5 minutes (org branding rarely changes)
          res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
          return res.send(injected);
        }
      } catch {
        // Fall through to default index.html on any error
      }
    }

    res.sendFile(indexHtmlPath);
  });
}
