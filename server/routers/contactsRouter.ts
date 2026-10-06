import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import {
  contactActivities,
  contactAuditEvents,
  contactConsents,
  contactCustomFieldDefinitions,
  contactTagAssignments,
  contactTags,
  contacts,
  emailCampaignRecipients,
  emailCampaigns,
  emailListSubscribers,
  emailLists,
  funnelLeads,
  formSubmissions,
  forms,
  generalFormSubmissions,
  generalFormTemplates,
  lmsCourses,
  lmsEnrollments,
  lmsOrders,
  newsletterSubscribers,
  orgMembers,
  users,
  webinarRegistrations,
  webinars,
} from "../../drizzle/schema";
import {
  normalizeContactEmail,
  normalizeContactPhone,
  resolveContactIdentity,
  splitContactName,
} from "../lib/contactIdentity";

const lifecycleStages = ["lead", "subscriber", "learner", "customer", "inactive"] as const;
const consentTypes = ["marketing_email", "marketing_sms", "terms", "privacy", "data_processing"] as const;
const consentStatuses = ["granted", "withdrawn", "pending"] as const;
const customFieldTypes = ["text", "number", "date", "boolean", "select", "url"] as const;

const contactInput = z.object({
  firstName: z.string().trim().max(128).nullable().optional(),
  lastName: z.string().trim().max(128).nullable().optional(),
  displayName: z.string().trim().max(255).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  emailVerified: z.boolean().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  phoneVerified: z.boolean().optional(),
  lifecycleStage: z.enum(lifecycleStages).optional(),
  source: z.string().trim().min(1).max(100).optional(),
  sourceDetail: z.string().trim().max(255).nullable().optional(),
  attribution: z.record(z.string(), z.unknown()).nullable().optional(),
  customFields: z.record(z.string(), z.unknown()).nullable().optional(),
  userId: z.number().int().positive().nullable().optional(),
});

type ContactInput = z.infer<typeof contactInput>;
type ContactSource = "manual" | "member" | "funnel_lead" | "newsletter" | "email_list" | "webinar" | "form";

const lifecycleRank: Record<(typeof lifecycleStages)[number], number> = {
  lead: 1,
  subscriber: 2,
  learner: 3,
  customer: 4,
  inactive: 0,
};

function highestLifecycle(
  current: (typeof lifecycleStages)[number] | null | undefined,
  candidate: (typeof lifecycleStages)[number],
) {
  return lifecycleRank[current ?? "lead"] >= lifecycleRank[candidate] ? current ?? "lead" : candidate;
}

async function requireActiveContactsOrganization(userId: number, role: string) {
  const orgId = await getOrgIdForUserWithFallback(userId, role);
  if (!orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Select an active organization before managing contacts.",
    });
  }
  await requireOrgAdmin(userId, role, orgId);
  return orgId;
}

async function getActiveOrganizationContact(orgId: number, contactId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)))
    .limit(1);
  if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found in the active organization." });
  return { db, contact };
}

async function recordContactAudit(
  db: Awaited<ReturnType<typeof getDb>>,
  values: {
    orgId: number;
    contactId: number;
    actorUserId?: number | null;
    action: string;
    fieldName?: string | null;
    previousValue?: unknown;
    nextValue?: unknown;
    metadata?: Record<string, unknown> | null;
  },
) {
  if (!db) return;
  await db.insert(contactAuditEvents).values({
    orgId: values.orgId,
    contactId: values.contactId,
    actorUserId: values.actorUserId ?? null,
    action: values.action,
    fieldName: values.fieldName ?? null,
    previousValue: values.previousValue ?? null,
    nextValue: values.nextValue ?? null,
    metadata: values.metadata ?? null,
  });
}

