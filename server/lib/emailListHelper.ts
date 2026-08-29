/**
 * emailListHelper.ts
 * Shared helpers for managing email lists and subscribers.
 *
 * Key exports:
 *   addToEmailList(email, name?, options?) — upsert a subscriber into a list
 *   addToAllContacts(email, name?, options?) — add to the organization "All Contacts" list
 *   ensureAllContactsList(orgId?) — get or create an organization "All Contacts" list, returns its ID
 *   backfillAllContacts() — one-time backfill of all existing users into All Contacts
 */

import { eq, and, sql, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { emailLists, emailListSubscribers, orgMembers, users } from "../../drizzle/schema";

// Cache the All Contacts list ID by organization so tenants never share the same
// implicit contact list. The "platform" key preserves legacy site-level callers.
const allContactsListIds = new Map<string, number>();

function allContactsCacheKey(orgId?: number | null): string {
  return orgId == null ? "platform" : `org:${orgId}`;
}

function listOrgCondition(orgId?: number | null) {
  return orgId == null ? isNull(emailLists.orgId) : eq(emailLists.orgId, orgId);
}

/** Get or create the organization-scoped "All Contacts" email list. Returns its ID. */
export async function ensureAllContactsList(orgId?: number | null): Promise<number> {
  const cacheKey = allContactsCacheKey(orgId);
  const cached = allContactsListIds.get(cacheKey);
  if (cached) return cached;
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Try to find existing
  const existing = await db
    .select({ id: emailLists.id })
    .from(emailLists)
    .where(and(eq(emailLists.name, "All Contacts"), listOrgCondition(orgId)))
    .limit(1);

  if (existing[0]) {
    allContactsListIds.set(cacheKey, existing[0].id);
    return existing[0].id;
  }

  // Create it
  const [result] = await db.insert(emailLists).values({
    name: "All Contacts",
    description: "Automatically populated with every contact who interacts with the platform (registrations, purchases, enrollments, form submissions).",
    isActive: true,
    subscriberCount: 0,
    orgId: orgId ?? null,
  });
  const listId = (result as any).insertId as number;
  allContactsListIds.set(cacheKey, listId);
  return listId;
}

export interface AddToListOptions {
  orgId?: number | null;
  userId?: number;
  source?: string;       // "registration" | "purchase" | "enrollment" | "form" | "content_block" | "manual" | "import"
  sourceId?: string;     // e.g. formId, productId
  metadata?: Record<string, unknown>;
}

/**
 * Upsert a subscriber into a specific email list.
 * If the subscriber already exists (same listId + email), updates name/userId/metadata.
 * Skips if email is empty or the subscriber has unsubscribed from this list.
 */
export async function addToEmailList(
  listId: number,
  email: string,
  name?: string | null,
  options: AddToListOptions = {},
): Promise<void> {
  if (!email || !email.trim()) return;
  const normalizedEmail = email.trim().toLowerCase();

  const db = await getDb();
  if (!db) return;

  if (options.orgId !== undefined) {
    const [list] = await db
      .select({ orgId: emailLists.orgId })
      .from(emailLists)
      .where(eq(emailLists.id, listId))
      .limit(1);
    const actualOrgId = list?.orgId ?? null;
    const expectedOrgId = options.orgId ?? null;
    if (!list || actualOrgId !== expectedOrgId) {
      throw new Error("Email list does not belong to the active organization.");
    }
  }

  try {
    // Check if already subscribed (any status)
    const existing = await db
      .select({ id: emailListSubscribers.id, status: emailListSubscribers.status })
      .from(emailListSubscribers)
      .where(
        and(
          eq(emailListSubscribers.listId, listId),
          eq(emailListSubscribers.email, normalizedEmail),
        ),
      )
      .limit(1);

    if (existing[0]) {
      // If they previously unsubscribed from this list, don't re-add
      if (existing[0].status === "unsubscribed") return;
      // Update name/userId if we have better info
      if (name || options.userId) {
        await db
          .update(emailListSubscribers)
          .set({
            ...(name ? { name } : {}),
            ...(options.userId ? { userId: options.userId } : {}),
          })
          .where(eq(emailListSubscribers.id, existing[0].id));
      }
      return;
    }

    // Insert new subscriber
    await db.insert(emailListSubscribers).values({
      listId,
      email: normalizedEmail,
      name: name ?? null,
      userId: options.userId ?? null,
      source: options.source ?? "manual",
      sourceId: options.sourceId ?? null,
      status: "subscribed",
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    });

    // Increment subscriber count
    await db
      .update(emailLists)
      .set({ subscriberCount: sql`subscriberCount + 1` })
      .where(eq(emailLists.id, listId));
  } catch (err: any) {
    // Ignore duplicate key errors (race condition)
    if (err?.code === "ER_DUP_ENTRY") return;
    console.error("[emailListHelper] addToEmailList error:", err);
  }
}

/**
 * Add a contact to the master "All Contacts" list.
 * Safe to call from anywhere — creates the list if it doesn't exist.
 */
export async function addToAllContacts(
  email: string,
  name?: string | null,
  options: AddToListOptions = {},
): Promise<void> {
  try {
    const listId = await ensureAllContactsList(options.orgId ?? null);
    await addToEmailList(listId, email, name, options);
  } catch (err) {
    // Never throw — this is a background operation
    console.error("[emailListHelper] addToAllContacts error:", err);
  }
}

/**
 * One-time backfill: add existing organization members to each organization's
 * own "All Contacts" list. This intentionally avoids the legacy global list so
 * campaign audiences cannot be populated across tenant boundaries.
 */
export async function backfillAllContacts(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Fetch organization members with email addresses who haven't globally unsubscribed.
    const orgUsers = await db
      .select({
        id: users.id,
        orgId: orgMembers.orgId,
        email: users.email,
        name: users.name,
        displayName: users.displayName,
        unsubscribedAt: users.unsubscribedAt,
      })
      .from(users)
      .innerJoin(orgMembers, eq(orgMembers.userId, users.id));

    let added = 0;
    const seen = new Set<string>();
    for (const u of orgUsers) {
      if (!u.email || u.unsubscribedAt) continue;
      const key = `${u.orgId}:${u.email.trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const listId = await ensureAllContactsList(u.orgId);
      const displayName = u.displayName || u.name || null;
      await addToEmailList(listId, u.email, displayName, {
        orgId: u.orgId,
        userId: u.id,
        source: "registration",
      });
      added++;
    }

    console.log(`[emailListHelper] Backfill complete — ${added} organization contacts added to scoped "All Contacts" lists.`);
  } catch (err) {
    console.error("[emailListHelper] backfillAllContacts error:", err);
  }
}
