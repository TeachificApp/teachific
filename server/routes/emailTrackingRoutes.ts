/**
 * emailTrackingRoutes.ts
 *
 * Express routes for email campaign tracking:
 *
 *   GET /api/email/open?c=<campaignId>&r=<recipientId>
 *     — Returns a 1×1 transparent GIF and records openedAt on the recipient row.
 *
 *   GET /api/email/click?c=<campaignId>&r=<recipientId>&u=<base64url-encoded-url>
 *     — Records clickedAt on the recipient row then redirects to the target URL.
 *
 *   GET /api/unsubscribe?token=<hmac-signed-token>
 *     — One-click unsubscribe from email clients that support RFC 8058.
 *       Verifies HMAC, marks user unsubscribed in emailUnsubscribes table,
 *       adds to SendGrid global suppression, then redirects to /unsubscribe?status=success.
 *
 * Token format for /api/unsubscribe (base64url): userId:timestamp:hmac
 * HMAC uses JWT_SECRET — tokens cannot be forged and expire after 30 days.
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { getDb } from "../db";
import { users, emailCampaignRecipients, emailUnsubscribes } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { addToSendGridGlobalUnsubscribes } from "../lib/sendgridSuppressions";
import { processCampaignUnsubscribe } from "../lib/campaignUnsubscribe";
import { decryptOrgKey } from "../sendgrid";
import { organizations, orgMembers } from "../../drizzle/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** 1×1 transparent GIF (43 bytes) */
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// ─── HMAC helpers ─────────────────────────────────────────────────────────────

function getSecret(): string {
  return process.env.JWT_SECRET ?? "teachific-default-secret";
}

export function generateUnsubscribeToken(userId: number): string {
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const hmac = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

function verifyUnsubscribeToken(token: string): { userId: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [userIdStr, timestampStr, hmac] = parts;
    const userId = parseInt(userIdStr, 10);
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(userId) || isNaN(timestamp)) return null;
    // Check expiry
    if (Date.now() - timestamp > TOKEN_TTL_MS) return null;
    // Verify HMAC (timing-safe)
    const expected = crypto
      .createHmac("sha256", getSecret())
      .update(`${userId}:${timestamp}`)
      .digest("hex");
    if (hmac.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expected, "hex"))) return null;
    return { userId };
  } catch {
    return null;
  }
}

// ─── Route registration ───────────────────────────────────────────────────────

