import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { mediaUploadFolders, mediaUploadResponses } from "../../drizzle/schema";

let activeOrgId = 11;
const insertedRows: any[] = [];
const whereConditions: any[] = [];
const dialect = new MySqlDialect();
const folderRows = [{ id: 1, orgId: 11, name: "Org A" }, { id: 2, orgId: 22, name: "Org B" }];
const responseRows = [{ id: 10, orgId: 11, folderId: 1, fileKey: "a.pdf" }, { id: 20, orgId: 22, folderId: 2, fileKey: "b.pdf" }];

const selectQuery = () => ({
  from: (table: any) => ({
    where: async (condition: any) => {
      whereConditions.push(condition);
      const params = dialect.sqlToQuery(condition).params;
      if (table === mediaUploadFolders) return folderRows.filter(row => params.includes(row.orgId));
      return responseRows.filter(row => params.includes(row.orgId));
    },
    innerJoin: () => ({
      where: async (condition: any) => {
        whereConditions.push(condition);
        const params = dialect.sqlToQuery(condition).params;
        const requestedFolderId = [1, 2].find(id => params.includes(id));
        return responseRows
          .filter(row => params.includes(row.orgId) && (!requestedFolderId || row.folderId === requestedFolderId))
          .map(resp => ({ resp, userName: "Learner", userEmail: "learner@example.test" }));
      },
    }),
  }),
});

const mockDb = {
  select: vi.fn(selectQuery),
  insert: vi.fn(() => ({
    values: (row: any) => {
      insertedRows.push(row);
      return { $returningId: async () => [{ id: insertedRows.length }] };
    },
  })),
};

vi.mock("../db", () => ({
  getDb: vi.fn(async () => mockDb),
  getOrCreateAccessToken: vi.fn(),
  getOrgById: vi.fn(),
  getOrgIdForUser: vi.fn(),
  getOrgIdForUserWithFallback: vi.fn(async () => activeOrgId),
}));

vi.mock("./lmsHelpers", () => ({
  assertAdmin: vi.fn(async () => undefined),
  assertCourseOwnership: vi.fn(async () => undefined),
  generateSlug: vi.fn(),
  uniqueSlug: vi.fn(),
  recalcProgress: vi.fn(),
  issueCertificateIfEnabled: vi.fn(),
}));

import { lmsCohortAdminRouter } from "./lmsCohortAdminRouter";

const context = { user: { id: 7, role: "org_admin" } } as any;

describe("cohort media upload organization isolation", () => {
  beforeEach(() => {
    activeOrgId = 11;
    insertedRows.splice(0);
    whereConditions.splice(0);
    vi.clearAllMocks();
  });

  it("writes each learner media upload with the caller's resolved active organization", async () => {
    const caller = lmsCohortAdminRouter.createCaller(context);
    await caller.recordMediaUploadResponse({ fileUrl: "https://files.example/one.pdf", fileKey: "one.pdf" });
    activeOrgId = 22;
    await caller.recordMediaUploadResponse({ fileUrl: "https://files.example/two.pdf", fileKey: "two.pdf" });
    expect(insertedRows.map(row => row.orgId)).toEqual([11, 22]);
  });

  it("returns only the active organization's folders and responses from two-organization fixtures", async () => {
    const caller = lmsCohortAdminRouter.createCaller(context);
    await expect(caller.listMediaUploadFolders()).resolves.toEqual([folderRows[0]]);
    await expect(caller.listMediaUploadResponses({})).resolves.toMatchObject([{ id: 10, orgId: 11, fileKey: "a.pdf" }]);
    expect(whereConditions.map(condition => dialect.sqlToQuery(condition).params)).toEqual([[11], [11]]);

    activeOrgId = 22;
    whereConditions.splice(0);
    await expect(caller.listMediaUploadFolders()).resolves.toEqual([folderRows[1]]);
    await expect(caller.listMediaUploadResponses({})).resolves.toMatchObject([{ id: 20, orgId: 22, fileKey: "b.pdf" }]);
    expect(whereConditions.map(condition => dialect.sqlToQuery(condition).params)).toEqual([[22], [22]]);
  });

  it("does not return another organization's response when its folder identifier is supplied", async () => {
    const caller = lmsCohortAdminRouter.createCaller(context);
    await expect(caller.listMediaUploadResponses({ folderId: 2 })).resolves.toEqual([]);
    expect(dialect.sqlToQuery(whereConditions[0]).params).toEqual([11, 2]);
  });
});
