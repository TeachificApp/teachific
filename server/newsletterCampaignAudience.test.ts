import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const helperSource = readFileSync(new URL("./lib/emailListHelper.ts", import.meta.url), "utf8");
const newsletterSource = readFileSync(new URL("./routers/newsletterRouter.ts", import.meta.url), "utf8");

describe("organization newsletter campaign audience reconciliation", () => {
  it("keeps All Contacts organization-scoped and preserves opt-outs unless a new newsletter opt-in occurs", () => {
    expect(helperSource).toContain('allContactsCacheKey(orgId?: number | null)');
    expect(helperSource).toContain('eq(emailLists.orgId, orgId)');
    expect(helperSource).toContain('if (!options.allowResubscribe) return;');
    expect(helperSource).toContain('status: "subscribed"');
    expect(helperSource).toContain('unsubscribeFromAllContacts');
    expect(helperSource).toContain('GREATEST(subscriberCount - 1, 0)');
  });

  it("synchronizes subscribe, explicit re-subscribe, unsubscribe, admin status, and deletion transitions", () => {
    expect(newsletterSource).toContain('import { addToAllContacts, unsubscribeFromAllContacts } from "../lib/emailListHelper";');
    expect(newsletterSource).toContain('source: "newsletter"');
    expect(newsletterSource).toContain('allowResubscribe: true');
    expect(newsletterSource).toContain('await unsubscribeFromAllContacts(row.email, row.orgId);');
    expect(newsletterSource).toContain('await unsubscribeFromAllContacts(subscriber.email, subscriber.orgId);');
  });
});