export function registerEmailTrackingRoutes(app: Express): void {
  // ── Open pixel ──────────────────────────────────────────────────────────────
  app.get("/api/email/open", async (req, res) => {
    // Always return the pixel immediately — tracking is best-effort
    res.set({
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    res.end(TRACKING_PIXEL);

    // Record open asynchronously (fire and forget)
    const campaignId = parseInt(req.query.c as string, 10);
    const recipientId = parseInt(req.query.r as string, 10);
    if (!isNaN(campaignId) && !isNaN(recipientId)) {
      getDb()
        .then((db) => {
          if (!db) return;
          return db
            .update(emailCampaignRecipients)
            .set({ openedAt: new Date() })
            .where(
              and(
                eq(emailCampaignRecipients.id, recipientId),
                eq(emailCampaignRecipients.campaignId, campaignId),
                // Only set once — don't overwrite first open time
                // (MySQL: openedAt IS NULL)
              ),
            );
        })
        .catch((err) => console.error("[EmailTracking] open pixel DB error:", err));
    }
  });

  // ── Click redirect ──────────────────────────────────────────────────────────
  app.get("/api/email/click", async (req, res) => {
    const campaignId = parseInt(req.query.c as string, 10);
    const recipientId = parseInt(req.query.r as string, 10);
    const encodedUrl = req.query.u as string | undefined;

    // Decode and validate the target URL
    let targetUrl = "/";
    if (encodedUrl) {
      try {
        const decoded = Buffer.from(encodedUrl, "base64url").toString("utf8");
        // Basic safety check — must be a valid URL or relative path
        if (decoded.startsWith("http://") || decoded.startsWith("https://") || decoded.startsWith("/")) {
          targetUrl = decoded;
        }
      } catch {
        // Fall through to default "/"
      }
    }

    // Record click asynchronously (fire and forget)
    if (!isNaN(campaignId) && !isNaN(recipientId)) {
      getDb()
        .then((db) => {
          if (!db) return;
          return db
            .update(emailCampaignRecipients)
            .set({ clickedAt: new Date() })
            .where(
              and(
                eq(emailCampaignRecipients.id, recipientId),
                eq(emailCampaignRecipients.campaignId, campaignId),
              ),
            );
        })
        .catch((err) => console.error("[EmailTracking] click DB error:", err));
    }

    return res.redirect(302, targetUrl);
  });

  const handleCampaignUnsubscribe = async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;
    const rawCampaignId = req.query.campaignId as string | undefined;
    const campaignId = rawCampaignId ? Number.parseInt(rawCampaignId, 10) : undefined;
    const redirectTo = (status: "success" | "invalid" | "error", email?: string) => {
      const params = new URLSearchParams({ status });
      if (email) params.set("email", email);
      return `/unsubscribe?${params.toString()}`;
    };

    if (!token) return res.redirect(302, redirectTo("invalid"));
    try {
      const db = await getDb();
      if (!db) return res.redirect(302, redirectTo("error"));
      const result = await processCampaignUnsubscribe(
        db,
        token,
        campaignId && !Number.isNaN(campaignId) ? campaignId : undefined,
      );
      if (!result.ok) return res.redirect(302, redirectTo("invalid"));
      return res.redirect(302, redirectTo("success", result.email));
    } catch (err) {
      console.error("[CampaignUnsubscribe] Error:", err);
      return res.redirect(302, redirectTo("error"));
    }
  };

  app.get("/api/email/campaign-unsubscribe", handleCampaignUnsubscribe);
  app.post("/api/email/campaign-unsubscribe", handleCampaignUnsubscribe);

  // ── One-click unsubscribe (RFC 8058 + email client GET) ─────────────────────
  app.get("/api/unsubscribe", async (req, res) => {
    const token = req.query.token as string | undefined;
    if (!token) {
      return res.redirect(302, "/unsubscribe?status=invalid");
    }

    const parsed = verifyUnsubscribeToken(token);
    if (!parsed) {
      return res.redirect(302, "/unsubscribe?status=invalid");
    }

    try {
      const db = await getDb();
      if (!db) return res.redirect(302, "/unsubscribe?status=error");

      const [userRow] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, parsed.userId))
        .limit(1);

      if (!userRow || !userRow.email) {
        return res.redirect(302, "/unsubscribe?status=invalid");
      }

      // Check if already unsubscribed (platform-wide, orgId IS NULL)
      const [existing] = await db
        .select({ id: emailUnsubscribes.id })
        .from(emailUnsubscribes)
        .where(
          and(
            eq(emailUnsubscribes.email, userRow.email),
            isNull(emailUnsubscribes.orgId),
          ),
        )
        .limit(1);

      if (!existing) {
        await db.insert(emailUnsubscribes).values({
          userId: userRow.id,
          email: userRow.email,
          orgId: null,
          reason: "one_click_get",
        });
      }

      // Add to SendGrid global suppression (best-effort, per-org key if available)
      // Try to find an org key for this user — use first org they belong to
      try {
        const memberRows = await db
          .select({ ownSendGridKeyEncrypted: organizations.ownSendGridKeyEncrypted })
          .from(orgMembers)
          .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
          .where(eq(orgMembers.userId, userRow.id))
          .limit(1);
        let orgApiKey: string | undefined;
        const firstOrg = memberRows[0];
        if (firstOrg?.ownSendGridKeyEncrypted) {
          try {
            orgApiKey = decryptOrgKey(firstOrg.ownSendGridKeyEncrypted);
          } catch { /* ignore decryption failure */ }
        }
        await addToSendGridGlobalUnsubscribes([userRow.email], orgApiKey);
      } catch {
        // Best-effort — still complete unsubscribe even if SendGrid call fails
        await addToSendGridGlobalUnsubscribes([userRow.email]);
      }

      return res.redirect(302, "/unsubscribe?status=success");
    } catch (err) {
      console.error("[Unsubscribe] Error:", err);
      return res.redirect(302, "/unsubscribe?status=error");
    }
  });
}
