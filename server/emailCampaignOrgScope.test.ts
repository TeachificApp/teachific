import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordEmailCampaignEvent: vi.fn(),
  addToSendGridGlobalUnsubscribes: vi.fn(async () => undefined),
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

vi.mock("./lib/emailCampaignTracking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/emailCampaignTracking")>();
  return {
    ...actual,
    recordEmailCampaignEvent: mocks.recordEmailCampaignEvent,
  };
});

vi.mock("./lib/sendgridSuppressions", () => ({
  addToSendGridGlobalUnsubscribes: mocks.addToSendGridGlobalUnsubscribes,
}));

import {
  buildCampaignRecipientUnsubscribeToken,
  buildListUnsubscribeApiUrl,
  buildUnsubscribePageUrl,
  processCampaignUnsubscribe,
} from "./lib/campaignUnsubscribe";
import {
  injectTrackingPixel,
  wrapLinksForTracking,
} from "./lib/emailCampaignTracking";
import { addToEmailList } from "./lib/emailListHelper";
import { resolveRecipients } from "./lib/emailCampaignAudienceResolver";
import { buildRecipientTrackingKey } from "../shared/emailCampaignAudience";

function createDbMock(selectQueues: any[][]) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(async () => selectQueues.shift() ?? []),
        })),
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectQueues.shift() ?? []),
        })),
      })),
      where: vi.fn(() => ({
        limit: vi.fn(async () => selectQueues.shift() ?? []),
      })),
    })),
  }));
  const insert = vi.fn((table: unknown) => ({
    values: vi.fn(async (values: Record<string, unknown>) => {
      inserts.push({ table, values });
      return [{ insertId: inserts.length }];
    }),
  }));
  const update = vi.fn((table: unknown) => ({
    set: vi.fn((values: Record<string, unknown>) => {
      updates.push({ table, values });
      return {
        where: vi.fn(async () => undefined),
      };
    }),
  }));
  return { select, insert, update, inserts, updates };
}

function createResolverDbMock({ orgId }: { orgId: number }) {
  const listRows = [
    { id: 101, email: "org-one-list@example.com", name: "Org One List", userId: null, status: "subscribed", orgId: 1, listId: 10 },
    { id: 201, email: "org-two-list@example.com", name: "Org Two List", userId: null, status: "subscribed", orgId: 2, listId: 20 },
  ];
  const userRows = [
    { id: 11, email: "org-one-member@example.com", displayName: "Org One Member", name: "One", isPremium: false, interestPrefs: null, isPending: false, unsubscribedAt: null, orgId: 1 },
    { id: 22, email: "org-two-member@example.com", displayName: "Org Two Member", name: "Two", isPremium: false, interestPrefs: null, isPending: false, unsubscribedAt: null, orgId: 2 },
  ];
  const select = vi.fn((selection?: Record<string, unknown>) => ({
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        where: vi.fn(async () => {
          const keys = Object.keys(selection ?? {});
          if (keys.includes("status") && keys.includes("userId") && !keys.includes("isPremium")) {
            return listRows.filter((row) => row.orgId === orgId);
          }
          return userRows.filter((row) => row.orgId === orgId);
        }),
      })),
      where: vi.fn(async () => userRows.filter((row) => row.orgId === orgId)),
    })),
  }));
  return { select };
}

function baseAudienceFilter(overrides: Partial<Parameters<typeof resolveRecipients>[0]> = {}): Parameters<typeof resolveRecipients>[0] {
  return {
    listIds: [],
    listMode: "union",
    interests: [],
    interestIds: [],
    roles: [],
    subscriptionType: "all",
    userStatus: "all",
    specificEmails: [],
    enrolledInCourseIds: [],
    completedCourseIds: [],
    freePreviewCourseIds: [],
    activeAccessCourseIds: [],
    purchasedProductIds: [],
    downloadedProductIds: [],
    purchasedCourseIds: [],
    inGroupIds: [],
    inCohortGroupIds: [],
    submittedFormIds: [],
    brands: [],
    membershipPlanIds: [],
    bundleIds: [],
    workshopIds: [],
    workshopInstanceIds: [],
    purchasedPhysicalProductIds: [],
    communityIds: [],
    webinarIds: [],
    purchasedDigitalBundleIds: [],
    enrolledInQuizIds: [],
    completedQuizIds: [],
    freePreviewQuizIds: [],
    activeAccessQuizIds: [],
    purchasedQuizIds: [],
    openedCampaignIds: [],
    clickedCampaignIds: [],
    logic: "and",
    ...overrides,
  };
}

