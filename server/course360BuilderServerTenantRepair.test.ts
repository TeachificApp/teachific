import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableColumns, getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema";
import { course360BuilderTemplateOwnership } from "./lib/course360BuilderTemplateOwnership";

const mocks = vi.hoisted(() => ({ db: null as any, membership: true, admin: vi.fn(), external: vi.fn(() => { throw new Error("External calls are forbidden"); }) }));
vi.mock("./db", () => ({
  getDb: async () => mocks.db,
  requireOrgAdmin: async (userId: number, role: string, orgId: number) => {
    mocks.admin(userId, role, orgId);
    if (!mocks.membership && !["site_owner", "site_admin"].includes(role)) throw new Error("Unapproved school membership");
    return orgId;
  },
  getOrCreateAccessToken: mocks.external, getOrgIdForUser: mocks.external,
  getOrgIdForUserWithFallback: mocks.external, getPrimaryOrgId: mocks.external,
  getOrCreateUserByEmail: mocks.external, getOrgById: mocks.external, getOrgBySlug: mocks.external,
}));
vi.mock("./routers/lmsHelpers", () => ({ generateSlug: (title: string) => title.toLowerCase(), uniqueSlug: async (_db: any, slug: string) => slug, recalcProgress: mocks.external, issueCertificateIfEnabled: mocks.external }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.external }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.external }));
vi.mock("./storage", () => ({ storagePut: mocks.external, storagePresignedPut: mocks.external }));
vi.mock("./lib/certificateGenerator", () => ({ generateCertificatePdf: mocks.external }));
vi.mock("./lib/certificateEmail", () => ({ sendCertificateEmail: mocks.external }));
vi.mock("./lib/enrollmentEmail", () => ({ sendEnrollmentEmail: mocks.external }));
vi.mock("./_core/email", () => ({ sendEmail: mocks.external, buildFreePreviewConfirmationEmail: mocks.external }));
vi.mock("./lib/stripeClient", () => ({ getStripeClient: mocks.external }));
vi.mock("./lib/course360AiCourseSource", () => ({ buildCourseSourceContext: mocks.external }));
vi.mock("./lib/course360AiCourseSourceMessage", () => ({ buildCourse360SourceMessage: mocks.external }));
vi.mock("./lib/course360AiSourceProvider", () => ({ invokeCourse360SourceLLM: mocks.external }));
import { requireCourse360BuilderSchool } from "./lib/course360BuilderSchoolScope";
import { lmsCourseBuilderRouter } from "./routers/lmsCourseBuilderRouter";
import { blockTemplatesRouter } from "./routers/blockTemplatesRouter";
import { funnelRouter, funnelAdminRouter, funnelPublicRouter } from "./routers/funnelRouter";