async function recordContactActivity(
  db: Awaited<ReturnType<typeof getDb>>,
  values: {
    orgId: number;
    contactId: number;
    actorUserId?: number | null;
    activityType: string;
    summary: string;
    metadata?: Record<string, unknown> | null;
  },
) {
  if (!db) return;
  await db.insert(contactActivities).values({
    orgId: values.orgId,
    contactId: values.contactId,
    actorUserId: values.actorUserId ?? null,
    activityType: values.activityType,
    summary: values.summary,
    metadata: values.metadata ?? null,
  });
}

/**
 * Resolves or creates a contact strictly inside one organization. The helper
 * intentionally never queries contacts without an orgId predicate, preventing
 * shared emails or phones from leaking between schools.
 */
export async function upsertOrganizationContact(
  orgId: number,
  input: ContactInput & { source?: ContactSource | string },
  actorUserId?: number | null,
) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

  const email = input.email === null ? null : normalizeContactEmail(input.email);
  const phone = input.phone === null ? null : normalizeContactPhone(input.phone);
  if (!email && !phone && !input.userId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A contact needs an email address, phone number, or linked user." });
  }

  const [emailContact, phoneContact, userContact] = await Promise.all([
    email
      ? db.select({ id: contacts.id, orgId: contacts.orgId, lifecycleStage: contacts.lifecycleStage }).from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.emailNormalized, email), isNull(contacts.deletedAt))).limit(1)
      : Promise.resolve([]),
    phone
      ? db.select({ id: contacts.id, orgId: contacts.orgId, lifecycleStage: contacts.lifecycleStage }).from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.phoneNormalized, phone), isNull(contacts.deletedAt))).limit(1)
      : Promise.resolve([]),
    input.userId
      ? db.select({ id: contacts.id, orgId: contacts.orgId, lifecycleStage: contacts.lifecycleStage }).from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.userId, input.userId), isNull(contacts.deletedAt))).limit(1)
      : Promise.resolve([]),
  ]);

  const identity = resolveContactIdentity(emailContact[0] ?? userContact[0], phoneContact[0]);
  if (identity.kind === "conflict") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "The supplied email and phone belong to different contacts in this organization. Review the duplicate records before updating either one.",
    });
  }

  const suppliedDisplayName = input.displayName === null
    ? null
    : input.displayName?.trim() || [input.firstName, input.lastName].filter(Boolean).join(" ") || null;

  if (identity.kind === "new") {
    const [result] = await db.insert(contacts).values({
      orgId,
      userId: input.userId ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      displayName: suppliedDisplayName,
      email: input.email?.trim() || null,
      emailNormalized: email,
      emailVerified: input.emailVerified ?? false,
      phone: input.phone?.trim() || null,
      phoneNormalized: phone,
      phoneVerified: input.phoneVerified ?? false,
      lifecycleStage: input.lifecycleStage ?? "lead",
      source: input.source ?? "manual",
      sourceDetail: input.sourceDetail ?? null,
      attribution: input.attribution ?? null,
      customFields: input.customFields ?? null,
    });
    const contactId = Number((result as { insertId: number }).insertId);
    await recordContactAudit(db, {
      orgId, contactId, actorUserId, action: "created", nextValue: { source: input.source ?? "manual" },
    });
    await recordContactActivity(db, {
      orgId, contactId, actorUserId, activityType: "contact_created", summary: "Contact record created.",
    });
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
    return { contact: contact!, created: true };
  }

  const [existing] = await db.select().from(contacts)
    .where(and(eq(contacts.id, identity.contactId), eq(contacts.orgId, orgId), isNull(contacts.deletedAt))).limit(1);
  if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found in the active organization." });

  const nextLifecycle = input.lifecycleStage ? highestLifecycle(existing.lifecycleStage, input.lifecycleStage) : existing.lifecycleStage;
  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
    lifecycleStage: nextLifecycle,
  };
  if (input.userId !== undefined) patch.userId = input.userId;
  if (input.firstName !== undefined) patch.firstName = input.firstName;
  if (input.lastName !== undefined) patch.lastName = input.lastName;
  if (input.displayName !== undefined || input.firstName !== undefined || input.lastName !== undefined) patch.displayName = suppliedDisplayName;
  if (input.email !== undefined) {
    patch.email = input.email?.trim() || null;
    patch.emailNormalized = email;
    patch.emailVerified = input.emailVerified ?? existing.emailVerified;
  }
  if (input.phone !== undefined) {
    patch.phone = input.phone?.trim() || null;
    patch.phoneNormalized = phone;
    patch.phoneVerified = input.phoneVerified ?? existing.phoneVerified;
  }
  if (input.source !== undefined) patch.source = input.source;
  if (input.sourceDetail !== undefined) patch.sourceDetail = input.sourceDetail;
  if (input.attribution !== undefined) patch.attribution = input.attribution;
  if (input.customFields !== undefined) patch.customFields = input.customFields;
  await db.update(contacts).set(patch).where(and(eq(contacts.id, existing.id), eq(contacts.orgId, orgId)));
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, existing.id)).limit(1);
  return { contact: contact!, created: false };
}

