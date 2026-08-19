import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { isManusOAuthEnabled, sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/** Auto-provision a default personal workspace for new users who have no org. */
async function ensureDefaultOrg(openId: string, displayName: string | null, email: string | null) {
  try {
    const user = await db.getUserByOpenId(openId);
    if (!user) return;

    const existingOrgs = await db.getOrgsByUserId(user.id);
    if (existingOrgs.length > 0) return; // already has at least one org

    const base = (displayName || email || "personal")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    const slug = `${base}-workspace`;

    // Avoid slug collision
    const existing = await db.getOrgBySlug(slug);
    const finalSlug = existing ? `${slug}-${user.id}` : slug;
    const orgName = displayName ? `${displayName}'s Workspace` : "My Workspace";

    await db.createOrg({
      name: orgName,
      slug: finalSlug,
      description: "Default personal workspace",
      ownerId: user.id,
    });

    const newOrg = await db.getOrgBySlug(finalSlug);
    if (newOrg) {
      await db.addOrgMember(newOrg.id, user.id, "org_admin");
      console.log(`[OAuth] Created default org "${orgName}" (id=${newOrg.id}) for user ${user.id}`);
    }
  } catch (err) {
    console.warn("[OAuth] Could not auto-create default org:", err);
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    if (!isManusOAuthEnabled()) {
      res.status(404).json({ error: "OAuth bridge disabled" });
      return;
    }

    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // ── Registration gate ─────────────────────────────────────────────────
      // Check if this is a new user (not yet in our DB)
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      const isNewUser = !existingUser;
      const isSiteOwner = userInfo.openId === ENV.ownerOpenId;

      if (isNewUser && !isSiteOwner) {
        // Check platform settings — block registration if public registration is off
        const settings = await db.getPlatformSettings();
        const registrationOpen = settings?.allowPublicRegistration ?? false;
        if (!registrationOpen) {
          console.log(`[OAuth] Registration blocked for new user: ${userInfo.email} (public registration is disabled)`);
          // Redirect to a friendly error page
          res.redirect(302, "/?error=registration_closed");
          return;
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Auto-provision default workspace for users who have none
      await ensureDefaultOrg(userInfo.openId, userInfo.name || null, userInfo.email ?? null);

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