function createResourceResolverDbMock() {
  const calls = {
    orgMemberUserLoads: 0,
    courseResourceJoins: 0,
    downloadResourceJoins: 0,
    groupResourceJoins: 0,
    cohortResourceJoins: 0,
    formResourceJoins: 0,
    membershipPlanResourceJoins: 0,
    bundleResourceJoins: 0,
    workshopResourceJoins: 0,
    communitySpaceResourceJoins: 0,
    quizResourceJoins: 0,
    joinedResourceQueries: 0,
  };
  const orgUsers = [
    { id: 11, email: "org-one-member@example.com", displayName: "Org One", name: "One", isPremium: false, interestPrefs: null, isPending: false, unsubscribedAt: null },
    { id: 22, email: "org-two-member@example.com", displayName: "Org Two", name: "Two", isPremium: false, interestPrefs: null, isPending: false, unsubscribedAt: null },
  ];
  const select = vi.fn((selection?: Record<string, unknown>) => {
    const keys = Object.keys(selection ?? {});
    return {
      from: vi.fn(() => {
        const joins: string[] = [];
        const chain: any = {
          innerJoin: vi.fn((table: unknown) => {
            joins.push(String((table as { [Symbol.toStringTag]?: string })?.[Symbol.toStringTag] ?? table));
            return chain;
          }),
          where: vi.fn(async () => {
            if (keys.includes("isPremium")) {
              calls.orgMemberUserLoads += 1;
              return orgUsers;
            }
            if (keys.includes("email") && !keys.includes("userId")) {
              calls.groupResourceJoins += joins.length;
              calls.joinedResourceQueries += joins.length > 0 ? 1 : 0;
              return [{ email: "org-one-member@example.com" }];
            }
            if (keys.includes("userEmail")) {
              calls.formResourceJoins += joins.length;
              calls.joinedResourceQueries += joins.length > 0 ? 1 : 0;
              return [{ userEmail: "org-one-member@example.com" }];
            }
            if (joins.length >= 2) {
              calls.workshopResourceJoins += 1;
              calls.joinedResourceQueries += 1;
              return [{ userId: 11 }];
            }
            if (joins.length === 1) {
              calls.joinedResourceQueries += 1;
              const joined = joins.join(" ");
              if (joined.includes("lmsCourses")) calls.courseResourceJoins += 1;
              if (joined.includes("digitalProducts")) calls.downloadResourceJoins += 1;
              if (joined.includes("lmsCohortGroups")) calls.cohortResourceJoins += 1;
              if (joined.includes("generalFormTemplates")) calls.formResourceJoins += 1;
              if (joined.includes("membershipPlans")) calls.membershipPlanResourceJoins += 1;
              if (joined.includes("digitalBundles")) calls.bundleResourceJoins += 1;
              if (joined.includes("workshops")) calls.workshopResourceJoins += 1;
              if (joined.includes("communitySpaces")) calls.communitySpaceResourceJoins += 1;
              return [{ userId: 11 }];
            }
            return [{ userId: 22 }, { userEmail: "org-two-member@example.com" }];
          }),
          limit: vi.fn(async () => []),
        };
        return chain;
      }),
    };
  });
  const execute = vi.fn(async (query: unknown) => {
    const text = String(query);
    if (
      text.includes("INNER JOIN webinars")
      || text.includes("INNER JOIN digital_bundles")
      || text.includes("INNER JOIN physical_products")
      || text.includes("INNER JOIN email_campaigns")
    ) {
      return [[{ userId: 11 }], undefined];
    }
    return [[{ userId: 22 }], undefined];
  });
  return { select, execute, calls };
}

