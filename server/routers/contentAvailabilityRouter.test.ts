import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const selectRows: any[][] = [];
const senderCalls: Array<{ message: any; orgId: number }> = [];
const updateConditions: any[] = [];

function selectResult(rows: any[]) {
  return {
    limit: async () => rows,
    then: (resolve: (value: any[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
  };
}

const db = {
  select: vi.fn(() => ({ from: () => ({ where: () => selectResult(selectRows.shift() ?? []) }) })),
  update: vi.fn(() => ({ set: () => ({ where: async (condition: any) => { updateConditions.push(condition); } }) })),
  insert: vi.fn(),
};

vi.mock("../db", () => ({
  getDb: vi.fn(async () => db),
  getOrgById: vi.fn(async (id: number) => id === 11 ? {
    id,
    slug: "northstar-learning",
    customDomain: null,
    domainVerificationStatus: null,
  } : null),
  requireOrgAdmin: vi.fn(async () => 11),
}));

vi.mock("../_core/email", () => ({
  sendEmailViaOrg: vi.fn(async (message: any, orgId: number) => {
    senderCalls.push({ message, orgId });
    return true;
  }),
}));

import { contentAvailabilityRouter, validateOwningOrgLearnerUrl } from "./contentAvailabilityRouter";

const context = { user: { id: 7, role: "org_admin" } } as any;
const dialect = new MySqlDialect();

describe("content availability enrollment notification routing", () => {
  beforeEach(() => {
    selectRows.splice(0);
    senderCalls.splice(0);
    updateConditions.splice(0);
    vi.clearAllMocks();
  });

  it("allows only a learner URL on the owning organization's resolved domain", async () => {
    await expect(validateOwningOrgLearnerUrl(11, "https://northstar-learning.teachific.app/courses/new-course"))
      .resolves.toBe("https://northstar-learning.teachific.app/courses/new-course");
  });

  it("rejects a platform or different organization's enrollment URL", async () => {
    await expect(validateOwningOrgLearnerUrl(11, "https://teachific.app/courses/new-course"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(validateOwningOrgLearnerUrl(11, "https://other-school.teachific.app/courses/new-course"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sends through the owning organization and marks only the selected waitlist entries", async () => {
    selectRows.push(
      [{ id: 44, orgId: 11, title: "New course" }],
      [
        { id: 101, orgId: 11, productType: "course", productId: 44, name: "Selected", email: "selected@example.test" },
        { id: 102, orgId: 11, productType: "course", productId: 44, name: "Unselected", email: "unselected@example.test" },
      ],
    );
    const caller = contentAvailabilityRouter.createCaller(context);
    await caller.notifyEnrollmentOpen({
      productType: "course",
      productId: 44,
      entryIds: [101],
      subject: "Enrollment is open",
      messageHtml: "<p>Welcome</p>",
      enrollmentUrl: "https://northstar-learning.teachific.app/courses/new-course",
    });
    expect(senderCalls).toHaveLength(1);
    expect(senderCalls[0]).toMatchObject({ orgId: 11, message: { to: { email: "selected@example.test" } } });
    expect(senderCalls[0].message.htmlBody).toContain("northstar-learning.teachific.app/courses/new-course");
    expect(updateConditions).toHaveLength(1);
    const bookkeepingParams = dialect.sqlToQuery(updateConditions[0]).params;
    expect(bookkeepingParams).toContain(101);
    expect(bookkeepingParams).not.toContain(102);
  });
});
