import { createHmac, timingSafeEqual } from "crypto";
import { and, eq } from "drizzle-orm";
import { emailUnsubscribes } from "../../drizzle/schema";
import { getDb } from "../db";

type Payload = { v: 1; orgId: number; email: string; userId?: number | null; exp: number };
const PREFIX = "ew1";
const TTL_MS = 180 * 24 * 60 * 60 * 1000;

function secret() { return process.env.JWT_SECRET ?? "course360-email-workflow-secret"; }
function sign(encoded: string) { return createHmac("sha256", secret()).update(encoded).digest("base64url"); }

export function buildEmailWorkflowUnsubscribeToken(input: { orgId: number; email: string; userId?: number | null }) {
  const payload: Payload = { v: 1, orgId: input.orgId, email: input.email.trim().toLowerCase(), userId: input.userId ?? null, exp: Date.now() + TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${PREFIX}.${encoded}.${sign(encoded)}`;
}

export async function processEmailWorkflowUnsubscribe(token: string): Promise<{ ok: boolean; email?: string }> {
  const [prefix, encoded, signature] = token.split(".");
  if (prefix !== PREFIX || !encoded || !signature) return { ok: false };
  const expected = sign(encoded);
  const provided = Buffer.from(signature);
  const verified = Buffer.from(expected);
  if (provided.length !== verified.length || !timingSafeEqual(provided, verified)) return { ok: false };
  let payload: Payload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { return { ok: false }; }
  if (payload.v !== 1 || !payload.orgId || !payload.email || payload.exp < Date.now()) return { ok: false };
  const db = await getDb();
  if (!db) return { ok: false };
  const email = payload.email.trim().toLowerCase();
  const [existing] = await db.select({ id: emailUnsubscribes.id }).from(emailUnsubscribes)
    .where(and(eq(emailUnsubscribes.orgId, payload.orgId), eq(emailUnsubscribes.email, email))).limit(1);
  if (!existing) await db.insert(emailUnsubscribes).values({ orgId: payload.orgId, email, userId: payload.userId ?? null, reason: "workflow_unsubscribe" });
  return { ok: true, email };
}
