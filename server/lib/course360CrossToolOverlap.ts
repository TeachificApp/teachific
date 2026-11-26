import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { orgSubscriptions, users } from "../../drizzle/schema";
import {
  course360PaymentLocks,
  course360PaymentCheckouts,
  course360PaymentAppSubscriptions,
} from "./course360PaymentTables";
import type {
  Course360PaymentCheckoutInput,
  Course360PaymentDb,
} from "./course360PaymentLedger";
import { COURSE360_CROSS_TOOL_FAMILY } from "./course360CrossToolCatalog";

const terminal = (status: string | null | undefined) =>
  ["canceled", "cancelled", "incomplete_expired"].includes(status ?? "");
/** Called inside the SAME durable reservation transaction, before product slots. All school/Creator paths serialize here. */
export async function guardCourse360CrossToolOverlap(
  db: Course360PaymentDb,
  input: Course360PaymentCheckoutInput,
  identity: { accountId: string; livemode: boolean }
) {
  if (!input.orgId || !["platform", "creator"].includes(input.product)) return;
  const id = createHash("sha256")
    .update(
      `${identity.accountId}:${identity.livemode}:cross-tool-school:${input.orgId}`
    )
    .digest("hex");
  await db
    .insert(course360PaymentLocks)
    .values({ id })
    .onDuplicateKeyUpdate({ set: { id } });
  await db
    .update(course360PaymentLocks)
    .set({ revision: sql`${course360PaymentLocks.revision} + 1` })
    .where(eq(course360PaymentLocks.id, id));
  const crossTool = input.params.metadata?.type === COURSE360_CROSS_TOOL_FAMILY;
  const pending = await db
    .select()
    .from(course360PaymentCheckouts)
    .where(
      and(
        eq(course360PaymentCheckouts.orgId, input.orgId),
        eq(course360PaymentCheckouts.accountId, identity.accountId),
        eq(course360PaymentCheckouts.livemode, identity.livemode)
      )
    );
  if (crossTool) {
    const [school] = await db
      .select()
      .from(orgSubscriptions)
      .where(eq(orgSubscriptions.orgId, input.orgId))
      .limit(1);
    if (
      school &&
      ((school.stripeSubscriptionId &&
        (!terminal(school.rawStripeStatus ?? school.status) ||
          school.stripeSubscriptionId !== input.previousSubscriptionId)) ||
        (!school.stripeSubscriptionId && school.plan !== "free"))
    )
      throw new Error(
        "Existing school subscription or assigned paid plan overlaps; use a reviewed change flow"
      );
    const apps = await db
      .select()
      .from(course360PaymentAppSubscriptions)
      .where(
        and(
          eq(course360PaymentAppSubscriptions.orgId, input.orgId),
          eq(course360PaymentAppSubscriptions.userId, input.userId!),
          eq(course360PaymentAppSubscriptions.product, "creator")
        )
      );
    if (apps.some(app => !terminal(app.rawStatus)))
      throw new Error(
        "Existing Creator subscription overlaps; use a reviewed change flow"
      );
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, input.userId!))
      .limit(1);
    // Global legacy purchases have no trustworthy school binding: preserve and require review rather than charge twice.
    if (user?.creatorAccess && user.creatorAccess !== "none")
      throw new Error(
        "Historical Creator access requires reviewed reconciliation before package checkout"
      );
    if (
      pending.some(
        p =>
          p.product === "creator" &&
          p.userId === input.userId &&
          ["reserved", "open", "completing"].includes(p.state)
      )
    )
      throw new Error(
        "Creator checkout already pending; package overlap blocked"
      );
  } else if (
    input.product === "creator" &&
    pending.some(
      p =>
        p.product === "platform" &&
        ["reserved", "open", "completing"].includes(p.state) &&
        JSON.parse(p.spec).metadata?.type === COURSE360_CROSS_TOOL_FAMILY &&
        p.userId === input.userId
    )
  ) {
    throw new Error(
      "Package checkout already pending; Creator overlap blocked"
    );
  }
}