const dialect = new MySqlDialect();
const tableName = (table: any) => getTableName(table);
const keyOf = (column: any) => Object.entries(getTableColumns(column.table)).find(([, value]) => value === column)?.[0] || column.name;
const columnValue = (column: any, context: any) => context[tableName(column.table)]?.[keyOf(column)];
function matches(condition: any, context: any) {
  if (!condition) throw new Error("Unscoped query rejected by the mock DB");
  const { sql, params } = dialect.sqlToQuery(condition);
  let paramAt = 0;
  const terms = [...sql.matchAll(/`([^`]+)`\.`([^`]+)`\s*(=|in)\s*(\?|`[^`]+`\.`[^`]+`|\([^)]*\))/gi)];
  if (!terms.length) throw new Error(`Unsupported mock predicate: ${sql}`);
  return terms.every(term => {
    const [, table, column, operator, rhs] = term;
    const source = Object.values(schema).find((value: any) => { try { return tableName(value) === table; } catch { return false; } }) || course360BuilderTemplateOwnership;
    const col = Object.values(getTableColumns(source as any)).find((value: any) => value.name === column);
    const left = columnValue(col, context);
    if (operator.toLowerCase() === "in") {
      const count = (rhs.match(/\?/g) || []).length;
      const values = params.slice(paramAt, paramAt + count); paramAt += count;
      return values.includes(left);
    }
    if (rhs === "?") return left === params[paramAt++];
    const other = /`([^`]+)`\.`([^`]+)`/.exec(rhs)!;
    const otherTable = Object.values(schema).find((value: any) => { try { return tableName(value) === other[1]; } catch { return false; } });
    const otherCol = Object.values(getTableColumns(otherTable as any)).find((value: any) => value.name === other[2]);
    return left === columnValue(otherCol, context);
  });
}
class MemoryDb {
  data = new Map<string, any[]>();
  queries: { table: string; condition: any; projection: any }[] = [];
  writes: { kind: string; table: string; values?: any; condition?: any }[] = [];
  missingOwnership = false;
  failOwnershipInsert = false;
  transactions = 0;
  set(table: any, rows: any[]) { this.data.set(tableName(table), rows); return this; }
  select(projection?: any) {
    let table: any, condition: any, limit: number | undefined;
    const joins: { table: any; condition: any }[] = [];
    const query: any = {
      from: (value: any) => { table = value; return query; },
      where: (value: any) => { condition = value; return query; },
      innerJoin: (value: any, on: any) => { joins.push({ table: value, condition: on }); return query; },
      orderBy: () => query, limit: (value: number) => { limit = value; return query; }, offset: () => query,
      then: (resolve: any, reject: any) => Promise.resolve().then(() => {
        if (table === course360BuilderTemplateOwnership && this.missingOwnership) throw new Error("Ownership migration missing");
        this.queries.push({ table: tableName(table), condition, projection });
        let contexts = (this.data.get(tableName(table)) || []).map(row => ({ [tableName(table)]: row }));
        for (const join of joins) contexts = contexts.flatMap(context => (this.data.get(tableName(join.table)) || [])
          .map(row => ({ ...context, [tableName(join.table)]: row })).filter(next => matches(join.condition, next)));
        // One allowed unfenced query is a read-only migration-existence probe.
        if (condition) contexts = contexts.filter(context => matches(condition, context));
        else if (!(table === course360BuilderTemplateOwnership && limit === 1)) throw new Error(`Unscoped select on ${tableName(table)}`);
        if (limit !== undefined) contexts = contexts.slice(0, limit);
        return contexts.map(context => projection ? Object.fromEntries(Object.entries(projection).map(([key, value]) => [key, columnValue(value, context)])) : context[tableName(table)]);
      }).then(resolve, reject),
    };
    return query;
  }
  insert(table: any) {
    const insert: any = {
      values: (values: any) => { insert.valuesData = values; return insert; },
      $returningId: async () => { const id = await this.performInsert(table, insert.valuesData); return [{ id }]; },
      then: (resolve: any, reject: any) => this.performInsert(table, insert.valuesData).then(id => [{ insertId: id }]).then(resolve, reject),
    };
    return insert;
  }
  async performInsert(table: any, values: any) {
    if (table === course360BuilderTemplateOwnership && this.failOwnershipInsert) throw new Error("Ownership insert failed");
    const rows = this.data.get(tableName(table)) || []; const id = Math.max(0, ...rows.map(row => row.id || 0)) + 1;
    this.writes.push({ kind: "insert", table: tableName(table), values });
    rows.push({ ...values, id }); this.data.set(tableName(table), rows); return id;
  }
  delete(table: any) { return { where: async (condition: any) => {
    this.writes.push({ kind: "delete", table: tableName(table), condition });
    this.data.set(tableName(table), (this.data.get(tableName(table)) || []).filter(row => !matches(condition, { [tableName(table)]: row })));
  } }; }
  update(table: any) { return { set: (values: any) => ({ where: async (condition: any) => {
    this.writes.push({ kind: "update", table: tableName(table), values, condition });
    for (const row of this.data.get(tableName(table)) || []) if (matches(condition, { [tableName(table)]: row })) Object.assign(row, values);
  } }) }; }
  async transaction(callback: any) {
    this.transactions++; const prior = structuredClone(this.data); const writesBefore = this.writes.length;
    try { return await callback(this); } catch (error) { this.data = prior; this.writes.length = writesBefore; throw error; }
  }
}
const ctx = (role = "org_admin") => ({ user: { id: 8, role }, req: {}, res: {} } as any);
const builder = (role?: string) => lmsCourseBuilderRouter.createCaller(ctx(role));
const blocks = (role?: string) => blockTemplatesRouter.createCaller(ctx(role));
const funnel = (role?: string) => funnelRouter.createCaller(ctx(role));
const funnelAdmin = (role?: string) => funnelAdminRouter.createCaller(ctx(role));
let db: MemoryDb;
beforeEach(() => {
  vi.clearAllMocks(); mocks.membership = true;
  vi.stubGlobal("fetch", mocks.external);
  db = new MemoryDb()
    .set(schema.userActiveOrg, [{ userId: 8, orgId: 17 }])
    .set(schema.organizations, [{ id: 17, isActive: true }, { id: 29, isActive: true }])
    .set(schema.lmsCourses, [{ id: 1, orgId: 17, title: "Owned", slug: "owned" }, { id: 2, orgId: 29, title: "Other", slug: "other" }])
    .set(schema.lmsSections, [{ id: 3, courseId: 1, title: "Owned section", position: 0 }, { id: 4, courseId: 2, title: "Other section", position: 0 }])
    .set(schema.lmsLessons, [{ id: 5, courseId: 1, sectionId: 3, title: "Owned lesson", contentBlocks: "[]", position: 0 }, { id: 6, courseId: 2, sectionId: 4, title: "SECRET", contentBlocks: '[{"secret":true}]', position: 0 }])
    .set(schema.lmsSectionTemplates, [{ id: 7, name: "Unknown historical", lessonsJson: "[]" }, { id: 8, name: "Verified owned", lessonsJson: "[]" }, { id: 9, name: "Verified other", lessonsJson: "[]" }])
    .set(course360BuilderTemplateOwnership, [{ templateKind: "section", templateId: 8, orgId: 17 }, { templateKind: "section", templateId: 9, orgId: 29 }])
    .set(schema.blockTemplates, [{ id: 10, orgId: 17, name: "Owned" }, { id: 11, orgId: 29, name: "Other" }, { id: 12, orgId: null, name: "Historical" }])
    .set(schema.funnels, [{ id: 20, orgId: 17, name: "Owned funnel", isActive: true }, { id: 21, orgId: 29, name: "Other funnel", isActive: true }])
    .set(schema.funnelSteps, [{ id: 30, funnelId: 20, pageId: 40, name: "Owned step", stepType: "landing", sortOrder: 0 }, { id: 31, funnelId: 20, pageId: 41, name: "Cross school link", sortOrder: 1 }, { id: 32, funnelId: 21, pageId: 41, sortOrder: 0 }])
    .set(schema.pageBuilderPages, [{ id: 40, orgId: 17, title: "Owned page", blocksJson: '[{"id":"original-block","type":"text","data":{"html":"Keep content"}}]' }, { id: 41, orgId: 29, title: "Secret page", blocksJson: '[{"secret":true}]' }]);
  mocks.db = db;
});
afterEach(() => vi.unstubAllGlobals());

