import { and, desc, asc, eq, sql, gt, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  courses,
  courseSections,
  courseLessons,
  courseEnrollments,
  lessonProgress,
  orgThemes,
  orgSubscriptions,
  pageBuilderPages,
  coursePricing,
  instructors,
  certificates,
  coupons,
  courseReviews,
  users,
  memberActivityEvents,
  digitalProducts,
  digitalProductPrices,
  digitalOrders,
  digitalDownloadLogs,
  webinars,
  webinarRegistrations,
  webinarSessions,
  webinarFunnelSteps,
  orgMembers,
  emailCampaigns,
  emailCampaignRecipients,
  categories,
  courseCategories,
  groups,
  groupMembers,
  discussions,
  discussionReplies,
  assignments,
  assignmentSubmissions,
  certificateTemplates,
  affiliates,
  revenuePartners,
  courseOrders,
  memberships,
  membershipMembers,
  membershipContent,
  membershipRules,
  bundles,
  flashcardDecks,
  flashcardCards,
  lessonNotes,
  lessonBookmarks,
  quizAttempts,
  workshops,
  workshopRegistrations,
  courseAnnouncements,
  courseResources,
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


// ─── Courses ────────────────────────────────────────────────────────────────

export async function getCoursesByOrg(orgId: number) {
  return db
    .select()
    .from(courses)
    .where(eq(courses.orgId, orgId))
    .orderBy(asc(courses.sortOrder), desc(courses.createdAt));
}

export async function reorderCourses(courseIds: number[]) {
  for (let i = 0; i < courseIds.length; i++) {
    await db
      .update(courses)
      .set({ sortOrder: i })
      .where(eq(courses.id, courseIds[i]));
  }
}

export async function getCourseById(id: number) {
  const rows = await db.select().from(courses).where(eq(courses.id, id));
  return rows[0] ?? null;
}

export async function getCourseWithInstructor(id: number) {
  const course = await getCourseById(id);
  if (!course) return null;
  let instructor = null;
  if (course.instructorId) {
    const rows = await db.select().from(instructors).where(eq(instructors.id, course.instructorId));
    instructor = rows[0] ?? null;
  }
  return { ...course, instructor };
}

export async function getCourseBySlug(orgId: number, slug: string) {
  const rows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.orgId, orgId), eq(courses.slug, slug)));
  return rows[0] ?? null;
}

export async function createCourse(data: typeof courses.$inferInsert) {
  const result = await db.insert(courses).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getCourseById(Number(id));
}

export async function updateCourse(id: number, data: Partial<typeof courses.$inferInsert>) {
  await db.update(courses).set(data).where(eq(courses.id, id));
  return getCourseById(id);
}

export async function deleteCourse(id: number) {
  await db.delete(courses).where(eq(courses.id, id));
}

// ─── Sections ───────────────────────────────────────────────────────────────

export async function getSectionsByCourse(courseId: number) {
  return db
    .select()
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId))
    .orderBy(asc(courseSections.sortOrder));
}

export async function createSection(data: typeof courseSections.$inferInsert) {
  const result = await db.insert(courseSections).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(courseSections).where(eq(courseSections.id, Number(id)));
  return rows[0];
}

export async function updateSection(id: number, data: Partial<typeof courseSections.$inferInsert>) {
  await db.update(courseSections).set(data).where(eq(courseSections.id, id));
  const rows = await db.select().from(courseSections).where(eq(courseSections.id, id));
  return rows[0];
}

export async function deleteSection(id: number) {
  await db.delete(courseLessons).where(eq(courseLessons.sectionId, id));
  await db.delete(courseSections).where(eq(courseSections.id, id));
}

export async function reorderSections(sectionIds: number[]) {
  for (let i = 0; i < sectionIds.length; i++) {
    await db
      .update(courseSections)
      .set({ sortOrder: i })
      .where(eq(courseSections.id, sectionIds[i]));
  }
}

// ─── Lessons ────────────────────────────────────────────────────────────────

export async function getLessonsBySection(sectionId: number) {
  return db
    .select()
    .from(courseLessons)
    .where(eq(courseLessons.sectionId, sectionId))
    .orderBy(asc(courseLessons.sortOrder));
}

export async function getLessonsByCourse(courseId: number) {
  return db
    .select()
    .from(courseLessons)
    .where(eq(courseLessons.courseId, courseId))
    .orderBy(asc(courseLessons.sortOrder));
}

export async function getLessonById(id: number) {
  const rows = await db.select().from(courseLessons).where(eq(courseLessons.id, id));
  return rows[0] ?? null;
}

export async function createLesson(data: typeof courseLessons.$inferInsert) {
  const result = await db.insert(courseLessons).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getLessonById(Number(id));
}

export async function updateLesson(id: number, data: Partial<typeof courseLessons.$inferInsert>) {
  await db.update(courseLessons).set(data).where(eq(courseLessons.id, id));
  return getLessonById(id);
}

export async function deleteLesson(id: number) {
  await db.delete(lessonProgress).where(eq(lessonProgress.lessonId, id));
  await db.delete(courseLessons).where(eq(courseLessons.id, id));
}

export async function reorderLessons(lessonIds: number[]) {
  for (let i = 0; i < lessonIds.length; i++) {
    await db
      .update(courseLessons)
      .set({ sortOrder: i })
      .where(eq(courseLessons.id, lessonIds[i]));
  }
}

// ─── Curriculum (full tree) ──────────────────────────────────────────────────

export async function getFullCurriculum(courseId: number) {
  const sections = await getSectionsByCourse(courseId);
  const lessons = await getLessonsByCourse(courseId);
  return sections.map((s: typeof courseSections.$inferSelect) => ({
    ...s,
    lessons: lessons.filter((l: typeof courseLessons.$inferSelect) => l.sectionId === s.id),
  }));
}

// ─── Pricing ────────────────────────────────────────────────────────────────

export async function getPricingByCourse(courseId: number) {
  return db
    .select()
    .from(coursePricing)
    .where(eq(coursePricing.courseId, courseId))
    .orderBy(asc(coursePricing.sortOrder));
}

export async function createPricing(data: typeof coursePricing.$inferInsert) {
  const result = await db.insert(coursePricing).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(coursePricing).where(eq(coursePricing.id, Number(id)));
  return rows[0];
}

export async function updatePricing(id: number, data: Partial<typeof coursePricing.$inferInsert>) {
  await db.update(coursePricing).set(data).where(eq(coursePricing.id, id));
  const rows = await db.select().from(coursePricing).where(eq(coursePricing.id, id));
  return rows[0];
}

export async function deletePricing(id: number) {
  await db.delete(coursePricing).where(eq(coursePricing.id, id));
}

// ─── Enrollments ────────────────────────────────────────────────────────────

export async function getEnrollmentsByUser(userId: number) {
  return db
    .select()
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.userId, userId), eq(courseEnrollments.isActive, true)))
    .orderBy(desc(courseEnrollments.enrolledAt));
}

export async function getEnrollmentsByCourse(courseId: number) {
  return db
    .select()
    .from(courseEnrollments)
    .where(eq(courseEnrollments.courseId, courseId))
    .orderBy(desc(courseEnrollments.enrolledAt));
}

export async function getEnrollment(courseId: number, userId: number) {
  const rows = await db
    .select()
    .from(courseEnrollments)
    .where(
      and(
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.userId, userId),
        eq(courseEnrollments.isActive, true)
      )
    );
  return rows[0] ?? null;
}

export async function createEnrollment(data: typeof courseEnrollments.$inferInsert) {
  const result = await db.insert(courseEnrollments).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db
    .select()
    .from(courseEnrollments)
    .where(eq(courseEnrollments.id, Number(id)));
  const enrollment = rows[0];
  // Dispatch Zapier event (non-blocking)
  if (enrollment && data.orgId) {
    import("./zapierRouter").then(({ dispatchZapierEvent }) => {
      dispatchZapierEvent(data.orgId!, "new_enrollment", {
        enrollment_id: enrollment.id,
        user_id: data.userId,
        course_id: data.courseId,
        org_id: data.orgId,
        enrolled_at: enrollment.enrolledAt?.toISOString() ?? new Date().toISOString(),
      });
    }).catch(() => {});
  }
  return enrollment;
}

export async function updateEnrollmentProgress(
  enrollmentId: number,
  progressPct: number,
  lastLessonId?: number
) {
  await db
    .update(courseEnrollments)
    .set({
      progressPct,
      lastLessonId: lastLessonId ?? undefined,
      lastAccessedAt: new Date(),
      completedAt: progressPct >= 100 ? new Date() : undefined,
    })
    .where(eq(courseEnrollments.id, enrollmentId));
  // Dispatch Zapier course_completed event (non-blocking)
  if (progressPct >= 100) {
    db.select().from(courseEnrollments).where(eq(courseEnrollments.id, enrollmentId)).then((rows) => {
      const enrollment = rows[0];
      if (enrollment?.orgId) {
        import("./zapierRouter").then(({ dispatchZapierEvent }) => {
          dispatchZapierEvent(enrollment.orgId!, "course_completed", {
            enrollment_id: enrollment.id,
            user_id: enrollment.userId,
            course_id: enrollment.courseId,
            org_id: enrollment.orgId,
            progress_pct: 100,
            completed_at: new Date().toISOString(),
          });
        }).catch(() => {});
      }
    }).catch(() => {});
  }
}