function csvCell(value: unknown): string {
  const output = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${output.replace(/"/g, '""')}"`;
}

function parseSourceName(name?: string | null) {
  const split = splitContactName(name);
  return { displayName: name?.trim() || null, ...split };
}

export const contactsRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().trim().max(320).optional(),
      lifecycleStage: z.enum([...lifecycleStages, "all"] as const).default("all"),
      tagId: z.number().int().positive().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(25),
    }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const filter = input ?? { lifecycleStage: "all" as const, page: 1, pageSize: 25 };
      const conditions: any[] = [eq(contacts.orgId, orgId), isNull(contacts.deletedAt)];
      if (filter.lifecycleStage !== "all") conditions.push(eq(contacts.lifecycleStage, filter.lifecycleStage));
      if (filter.search) {
        const term = `%${filter.search}%`;
        conditions.push(or(
          like(contacts.email, term),
          like(contacts.displayName, term),
          like(contacts.firstName, term),
          like(contacts.lastName, term),
          like(contacts.phone, term),
        ));
      }
      if (filter.tagId) {
        const [tag] = await db.select({ id: contactTags.id }).from(contactTags)
          .where(and(eq(contactTags.id, filter.tagId), eq(contactTags.orgId, orgId))).limit(1);
        if (!tag) throw new TRPCError({ code: "NOT_FOUND", message: "Tag not found in the active organization." });
        const tagged = await db.select({ contactId: contactTagAssignments.contactId }).from(contactTagAssignments)
          .where(and(eq(contactTagAssignments.orgId, orgId), eq(contactTagAssignments.tagId, tag.id)));
        const ids = tagged.map(row => row.contactId);
        if (ids.length === 0) return { contacts: [], total: 0, page: filter.page, pageSize: filter.pageSize };
        conditions.push(inArray(contacts.id, ids));
      }
      const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(contacts).where(and(...conditions));
      const rows = await db.select().from(contacts).where(and(...conditions))
        .orderBy(desc(contacts.updatedAt), asc(contacts.id)).limit(filter.pageSize).offset((filter.page - 1) * filter.pageSize);
      return { contacts: rows, total: Number(total), page: filter.page, pageSize: filter.pageSize };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const { db, contact } = await getActiveOrganizationContact(orgId, input.id);
      const [tags, consents, activities, audits, enrollments, purchases, campaignParticipation, webinarParticipation, legacyForms, generalForms] = await Promise.all([
        db.select({ id: contactTags.id, name: contactTags.name, color: contactTags.color })
          .from(contactTagAssignments).innerJoin(contactTags, eq(contactTagAssignments.tagId, contactTags.id))
          .where(and(eq(contactTagAssignments.orgId, orgId), eq(contactTagAssignments.contactId, contact.id), eq(contactTags.orgId, orgId)))
          .orderBy(asc(contactTags.name)),
        db.select().from(contactConsents).where(and(eq(contactConsents.orgId, orgId), eq(contactConsents.contactId, contact.id))).orderBy(asc(contactConsents.consentType)),
        db.select().from(contactActivities).where(and(eq(contactActivities.orgId, orgId), eq(contactActivities.contactId, contact.id))).orderBy(desc(contactActivities.createdAt)).limit(200),
        db.select().from(contactAuditEvents).where(and(eq(contactAuditEvents.orgId, orgId), eq(contactAuditEvents.contactId, contact.id))).orderBy(desc(contactAuditEvents.createdAt)).limit(200),
        contact.userId
          ? db.select({ id: lmsEnrollments.id, courseId: lmsEnrollments.courseId, courseTitle: lmsCourses.title, status: lmsEnrollments.status, progressPercent: lmsEnrollments.progressPercent, enrolledAt: lmsEnrollments.enrolledAt, completedAt: lmsEnrollments.completedAt, lastAccessedAt: lmsEnrollments.lastAccessedAt })
            .from(lmsEnrollments).innerJoin(lmsCourses, eq(lmsEnrollments.courseId, lmsCourses.id))
            .where(and(eq(lmsEnrollments.orgId, orgId), eq(lmsEnrollments.userId, contact.userId), eq(lmsCourses.orgId, orgId))).orderBy(desc(lmsEnrollments.enrolledAt))
          : Promise.resolve([]),
        contact.userId
          ? db.select({ id: lmsOrders.id, courseTitle: lmsCourses.title, amount: lmsOrders.amount, currency: lmsOrders.currency, status: lmsOrders.status, createdAt: lmsOrders.createdAt, completedAt: lmsOrders.completedAt })
            .from(lmsOrders).leftJoin(lmsCourses, eq(lmsOrders.courseId, lmsCourses.id))
            .where(and(eq(lmsOrders.orgId, orgId), eq(lmsOrders.userId, contact.userId))).orderBy(desc(lmsOrders.createdAt))
          : Promise.resolve([]),
        contact.emailNormalized
          ? db.select({ id: emailCampaignRecipients.id, email: emailCampaignRecipients.email, status: emailCampaignRecipients.status, sentAt: emailCampaignRecipients.sentAt, openedAt: emailCampaignRecipients.openedAt, clickedAt: emailCampaignRecipients.clickedAt, campaignId: emailCampaigns.id, subject: emailCampaigns.subject })
            .from(emailCampaignRecipients).innerJoin(emailCampaigns, eq(emailCampaignRecipients.campaignId, emailCampaigns.id))
            .where(and(eq(emailCampaigns.orgId, orgId), eq(emailCampaignRecipients.email, contact.emailNormalized))).orderBy(desc(emailCampaignRecipients.sentAt)).limit(200)
          : Promise.resolve([]),
        contact.emailNormalized
          ? db.select({ id: webinarRegistrations.id, webinarTitle: webinars.title, registeredAt: webinarRegistrations.registeredAt, attended: webinarRegistrations.attended, completedAt: webinarRegistrations.completedAt, watchedSeconds: webinarRegistrations.watchedSeconds })
            .from(webinarRegistrations).innerJoin(webinars, eq(webinarRegistrations.webinarId, webinars.id))
            .where(and(eq(webinarRegistrations.orgId, orgId), eq(webinars.orgId, orgId), eq(webinarRegistrations.email, contact.emailNormalized))).orderBy(desc(webinarRegistrations.registeredAt))
          : Promise.resolve([]),
        contact.userId
          ? db.select({ id: formSubmissions.id, formTitle: forms.title, status: formSubmissions.status, submittedAt: formSubmissions.submittedAt })
            .from(formSubmissions).innerJoin(forms, eq(formSubmissions.formId, forms.id))
            .where(and(eq(forms.orgId, orgId), eq(formSubmissions.userId, contact.userId))).orderBy(desc(formSubmissions.submittedAt)).limit(100)
          : Promise.resolve([]),
        // General-form submissions contain only a JSON payload rather than a
        // canonical user/email column, so they are linked during source sync
        // only when that payload carries an explicit email identifier.
        Promise.resolve([]),
      ]);
      return { contact, tags, consents, activities, audits, enrollments, purchases, campaignParticipation, webinarParticipation, forms: [...legacyForms, ...generalForms] };
    }),

  create: protectedProcedure.input(contactInput).mutation(async ({ ctx, input }) => {
    const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
    return upsertOrganizationContact(orgId, { ...input, source: input.source ?? "manual" }, ctx.user.id);
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), data: contactInput }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const { db, contact } = await getActiveOrganizationContact(orgId, input.id);
      const result = await upsertOrganizationContact(orgId, input.data, ctx.user.id);
      const updated = result.contact;
      for (const field of ["firstName", "lastName", "displayName", "email", "emailVerified", "phone", "phoneVerified", "lifecycleStage", "source", "sourceDetail", "attribution", "customFields", "userId"] as const) {
        if (input.data[field] === undefined) continue;
        const previous = (contact as any)[field];
        const next = (updated as any)[field];
        if (JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null)) {
          await recordContactAudit(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, action: "field_updated", fieldName: field, previousValue: previous ?? null, nextValue: next ?? null });
        }
      }
      await recordContactActivity(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, activityType: "contact_updated", summary: "Contact details updated." });
      return { contact: updated };
    }),

  getByIdentity: protectedProcedure
    .input(z.object({ email: z.string().trim().email().max(320).optional(), userId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      if (!input.email && !input.userId) return null;
      const conditions: any[] = [eq(contacts.orgId, orgId), isNull(contacts.deletedAt)];
      if (input.email && input.userId) conditions.push(or(eq(contacts.emailNormalized, normalizeContactEmail(input.email)!), eq(contacts.userId, input.userId)));
      else if (input.email) conditions.push(eq(contacts.emailNormalized, normalizeContactEmail(input.email)!));
      else conditions.push(eq(contacts.userId, input.userId!));
      const [contact] = await db.select().from(contacts).where(and(...conditions)).limit(1);
      return contact ?? null;
    }),

  addTag: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive(), tagId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const { db, contact } = await getActiveOrganizationContact(orgId, input.contactId);
      const [tag] = await db.select().from(contactTags).where(and(eq(contactTags.id, input.tagId), eq(contactTags.orgId, orgId))).limit(1);
      if (!tag) throw new TRPCError({ code: "NOT_FOUND", message: "Tag not found in the active organization." });
      await db.insert(contactTagAssignments).values({ orgId, contactId: contact.id, tagId: tag.id }).onDuplicateKeyUpdate({ set: { tagId: tag.id } });
      await recordContactAudit(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, action: "tag_added", nextValue: { tagId: tag.id, tag: tag.name } });
      return { ok: true };
    }),

  removeTag: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive(), tagId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const { db, contact } = await getActiveOrganizationContact(orgId, input.contactId);
      await db.delete(contactTagAssignments).where(and(eq(contactTagAssignments.orgId, orgId), eq(contactTagAssignments.contactId, contact.id), eq(contactTagAssignments.tagId, input.tagId)));
      await recordContactAudit(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, action: "tag_removed", previousValue: { tagId: input.tagId } });
      return { ok: true };
    }),

  listTags: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    return db.select().from(contactTags).where(eq(contactTags.orgId, orgId)).orderBy(asc(contactTags.name));
  }),

  createTag: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(100), color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const [existing] = await db.select().from(contactTags).where(and(eq(contactTags.orgId, orgId), eq(contactTags.name, input.name))).limit(1);
      if (existing) return existing;
      const [result] = await db.insert(contactTags).values({ orgId, name: input.name, color: input.color ?? null });
      const [tag] = await db.select().from(contactTags).where(eq(contactTags.id, Number((result as { insertId: number }).insertId))).limit(1);
      return tag!;
    }),

  listCustomFields: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    return db.select().from(contactCustomFieldDefinitions).where(eq(contactCustomFieldDefinitions.orgId, orgId)).orderBy(asc(contactCustomFieldDefinitions.label));
  }),

  createCustomField: protectedProcedure
    .input(z.object({ key: z.string().trim().regex(/^[a-z][a-z0-9_]{0,99}$/), label: z.string().trim().min(1).max(150), fieldType: z.enum(customFieldTypes), options: z.array(z.string().trim().min(1).max(100)).max(100).optional(), isRequired: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      const [existing] = await db.select({ id: contactCustomFieldDefinitions.id }).from(contactCustomFieldDefinitions)
        .where(and(eq(contactCustomFieldDefinitions.orgId, orgId), eq(contactCustomFieldDefinitions.key, input.key))).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A custom field with this key already exists." });
      const [result] = await db.insert(contactCustomFieldDefinitions).values({ orgId, ...input, options: input.options ?? null });
      const [field] = await db.select().from(contactCustomFieldDefinitions).where(eq(contactCustomFieldDefinitions.id, Number((result as { insertId: number }).insertId))).limit(1);
      return field!;
    }),

  setConsent: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive(), consentType: z.enum(consentTypes), status: z.enum(consentStatuses), source: z.string().trim().min(1).max(100).default("manual"), evidence: z.record(z.string(), z.unknown()).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const { db, contact } = await getActiveOrganizationContact(orgId, input.contactId);
      const now = new Date();
      const [existing] = await db.select().from(contactConsents).where(and(eq(contactConsents.orgId, orgId), eq(contactConsents.contactId, contact.id), eq(contactConsents.consentType, input.consentType))).limit(1);
      if (existing) {
        await db.update(contactConsents).set({ status: input.status, source: input.source, evidence: input.evidence ?? null, grantedAt: input.status === "granted" ? now : existing.grantedAt, withdrawnAt: input.status === "withdrawn" ? now : null }).where(eq(contactConsents.id, existing.id));
      } else {
        await db.insert(contactConsents).values({ orgId, contactId: contact.id, consentType: input.consentType, status: input.status, source: input.source, evidence: input.evidence ?? null, grantedAt: input.status === "granted" ? now : null, withdrawnAt: input.status === "withdrawn" ? now : null });
      }
      await recordContactAudit(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, action: "consent_updated", fieldName: input.consentType, nextValue: { status: input.status, source: input.source } });
      await recordContactActivity(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, activityType: "consent_updated", summary: `${input.consentType.replace(/_/g, " ")} consent marked ${input.status}.` });
      return { ok: true };
    }),

  addNote: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive(), note: z.string().trim().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const { db, contact } = await getActiveOrganizationContact(orgId, input.contactId);
      await recordContactActivity(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, activityType: "note", summary: input.note });
      await recordContactAudit(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, action: "note_added" });
      return { ok: true };
    }),

  duplicateCandidates: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const rows = await db.select({ id: contacts.id, displayName: contacts.displayName, email: contacts.email, emailNormalized: contacts.emailNormalized, phone: contacts.phone, phoneNormalized: contacts.phoneNormalized, lifecycleStage: contacts.lifecycleStage })
      .from(contacts).where(and(eq(contacts.orgId, orgId), isNull(contacts.deletedAt))).orderBy(asc(contacts.id)).limit(2000);
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      for (const key of [row.emailNormalized ? `email:${row.emailNormalized}` : null, row.phoneNormalized ? `phone:${row.phoneNormalized}` : null]) {
        if (!key) continue;
        const group = groups.get(key) ?? [];
        group.push(row);
        groups.set(key, group);
      }
    }
    return [...groups.entries()].filter(([, values]) => values.length > 1).map(([match, candidates]) => ({ match, candidates }));
  }),

  importContacts: protectedProcedure
    .input(z.object({ rows: z.array(contactInput).min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      let created = 0;
      let updated = 0;
      const rejected: Array<{ row: number; reason: string }> = [];
      for (const [index, row] of input.rows.entries()) {
        try {
          const result = await upsertOrganizationContact(orgId, { ...row, source: row.source ?? "import" }, ctx.user.id);
          if (result.created) created += 1;
          else updated += 1;
        } catch (error) {
          rejected.push({ row: index + 1, reason: error instanceof Error ? error.message : "Unable to import contact" });
        }
      }
      return { created, updated, rejected };
    }),

  exportContacts: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const rows = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), isNull(contacts.deletedAt))).orderBy(asc(contacts.id));
    const header = ["id", "firstName", "lastName", "displayName", "email", "emailVerified", "phone", "phoneVerified", "lifecycleStage", "source", "sourceDetail", "customFields", "createdAt", "updatedAt"];
    const csv = [header, ...rows.map(row => [row.id, row.firstName, row.lastName, row.displayName, row.email, row.emailVerified, row.phone, row.phoneVerified, row.lifecycleStage, row.source, row.sourceDetail, row.customFields, row.createdAt.toISOString(), row.updatedAt.toISOString()])]
      .map(row => row.map(csvCell).join(",")).join("\n");
    return { filename: `course360-contacts-org-${orgId}.csv`, csv, total: rows.length };
  }),

  anonymize: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive(), confirmation: z.literal("ANONYMIZE") }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
      const { db, contact } = await getActiveOrganizationContact(orgId, input.contactId);
      const now = new Date();
      await db.update(contacts).set({ userId: null, firstName: null, lastName: null, displayName: "Anonymized contact", email: null, emailNormalized: null, emailVerified: false, phone: null, phoneNormalized: null, phoneVerified: false, lifecycleStage: "inactive", source: "privacy_request", sourceDetail: null, attribution: null, customFields: null, deletedAt: now, anonymizedAt: now }).where(and(eq(contacts.id, contact.id), eq(contacts.orgId, orgId)));
      await db.delete(contactTagAssignments).where(and(eq(contactTagAssignments.orgId, orgId), eq(contactTagAssignments.contactId, contact.id)));
      await db.update(contactConsents).set({ evidence: null }).where(and(eq(contactConsents.orgId, orgId), eq(contactConsents.contactId, contact.id)));
      await db.update(contactActivities).set({ summary: "Historical contact activity redacted.", metadata: null, actorUserId: null }).where(and(eq(contactActivities.orgId, orgId), eq(contactActivities.contactId, contact.id)));
      await db.update(contactAuditEvents).set({ actorUserId: null, previousValue: null, nextValue: null, metadata: null }).where(and(eq(contactAuditEvents.orgId, orgId), eq(contactAuditEvents.contactId, contact.id)));
      await recordContactAudit(db, { orgId, contactId: contact.id, actorUserId: ctx.user.id, action: "anonymized", metadata: { request: "privacy_request" } });
      return { ok: true };
    }),

  syncExistingSources: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = await requireActiveContactsOrganization(ctx.user.id, ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const [members, leads, subscribers, listSubscribers, webinarRows, legacySubmissions, generalSubmissions, enrollments, orders] = await Promise.all([
      db.select({ userId: users.id, email: users.email, emailVerified: users.emailVerified, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName, name: users.name }).from(orgMembers).innerJoin(users, eq(orgMembers.userId, users.id)).where(eq(orgMembers.orgId, orgId)),
      db.select({ email: funnelLeads.email, name: funnelLeads.name, createdAt: funnelLeads.createdAt }).from(funnelLeads).where(eq(funnelLeads.orgId, orgId)),
      db.select({ email: newsletterSubscribers.email, firstName: newsletterSubscribers.firstName, lastName: newsletterSubscribers.lastName, isActive: newsletterSubscribers.isActive }).from(newsletterSubscribers).where(eq(newsletterSubscribers.orgId, orgId)),
      db.select({ email: emailListSubscribers.email, name: emailListSubscribers.name, userId: emailListSubscribers.userId, status: emailListSubscribers.status }).from(emailListSubscribers).innerJoin(emailLists, eq(emailListSubscribers.listId, emailLists.id)).where(eq(emailLists.orgId, orgId)),
      db.select({ email: webinarRegistrations.email, firstName: webinarRegistrations.firstName, lastName: webinarRegistrations.lastName, phone: webinarRegistrations.phone }).from(webinarRegistrations).where(eq(webinarRegistrations.orgId, orgId)),
      db.select({ userId: formSubmissions.userId, email: formSubmissions.respondentEmail, name: formSubmissions.respondentName }).from(formSubmissions).innerJoin(forms, eq(formSubmissions.formId, forms.id)).where(eq(forms.orgId, orgId)),
      db.select({ submissionData: generalFormSubmissions.submissionData }).from(generalFormSubmissions).where(eq(generalFormSubmissions.orgId, orgId)),
      db.select({ userId: lmsEnrollments.userId, status: lmsEnrollments.status }).from(lmsEnrollments).where(eq(lmsEnrollments.orgId, orgId)),
      db.select({ userId: lmsOrders.userId, status: lmsOrders.status }).from(lmsOrders).where(eq(lmsOrders.orgId, orgId)),
    ]);

    let created = 0;
    let updated = 0;
    const apply = async (source: ContactSource, data: ContactInput) => {
      if (!data.email && !data.phone && !data.userId) return;
      try {
        const result = await upsertOrganizationContact(orgId, { ...data, source }, ctx.user.id);
        if (result.created) created += 1;
        else updated += 1;
      } catch {
        // The sync is best-effort: a malformed legacy record must not block the rest.
      }
    };

    for (const member of members) await apply("member", { userId: member.userId, email: member.email, emailVerified: member.emailVerified, firstName: member.firstName, lastName: member.lastName, displayName: member.displayName || member.name, lifecycleStage: "learner" });
    for (const lead of leads) await apply("funnel_lead", { email: lead.email, ...parseSourceName(lead.name), lifecycleStage: "lead" });
    for (const subscriber of subscribers) await apply("newsletter", { email: subscriber.email, firstName: subscriber.firstName, lastName: subscriber.lastName, displayName: [subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") || null, lifecycleStage: subscriber.isActive ? "subscriber" : "inactive" });
    for (const subscriber of listSubscribers) await apply("email_list", { email: subscriber.email, ...parseSourceName(subscriber.name), userId: subscriber.userId, lifecycleStage: subscriber.status === "subscribed" ? "subscriber" : "inactive" });
    for (const registration of webinarRows) await apply("webinar", { email: registration.email, firstName: registration.firstName, lastName: registration.lastName, displayName: [registration.firstName, registration.lastName].filter(Boolean).join(" ") || null, phone: registration.phone, lifecycleStage: "lead" });
    for (const submission of legacySubmissions) await apply("form", { userId: submission.userId, email: submission.email, ...parseSourceName(submission.name), lifecycleStage: "lead" });
    for (const submission of generalSubmissions) {
      const data = submission.submissionData;
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      const values = Object.entries(data as Record<string, unknown>);
      const email = values.find(([key, value]) => /email/i.test(key) && typeof value === "string")?.[1] as string | undefined;
      const name = values.find(([key, value]) => /(^|_)name/i.test(key) && typeof value === "string")?.[1] as string | undefined;
      await apply("form", { email, ...parseSourceName(name), lifecycleStage: "lead" });
    }
    for (const enrollment of enrollments) await apply("member", { userId: enrollment.userId, lifecycleStage: enrollment.status === "active" || enrollment.status === "completed" ? "learner" : "inactive" });
    for (const order of orders) {
      if (!order.userId) continue;
      await apply("member", { userId: order.userId, lifecycleStage: order.status === "completed" ? "customer" : "learner" });
    }

    return { created, updated, scanned: members.length + leads.length + subscribers.length + listSubscribers.length + webinarRows.length + legacySubmissions.length + generalSubmissions.length + enrollments.length + orders.length };
  }),
});