describe("Course360 builder strict authoring tenant guards", () => {
  it.each(["site_owner", "site_admin", "org_admin"])("%s must explicitly select an active school; primary fallback never runs", async role => {
    db.set(schema.userActiveOrg, []);
    await expect(builder(role).listCoursesWithSections()).rejects.toThrow("Choose an active");
    expect(db.queries.every(query => query.table === "user_active_org")).toBe(true);
    expect(mocks.external).not.toHaveBeenCalled();
  });
  it("rejects deactivated school and unapproved exact-school membership", async () => {
    db.set(schema.organizations, [{ id: 17, isActive: false }]);
    await expect(requireCourse360BuilderSchool(ctx())).rejects.toThrow("Choose an active");
    db.set(schema.organizations, [{ id: 17, isActive: true }]); mocks.membership = false;
    await expect(builder().getLessonAdmin({ lessonId: 5 })).rejects.toThrow("Unapproved");
    expect(mocks.admin).toHaveBeenCalledWith(8, "org_admin", 17);
    expect(db.queries.some(query => query.table === "lms_lessons")).toBe(false);
  });
  it("permits approved school admin membership independent of stale global role, but rejects obsolete admin bypass", async () => {
    expect((await builder("user").getLessonAdmin({ lessonId: 5 })).title).toBe("Owned lesson");
    await expect(builder("admin").getLessonAdmin({ lessonId: 5 })).rejects.toThrow("current platform role");
  });
  it.each(["org_admin", "site_admin"])("%s cannot read an inactive-school lesson", async role => {
    await expect(builder(role).getLessonAdmin({ lessonId: 6 })).rejects.toThrow("active organization");
    expect(db.queries.filter(query => query.table === "lms_lessons").every(query => query.projection && !query.projection.contentBlocks)).toBe(true);
  });
  it("validates both legacy parent references and supports section-only historical lesson identity", async () => {
    db.data.get("lms_lessons")!.push({ id: 50, courseId: 1, sectionId: 4, title: "Inconsistent" }, { id: 51, courseId: null, sectionId: 3, title: "Legacy section-only" });
    await expect(builder().getLessonAdmin({ lessonId: 50 })).rejects.toThrow();
    expect((await builder().getLessonAdmin({ lessonId: 51 })).title).toBe("Legacy section-only");
  });
  it("uses one server-verified active selection for all source and target checks in a request", async () => {
    const originalSelect = db.select.bind(db); let activeReads = 0;
    db.select = ((...args: any[]) => {
      const query = originalSelect(...args); const originalFrom = query.from;
      query.from = (table: any) => {
        if (table === schema.userActiveOrg && ++activeReads > 1) throw new Error("Repeated active-school resolution could drift");
        return originalFrom(table);
      };
      return query;
    }) as any;
    await expect(builder().copyLesson({ targetCourseId: 1, lessonId: 6, targetSectionId: null })).rejects.toThrow("active organization");
    expect(activeReads).toBe(1); expect(db.writes).toHaveLength(0);
  });
  it("empty school course picker never queries sections or lessons globally", async () => {
    db.set(schema.lmsCourses, []); expect(await builder().listCoursesWithSections()).toEqual([]);
    expect(db.queries.some(query => ["lms_sections", "lms_lessons"].includes(query.table))).toBe(false);
  });
  it("guests are rejected before DB or external IO", async () => {
    await expect(lmsCourseBuilderRouter.createCaller({ user: null, req: {}, res: {} } as any).getLessonAdmin({ lessonId: 5 })).rejects.toThrow();
    expect(db.queries).toHaveLength(0); expect(mocks.external).not.toHaveBeenCalled();
  });
  it("returns verified orgId and fetches sections/lessons only from returned owned courses", async () => {
    const rows = await builder().listCoursesWithLessons();
    expect(rows).toHaveLength(1); expect(rows[0].orgId).toBe(17); expect(rows[0].sections[0].lessons[0].id).toBe(5);
    const sectionQueries = db.queries.filter(query => query.table === "lms_sections");
    expect(sectionQueries.every(query => dialect.sqlToQuery(query.condition).sql.includes(" in "))).toBe(true);
  });
  it.each([
    ["copySectionFromCourse", { targetCourseId: 1, sourceSectionId: 4 }],
    ["copySectionFromCourse", { targetCourseId: 2, sourceSectionId: 3 }],
    ["copyLesson", { targetCourseId: 1, lessonId: 6, targetSectionId: null }],
    ["copyLesson", { targetCourseId: 2, lessonId: 5, targetSectionId: null }],
    ["copyLesson", { targetCourseId: 1, lessonId: 5, targetSectionId: 4 }],
    ["copyModule", { targetCourseId: 1, sectionId: 4 }],
    ["copyModule", { targetCourseId: 2, sectionId: 3 }],
    ["saveSectionTemplate", { sectionId: 4, name: "No" }],
    ["saveLessonTemplate", { lessonId: 6, title: "No" }],
    ["applyLessonTemplate", { lessonId: 6, templateId: 1 }],
    ["importSectionTemplate", { courseId: 2, templateId: 8 }],
    ["deleteCourse", { id: 2 }],
    ["reorderCourses", { courses: [{ id: 1, libraryOrder: 0 }, { id: 2, libraryOrder: 1 }] }],
    ["reorderSections", { sections: [{ id: 3, position: 0 }, { id: 4, position: 1 }] }],
    ["reorderLessons", { lessons: [{ id: 5, position: 0 }, { id: 6, position: 1 }] }],
    ["bulkSetLessonStatus", { courseId: 2, lessonStatus: "published" }],
    ["moveLesson", { courseId: 1, lessonId: 5, targetSectionId: 4 }],
    ["createLesson", { courseId: 1, sectionId: 4, title: "No" }],
    ["setCurriculumEmbedVisibility", { courseId: 1, items: [{ itemType: "section", itemId: 4, hidden: true }] }],
  ])("%s validates all requested source/target ownership before any write", async (name, input) => {
    await expect((builder() as any)[name](input)).rejects.toThrow(); expect(db.writes).toHaveLength(0); expect(mocks.external).not.toHaveBeenCalled();
  });
  it("unknown and other-school historical section templates stay unread/unmodifiable", async () => {
    const rows = await builder().listSectionTemplates(); expect(rows.map(row => row.id)).toEqual([8]); expect(rows[0].orgId).toBe(17);
    for (const templateId of [7, 9]) {
      await expect(builder().importSectionTemplate({ courseId: 1, templateId })).rejects.toThrow("verified ownership");
      await expect(builder().deleteSectionTemplate({ id: templateId })).rejects.toThrow("verified ownership");
    }
    expect(db.writes).toHaveLength(0); expect(db.data.get("lms_section_templates")).toHaveLength(3);
  });
  it("new section saves atomically record trusted source school ownership", async () => {
    const result = await builder().saveSectionTemplate({ sectionId: 3, name: "Saved" }); expect(result.orgId).toBe(17); expect(db.transactions).toBe(1);
    expect(db.writes.find(write => write.table === "course360_builder_template_ownership")?.values).toMatchObject({ orgId: 17, sourceCourseId: 1, sourceSectionId: 3, savedByUserId: 8, evidence: "authorized_source_section_save_v1" });
  });
  it("missing ownership migration and failed ownership insert never leave a new ambiguous template", async () => {
    db.missingOwnership = true; await expect(builder().saveSectionTemplate({ sectionId: 3, name: "No" })).rejects.toThrow("migration missing"); expect(db.writes).toHaveLength(0);
    db.missingOwnership = false; db.failOwnershipInsert = true; await expect(builder().saveSectionTemplate({ sectionId: 3, name: "No" })).rejects.toThrow("insert failed");
    expect(db.data.get("lms_section_templates")).toHaveLength(3); expect(db.writes).toHaveLength(0);
  });
  it("checkout templates also use verified additive ownership and atomic saves", async () => {
    const result = await builder().saveCheckoutTemplate({ name: "Checkout", config: "{}" }); expect(result.orgId).toBe(17);
    expect(db.writes.find(write => write.table === "course360_builder_template_ownership")?.values.templateKind).toBe("checkout");
    const rows = await builder().listCheckoutTemplates(); expect(rows[0].orgId).toBe(17);
  });
  it("base duplicate endpoint calls strict guard before reading courseLessons", () => {
    const source = readFileSync(new URL("./routers/lmsAdminRouter.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("  getLessonsWithBlocks:"), source.indexOf("// ─── Certificate Templates sub-router"));
    expect(body.indexOf("assertCourse360BuilderCourse(ctx, input.courseId)")).toBeLessThan(body.indexOf(".from(courseLessons)"));
  });
});

describe("Course360 shared block template school ownership", () => {
  it("lists only exact-school rows and preserves ambiguous history", async () => { expect((await blocks().list({})).map(row => row.id)).toEqual([10]); expect(db.data.get("blockTemplates")).toHaveLength(3); });
  it("save stamps server-selected orgId and returns it", async () => { const result = await blocks().save({ name: "New", blockType: "text", blockData: { html: "Keep" } }); expect(result.orgId).toBe(17); expect(db.writes[0].values).toMatchObject({ orgId: 17, createdByUserId: 8 }); });
  it.each([11, 12])("cannot modify/delete foreign or ambiguous template %s", async id => { await expect(blocks().update({ id, name: "No" })).rejects.toThrow(); await expect(blocks("site_owner").delete({ id })).rejects.toThrow(); expect(db.writes).toHaveLength(0); });
  it("update/delete include exact school in both reads and mutation predicates", async () => { await blocks().update({ id: 10, name: "Changed" }); await blocks().delete({ id: 10 }); expect(db.writes.every(write => dialect.sqlToQuery(write.condition).params.includes(17))).toBe(true); expect(db.data.get("blockTemplates")?.map(row => row.id)).toEqual([11, 12]); });
  it.each(["list", "save", "update", "delete"])("%s rejects missing active school before template IO", async method => {
    db.set(schema.userActiveOrg, []); const input = method === "save" ? { name: "N", blockType: "text", blockData: {} } : { id: 10 };
    await expect((blocks() as any)[method](input)).rejects.toThrow("Choose an active"); expect(db.queries.some(query => query.table === "blockTemplates")).toBe(false); expect(db.writes).toHaveLength(0);
  });
});

describe("Course360 legacy funnel native-picker adapter", () => {
  it("returns only active-school parents and same-school native pages with untouched blocks/order", async () => {
    const rows = await funnelAdmin().getFunnelsWithPages(); expect(rows).toHaveLength(1); expect(rows[0].orgId).toBe(17); expect(rows[0].pages).toHaveLength(1);
    expect(rows[0].pages[0]).toMatchObject({ id: 40, stepId: 30, orgId: 17, pageFamily: "page_builder_pages", sortOrder: 0, blocks: db.data.get("page_builder_pages")![0].blocksJson });
    expect(db.queries.some(query => query.table === "funnel_pages")).toBe(false);
  });
  it("preserves list/get APIs but rejects another school's requested funnel", async () => { expect((await funnel().list())[0].id).toBe(20); await expect(funnel("site_admin").get({ id: 21 })).rejects.toThrow(); expect((await funnel().get({ id: 20 })).orgId).toBe(17); });
  it("page lookup returns explicit native identity and refuses ambiguous shared page links", async () => {
    expect((await funnel().getPageById({ id: 40 })).page.pageFamily).toBe("page_builder_pages");
    db.data.get("funnel_steps")!.push({ id: 33, funnelId: 20, pageId: 40, sortOrder: 2 });
    await expect(funnel().getPageById({ id: 40 })).rejects.toThrow("multiple steps");
  });
  it("all registered incompatible admin endpoints are fail-closed before legacy SQL and provider calls", async () => {
    await expect(funnelAdmin().globalContacts({})).rejects.toThrow("native funnel adapter");
    await expect(funnel().copyPageToFunnel({ pageId: 40, targetFunnelId: 21 })).rejects.toThrow("native funnel adapter");
    await expect(funnel().listTemplates()).rejects.toThrow("native funnel adapter");
    expect(db.queries.every(query => query.table === "user_active_org")).toBe(true); expect(db.writes).toHaveLength(0); expect(mocks.external).not.toHaveBeenCalled();
  });
  it("incompatible public checkout/page endpoints stop before any DB/provider read", async () => {
    await expect(funnelPublicRouter.createCaller({ user: null, req: {}, res: {} } as any).getBySlug({ slug: "legacy" })).rejects.toThrow("verified native page adapter");
    expect(db.queries).toHaveLength(0); expect(mocks.external).not.toHaveBeenCalled();
  });
  it("public enrollment counters cannot return global cross-school totals", async () => {
    await expect(funnelAdminRouter.createCaller({ user: null, req: {}, res: {} } as any).getEnrollmentCount({ countType: "site_users" })).rejects.toThrow("verified native page adapter");
    expect(db.queries).toHaveLength(0);
  });
  it("funnel picker rejects missing active school rather than querying all funnels", async () => { db.set(schema.userActiveOrg, []); await expect(funnelAdmin("site_owner").getFunnelsWithPages()).rejects.toThrow("Choose an active"); expect(db.queries.some(query => query.table === "funnels")).toBe(false); });
});