// ─── Lesson Progress ─────────────────────────────────────────────────────────

export async function getLessonProgress(enrollmentId: number, lessonId: number) {
  const rows = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.enrollmentId, enrollmentId),
        eq(lessonProgress.lessonId, lessonId)
      )
    );
  return rows[0] ?? null;
}

export async function getAllLessonProgress(enrollmentId: number) {
  return db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.enrollmentId, enrollmentId));
}

export async function upsertLessonProgress(data: typeof lessonProgress.$inferInsert) {
  const existing = await getLessonProgress(data.enrollmentId!, data.lessonId!);
  if (existing) {
    await db
      .update(lessonProgress)
      .set(data)
      .where(eq(lessonProgress.id, existing.id));
    const rows = await db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.id, existing.id));
    return rows[0];
  } else {
    const result = await db.insert(lessonProgress).values(data);
    const id = (result as any)[0]?.insertId ?? (result as any).insertId;
    const rows = await db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.id, Number(id)));
    return rows[0];
  }
}

// ─── Org Themes ──────────────────────────────────────────────────────────────

export async function getOrgTheme(orgId: number) {
  const rows = await db.select().from(orgThemes).where(eq(orgThemes.orgId, orgId));
  return rows[0] ?? null;
}

export async function upsertOrgTheme(orgId: number, data: Partial<typeof orgThemes.$inferInsert>) {
  const existing = await getOrgTheme(orgId);
  if (existing) {
    await db.update(orgThemes).set(data).where(eq(orgThemes.orgId, orgId));
  } else {
    await db.insert(orgThemes).values({ orgId, ...data } as any);
  }
  return getOrgTheme(orgId);
}

// ─── Org Subscriptions ───────────────────────────────────────────────────────

export async function getOrgSubscription(orgId: number) {
  const rows = await db
    .select()
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, orgId));
  return rows[0] ?? null;
}

export async function upsertOrgSubscription(
  orgId: number,
  data: Partial<typeof orgSubscriptions.$inferInsert>
) {
  const existing = await getOrgSubscription(orgId);
  if (existing) {
    await db.update(orgSubscriptions).set(data).where(eq(orgSubscriptions.orgId, orgId));
  } else {
    await db.insert(orgSubscriptions).values({ orgId, ...data } as any);
  }
  return getOrgSubscription(orgId);
}

// ─── Page Builder ────────────────────────────────────────────────────────────

export async function getPagesByOrg(orgId: number) {
  return db
    .select()
    .from(pageBuilderPages)
    .where(eq(pageBuilderPages.orgId, orgId))
    .orderBy(desc(pageBuilderPages.createdAt));
}

export async function getPageById(id: number) {
  const rows = await db.select().from(pageBuilderPages).where(eq(pageBuilderPages.id, id));
  return rows[0] ?? null;
}

export async function getPageByCourse(courseId: number) {
  const rows = await db
    .select()
    .from(pageBuilderPages)
    .where(
      and(
        eq(pageBuilderPages.courseId, courseId),
        eq(pageBuilderPages.pageType, "course_sales")
      )
    );
  return rows[0] ?? null;
}

export async function createPage(data: typeof pageBuilderPages.$inferInsert) {
  const result = await db.insert(pageBuilderPages).values({
    ...data,
    blocksJson: data.blocksJson ?? "[]",
  });
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getPageById(Number(id));
}

export async function updatePage(id: number, data: Partial<typeof pageBuilderPages.$inferInsert>) {
  await db.update(pageBuilderPages).set(data).where(eq(pageBuilderPages.id, id));
  return getPageById(id);
}

export async function deletePage(id: number) {
  await db.delete(pageBuilderPages).where(eq(pageBuilderPages.id, id));
}

export async function getPublishedPageBySlug(slug: string) {
  const rows = await db
    .select()
    .from(pageBuilderPages)
    .where(
      and(
        eq(pageBuilderPages.slug, slug),
        eq(pageBuilderPages.isPublished, true)
      )
    );
  return rows[0] ?? null;
}

export async function duplicatePage(id: number) {
  const original = await getPageById(id);
  if (!original) return null;
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = original;
  const newTitle = `${original.title ?? "Untitled"} (Copy)`;
  const newSlug = `${original.slug ?? "page"}-copy-${Date.now()}`;
  const result = await db.insert(pageBuilderPages).values({
    ...rest,
    title: newTitle,
    slug: newSlug,
    isPublished: false,
  });
  const newId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getPageById(Number(newId));
}

// ─── Instructors ─────────────────────────────────────────────────────────────

export async function getInstructorsByOrg(orgId: number) {
  return db
    .select()
    .from(instructors)
    .where(and(eq(instructors.orgId, orgId), eq(instructors.isActive, true)));
}

export async function getInstructorByUserId(userId: number, orgId: number) {
  const rows = await db
    .select()
    .from(instructors)
    .where(and(eq(instructors.userId, userId), eq(instructors.orgId, orgId)));
  return rows[0] ?? null;
}

export async function upsertInstructor(data: typeof instructors.$inferInsert) {
  const existing = await getInstructorByUserId(data.userId!, data.orgId!);
  if (existing) {
    await db.update(instructors).set(data).where(eq(instructors.id, existing.id));
    const rows = await db.select().from(instructors).where(eq(instructors.id, existing.id));
    return rows[0];
  } else {
    const result = await db.insert(instructors).values(data);
    const id = (result as any)[0]?.insertId ?? (result as any).insertId;
    const rows = await db.select().from(instructors).where(eq(instructors.id, Number(id)));
    return rows[0];
  }
}

export async function updateInstructorById(id: number, data: Partial<typeof instructors.$inferInsert>) {
  await db.update(instructors).set(data).where(eq(instructors.id, id));
  const rows = await db.select().from(instructors).where(eq(instructors.id, id));
  return rows[0];
}

export async function deleteInstructorById(id: number) {
  await db.update(instructors).set({ isActive: false }).where(eq(instructors.id, id));
  return { success: true };
}

// ─── Coupons ─────────────────────────────────────────────────────────────────

export async function getCouponsByOrg(orgId: number) {
  return db
    .select()
    .from(coupons)
    .where(and(eq(coupons.orgId, orgId), eq(coupons.isActive, true)));
}

export async function getCouponByCode(orgId: number, code: string) {
  const rows = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.orgId, orgId), eq(coupons.code, code), eq(coupons.isActive, true)));
  return rows[0] ?? null;
}

export async function createCoupon(data: typeof coupons.$inferInsert) {
  const result = await db.insert(coupons).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(coupons).where(eq(coupons.id, Number(id)));
  return rows[0];
}

export async function updateCoupon(id: number, data: Partial<typeof coupons.$inferInsert>) {
  await db.update(coupons).set(data).where(eq(coupons.id, id));
  const rows = await db.select().from(coupons).where(eq(coupons.id, id));
  return rows[0];
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function getReviewsByCourse(courseId: number) {
  return db
    .select()
    .from(courseReviews)
    .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.isPublished, true)))
    .orderBy(desc(courseReviews.createdAt));
}

export async function createReview(data: typeof courseReviews.$inferInsert) {
  const result = await db.insert(courseReviews).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(courseReviews).where(eq(courseReviews.id, Number(id)));
  return rows[0];
}

// ─── Certificates ────────────────────────────────────────────────────────────

export async function getCertificatesByUser(userId: number) {
  return db
    .select()
    .from(certificates)
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedAt));
}

export async function getCertificateByEnrollment(enrollmentId: number) {
  const rows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.enrollmentId, enrollmentId));
  return rows[0] ?? null;
}

export async function createCertificate(data: typeof certificates.$inferInsert) {
  const result = await db.insert(certificates).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(certificates).where(eq(certificates.id, Number(id)));
  return rows[0];
}

// ─── Dashboard Analytics ─────────────────────────────────────────────────────

export async function getDashboardMetrics(orgId: number, days: number = 30) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [revenueRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${courseEnrollments.amountPaid}), 0)` })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.orgId, orgId), gte(courseEnrollments.enrolledAt, cutoff)));
  const revenue = Number(revenueRow?.total ?? 0);

  const [regRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.orgId, orgId), gte(courseEnrollments.enrolledAt, cutoff)));
  const registrations = Number(regRow?.count ?? 0);

  const [salesRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(courseEnrollments)
    .where(and(
      eq(courseEnrollments.orgId, orgId),
      gte(courseEnrollments.enrolledAt, cutoff),
      gt(courseEnrollments.amountPaid, 0)
    ));
  const sales = Number(salesRow?.count ?? 0);

  const [membersRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${courseEnrollments.userId})` })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.orgId, orgId), eq(courseEnrollments.isActive, true)));
  const activeMembers = Number(membersRow?.count ?? 0);

  return { revenue, registrations, sales, activeMembers };
}

