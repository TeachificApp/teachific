import sgMail from "@sendgrid/mail";
import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from "crypto";

const PLATFORM_SENDGRID_KEY = process.env.SENDGRID_API_KEY ?? "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "hello@teachific.net";
const FROM_NAME = process.env.SENDGRID_FROM_NAME ?? "Teachific";

if (PLATFORM_SENDGRID_KEY) {
  sgMail.setApiKey(PLATFORM_SENDGRID_KEY);
}

// ─── Encryption helpers for per-org keys ─────────────────────────────────────
const ENC_KEY = scryptSync(process.env.JWT_SECRET ?? "teachific-default", "salt", 32);

export function encryptOrgKey(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", ENC_KEY, iv);
  return iv.toString("hex") + ":" + cipher.update(plain, "utf8", "hex") + cipher.final("hex");
}

export function decryptOrgKey(enc: string): string {
  const [ivHex, data] = enc.split(":");
  if (!ivHex || !data) throw new Error("Invalid encrypted key format");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", ENC_KEY, iv);
  return decipher.update(data, "hex", "utf8") + decipher.final("utf8");
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  /** Optional: use this SendGrid API key instead of the platform key */
  apiKey?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const apiKey = opts.apiKey ?? PLATFORM_SENDGRID_KEY;
  if (!apiKey) {
    console.warn("[SendGrid] No API key configured — email not sent:", opts.subject);
    return false;
  }
  // When using a custom per-org key, set it on the global instance temporarily
  // (sgMail is stateless per-call once key is set)
  if (opts.apiKey) {
    sgMail.setApiKey(opts.apiKey);
  }
  try {
    await sgMail.send({
      to: opts.to,
      from: {
        email: opts.fromEmail ?? FROM_EMAIL,
        name: opts.fromName ?? FROM_NAME,
      },
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      // Disable SendGrid's built-in link rewriting — we inject our own tracking
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
      },
    });
    return true;
  } catch (err: any) {
    console.error("[SendGrid] Send failed:", err?.response?.body ?? err);
    return false;
  } finally {
    // Restore platform key after per-org send
    if (opts.apiKey && PLATFORM_SENDGRID_KEY) {
      sgMail.setApiKey(PLATFORM_SENDGRID_KEY);
    }
  }
}

/**
 * Send an email using an org's own SendGrid key (decrypted on the fly).
 * Falls back to the platform key if the org has no own key configured.
 */
export async function sendOrgEmail(
  opts: Omit<SendEmailOptions, "apiKey">,
  orgConfig: {
    ownSendGridKeyEncrypted?: string | null;
    customSenderName?: string | null;
    customSenderEmail?: string | null;
  },
): Promise<boolean> {
  let apiKey: string | undefined;
  if (orgConfig.ownSendGridKeyEncrypted) {
    try {
      apiKey = decryptOrgKey(orgConfig.ownSendGridKeyEncrypted);
    } catch (e) {
      console.error("[SendGrid] Failed to decrypt org key, falling back to platform key:", e);
    }
  }
  return sendEmail({
    ...opts,
    fromName: opts.fromName ?? orgConfig.customSenderName ?? undefined,
    fromEmail: opts.fromEmail ?? orgConfig.customSenderEmail ?? undefined,
    ...(apiKey ? { apiKey } : {}),
  });
}

/** Replace merge tags in a template string.
 *  Supported tags: {{user_name}}, {{org_name}}, {{course_title}},
 *  {{unsubscribe_url}}, {{site_url}}, {{year}}
 */
export function resolveMergeTags(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Build an unsubscribe token: base64url(orgId:userId:timestamp) */
export function buildUnsubscribeToken(orgId: number, userId: number): string {
  const payload = `${orgId}:${userId}:${Date.now()}`;
  return Buffer.from(payload).toString("base64url");
}

/** Parse an unsubscribe token back to { orgId, userId } */
export function parseUnsubscribeToken(
  token: string
): { orgId: number; userId: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length < 2) return null;
    const orgId = parseInt(parts[0]);
    const userId = parseInt(parts[1]);
    if (isNaN(orgId) || isNaN(userId)) return null;
    return { orgId, userId };
  } catch {
    return null;
  }
}

/** Validate a SendGrid API key by calling the API.
 * If no key is provided, validates the platform key.
 */
export async function validateSendGridKey(apiKey?: string): Promise<boolean> {
  const key = apiKey ?? PLATFORM_SENDGRID_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}
