import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeContactEmail,
  normalizeContactPhone,
  resolveContactIdentity,
} from "./lib/contactIdentity";

const routerSource = readFileSync(new URL("./routers/contactsRouter.ts", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const contactsPageSource = readFileSync(new URL("../client/src/pages/admin/ContactsAdmin.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
const courseBuilderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
const webinarsSource = readFileSync(new URL("../client/src/pages/admin/WebinarsAdmin.tsx", import.meta.url), "utf8");
const workshopsSource = readFileSync(new URL("../client/src/pages/admin/WorkshopsAdmin.tsx", import.meta.url), "utf8");

describe("Course360 organization contact domain", () => {
  it("normalizes identity values only for explicit, local matching", () => {
    expect(normalizeContactEmail(" Learner@Example.test ")).toBe("learner@example.test");
    expect(normalizeContactPhone("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizeContactPhone("123")).toBeNull();
  });

  it("does not merge conflicting email and phone matches", () => {
    expect(resolveContactIdentity({ id: 11, orgId: 7 }, { id: 22, orgId: 7 })).toEqual({
      kind: "conflict",
      emailContactId: 11,
      phoneContactId: 22,
    });
    expect(resolveContactIdentity({ id: 11, orgId: 7 }, { id: 11, orgId: 7 })).toEqual({
      kind: "existing",
      contactId: 11,
    });
  });

  it("persists contact identities, consent, activity, and audit records under an organization key", () => {
    for (const table of [
      "export const contacts = mysqlTable(\"contacts\"",
      "export const contactTags = mysqlTable(\"contact_tags\"",
      "export const contactTagAssignments = mysqlTable(\"contact_tag_assignments\"",
      "export const contactCustomFieldDefinitions = mysqlTable(\"contact_custom_field_definitions\"",
      "export const contactConsents = mysqlTable(\"contact_consents\"",
      "export const contactActivities = mysqlTable(\"contact_activities\"",
      "export const contactAuditEvents = mysqlTable(\"contact_audit_events\"",
    ]) {
      expect(schemaSource).toContain(table);
    }
    expect(schemaSource).toContain("contacts_org_email_normalized_unique");
    expect(schemaSource).toContain("contacts_org_phone_normalized_unique");
  });

  it("derives scope server-side and requires an administrator before any contact operation", () => {
    expect(routerSource).toContain("async function requireActiveContactsOrganization");
    expect(routerSource).toContain("getOrgIdForUserWithFallback(userId, role)");
    expect(routerSource).toContain("await requireOrgAdmin(userId, role, orgId)");
    expect(routerSource).toContain("eq(contacts.orgId, orgId)");
    expect(routerSource).toContain("eq(contactTags.orgId, orgId)");
    expect(routerSource).toContain("eq(contactConsents.orgId, orgId)");
    expect(routerSource).not.toContain("input.orgId");
  });

  it("keeps imports, exports, duplicates, and privacy anonymization in the scoped release", () => {
    expect(routerSource).toContain("importContacts: protectedProcedure");
    expect(routerSource).toContain("exportContacts: protectedProcedure");
    expect(routerSource).toContain("duplicateCandidates: protectedProcedure");
    expect(routerSource).toContain("anonymize: protectedProcedure");
    expect(routerSource).toContain("confirmation: z.literal(\"ANONYMIZE\")");
    expect(routerSource).toContain("syncExistingSources: protectedProcedure");
  });

  it("opens the isolated contact profile from existing organization views", () => {
    expect(dashboardSource).toContain('{ label: "Contacts", path: "/admin/contacts" }');
    expect(contactsPageSource).toContain("getByIdentity.useQuery");
    expect(contactsPageSource).toContain("syncSources.mutate()");
    expect(courseBuilderSource).toContain("/admin/contacts?userId=${encodeURIComponent");
    expect(webinarsSource).toContain("/admin/contacts?email=${encodeURIComponent");
    expect(workshopsSource).toContain("/admin/contacts?userId=${encodeURIComponent");
  });
});