export async function getRevenueChartData(
  orgId: number,
  days: number = 30,
  groupBy: 'day' | 'week' | 'month' = 'day'
) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // Fetch raw rows and group in JS to avoid DATE_FORMAT sandbox restrictions
  const rows = await db
    .select({
      enrolledAt: courseEnrollments.enrolledAt,
      amountPaid: courseEnrollments.amountPaid,
    })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.orgId, orgId), gte(courseEnrollments.enrolledAt, cutoff)));

  const buckets = new Map<string, { revenue: number; enrollments: number }>();
  for (const row of rows) {
    const d = new Date(row.enrolledAt);
    let key: string;
    if (groupBy === 'month') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else if (groupBy === 'week') {
      const day = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + 1);
      key = monday.toISOString().slice(0, 10);
    } else {
      key = d.toISOString().slice(0, 10);
    }
    const existing = buckets.get(key) ?? { revenue: 0, enrollments: 0 };
    existing.revenue += Number(row.amountPaid ?? 0);
    existing.enrollments += 1;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { revenue, enrollments }]) => ({ date, revenue, enrollments }));
}

export async function getRecentActivity(orgId: number, limit: number = 20) {
  const db = await getDb();
  return db
    .select({
      id: courseEnrollments.id,
      type: sql<string>`'enrollment'`,
      userName: users.name,
      userEmail: users.email,
      courseName: courses.title,
      timestamp: courseEnrollments.enrolledAt,
      price: courseEnrollments.amountPaid,
    })
    .from(courseEnrollments)
    .innerJoin(users, eq(courseEnrollments.userId, users.id))
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .where(eq(courseEnrollments.orgId, orgId))
    .orderBy(desc(courseEnrollments.enrolledAt))
    .limit(limit);
}

export async function getRecentlyEditedCourses(orgId: number, limit: number = 6) {
  const db = await getDb();
  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      thumbnailUrl: courses.thumbnailUrl,
      status: courses.status,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(eq(courses.orgId, orgId))
    .orderBy(desc(courses.updatedAt))
    .limit(limit);
}

export async function getEnrolledCoursesForUser(userId: number) {
  const db = await getDb();
  return db
    .select({
      enrollmentId: courseEnrollments.id,
      courseId: courses.id,
      title: courses.title,
      slug: courses.slug,
      thumbnailUrl: courses.thumbnailUrl,
      status: courses.status,
      progressPct: courseEnrollments.progressPct,
      completedAt: courseEnrollments.completedAt,
      lastAccessedAt: courseEnrollments.lastAccessedAt,
      lastLessonId: courseEnrollments.lastLessonId,
      enrolledAt: courseEnrollments.enrolledAt,
      orgId: courses.orgId,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .where(and(eq(courseEnrollments.userId, userId), eq(courseEnrollments.isActive, true)))
    .orderBy(desc(courseEnrollments.lastAccessedAt));
}

// ─── LMS Analytics ───────────────────────────────────────────────────────────

export async function getLmsAnalyticsByOrg(orgId: number) {
  const [enrollmentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.orgId, orgId));

  const [completionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.orgId, orgId), sql`completedAt IS NOT NULL`));

  const [courseCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(courses)
    .where(eq(courses.orgId, orgId));

  return {
    totalEnrollments: Number(enrollmentCount?.count ?? 0),
    totalCompletions: Number(completionCount?.count ?? 0),
    totalCourses: Number(courseCount?.count ?? 0),
  };
}

// ─── Member Activity Events ───────────────────────────────────────────────────

export async function insertActivityEvents(events: typeof memberActivityEvents.$inferInsert[]) {
  if (!events.length) return;
  await db.insert(memberActivityEvents).values(events as any);
}

export async function getActivityEventsByOrg(
  orgId: number,
  opts: {
    userId?: number;
    courseId?: number;
    eventType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  } = {}
) {
  const conditions = [eq(memberActivityEvents.orgId, orgId)];
  if (opts.userId) conditions.push(eq(memberActivityEvents.userId, opts.userId));
  if (opts.courseId) conditions.push(eq(memberActivityEvents.courseId, opts.courseId));
  if (opts.eventType) conditions.push(eq(memberActivityEvents.eventType, opts.eventType as any));
  if (opts.dateFrom) conditions.push(gte(memberActivityEvents.createdAt, opts.dateFrom));
  if (opts.dateTo) conditions.push(sql`${memberActivityEvents.createdAt} <= ${opts.dateTo}`);

  return db
    .select()
    .from(memberActivityEvents)
    .where(and(...conditions))
    .orderBy(desc(memberActivityEvents.createdAt))
    .limit(opts.limit ?? 200)
    .offset(opts.offset ?? 0);
}

