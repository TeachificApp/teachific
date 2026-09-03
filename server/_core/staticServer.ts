import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { getOrgBaseUrl } from "../lib/orgUrl";

/**
 * Production static file server.
 * Serves the built client from dist/public and injects organization-specific
 * metadata for Course360 subdomains and verified custom organization domains.
 * This file has NO vite imports so it can be safely bundled for production.
 */

const PLATFORM_ROOT_DOMAINS = ["course360.app", "teachific.app"] as const;
const PLATFORM_ROOT_HOSTNAMES = new Set([
  ...PLATFORM_ROOT_DOMAINS,
  "www.course360.app",
  "www.teachific.app",
]);
const RESERVED_SUBDOMAINS = new Set([
  "www", "learn", "app", "api", "admin", "mail", "status", "help", "cdn",
  "assets", "static", "media", "support", "docs",
]);

type OrgBranding = {
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoOgImageUrl: string | null;
  customDomain: string | null;
  domainVerificationStatus: string | null;
};

function getRequestHostname(req: Request): string {
  const rawHost = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  return rawHost.split(",")[0].trim().split(":")[0].toLowerCase();
}

function isPlatformRootHostname(hostname: string): boolean {
  return PLATFORM_ROOT_HOSTNAMES.has(hostname);
}

/** Extract an organization slug from an approved platform subdomain. */
export function getOrgSlugFromHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase();
  for (const rootDomain of PLATFORM_ROOT_DOMAINS) {
    if (!normalized.endsWith(`.${rootDomain}`)) continue;
    const subdomain = normalized.slice(0, -(`.${rootDomain}`).length);
    if (!subdomain || subdomain.includes(".") || RESERVED_SUBDOMAINS.has(subdomain)) return null;
    return subdomain;
  }
  return null;
}

/** Resolve the trusted canonical learner base URL used in organization metadata. */
export function getOrgMetadataUrl(org: Pick<OrgBranding, "slug" | "customDomain" | "domainVerificationStatus">): string {
  return `${getOrgBaseUrl(org.slug, org.customDomain, org.domainVerificationStatus)}/`;
}

function brandingSelection(organizations: typeof import("../../drizzle/schema").organizations) {
  return {
    slug: organizations.slug,
    name: organizations.name,
    description: organizations.description,
    logoUrl: organizations.logoUrl,
    seoTitle: organizations.seoTitle,
    seoDescription: organizations.seoDescription,
    seoOgImageUrl: organizations.seoOgImageUrl,
    customDomain: organizations.customDomain,
    domainVerificationStatus: organizations.domainVerificationStatus,
  };
}

/** Fetch minimal organization branding from the DB by its platform subdomain slug. */
async function getOrgBrandingBySlug(slug: string): Promise<OrgBranding | null> {
  try {
    const { getDb } = await import("../db");
    const { organizations } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;
    const [org] = await db
      .select(brandingSelection(organizations))
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    return org ?? null;
  } catch {
    return null;
  }
}

/** Fetch branding only where the request host matches an organization-owned verified custom domain. */
async function getOrgBrandingByVerifiedCustomDomain(hostname: string): Promise<OrgBranding | null> {
  try {
    const { getDb } = await import("../db");
    const { organizations } = await import("../../drizzle/schema");
    const { and, eq, or } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;
    const candidates = [
      hostname,
      `https://${hostname}`,
      `https://${hostname}/`,
      `http://${hostname}`,
      `http://${hostname}/`,
    ];
    const [org] = await db
      .select(brandingSelection(organizations))
      .from(organizations)
      .where(
        and(
          eq(organizations.domainVerificationStatus, "verified"),
          or(...candidates.map(domain => eq(organizations.customDomain, domain))),
        ),
      )
      .limit(1);
    return org ?? null;
  } catch {
    return null;
  }
}

async function getOrgBrandingForHostname(hostname: string): Promise<OrgBranding | null> {
  const slug = getOrgSlugFromHostname(hostname);
  if (slug) return getOrgBrandingBySlug(slug);
  if (isPlatformRootHostname(hostname)) return null;
  return getOrgBrandingByVerifiedCustomDomain(hostname);
}

/** Inject organization-specific OG/Twitter metadata into the rendered HTML string. */
function injectOrgMeta(html: string, org: OrgBranding): string {
  const title = org.seoTitle || org.name;
  const desc = org.seoDescription || org.description || `${org.name} — online courses and learning.`;
  const image = org.seoOgImageUrl || org.logoUrl || "";
  const url = getOrgMetadataUrl(org);
  const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(title)}" />`);
  html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(desc)}" />`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${esc(url)}" />`);
  html = html.replace(/<meta property="og:site_name"[^>]*>/, `<meta property="og:site_name" content="${esc(org.name)}" />`);
  if (image) html = html.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(image)}" />`);
  html = html.replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(title)}" />`);
  html = html.replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(desc)}" />`);
  if (image) html = html.replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${esc(image)}" />`);
  return html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const indexHtmlPath = path.resolve(distPath, "index.html");
  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
  }

  app.use(express.static(distPath));
  app.use("*", async (req: Request, res: Response) => {
    const hostname = getRequestHostname(req);
    try {
      const [html, branding] = await Promise.all([
        fs.promises.readFile(indexHtmlPath, "utf8"),
        getOrgBrandingForHostname(hostname),
      ]);
      if (branding) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
        return res.send(injectOrgMeta(html, branding));
      }
    } catch {
      // Fall through to the static index file if branding resolution fails.
    }
    return res.sendFile(indexHtmlPath);
  });
}