describe("organization-scoped email campaign delivery helpers", () => {
  beforeEach(() => {
    mocks.recordEmailCampaignEvent.mockClear();
    mocks.addToSendGridGlobalUnsubscribes.mockClear();
    mocks.getDb.mockReset();
  });

  it("builds unsubscribe, open-tracking, and click-tracking links from the owning organization domain", () => {
    const orgBaseUrl = "https://school.teachific.app/";
    expect(buildUnsubscribePageUrl("token-123", 55, orgBaseUrl)).toBe(
      "https://school.teachific.app/unsubscribe?token=token-123&campaignId=55",
    );
    expect(buildListUnsubscribeApiUrl("token-123", 55, orgBaseUrl)).toBe(
      "https://school.teachific.app/api/email/campaign-unsubscribe?token=token-123&campaignId=55",
    );

    const withPixel = injectTrackingPixel("<body><p>Hello</p></body>", 55, "u7", "a", orgBaseUrl);
    expect(withPixel).toContain("https://school.teachific.app/api/email/track/open/55/u7.gif?v=a");

    const wrapped = wrapLinksForTracking('<a href="/courses/start">Start</a>', 55, "u7", "a", orgBaseUrl);
    expect(wrapped).toContain(
      "https://school.teachific.app/api/email/track/click/55/u7?url=https%3A%2F%2Fschool.teachific.app%2Fcourses%2Fstart&v=a",
    );
  });

  it("records unsubscribe analytics only when the user belongs to the campaign owning organization", async () => {
    const db = createDbMock([
      [{ id: 7, email: "learner@example.com", unsubscribedAt: null }],
      [],
    ]);

    await expect(processCampaignUnsubscribe(db as any, "token-123", 55)).resolves.toEqual({
      ok: true,
      userId: 7,
      email: "learner@example.com",
      alreadyUnsubscribed: false,
    });

    expect(mocks.addToSendGridGlobalUnsubscribes).toHaveBeenCalledWith(["learner@example.com"]);
    expect(db.updates).toHaveLength(1);
    expect(mocks.recordEmailCampaignEvent).not.toHaveBeenCalled();
  });

  it("records unsubscribe analytics when the user is a member of the campaign organization", async () => {
    const db = createDbMock([
      [{ id: 7, email: "learner@example.com", unsubscribedAt: null }],
      [{ id: 55 }],
    ]);

    await processCampaignUnsubscribe(db as any, "token-123", 55);

    expect(mocks.recordEmailCampaignEvent).toHaveBeenCalledWith(db, {
      campaignId: 55,
      recipientKey: "u7",
      userId: 7,
      eventType: "unsubscribe",
    });
  });

  it("routes list-only campaign recipients through owning-organization unsubscribe URLs and records anonymous analytics", async () => {
    process.env.JWT_SECRET = "test-secret";
    const token = buildCampaignRecipientUnsubscribeToken({
      campaignId: 55,
      orgId: 9,
      email: "ListOnly@Example.com",
      recipientKey: "elist-only",
      listSubscriberId: 321,
    });
    const orgBaseUrl = "https://school.teachific.app";
    expect(buildUnsubscribePageUrl(token, 55, orgBaseUrl)).toMatch(/^https:\/\/school\.teachific\.app\/unsubscribe\?token=ec1\./);
    expect(buildListUnsubscribeApiUrl(token, 55, orgBaseUrl)).toMatch(/^https:\/\/school\.teachific\.app\/api\/email\/campaign-unsubscribe\?token=ec1\./);
    const listOnlyPixel = injectTrackingPixel("<body><p>Lead capture follow-up</p></body>", 55, "elist-only", undefined, orgBaseUrl);
    expect(listOnlyPixel).toContain("https://school.teachific.app/api/email/track/open/55/elist-only.gif");
    const listOnlyWrapped = wrapLinksForTracking('<a href="/courses/org-offer">View offer</a>', 55, "elist-only", undefined, orgBaseUrl);
    expect(listOnlyWrapped).toContain(
      "https://school.teachific.app/api/email/track/click/55/elist-only?url=https%3A%2F%2Fschool.teachific.app%2Fcourses%2Forg-offer",
    );
    expect(`${listOnlyPixel}${listOnlyWrapped}`).not.toContain("https://teachific.app/api/email/");

    const db = createDbMock([
      [{ id: 55, orgId: 9 }],
      [{ id: 321, email: "listonly@example.com", userId: null, status: "subscribed", unsubscribedAt: null }],
      [],
    ]);
    await expect(processCampaignUnsubscribe(db as any, token, 55)).resolves.toEqual({
      ok: true,
      userId: null,
      email: "listonly@example.com",
      alreadyUnsubscribed: false,
      listSubscriberId: 321,
    });
    expect(db.updates).toHaveLength(1);
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0].values).toMatchObject({
      email: "listonly@example.com",
      orgId: 9,
      userId: null,
      reason: "campaign_list_unsubscribe",
    });
    expect(mocks.recordEmailCampaignEvent).toHaveBeenCalledWith(db, {
      campaignId: 55,
      recipientKey: "elist-only",
      eventType: "unsubscribe",
    });
  });

  it("routes lead-capture-origin campaign recipients through owning-organization unsubscribe and tracking links", () => {
    process.env.JWT_SECRET = "test-secret";
    const leadCaptureRecipient = {
      userId: null,
      email: "LeadCapture@Example.com",
      displayName: "Lead Capture Contact",
      name: "Lead Capture Contact",
      listSubscriberId: 654,
    };
    const recipientKey = buildRecipientTrackingKey(leadCaptureRecipient);
    const orgBaseUrl = "https://academy.teachific.app";
    const token = buildCampaignRecipientUnsubscribeToken({
      campaignId: 77,
      orgId: 12,
      email: leadCaptureRecipient.email,
      recipientKey,
      listSubscriberId: leadCaptureRecipient.listSubscriberId,
    });

    const unsubscribeUrl = buildUnsubscribePageUrl(token, 77, orgBaseUrl);
    const listUnsubscribeUrl = buildListUnsubscribeApiUrl(token, 77, orgBaseUrl);
    const trackedHtml = wrapLinksForTracking(
      injectTrackingPixel(
        `<body><a href="/downloads/lead-magnet">Download</a><a href="${unsubscribeUrl}">Unsubscribe</a></body>`,
        77,
        recipientKey,
        undefined,
        orgBaseUrl,
      ),
      77,
      recipientKey,
      undefined,
      orgBaseUrl,
    );

    expect(unsubscribeUrl).toMatch(/^https:\/\/academy\.teachific\.app\/unsubscribe\?token=ec1\./);
    expect(listUnsubscribeUrl).toMatch(/^https:\/\/academy\.teachific\.app\/api\/email\/campaign-unsubscribe\?token=ec1\./);
    expect(trackedHtml).toContain(`https://academy.teachific.app/api/email/track/open/77/${recipientKey}.gif`);
    expect(trackedHtml).toContain(
      `https://academy.teachific.app/api/email/track/click/77/${recipientKey}?url=https%3A%2F%2Facademy.teachific.app%2Fdownloads%2Flead-magnet`,
    );
    expect(`${unsubscribeUrl}${listUnsubscribeUrl}${trackedHtml}`).not.toContain("https://teachific.app/api/email/");
    expect(`${unsubscribeUrl}${listUnsubscribeUrl}${trackedHtml}`).not.toContain("learn.teachific.app");
  });

  it("keeps campaign audience resolution isolated to the active organization for members and list-only subscribers", async () => {
    mocks.getDb.mockResolvedValue(createResolverDbMock({ orgId: 1 }));
    const recipients = await resolveRecipients({
      listIds: [10, 20],
      listMode: "union",
      interests: [],
      interestIds: [],
      roles: [],
      subscriptionType: "all",
      userStatus: "all",
      specificEmails: [],
      enrolledInCourseIds: [],
      completedCourseIds: [],
      freePreviewCourseIds: [],
      activeAccessCourseIds: [],
      purchasedProductIds: [],
      downloadedProductIds: [],
      purchasedCourseIds: [],
      inGroupIds: [],
      inCohortGroupIds: [],
      submittedFormIds: [],
      brands: [],
      membershipPlanIds: [],
      bundleIds: [],
      workshopIds: [],
      workshopInstanceIds: [],
      purchasedPhysicalProductIds: [],
      communityIds: [],
      webinarIds: [],
      purchasedDigitalBundleIds: [],
      enrolledInQuizIds: [],
      completedQuizIds: [],
      freePreviewQuizIds: [],
      activeAccessQuizIds: [],
      purchasedQuizIds: [],
      openedCampaignIds: [],
      clickedCampaignIds: [],
      logic: "and",
    }, 55, 1);
    expect(recipients.map((recipient) => recipient.email).sort()).toEqual([
      "org-one-list@example.com",
      "org-one-member@example.com",
    ]);
    expect(recipients.some((recipient) => recipient.email.includes("org-two"))).toBe(false);
  });

  it("does not resolve lead-capture widget subscribers from another organization's list", async () => {
    const foreignWidgetListSubscriber = {
      id: 501,
      email: "org-one-widget-lead@example.com",
      name: "Org One Widget Lead",
      userId: null,
      status: "subscribed",
      orgId: 1,
      listId: 10,
    };
    const selectSpy = vi.fn((selection?: Record<string, unknown>) => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(async () => {
            const keys = Object.keys(selection ?? {});
            if (keys.includes("status") && keys.includes("userId") && !keys.includes("isPremium")) {
              return foreignWidgetListSubscriber.orgId === 2 ? [foreignWidgetListSubscriber] : [];
            }
            return [];
          }),
        })),
        where: vi.fn(async () => []),
      })),
    }));
    mocks.getDb.mockResolvedValue({ select: selectSpy });

    const recipients = await resolveRecipients(baseAudienceFilter({
      listIds: [10],
      listMode: "only",
    }), 77, 2);

    expect(recipients).toEqual([]);
    expect(selectSpy).toHaveBeenCalled();
  });

  it("denies lead-capture subscriber writes when the target list belongs to another organization", async () => {
    const db = createDbMock([
      [{ orgId: 1 }],
    ]);
    mocks.getDb.mockResolvedValue(db);

    await expect(addToEmailList(10, "lead@example.com", "Lead Capture", {
      orgId: 2,
      source: "lead_capture_widget",
      sourceId: "widget-99",
    })).rejects.toThrow("Email list does not belong to the active organization.");

    expect(db.inserts).toHaveLength(0);
    expect(db.updates).toHaveLength(0);
  });

  it("keeps resource-based audience filters isolated to active-organization owned records", async () => {
    const db = createResourceResolverDbMock();
    mocks.getDb.mockResolvedValue(db);

    const recipients = await resolveRecipients(baseAudienceFilter({
      enrolledInCourseIds: [101],
      downloadedProductIds: [202],
      inGroupIds: [303],
      inCohortGroupIds: [404],
      submittedFormIds: [505],
      membershipPlanIds: [606],
      bundleIds: [707],
      workshopIds: [808],
      communityIds: [909],
    }), 55, 1);

    expect(recipients.map((recipient) => recipient.email)).toEqual(["org-one-member@example.com"]);
    expect(recipients.some((recipient) => recipient.email.includes("org-two"))).toBe(false);
    expect(db.calls.groupResourceJoins).toBeGreaterThanOrEqual(1);
    expect(db.calls.formResourceJoins).toBeGreaterThanOrEqual(1);
    expect(db.calls.joinedResourceQueries).toBeGreaterThanOrEqual(9);
  });
});
