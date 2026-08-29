/**
 * Shared campaign unsubscribe processing + events table bootstrap.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { emailCampaigns, emailListSubscribers, emailLists, emailUnsubscribes, orgMembers, users } from "../../drizzle/schema";
import type { getDb } from "../db";
import { addToSendGridGlobalUnsubscribes } from "./sendgridSuppressions";
import {
  getEmailCampaignAppUrl,
  recordEmailCampaignEvent,
} from "./emailCampaignTracking";
type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type CampaignUnsubscribeResult =
  | { ok: true; userId: number | null; email: string; alreadyUnsubscribed: boolean; listSubscriberId?: number | null }
  | { ok: false; reason: "invalid" | "not_found" | "db_unavailable" };

const CAMPAIGN_UNSUBSCRIBE_TOKEN_PREFIX = "ec1";
const CAMPAIGN_UNSUBSCRIBE_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;

type CampaignRecipientUnsubscribePayload = {
  v: 1;
  campaignId: number;
  orgId: number;
  email: string;
  recipientKey: string;
  userId?: number | null;
  listSubscriberId?: number | null;
  exp: number;
};

function getSecret(): string {
  return process.env.JWT_SECRET ?? "teachific-default-secret";
}

function signCampaignUnsubscribePayload(encodedPayload: string): string {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildCampaignRecipientUnsubscribeToken(input: {
  campaignId: number;
  orgId: number;
  email: string;
  recipientKey: string;
  userId?: number | null;
  listSubscriberId?: number | null;
}): string {
  const payload: CampaignRecipientUnsubscribePayload = {
    v: 1,
    campaignId: input.campaignId,
    orgId: input.orgId,
    email: normalizeEmail(input.email),
    recipientKey: input.recipientKey,
    userId: input.userId ?? null,
    listSubscriberId: input.listSubscriberId ?? null,
    exp: Date.now() + CAMPAIGN_UNSUBSCRIBE_TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signCampaignUnsubscribePayload(encodedPayload);
  return `${CAMPAIGN_UNSUBSCRIBE_TOKEN_PREFIX}.${encodedPayload}.${signature}`;
}

function verifyCampaignRecipientUnsubscribeToken(token: string): CampaignRecipientUnsubscribePayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== CAMPAIGN_UNSUBSCRIBE_TOKEN_PREFIX) return null;
  const [, encodedPayload, signature] = parts;
  const expected = signCampaignUnsubscribePayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as CampaignRecipientUnsubscribePayload;
    if (parsed.v !== 1 || parsed.exp < Date.now()) return null;
    if (!parsed.campaignId || !parsed.orgId || !parsed.email || !parsed.recipientKey) return null;
    return { ...parsed, email: normalizeEmail(parsed.email) };
  } catch {
    return null;
  }
}

async function ensureOrgEmailSuppression(
  db: DbClient,
  email: string,
  orgId: number,
  userId: number | null,
  reason: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const [existing] = await db
    .select({ id: emailUnsubscribes.id })
    .from(emailUnsubscribes)
    .where(and(eq(emailUnsubscribes.email, normalized), eq(emailUnsubscribes.orgId, orgId)))
    .limit(1);
  if (existing) return true;
  await db.insert(emailUnsubscribes).values({
    userId,
    email: normalized,
    orgId,
    reason,
  });
  return false;
}

async function processSignedCampaignRecipientUnsubscribe(
  db: DbClient,
  token: string,
  campaignId?: number,
): Promise<CampaignUnsubscribeResult | null> {
  const payload = verifyCampaignRecipientUnsubscribeToken(token);
  if (!payload) return null;
  if (campaignId && campaignId !== payload.campaignId) return { ok: false, reason: "invalid" };

  const [campaign] = await db
    .select({ id: emailCampaigns.id, orgId: emailCampaigns.orgId })
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.id, payload.campaignId), eq(emailCampaigns.orgId, payload.orgId)))
    .limit(1);
  if (!campaign) return { ok: false, reason: "not_found" };

  let email = payload.email;
  let userId = payload.userId ?? null;
  let alreadyListUnsubscribed = false;

  if (payload.listSubscriberId) {
    const [subscriber] = await db
      .select({
        id: emailListSubscribers.id,
        email: emailListSubscribers.email,
        userId: emailListSubscribers.userId,
        status: emailListSubscribers.status,
        unsubscribedAt: emailListSubscribers.unsubscribedAt,
      })
      .from(emailListSubscribers)
      .innerJoin(emailLists, eq(emailListSubscribers.listId, emailLists.id))
      .where(
        and(
          eq(emailListSubscribers.id, payload.listSubscriberId),
          eq(emailLists.orgId, payload.orgId),
          eq(emailListSubscribers.email, payload.email),
        ),
      )
      .limit(1);
    if (!subscriber) return { ok: false, reason: "not_found" };
    email = normalizeEmail(subscriber.email);
    userId = subscriber.userId ?? userId;
    alreadyListUnsubscribed = subscriber.status === "unsubscribed" || !!subscriber.unsubscribedAt;
    if (!alreadyListUnsubscribed) {
      await db
        .update(emailListSubscribers)
        .set({ status: "unsubscribed", unsubscribedAt: new Date() })
        .where(eq(emailListSubscribers.id, subscriber.id));
    }
  }

  const alreadyOrgSuppressed = await ensureOrgEmailSuppression(
    db,
    email,
    payload.orgId,
    userId,
    payload.listSubscriberId ? "campaign_list_unsubscribe" : "campaign_email_unsubscribe",
  );

  try {
    await recordEmailCampaignEvent(db, {
      campaignId: payload.campaignId,
      recipientKey: payload.recipientKey,
      eventType: "unsubscribe",
    });
  } catch (err) {
    console.error("[EmailCampaign] Failed to record anonymous unsubscribe event:", err);
  }

  return {
    ok: true,
    userId,
    email,
    alreadyUnsubscribed: alreadyListUnsubscribed || alreadyOrgSuppressed,
    listSubscriberId: payload.listSubscriberId ?? null,
  };
}
/** Human-facing unsubscribe page (footer link in email body). */
export function buildUnsubscribePageUrl(token: string, campaignId?: number, baseUrl?: string): string {
  const appUrl = (baseUrl || getEmailCampaignAppUrl()).replace(/\/$/, "");
  const params = new URLSearchParams({ token });
  if (campaignId) params.set("campaignId", String(campaignId));
  return `${appUrl}/unsubscribe?${params.toString()}`;
}
/** RFC 8058 one-click unsubscribe API URL (List-Unsubscribe header). */
export function buildListUnsubscribeApiUrl(token: string, campaignId?: number, baseUrl?: string): string {
  const appUrl = (baseUrl || getEmailCampaignAppUrl()).replace(/\/$/, "");
  const params = new URLSearchParams({ token });
  if (campaignId) params.set("campaignId", String(campaignId));
  return `${appUrl}/api/email/campaign-unsubscribe?${params.toString()}`;
}
const EVENTS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS emailCampaignEvents (
  id int NOT NULL AUTO_INCREMENT,
  campaignId int NOT NULL,
  userId int DEFAULT NULL,
  recipientKey varchar(128) NOT NULL,
  eventType enum('open','click','unsubscribe') NOT NULL,
  metadata text,
  country varchar(100) DEFAULT NULL,
  region varchar(100) DEFAULT NULL,
  city varchar(100) DEFAULT NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_campaign_events_campaign (campaignId, eventType),
  KEY idx_email_campaign_events_recipient (campaignId, recipientKey)
)`;

let eventsTableEnsured = false;

/** Idempotent bootstrap — ensures tracking works even if migration was not run manually. */
export async function ensureEmailCampaignEventsTable(db: DbClient): Promise<void> {
  if (eventsTableEnsured) return;
  try {
    await db.execute(sql.raw(EVENTS_TABLE_DDL));
    eventsTableEnsured = true;
  } catch (err) {
    console.error("[EmailCampaign] Failed to ensure emailCampaignEvents table:", err);
  }
}
/** Process an unsubscribe request given a JWT token (stored in users.unsubscribeToken). */
export async function processCampaignUnsubscribe(
  db: DbClient,
  token: string,
  campaignId?: number,
): Promise<CampaignUnsubscribeResult> {
  const signedResult = await processSignedCampaignRecipientUnsubscribe(db, token, campaignId);
  if (signedResult) return signedResult;

  const [u] = await db
    .select({ id: users.id, email: users.email, unsubscribedAt: users.unsubscribedAt })
    .from(users)
    .where(eq(users.unsubscribeToken, token))
    .limit(1);

  if (!u || !u.email) return { ok: false, reason: "not_found" };

  const alreadyUnsubscribed = !!u.unsubscribedAt;

  if (!alreadyUnsubscribed) {
    await db
      .update(users)
      .set({ unsubscribedAt: new Date() })
      .where(eq(users.id, u.id));
    if (u.email) {
      await addToSendGridGlobalUnsubscribes([u.email]).catch((err) =>
        console.error("[CampaignUnsubscribe] SendGrid error:", err),
      );
    }
  }

  if (campaignId) {
    try {
      const [campaignForUser] = await db
        .select({ id: emailCampaigns.id })
        .from(emailCampaigns)
        .innerJoin(orgMembers, eq(orgMembers.orgId, emailCampaigns.orgId))
        .where(and(eq(emailCampaigns.id, campaignId), eq(orgMembers.userId, u.id)))
        .limit(1);
      if (campaignForUser) {
        await recordEmailCampaignEvent(db, {
          campaignId,
          recipientKey: `u${u.id}`,
          userId: u.id,
          eventType: "unsubscribe",
        });
      }
    } catch (err) {
      console.error("[EmailCampaign] Failed to record unsubscribe event:", err);
    }
  }

  return { ok: true, userId: u.id, email: u.email, alreadyUnsubscribed };
}
