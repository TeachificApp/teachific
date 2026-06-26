/**
 * sendgridSuppressions.ts
 *
 * Helpers for managing SendGrid's Global Unsubscribe (suppression) list.
 *
 * When a user unsubscribes from a Teachific org campaign, their email is added
 * to SendGrid's global suppression list for that org's SendGrid account.
 * SendGrid will then automatically block delivery to that address for all sends
 * from that account — regardless of which campaign triggers the send.
 *
 * If an org has no own SendGrid key, the platform key is used as fallback.
 *
 * API reference:
 *   POST   https://api.sendgrid.com/v3/asm/suppressions/global
 *   GET    https://api.sendgrid.com/v3/asm/suppressions/global/{email}
 *   DELETE https://api.sendgrid.com/v3/asm/suppressions/global/{email}
 */

const PLATFORM_SENDGRID_KEY = process.env.SENDGRID_API_KEY ?? "";
const SENDGRID_API_BASE = "https://api.sendgrid.com/v3";

/**
 * Add one or more email addresses to SendGrid's Global Unsubscribe list.
 * Safe to call multiple times — SendGrid deduplicates automatically.
 * Fails silently (logs error) so it never blocks the main unsubscribe flow.
 *
 * @param emails  List of email addresses to suppress.
 * @param apiKey  Optional per-org SendGrid API key. Falls back to platform key.
 */
export async function addToSendGridGlobalUnsubscribes(
  emails: string[],
  apiKey?: string,
): Promise<void> {
  const key = apiKey ?? PLATFORM_SENDGRID_KEY;
  if (!key) {
    console.warn("[SendGridSuppressions] No SendGrid API key available — skipping global unsubscribe.");
    return;
  }
  if (emails.length === 0) return;

  // Normalize: lowercase, trim, deduplicate
  const normalized = Array.from(
    new Set(emails.map((e) => e.toLowerCase().trim()).filter(Boolean)),
  );

  try {
    const res = await fetch(`${SENDGRID_API_BASE}/asm/suppressions/global`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_emails: normalized }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[SendGridSuppressions] Failed to add ${normalized.length} email(s) to global unsubscribes: HTTP ${res.status} — ${body}`,
      );
    } else {
      console.log(
        `[SendGridSuppressions] Added ${normalized.length} email(s) to SendGrid global unsubscribe list.`,
      );
    }
  } catch (err) {
    console.error("[SendGridSuppressions] Network error adding to global unsubscribes:", err);
  }
}

/**
 * Check if an email is on SendGrid's Global Unsubscribe list.
 * Returns true if suppressed, false if not (or if API unavailable).
 *
 * @param email   Email address to check.
 * @param apiKey  Optional per-org SendGrid API key. Falls back to platform key.
 */
export async function isOnSendGridGlobalUnsubscribes(
  email: string,
  apiKey?: string,
): Promise<boolean> {
  const key = apiKey ?? PLATFORM_SENDGRID_KEY;
  if (!key) return false;
  const encoded = encodeURIComponent(email.toLowerCase().trim());
  try {
    const res = await fetch(`${SENDGRID_API_BASE}/asm/suppressions/global/${encoded}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    return false;
  } catch {
    return false;
  }
}

/**
 * Remove an email from SendGrid's Global Unsubscribe list (re-subscribe).
 * Use with caution — only call when the user explicitly opts back in.
 *
 * @param email   Email address to re-enable.
 * @param apiKey  Optional per-org SendGrid API key. Falls back to platform key.
 */
export async function removeFromSendGridGlobalUnsubscribes(
  email: string,
  apiKey?: string,
): Promise<void> {
  const key = apiKey ?? PLATFORM_SENDGRID_KEY;
  if (!key) return;
  const encoded = encodeURIComponent(email.toLowerCase().trim());
  try {
    const res = await fetch(`${SENDGRID_API_BASE}/asm/suppressions/global/${encoded}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok && res.status !== 404) {
      console.error(
        `[SendGridSuppressions] Failed to remove ${email} from global unsubscribes: HTTP ${res.status}`,
      );
    } else {
      console.log(`[SendGridSuppressions] Removed ${email} from SendGrid global unsubscribe list.`);
    }
  } catch (err) {
    console.error("[SendGridSuppressions] Network error removing from global unsubscribes:", err);
  }
}