export async function getActivitySummaryByUser(orgId: number, userId: number) {
  // Total session time (sum of session_heartbeat durationMs + page_exit durationMs)
  const [timeRow] = await db
    .select({ totalMs: sql<number>`COALESCE(SUM(${memberActivityEvents.durationMs}), 0)` })
    .from(memberActivityEvents)
    .where(
      and(
        eq(memberActivityEvents.orgId, orgId),
        eq(memberActivityEvents.userId, userId),
        sql`${memberActivityEvents.eventType} IN ('session_heartbeat', 'page_exit')`
      )
    );
  const [pageViewRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(memberActivityEvents)
    .where(
      and(
        eq(memberActivityEvents.orgId, orgId),
        eq(memberActivityEvents.userId, userId),
        eq(memberActivityEvents.eventType, "page_view")
      )
    );
  const [videoRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(memberActivityEvents)
    .where(
      and(
        eq(memberActivityEvents.orgId, orgId),
        eq(memberActivityEvents.userId, userId),
        eq(memberActivityEvents.eventType, "video_complete")
      )
    );
  const [lessonRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(memberActivityEvents)
    .where(
      and(
        eq(memberActivityEvents.orgId, orgId),
        eq(memberActivityEvents.userId, userId),
        eq(memberActivityEvents.eventType, "lesson_complete")
      )
    );
  return {
    totalTimeMs: Number(timeRow?.totalMs ?? 0),
    pageViews: Number(pageViewRow?.count ?? 0),
    videosCompleted: Number(videoRow?.count ?? 0),
    lessonsCompleted: Number(lessonRow?.count ?? 0),
  };
}

export async function getActivityMemberList(orgId: number) {
  // Get distinct users who have activity in this org
  const rows = await db
    .selectDistinct({ userId: memberActivityEvents.userId })
    .from(memberActivityEvents)
    .where(and(eq(memberActivityEvents.orgId, orgId), sql`${memberActivityEvents.userId} IS NOT NULL`));
  return rows.map((r) => r.userId).filter(Boolean) as number[];
}

// ─── Notification Settings ────────────────────────────────────────────────────

export type NotificationSettings = {
  enrollment: boolean;
  completion: boolean;
  quizResult: boolean;
  reminder: boolean;
  announcement: boolean;
  weeklyDigest: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enrollment: true,
  completion: true,
  quizResult: true,
  reminder: false,
  announcement: true,
  weeklyDigest: false,
};

export async function getOrgNotificationSettings(orgId: number): Promise<NotificationSettings> {
  const theme = await getOrgTheme(orgId);
  if (!theme?.notificationSettings) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  try {
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(theme.notificationSettings) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
}

export async function updateOrgNotificationSettings(orgId: number, settings: Partial<NotificationSettings>) {
  const current = await getOrgNotificationSettings(orgId);
  const merged = { ...current, ...settings };
  await upsertOrgTheme(orgId, { notificationSettings: JSON.stringify(merged) });
  return merged;
}

export async function getCourseNotificationOverrides(courseId: number) {
  const course = await getCourseById(courseId);
  if (!course?.notificationOverrides) return null;
  try { return JSON.parse(course.notificationOverrides); }
  catch { return null; }
}

export async function updateCourseNotificationOverrides(courseId: number, overrides: Partial<NotificationSettings> | null) {
  await updateCourse(courseId, {
    notificationOverrides: overrides ? JSON.stringify(overrides) : null,
  });
}

// ─── Email Branding ───────────────────────────────────────────────────────────

export type EmailBranding = {
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
  senderName?: string;
};

export async function getOrgEmailBranding(orgId: number): Promise<EmailBranding> {
  const theme = await getOrgTheme(orgId);
  if (!theme?.emailBranding) return {};
  try { return JSON.parse(theme.emailBranding); }
  catch { return {}; }
}

export async function updateOrgEmailBranding(orgId: number, branding: EmailBranding) {
  await upsertOrgTheme(orgId, { emailBranding: JSON.stringify(branding) });
  return branding;
}

// ─── Digital Downloads ────────────────────────────────────────────────────────
import { randomBytes } from "crypto";

export async function listDigitalProducts(orgId: number) {
  return db.select().from(digitalProducts).where(eq(digitalProducts.orgId, orgId)).orderBy(desc(digitalProducts.createdAt));
}

export async function getDigitalProduct(id: number) {
  const rows = await db.select().from(digitalProducts).where(eq(digitalProducts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getDigitalProductBySlug(slug: string) {
  const rows = await db.select().from(digitalProducts).where(eq(digitalProducts.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function createDigitalProduct(data: {
  orgId: number; title: string; slug: string; description?: string;
  fileUrl: string; fileKey: string; fileType?: string; fileSize?: number;
  thumbnailUrl?: string; defaultAccessDays?: number; defaultMaxDownloads?: number;
}) {
  const result = await db.insert(digitalProducts).values(data as any);
  return { id: (result as any)[0].insertId as number };
}

export async function updateDigitalProduct(id: number, data: Partial<{
  title: string; slug: string; description: string; fileUrl: string; fileKey: string;
  fileType: string; fileSize: number; thumbnailUrl: string; salesPageBlocksJson: any;
  isPublished: boolean; defaultAccessDays: number | null; defaultMaxDownloads: number | null;
}>) {
  await db.update(digitalProducts).set(data as any).where(eq(digitalProducts.id, id));
}

export async function deleteDigitalProduct(id: number) {
  await db.delete(digitalDownloadLogs).where(eq(digitalDownloadLogs.productId, id));
  await db.delete(digitalOrders).where(eq(digitalOrders.productId, id));
  await db.delete(digitalProductPrices).where(eq(digitalProductPrices.productId, id));
  await db.delete(digitalProducts).where(eq(digitalProducts.id, id));
}

export async function listProductPrices(productId: number) {
  return db.select().from(digitalProductPrices).where(eq(digitalProductPrices.productId, productId)).orderBy(asc(digitalProductPrices.createdAt));
}

export async function upsertProductPrice(data: {
  id?: number; productId: number; label: string; type: string; amount: string; currency?: string;
  installments?: number | null; installmentAmount?: string | null; intervalDays?: number | null; isActive?: boolean;
}) {
  if (data.id) {
    await db.update(digitalProductPrices).set(data as any).where(eq(digitalProductPrices.id, data.id));
    return data.id;
  }
  const result = await db.insert(digitalProductPrices).values(data as any);
  return (result as any)[0].insertId as number;
}

export async function deleteProductPrice(id: number) {
  await db.delete(digitalProductPrices).where(eq(digitalProductPrices.id, id));
}

export async function createDigitalOrder(data: {
  productId: number; priceId: number; orgId: number; buyerEmail: string; buyerName?: string;
  amount: string; currency?: string; paymentRef?: string;
  accessExpiresAt?: Date | null; maxDownloads?: number | null;
}) {
  const token = randomBytes(32).toString("hex");
  const result = await db.insert(digitalOrders).values({ ...data, downloadToken: token, status: "pending" } as any);
  return { id: (result as any)[0].insertId as number, downloadToken: token };
}

export async function markOrderPaid(id: number, paymentRef?: string) {
  await db.update(digitalOrders).set({ status: "paid", paidAt: new Date(), ...(paymentRef ? { paymentRef } : {}) } as any).where(eq(digitalOrders.id, id));
}

export async function getOrderByToken(token: string) {
  const rows = await db.select().from(digitalOrders).where(eq(digitalOrders.downloadToken, token)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderById(id: number) {
  const rows = await db.select().from(digitalOrders).where(eq(digitalOrders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listOrdersForProduct(productId: number) {
  return db.select().from(digitalOrders).where(eq(digitalOrders.productId, productId)).orderBy(desc(digitalOrders.createdAt));
}

export async function listOrdersForOrg(orgId: number) {
  return db.select().from(digitalOrders).where(eq(digitalOrders.orgId, orgId)).orderBy(desc(digitalOrders.createdAt));
}

export async function incrementDownloadCount(orderId: number) {
  await db.update(digitalOrders).set({ downloadCount: sql`${digitalOrders.downloadCount} + 1` } as any).where(eq(digitalOrders.id, orderId));
}

export async function logDownload(data: { orderId: number; productId: number; ipAddress?: string; userAgent?: string }) {
  await db.insert(digitalDownloadLogs).values(data as any);
}

export async function listDownloadLogs(productId: number) {
  return db.select().from(digitalDownloadLogs).where(eq(digitalDownloadLogs.productId, productId)).orderBy(desc(digitalDownloadLogs.downloadedAt));
}

export async function listDownloadLogsForOrder(orderId: number) {
  return db.select().from(digitalDownloadLogs).where(eq(digitalDownloadLogs.orderId, orderId)).orderBy(desc(digitalDownloadLogs.downloadedAt));
}

export async function updateOrderStatus(id: number, status: string, notes?: string) {
  await db.update(digitalOrders).set({ status, ...(notes !== undefined ? { notes } : {}) } as any).where(eq(digitalOrders.id, id));
}

// ─── Webinars ────────────────────────────────────────────────────────────────

export async function getWebinarsByOrg(orgId: number) {
  return db
    .select()
    .from(webinars)
    .where(eq(webinars.orgId, orgId))
    .orderBy(desc(webinars.createdAt));
}

export async function getWebinarById(id: number) {
  const rows = await db.select().from(webinars).where(eq(webinars.id, id));
  return rows[0] ?? null;
}

export async function getWebinarBySlug(orgId: number, slug: string) {
  const rows = await db
    .select()
    .from(webinars)
    .where(and(eq(webinars.orgId, orgId), eq(webinars.slug, slug)));
  return rows[0] ?? null;
}

export async function getPublishedWebinarBySlug(slug: string) {
  const rows = await db
    .select()
    .from(webinars)
    .where(and(eq(webinars.slug, slug), eq(webinars.isPublished, true)));
  return rows[0] ?? null;
}

export async function createWebinar(data: typeof webinars.$inferInsert) {
  const result = await db.insert(webinars).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getWebinarById(Number(id));
}

export async function updateWebinar(id: number, data: Partial<typeof webinars.$inferInsert>) {
  await db.update(webinars).set(data).where(eq(webinars.id, id));
  return getWebinarById(id);
}

export async function deleteWebinar(id: number) {
  await db.delete(webinarSessions).where(eq(webinarSessions.webinarId, id));
  await db.delete(webinarRegistrations).where(eq(webinarRegistrations.webinarId, id));
  await db.delete(webinarFunnelSteps).where(eq(webinarFunnelSteps.webinarId, id));
  await db.delete(webinars).where(eq(webinars.id, id));
}

// ─── Webinar Registrations ───────────────────────────────────────────────────

export async function getWebinarRegistrations(webinarId: number) {
  return db
    .select()
    .from(webinarRegistrations)
    .where(eq(webinarRegistrations.webinarId, webinarId))
    .orderBy(desc(webinarRegistrations.registeredAt));
}

export async function getWebinarRegistrationByEmail(webinarId: number, email: string) {
  const rows = await db
    .select()
    .from(webinarRegistrations)
    .where(and(eq(webinarRegistrations.webinarId, webinarId), eq(webinarRegistrations.email, email)));
  return rows[0] ?? null;
}

export async function createWebinarRegistration(data: typeof webinarRegistrations.$inferInsert) {
  const result = await db.insert(webinarRegistrations).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(webinarRegistrations).where(eq(webinarRegistrations.id, Number(id)));
  return rows[0];
}

export async function updateWebinarRegistration(id: number, data: Partial<typeof webinarRegistrations.$inferInsert>) {
  await db.update(webinarRegistrations).set(data).where(eq(webinarRegistrations.id, id));
}

// ─── Webinar Sessions ────────────────────────────────────────────────────────

export async function createWebinarSession(data: typeof webinarSessions.$inferInsert) {
  const result = await db.insert(webinarSessions).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(webinarSessions).where(eq(webinarSessions.id, Number(id)));
  return rows[0];
}

export async function getWebinarSessionByToken(token: string) {
  const rows = await db.select().from(webinarSessions).where(eq(webinarSessions.sessionToken, token));
  return rows[0] ?? null;
}

export async function updateWebinarSession(id: number, data: Partial<typeof webinarSessions.$inferInsert>) {
  await db.update(webinarSessions).set(data).where(eq(webinarSessions.id, id));
}

export async function getWebinarSessions(webinarId: number) {
  return db
    .select()
    .from(webinarSessions)
    .where(eq(webinarSessions.webinarId, webinarId))
    .orderBy(desc(webinarSessions.startedAt));
}

// ─── Webinar Funnel Steps ────────────────────────────────────────────────────

export async function getWebinarFunnelSteps(webinarId: number) {
  return db
    .select()
    .from(webinarFunnelSteps)
    .where(eq(webinarFunnelSteps.webinarId, webinarId))
    .orderBy(asc(webinarFunnelSteps.stepOrder));
}

export async function upsertWebinarFunnelSteps(webinarId: number, steps: typeof webinarFunnelSteps.$inferInsert[]) {
  await db.delete(webinarFunnelSteps).where(eq(webinarFunnelSteps.webinarId, webinarId));
  if (steps.length > 0) {
    await db.insert(webinarFunnelSteps).values(steps.map((s, i) => ({ ...s, webinarId, stepOrder: i })));
  }
}

// ─── Webinar Analytics ───────────────────────────────────────────────────────

export async function getWebinarStats(webinarId: number) {
  const registrations = await getWebinarRegistrations(webinarId);
  const sessions = await getWebinarSessions(webinarId);
  const attended = registrations.filter((r) => r.attended).length;
  const converted = registrations.filter((r) => r.convertedAt).length;
  const totalWatchSeconds = sessions.reduce((sum, s) => sum + (s.watchedSeconds ?? 0), 0);
  return {
    totalRegistrations: registrations.length,
    attended,
    converted,
    conversionRate: registrations.length > 0 ? Math.round((converted / registrations.length) * 100) : 0,
    avgWatchMinutes: sessions.length > 0 ? Math.round(totalWatchSeconds / sessions.length / 60) : 0,
  };
}

// ─── Members with Enrollment Data ────────────────────────────────────────────
export async function getMembersWithEnrollments(orgId: number) {
  // Get all org members with user info
  const members = await db
    .select({
      userId: orgMembers.userId,
      role: orgMembers.role,
      joinedAt: orgMembers.joinedAt,
      name: users.name,
      email: users.email,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId))
    .orderBy(desc(orgMembers.joinedAt));

  // For each member, get their enrollment stats
  const results = await Promise.all(
    members.map(async (m) => {
      const enrollmentStats = await db
        .select({
          total: sql<number>`COUNT(*)`,
          completed: sql<number>`SUM(CASE WHEN ${courseEnrollments.completedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
          avgProgress: sql<number>`COALESCE(AVG(${courseEnrollments.progressPct}), 0)`,
          lastAccess: sql<Date | null>`MAX(${courseEnrollments.lastAccessedAt})`,
        })
        .from(courseEnrollments)
        .where(and(eq(courseEnrollments.userId, m.userId), eq(courseEnrollments.orgId, orgId)));
      const stats = enrollmentStats[0];
      return {
        ...m,
        totalEnrollments: Number(stats?.total ?? 0),
        completedCourses: Number(stats?.completed ?? 0),
        avgProgress: Math.round(Number(stats?.avgProgress ?? 0)),
        lastAccess: stats?.lastAccess ?? null,
      };
    })
  );
  return results;
}
export async function listEmailCampaigns(orgId: number) {
  return db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.orgId, orgId))
    .orderBy(desc(emailCampaigns.createdAt));
}

export async function getEmailCampaignById(id: number) {
  const rows = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
  return rows[0] ?? null;
}

export async function createEmailCampaign(data: typeof emailCampaigns.$inferInsert) {
  const result = await db.insert(emailCampaigns).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getEmailCampaignById(Number(id));
}

export async function updateEmailCampaign(id: number, data: Partial<typeof emailCampaigns.$inferInsert>) {
  await db.update(emailCampaigns).set(data).where(eq(emailCampaigns.id, id));
  return getEmailCampaignById(id);
}

export async function deleteEmailCampaign(id: number) {
  await db.delete(emailCampaignRecipients).where(eq(emailCampaignRecipients.campaignId, id));
  await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
}

export async function getEmailCampaignStats(orgId: number) {
  const campaigns = await listEmailCampaigns(orgId);
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount ?? 0), 0);
  const totalOpens = campaigns.reduce((sum, c) => sum + (c.openCount ?? 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clickCount ?? 0), 0);
  const openRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicks / totalSent) * 100) : 0;
  return { totalCampaigns: campaigns.length, totalSent, totalOpens, totalClicks, openRate, clickRate };
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategoriesByOrg(orgId: number) {
  return db.select().from(categories).where(eq(categories.orgId, orgId)).orderBy(asc(categories.sortOrder));
}
export async function getCategoryById(id: number) {
  const rows = await db.select().from(categories).where(eq(categories.id, id));
  return rows[0] ?? null;
}
export async function createCategory(data: typeof categories.$inferInsert) {
  const result = await db.insert(categories).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getCategoryById(Number(id));
}
export async function updateCategory(id: number, data: Partial<typeof categories.$inferInsert>) {
  await db.update(categories).set(data).where(eq(categories.id, id));
  return getCategoryById(id);
}
export async function deleteCategory(id: number) {
  await db.delete(courseCategories).where(eq(courseCategories.categoryId, id));
  await db.delete(categories).where(eq(categories.id, id));
}
export async function getCourseCategories(courseId: number) {
  return db.select().from(courseCategories).where(eq(courseCategories.courseId, courseId));
}
export async function setCourseCategories(courseId: number, categoryIds: number[]) {
  await db.delete(courseCategories).where(eq(courseCategories.courseId, courseId));
  if (categoryIds.length > 0) {
    await db.insert(courseCategories).values(categoryIds.map(cid => ({ courseId, categoryId: cid })));
  }
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export async function getGroupsByOrg(orgId: number) {
  return db.select().from(groups).where(eq(groups.orgId, orgId)).orderBy(desc(groups.createdAt));
}
export async function getGroupById(id: number) {
  const rows = await db.select().from(groups).where(eq(groups.id, id));
  return rows[0] ?? null;
}
export async function createGroup(data: typeof groups.$inferInsert) {
  const result = await db.insert(groups).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getGroupById(Number(id));
}
export async function updateGroup(id: number, data: Partial<typeof groups.$inferInsert>) {
  await db.update(groups).set(data).where(eq(groups.id, id));
  return getGroupById(id);
}
export async function deleteGroup(id: number) {
  await db.delete(groupMembers).where(eq(groupMembers.groupId, id));
  await db.delete(groups).where(eq(groups.id, id));
}
export async function getGroupMembers(groupId: number) {
  return db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId)).orderBy(asc(groupMembers.enrolledAt));
}
export async function addGroupMember(data: typeof groupMembers.$inferInsert) {
  const result = await db.insert(groupMembers).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(groupMembers).where(eq(groupMembers.id, Number(id)));
  // Update usedSeats count
  const count = await db.select({ cnt: sql<number>`count(*)` }).from(groupMembers)
    .where(and(eq(groupMembers.groupId, data.groupId!), eq(groupMembers.status, 'active')));
  await db.update(groups).set({ usedSeats: count[0]?.cnt ?? 0 }).where(eq(groups.id, data.groupId!));
  return rows[0];
}
export async function removeGroupMember(id: number) {
  const rows = await db.select().from(groupMembers).where(eq(groupMembers.id, id));
  if (rows[0]) {
    await db.update(groupMembers).set({ status: 'removed' }).where(eq(groupMembers.id, id));
    const count = await db.select({ cnt: sql<number>`count(*)` }).from(groupMembers)
      .where(and(eq(groupMembers.groupId, rows[0].groupId), eq(groupMembers.status, 'active')));
    await db.update(groups).set({ usedSeats: count[0]?.cnt ?? 0 }).where(eq(groups.id, rows[0].groupId));
  }
}
export async function getGroupsByManager(managerEmail: string) {
  return db.select().from(groups).where(eq(groups.managerEmail, managerEmail)).orderBy(desc(groups.createdAt));
}
export async function getGroupMemberById(id: number) {
  const rows = await db.select().from(groupMembers).where(eq(groupMembers.id, id));
  return rows[0] ?? null;
}

// ─── Discussions ─────────────────────────────────────────────────────────────

export async function getDiscussionsByOrg(orgId: number, courseId?: number) {
  const cond = courseId
    ? and(eq(discussions.orgId, orgId), eq(discussions.courseId, courseId))
    : eq(discussions.orgId, orgId);
  return db.select().from(discussions).where(cond).orderBy(desc(discussions.isPinned), desc(discussions.createdAt));
}
export async function getDiscussionById(id: number) {
  const rows = await db.select().from(discussions).where(eq(discussions.id, id));
  return rows[0] ?? null;
}
export async function createDiscussion(data: typeof discussions.$inferInsert) {
  const result = await db.insert(discussions).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getDiscussionById(Number(id));
}
export async function updateDiscussion(id: number, data: Partial<typeof discussions.$inferInsert>) {
  await db.update(discussions).set(data).where(eq(discussions.id, id));
  return getDiscussionById(id);
}
export async function deleteDiscussion(id: number) {
  await db.delete(discussionReplies).where(eq(discussionReplies.discussionId, id));
  await db.delete(discussions).where(eq(discussions.id, id));
}
export async function getRepliesByDiscussion(discussionId: number) {
  return db.select().from(discussionReplies).where(eq(discussionReplies.discussionId, discussionId)).orderBy(asc(discussionReplies.createdAt));
}
export async function createDiscussionReply(data: typeof discussionReplies.$inferInsert) {
  const result = await db.insert(discussionReplies).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  // Increment reply count
  await db.update(discussions).set({ replyCount: sql`${discussions.replyCount} + 1` }).where(eq(discussions.id, data.discussionId!));
  const rows = await db.select().from(discussionReplies).where(eq(discussionReplies.id, Number(id)));
  return rows[0];
}
export async function deleteDiscussionReply(id: number) {
  const rows = await db.select().from(discussionReplies).where(eq(discussionReplies.id, id));
  if (rows[0]) {
    await db.update(discussions).set({ replyCount: sql`GREATEST(${discussions.replyCount} - 1, 0)` }).where(eq(discussions.id, rows[0].discussionId));
  }
  await db.delete(discussionReplies).where(eq(discussionReplies.id, id));
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export async function getAssignmentsByOrg(orgId: number) {
  return db.select().from(assignments).where(eq(assignments.orgId, orgId)).orderBy(desc(assignments.createdAt));
}
export async function getAssignmentById(id: number) {
  const rows = await db.select().from(assignments).where(eq(assignments.id, id));
  return rows[0] ?? null;
}
export async function createAssignment(data: typeof assignments.$inferInsert) {
  const result = await db.insert(assignments).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getAssignmentById(Number(id));
}
export async function updateAssignment(id: number, data: Partial<typeof assignments.$inferInsert>) {
  await db.update(assignments).set(data).where(eq(assignments.id, id));
  return getAssignmentById(id);
}
export async function deleteAssignment(id: number) {
  await db.delete(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, id));
  await db.delete(assignments).where(eq(assignments.id, id));
}
export async function getSubmissionsByAssignment(assignmentId: number) {
  return db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, assignmentId)).orderBy(desc(assignmentSubmissions.submittedAt));
}
export async function createSubmission(data: typeof assignmentSubmissions.$inferInsert) {
  const result = await db.insert(assignmentSubmissions).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.id, Number(id)));
  return rows[0];
}
export async function gradeSubmission(id: number, grade: string, score: number | null, feedback: string | null) {
  await db.update(assignmentSubmissions).set({ grade, score: score ?? undefined, feedback: feedback ?? undefined, status: 'graded', gradedAt: new Date() }).where(eq(assignmentSubmissions.id, id));
  const rows = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.id, id));
  return rows[0];
}

// ─── Certificate Templates ────────────────────────────────────────────────────

export async function getCertificateTemplatesByOrg(orgId: number) {
  return db.select().from(certificateTemplates).where(eq(certificateTemplates.orgId, orgId)).orderBy(desc(certificateTemplates.isDefault), asc(certificateTemplates.name));
}
export async function getCertificateTemplateById(id: number) {
  const rows = await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, id));
  return rows[0] ?? null;
}
export async function createCertificateTemplate(data: typeof certificateTemplates.$inferInsert) {
  if (data.isDefault) {
    await db.update(certificateTemplates).set({ isDefault: false }).where(eq(certificateTemplates.orgId, data.orgId!));
  }
  const result = await db.insert(certificateTemplates).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getCertificateTemplateById(Number(id));
}
export async function updateCertificateTemplate(id: number, data: Partial<typeof certificateTemplates.$inferInsert>) {
  if (data.isDefault) {
    const t = await getCertificateTemplateById(id);
    if (t) await db.update(certificateTemplates).set({ isDefault: false }).where(eq(certificateTemplates.orgId, t.orgId!));
  }
  await db.update(certificateTemplates).set(data).where(eq(certificateTemplates.id, id));
  return getCertificateTemplateById(id);
}
export async function deleteCertificateTemplate(id: number) {
  await db.delete(certificateTemplates).where(eq(certificateTemplates.id, id));
}

// ─── Affiliates ──────────────────────────────────────────────────────────────

export async function getAffiliatesByOrg(orgId: number) {
  return db.select().from(affiliates).where(eq(affiliates.orgId, orgId)).orderBy(desc(affiliates.createdAt));
}
export async function getAffiliateById(id: number) {
  const rows = await db.select().from(affiliates).where(eq(affiliates.id, id));
  return rows[0] ?? null;
}
export async function createAffiliate(data: typeof affiliates.$inferInsert) {
  const result = await db.insert(affiliates).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getAffiliateById(Number(id));
}
export async function updateAffiliate(id: number, data: Partial<typeof affiliates.$inferInsert>) {
  await db.update(affiliates).set(data).where(eq(affiliates.id, id));
  return getAffiliateById(id);
}
export async function deleteAffiliate(id: number) {
  await db.delete(affiliates).where(eq(affiliates.id, id));
}

// ─── Revenue Partners ─────────────────────────────────────────────────────────

export async function getRevenuePartnersByOrg(orgId: number) {
  return db.select().from(revenuePartners).where(eq(revenuePartners.orgId, orgId)).orderBy(desc(revenuePartners.createdAt));
}
export async function getRevenuePartnerById(id: number) {
  const rows = await db.select().from(revenuePartners).where(eq(revenuePartners.id, id));
  return rows[0] ?? null;
}
export async function createRevenuePartner(data: typeof revenuePartners.$inferInsert) {
  const result = await db.insert(revenuePartners).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getRevenuePartnerById(Number(id));
}
export async function updateRevenuePartner(id: number, data: Partial<typeof revenuePartners.$inferInsert>) {
  await db.update(revenuePartners).set(data).where(eq(revenuePartners.id, id));
  return getRevenuePartnerById(id);
}
export async function deleteRevenuePartner(id: number) {
  await db.delete(revenuePartners).where(eq(revenuePartners.id, id));
}

// ─── Course Orders ────────────────────────────────────────────────────────────

export async function getCourseOrdersByOrg(orgId: number) {
  return db.select().from(courseOrders).where(eq(courseOrders.orgId, orgId)).orderBy(desc(courseOrders.createdAt));
}
export async function getCourseOrderById(id: number) {
  const rows = await db.select().from(courseOrders).where(eq(courseOrders.id, id));
  return rows[0] ?? null;
}
export async function createCourseOrder(data: typeof courseOrders.$inferInsert) {
  const result = await db.insert(courseOrders).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getCourseOrderById(Number(id));
}
export async function updateCourseOrder(id: number, data: Partial<typeof courseOrders.$inferInsert>) {
  await db.update(courseOrders).set(data).where(eq(courseOrders.id, id));
  return getCourseOrderById(id);
}
export async function getCourseOrderStats(orgId: number) {
  const orders = await getCourseOrdersByOrg(orgId);
  const completed = orders.filter(o => o.status === 'completed');
  const totalRevenue = completed.reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const refunded = orders.filter(o => o.status === 'refunded').length;
  return { total: orders.length, completed: completed.length, refunded, totalRevenue };
}

// ─── Memberships ──────────────────────────────────────────────────────────────

export async function getMembershipsByOrg(orgId: number) {
  return db.select().from(memberships).where(eq(memberships.orgId, orgId)).orderBy(asc(memberships.name));
}
export async function getMembershipById(id: number) {
  const rows = await db.select().from(memberships).where(eq(memberships.id, id));
  return rows[0] ?? null;
}
export async function createMembership(data: typeof memberships.$inferInsert) {
  const result = await db.insert(memberships).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getMembershipById(Number(id));
}
export async function updateMembership(id: number, data: Partial<typeof memberships.$inferInsert>) {
  await db.update(memberships).set(data).where(eq(memberships.id, id));
  return getMembershipById(id);
}
export async function deleteMembership(id: number) {
  await db.delete(memberships).where(eq(memberships.id, id));
}

// ─── Membership Members ─────────────────────────────────────────────────────
export async function getMembershipMembers(membershipId: number) {
  return db.select().from(membershipMembers).where(eq(membershipMembers.membershipId, membershipId)).orderBy(desc(membershipMembers.joinedAt));
}
export async function addMembershipMember(data: { membershipId: number; userId: number; status?: "active" | "paused" | "cancelled" | "expired"; stripeSubscriptionId?: string }) {
  const result = await db.insert(membershipMembers).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(membershipMembers).where(eq(membershipMembers.id, Number(id)));
  return rows[0] ?? null;
}
export async function updateMembershipMember(id: number, data: Partial<{ status: string; expiresAt: Date | null; cancelledAt: Date | null }>) {
  await db.update(membershipMembers).set(data as any).where(eq(membershipMembers.id, id));
}
export async function removeMembershipMember(id: number) {
  await db.delete(membershipMembers).where(eq(membershipMembers.id, id));
}

// ─── Membership Content ─────────────────────────────────────────────────────
export async function getMembershipContentItems(membershipId: number) {
  return db.select().from(membershipContent).where(eq(membershipContent.membershipId, membershipId)).orderBy(asc(membershipContent.addedAt));
}
export async function addMembershipContent(data: { membershipId: number; contentType: "course" | "digital_product" | "community" | "webinar"; contentId: number }) {
  const result = await db.insert(membershipContent).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(membershipContent).where(eq(membershipContent.id, Number(id)));
  return rows[0] ?? null;
}
export async function removeMembershipContent(id: number) {
  await db.delete(membershipContent).where(eq(membershipContent.id, id));
}

// ─── Membership Rules ───────────────────────────────────────────────────────
export async function getMembershipRules(membershipId: number) {
  return db.select().from(membershipRules).where(eq(membershipRules.membershipId, membershipId)).orderBy(desc(membershipRules.createdAt));
}
export async function addMembershipRule(data: { membershipId: number; triggerType: "course_purchase" | "product_purchase" | "webinar_registration" | "tag_added" | "manual"; triggerEntityId?: number; triggerTag?: string; action?: "add_to_membership" | "remove_from_membership" }) {
  const result = await db.insert(membershipRules).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(membershipRules).where(eq(membershipRules.id, Number(id)));
  return rows[0] ?? null;
}
export async function updateMembershipRule(id: number, data: Partial<{ isActive: boolean; triggerType: string; triggerEntityId: number; triggerTag: string; action: string }>) {
  await db.update(membershipRules).set(data as any).where(eq(membershipRules.id, id));
}
export async function removeMembershipRule(id: number) {
  await db.delete(membershipRules).where(eq(membershipRules.id, id));
}

// ─── Bundles ──────────────────────────────────────────────────────────────────

export async function getBundlesByOrg(orgId: number) {
  return db.select().from(bundles).where(eq(bundles.orgId, orgId)).orderBy(desc(bundles.createdAt));
}
export async function getBundleById(id: number) {
  const rows = await db.select().from(bundles).where(eq(bundles.id, id));
  return rows[0] ?? null;
}
export async function createBundle(data: typeof bundles.$inferInsert) {
  const result = await db.insert(bundles).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getBundleById(Number(id));
}
export async function updateBundle(id: number, data: Partial<typeof bundles.$inferInsert>) {
  await db.update(bundles).set(data).where(eq(bundles.id, id));
  return getBundleById(id);
}
export async function deleteBundle(id: number) {
  await db.delete(bundles).where(eq(bundles.id, id));
}

// ─── Flashcard Decks ─────────────────────────────────────────────────────────
export async function getFlashcardDecksByOrg(orgId: number) {
  return db.select().from(flashcardDecks).where(eq(flashcardDecks.orgId, orgId)).orderBy(desc(flashcardDecks.createdAt));
}
export async function getFlashcardDeckById(id: number) {
  const rows = await db.select().from(flashcardDecks).where(eq(flashcardDecks.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createFlashcardDeck(data: { orgId: number; title: string; description?: string; category?: string; isPublic?: boolean; createdBy: number }) {
  const result = await db.insert(flashcardDecks).values({ ...data, cardCount: 0 });
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getFlashcardDeckById(Number(id));
}
export async function updateFlashcardDeck(id: number, data: Partial<{ title: string; description: string; category: string; isPublic: boolean; cardCount: number }>) {
  await db.update(flashcardDecks).set({ ...data, updatedAt: new Date() }).where(eq(flashcardDecks.id, id));
  return getFlashcardDeckById(id);
}
export async function deleteFlashcardDeck(id: number) {
  await db.delete(flashcardCards).where(eq(flashcardCards.deckId, id));
  await db.delete(flashcardDecks).where(eq(flashcardDecks.id, id));
}

// ─── Flashcard Cards ─────────────────────────────────────────────────────────
export async function getCardsByDeck(deckId: number) {
  return db.select().from(flashcardCards).where(eq(flashcardCards.deckId, deckId)).orderBy(asc(flashcardCards.sortOrder));
}
export async function bulkUpsertCards(deckId: number, cards: Array<{ front: string; back: string; frontImageUrl?: string; backImageUrl?: string; sortOrder: number }>) {
  await db.delete(flashcardCards).where(eq(flashcardCards.deckId, deckId));
  if (cards.length === 0) return;
  await db.insert(flashcardCards).values(cards.map((c) => ({ deckId, front: c.front, back: c.back, frontImageUrl: c.frontImageUrl, backImageUrl: c.backImageUrl, sortOrder: c.sortOrder })));
  await db.update(flashcardDecks).set({ cardCount: cards.length, updatedAt: new Date() }).where(eq(flashcardDecks.id, deckId));
}

// ─── Lesson Notes ─────────────────────────────────────────────────────────────

export async function getNotesByLesson(userId: number, lessonId: number) {
  return db
    .select()
    .from(lessonNotes)
    .where(and(eq(lessonNotes.userId, userId), eq(lessonNotes.lessonId, lessonId)))
    .orderBy(asc(lessonNotes.createdAt));
}

export async function getNotesByCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(lessonNotes)
    .where(and(eq(lessonNotes.userId, userId), eq(lessonNotes.courseId, courseId)))
    .orderBy(desc(lessonNotes.createdAt));
}

export async function getNoteById(id: number) {
  const rows = await db.select().from(lessonNotes).where(eq(lessonNotes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createNote(data: {
  userId: number;
  courseId: number;
  lessonId: number;
  enrollmentId: number;
  content: string;
  videoTimestamp?: number;
}) {
  const result = await db.insert(lessonNotes).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getNoteById(Number(id));
}

export async function updateNote(id: number, content: string) {
  await db.update(lessonNotes).set({ content, updatedAt: new Date() }).where(eq(lessonNotes.id, id));
  return getNoteById(id);
}

export async function deleteNote(id: number) {
  await db.delete(lessonNotes).where(eq(lessonNotes.id, id));
}

// ─── Lesson Bookmarks ─────────────────────────────────────────────────────────

export async function getBookmarksByCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(lessonBookmarks)
    .where(and(eq(lessonBookmarks.userId, userId), eq(lessonBookmarks.courseId, courseId)))
    .orderBy(desc(lessonBookmarks.createdAt));
}

export async function getBookmark(userId: number, lessonId: number) {
  const rows = await db
    .select()
    .from(lessonBookmarks)
    .where(and(eq(lessonBookmarks.userId, userId), eq(lessonBookmarks.lessonId, lessonId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBookmarkById(id: number) {
  const rows = await db.select().from(lessonBookmarks).where(eq(lessonBookmarks.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createBookmark(data: {
  userId: number;
  courseId: number;
  lessonId: number;
  enrollmentId: number;
  label?: string;
}) {
  const result = await db.insert(lessonBookmarks).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getBookmarkById(Number(id));
}

export async function deleteBookmark(id: number) {
  await db.delete(lessonBookmarks).where(eq(lessonBookmarks.id, id));
}

// ─── Org Analytics with Group Breakdown ───────────────────────────────────────

/**
 * Get comprehensive org analytics broken down by group.
 * Covers both courses (enrollments, completions, progress) and quizzes (attempts, scores, pass rates).
 */
export async function getOrgAnalyticsByGroup(orgId: number, opts: {
  groupId?: number;
  dateFrom?: Date;
  dateTo?: Date;
} = {}) {
  const orgGroups = await db.select().from(groups).where(eq(groups.orgId, orgId));
  const allGroupMembers = await db.select().from(groupMembers)
    .where(sql`${groupMembers.groupId} IN (${orgGroups.length > 0 ? sql.raw(orgGroups.map(g => g.id).join(",")) : sql`0`})`);

  const groupUserMap: Record<number, number[]> = {};
  for (const gm of allGroupMembers) {
    if (!gm.userId) continue;
    if (!groupUserMap[gm.groupId]) groupUserMap[gm.groupId] = [];
    groupUserMap[gm.groupId].push(gm.userId);
  }

  const targetGroups = opts.groupId
    ? orgGroups.filter(g => g.id === opts.groupId)
    : orgGroups;

  const results = [];
  for (const group of targetGroups) {
    const userIds = groupUserMap[group.id] ?? [];
    if (userIds.length === 0) {
      results.push({
        groupId: group.id,
        groupName: group.name,
        memberCount: 0,
        courseMetrics: { enrollments: 0, completions: 0, avgProgress: 0 },
        quizMetrics: { attempts: 0, avgScore: 0, passRate: 0 },
      });
      continue;
    }

    const userIdList = sql.raw(userIds.join(","));
    const enrollConds: any[] = [
      eq(courseEnrollments.orgId, orgId),
      sql`${courseEnrollments.userId} IN (${userIdList})`,
    ];
    if (opts.dateFrom) enrollConds.push(gte(courseEnrollments.enrolledAt, opts.dateFrom));
    if (opts.dateTo) enrollConds.push(sql`${courseEnrollments.enrolledAt} <= ${opts.dateTo}`);

    const [enrollStats] = await db.select({
      total: sql<number>`count(*)`,
      completed: sql<number>`SUM(CASE WHEN completedAt IS NOT NULL THEN 1 ELSE 0 END)`,
      avgProgress: sql<number>`AVG(progressPct)`,
    }).from(courseEnrollments).where(and(...enrollConds));

    const quizConds: any[] = [
      eq(quizAttempts.orgId, orgId),
      sql`${quizAttempts.userId} IN (${userIdList})`,
    ];
    if (opts.dateFrom) quizConds.push(gte(quizAttempts.startedAt, opts.dateFrom));
    if (opts.dateTo) quizConds.push(sql`${quizAttempts.startedAt} <= ${opts.dateTo}`);

    const [quizStats] = await db.select({
      total: sql<number>`count(*)`,
      avgScore: sql<number>`AVG(scorePct)`,
      passed: sql<number>`SUM(CASE WHEN isPassed = 1 THEN 1 ELSE 0 END)`,
    }).from(quizAttempts).where(and(...quizConds));

    const quizTotal = Number(quizStats?.total ?? 0);
    results.push({
      groupId: group.id,
      groupName: group.name,
      memberCount: userIds.length,
      courseMetrics: {
        enrollments: Number(enrollStats?.total ?? 0),
        completions: Number(enrollStats?.completed ?? 0),
        avgProgress: Math.round(Number(enrollStats?.avgProgress ?? 0) * 10) / 10,
      },
      quizMetrics: {
        attempts: quizTotal,
        avgScore: Math.round(Number(quizStats?.avgScore ?? 0) * 10) / 10,
        passRate: quizTotal > 0 ? Math.round((Number(quizStats?.passed ?? 0) / quizTotal) * 1000) / 10 : 0,
      },
    });
  }
  return results;
}

/**
 * Get org-level course analytics summary with timeline data.
 */
export async function getOrgCourseAnalytics(orgId: number, opts: {
  dateFrom?: Date;
  dateTo?: Date;
  groupBy?: "day" | "week" | "month";
} = {}) {
  const conditions: any[] = [eq(courseEnrollments.orgId, orgId)];
  if (opts.dateFrom) conditions.push(gte(courseEnrollments.enrolledAt, opts.dateFrom));
  if (opts.dateTo) conditions.push(sql`${courseEnrollments.enrolledAt} <= ${opts.dateTo}`);

  const [summary] = await db.select({
    totalEnrollments: sql<number>`count(*)`,
    completions: sql<number>`SUM(CASE WHEN completedAt IS NOT NULL THEN 1 ELSE 0 END)`,
    avgProgress: sql<number>`AVG(progressPct)`,
    totalRevenue: sql<number>`COALESCE(SUM(amountPaid), 0)`,
  }).from(courseEnrollments).where(and(...conditions));

  const groupBy = opts.groupBy ?? "day";
  const dateFormat = groupBy === "day" ? "%Y-%m-%d" : groupBy === "week" ? "%x-W%v" : "%Y-%m";
  const timeline = await db.select({
    period: sql<string>`DATE_FORMAT(enrolledAt, ${dateFormat})`,
    enrollments: sql<number>`count(*)`,
    completions: sql<number>`SUM(CASE WHEN completedAt IS NOT NULL THEN 1 ELSE 0 END)`,
  }).from(courseEnrollments)
    .where(and(...conditions))
    .groupBy(sql`DATE_FORMAT(enrolledAt, ${dateFormat})`)
    .orderBy(sql`DATE_FORMAT(enrolledAt, ${dateFormat})`);

  const perCourse = await db.select({
    courseId: courseEnrollments.courseId,
    enrollments: sql<number>`count(*)`,
    completions: sql<number>`SUM(CASE WHEN completedAt IS NOT NULL THEN 1 ELSE 0 END)`,
    avgProgress: sql<number>`AVG(progressPct)`,
    revenue: sql<number>`COALESCE(SUM(amountPaid), 0)`,
  }).from(courseEnrollments)
    .where(and(...conditions))
    .groupBy(courseEnrollments.courseId);

  return {
    summary: {
      totalEnrollments: Number(summary?.totalEnrollments ?? 0),
      completions: Number(summary?.completions ?? 0),
      avgProgress: Math.round(Number(summary?.avgProgress ?? 0) * 10) / 10,
      totalRevenue: Number(summary?.totalRevenue ?? 0),
      completionRate: Number(summary?.totalEnrollments ?? 0) > 0
        ? Math.round((Number(summary?.completions ?? 0) / Number(summary?.totalEnrollments ?? 0)) * 1000) / 10
        : 0,
    },
    timeline,
    perCourse,
  };
}

/**
 * Get org-level quiz analytics summary with timeline data.
 */
export async function getOrgQuizAnalytics(orgId: number, opts: {
  dateFrom?: Date;
  dateTo?: Date;
  groupBy?: "day" | "week" | "month";
} = {}) {
  const conditions: any[] = [eq(quizAttempts.orgId, orgId)];
  if (opts.dateFrom) conditions.push(gte(quizAttempts.startedAt, opts.dateFrom));
  if (opts.dateTo) conditions.push(sql`${quizAttempts.startedAt} <= ${opts.dateTo}`);

  const [summary] = await db.select({
    totalAttempts: sql<number>`count(*)`,
    avgScore: sql<number>`AVG(scorePct)`,
    passed: sql<number>`SUM(CASE WHEN isPassed = 1 THEN 1 ELSE 0 END)`,
    avgTime: sql<number>`AVG(timeTakenSeconds)`,
  }).from(quizAttempts).where(and(...conditions));

  const totalAttempts = Number(summary?.totalAttempts ?? 0);
  const groupBy = opts.groupBy ?? "day";
  const dateFormat = groupBy === "day" ? "%Y-%m-%d" : groupBy === "week" ? "%x-W%v" : "%Y-%m";
  const timeline = await db.select({
    period: sql<string>`DATE_FORMAT(startedAt, ${dateFormat})`,
    attempts: sql<number>`count(*)`,
    avgScore: sql<number>`AVG(scorePct)`,
    passed: sql<number>`SUM(CASE WHEN isPassed = 1 THEN 1 ELSE 0 END)`,
  }).from(quizAttempts)
    .where(and(...conditions))
    .groupBy(sql`DATE_FORMAT(startedAt, ${dateFormat})`)
    .orderBy(sql`DATE_FORMAT(startedAt, ${dateFormat})`);

  const perQuiz = await db.select({
    quizId: quizAttempts.quizId,
    attempts: sql<number>`count(*)`,
    avgScore: sql<number>`AVG(scorePct)`,
    passed: sql<number>`SUM(CASE WHEN isPassed = 1 THEN 1 ELSE 0 END)`,
    avgTime: sql<number>`AVG(timeTakenSeconds)`,
  }).from(quizAttempts)
    .where(and(...conditions))
    .groupBy(quizAttempts.quizId);

  return {
    summary: {
      totalAttempts,
      avgScore: Math.round(Number(summary?.avgScore ?? 0) * 10) / 10,
      passRate: totalAttempts > 0 ? Math.round((Number(summary?.passed ?? 0) / totalAttempts) * 1000) / 10 : 0,
      avgTime: Math.round(Number(summary?.avgTime ?? 0)),
    },
    timeline,
    perQuiz,
  };
}

// ─── Workshops ────────────────────────────────────────────────────────────────

export async function getWorkshopsByOrg(orgId: number) {
  return db.select().from(workshops).where(eq(workshops.orgId, orgId)).orderBy(desc(workshops.createdAt));
}
export async function getWorkshopById(id: number) {
  const rows = await db.select().from(workshops).where(eq(workshops.id, id));
  return rows[0] ?? null;
}
export async function getWorkshopBySlug(orgId: number, slug: string) {
  const rows = await db.select().from(workshops).where(and(eq(workshops.orgId, orgId), eq(workshops.slug, slug)));
  return rows[0] ?? null;
}
export async function createWorkshop(data: typeof workshops.$inferInsert) {
  const result = await db.insert(workshops).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getWorkshopById(Number(id));
}
export async function updateWorkshop(id: number, data: Partial<typeof workshops.$inferInsert>) {
  await db.update(workshops).set(data).where(eq(workshops.id, id));
  return getWorkshopById(id);
}
export async function deleteWorkshop(id: number) {
  await db.delete(workshopRegistrations).where(eq(workshopRegistrations.workshopId, id));
  await db.delete(workshops).where(eq(workshops.id, id));
}
export async function getWorkshopRegistrations(workshopId: number) {
  return db.select().from(workshopRegistrations).where(eq(workshopRegistrations.workshopId, workshopId)).orderBy(desc(workshopRegistrations.registeredAt));
}
export async function createWorkshopRegistration(data: typeof workshopRegistrations.$inferInsert) {
  const result = await db.insert(workshopRegistrations).values(data);
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  const rows = await db.select().from(workshopRegistrations).where(eq(workshopRegistrations.id, Number(id)));
  return rows[0] ?? null;
}
export async function updateWorkshopRegistration(id: number, data: Partial<typeof workshopRegistrations.$inferInsert>) {
  await db.update(workshopRegistrations).set(data).where(eq(workshopRegistrations.id, id));
}

// ─── Course Announcements ────────────────────────────────────────────────────
export async function getAnnouncementsByCourse(courseId: number) {
  return db
    .select()
    .from(courseAnnouncements)
    .where(eq(courseAnnouncements.courseId, courseId))
    .orderBy(desc(courseAnnouncements.isPinned), desc(courseAnnouncements.createdAt));
}

export async function getAnnouncementById(id: number) {
  const rows = await db.select().from(courseAnnouncements).where(eq(courseAnnouncements.id, id));
  return rows[0] ?? null;
}

export async function createAnnouncement(data: typeof courseAnnouncements.$inferInsert) {
  const result = await db.insert(courseAnnouncements).values({ ...data, createdAt: Date.now(), updatedAt: Date.now() });
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getAnnouncementById(Number(id));
}

export async function updateAnnouncement(id: number, data: Partial<typeof courseAnnouncements.$inferInsert>) {
  await db.update(courseAnnouncements).set({ ...data, updatedAt: Date.now() }).where(eq(courseAnnouncements.id, id));
  return getAnnouncementById(id);
}

export async function deleteAnnouncement(id: number) {
  await db.delete(courseAnnouncements).where(eq(courseAnnouncements.id, id));
}

// ─── Course Resources ────────────────────────────────────────────────────────
export async function getResourcesByCourse(courseId: number, lessonId?: number) {
  const conditions = lessonId != null
    ? and(eq(courseResources.courseId, courseId), eq(courseResources.lessonId, lessonId))
    : eq(courseResources.courseId, courseId);
  return db
    .select()
    .from(courseResources)
    .where(conditions)
    .orderBy(asc(courseResources.sortOrder), asc(courseResources.createdAt));
}

export async function getResourceById(id: number) {
  const rows = await db.select().from(courseResources).where(eq(courseResources.id, id));
  return rows[0] ?? null;
}

export async function createResource(data: typeof courseResources.$inferInsert) {
  const result = await db.insert(courseResources).values({ ...data, createdAt: Date.now() });
  const id = (result as any)[0]?.insertId ?? (result as any).insertId;
  return getResourceById(Number(id));
}

export async function updateResource(id: number, data: Partial<typeof courseResources.$inferInsert>) {
  await db.update(courseResources).set(data).where(eq(courseResources.id, id));
  return getResourceById(id);
}

export async function deleteResource(id: number) {
  await db.delete(courseResources).where(eq(courseResources.id, id));
}
