import { and, eq, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  orderBumps,
  orderBumpConversions,
  privateInvites,
  digitalProducts,
  quizzes,
  courses,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db) _db = drizzle(process.env.DATABASE_URL as string);
  return _db;
}
const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});

// ─── Order Bumps CRUD ─────────────────────────────────────────────────────────

export async function listOrderBumps(orgId: number) {
  return db
    .select()
    .from(orderBumps)
    .where(eq(orderBumps.orgId, orgId))
    .orderBy(asc(orderBumps.sortOrder), desc(orderBumps.createdAt));
}

export async function getOrderBump(id: number) {
  const [bump] = await db.select().from(orderBumps).where(eq(orderBumps.id, id)).limit(1);
  return bump ?? null;
}

export async function getOrderBumpsForProduct(
  orgId: number,
  productType: "course" | "download" | "quiz",
  productId: number,
  placement?: "before_checkout" | "during_checkout" | "after_checkout"
) {
  const conditions = [
    eq(orderBumps.orgId, orgId),
    eq(orderBumps.triggerProductType, productType),
    eq(orderBumps.triggerProductId, productId),
    eq(orderBumps.isActive, true),
  ];
  if (placement) {
    conditions.push(eq(orderBumps.placement, placement));
  }
  return db
    .select()
    .from(orderBumps)
    .where(and(...conditions))
    .orderBy(asc(orderBumps.sortOrder));
}

export async function createOrderBump(data: {
  orgId: number;
  name: string;
  triggerProductType: "course" | "download" | "quiz";
  triggerProductId: number;
  bumpProductType: "course" | "download" | "quiz";
  bumpProductId: number;
  placement?: "before_checkout" | "during_checkout" | "after_checkout";
  headline?: string;
  description?: string;
  discountPercent?: number;
  discountedPrice?: string;
  landingPageJson?: any;
  buttonText?: string;
  declineText?: string;
  imageUrl?: string;
}) {
  const [result] = await db.insert(orderBumps).values(data as any);
  return result.insertId;
}

export async function updateOrderBump(
  id: number,
  data: Partial<{
    name: string;
    triggerProductType: "course" | "download" | "quiz";
    triggerProductId: number;
    bumpProductType: "course" | "download" | "quiz";
    bumpProductId: number;
    placement: "before_checkout" | "during_checkout" | "after_checkout";
    headline: string;
    description: string;
    discountPercent: number;
    discountedPrice: string;
    landingPageJson: any;
    buttonText: string;
    declineText: string;
    imageUrl: string;
    isActive: boolean;
    sortOrder: number;
  }>
) {
  await db.update(orderBumps).set(data as any).where(eq(orderBumps.id, id));
}

export async function deleteOrderBump(id: number) {
  await db.delete(orderBumps).where(eq(orderBumps.id, id));
}

// ─── Order Bump Conversions ───────────────────────────────────────────────────

export async function recordBumpConversion(data: {
  bumpId: number;
  orgId: number;
  triggerOrderId?: number;
  bumpOrderId?: number;
  buyerEmail?: string;
  accepted: boolean;
  sessionId?: string;
}) {
  const [result] = await db.insert(orderBumpConversions).values(data as any);
  return result.insertId;
}

export async function getBumpConversionStats(bumpId: number) {
  const conversions = await db
    .select()
    .from(orderBumpConversions)
    .where(eq(orderBumpConversions.bumpId, bumpId));
  const total = conversions.length;
  const accepted = conversions.filter((c) => c.accepted).length;
  return { total, accepted, declined: total - accepted, rate: total > 0 ? Math.round((accepted / total) * 100) : 0 };
}

// ─── Private Invites ──────────────────────────────────────────────────────────

export async function createPrivateInvite(data: {
  orgId: number;
  productType: "course" | "download" | "quiz";
  productId: number;
  email: string;
  inviteToken: string;
  invitedBy: number;
  expiresAt?: Date | null;
}) {
  const [result] = await db.insert(privateInvites).values(data as any);
  return result.insertId;
}

export async function getPrivateInviteByToken(token: string) {
  const [invite] = await db
    .select()
    .from(privateInvites)
    .where(eq(privateInvites.inviteToken, token))
    .limit(1);
  return invite ?? null;
}

export async function listPrivateInvites(orgId: number, productType: "course" | "download" | "quiz", productId: number) {
  return db
    .select()
    .from(privateInvites)
    .where(
      and(
        eq(privateInvites.orgId, orgId),
        eq(privateInvites.productType, productType),
        eq(privateInvites.productId, productId)
      )
    )
    .orderBy(desc(privateInvites.createdAt));
}

export async function acceptPrivateInvite(token: string) {
  await db
    .update(privateInvites)
    .set({ status: "accepted", acceptedAt: new Date() } as any)
    .where(eq(privateInvites.inviteToken, token));
}

export async function deletePrivateInvite(id: number) {
  await db.delete(privateInvites).where(eq(privateInvites.id, id));
}

// ─── Visibility Helpers ───────────────────────────────────────────────────────

export async function updateCourseVisibility(courseId: number, visibility: "draft" | "published" | "hidden" | "private" | "archived") {
  await db.update(courses).set({ status: visibility } as any).where(eq(courses.id, courseId));
}

export async function updateDownloadVisibility(productId: number, visibility: "draft" | "published" | "hidden" | "private" | "archived") {
  await db.update(digitalProducts).set({ visibility } as any).where(eq(digitalProducts.id, productId));
}

export async function updateQuizVisibility(quizId: number, visibility: "draft" | "published" | "hidden" | "private" | "archived") {
  await db.update(quizzes).set({ visibility } as any).where(eq(quizzes.id, quizId));
}
