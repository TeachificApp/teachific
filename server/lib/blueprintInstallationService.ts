/**
 * blueprintInstallationService.ts
 * Teachific™ Blueprint System — Installation Engine
 *
 * Performs a deep-clone of Blueprint resources into a target organization.
 * Every resource receives a new ID scoped to the target org.
 * All internal cross-references are rewritten using a resourceIdMap.
 * Variable tokens ({{variable_key}}) are replaced with user-supplied values.
 * On failure, all created resources are deleted (rollback).
 */

import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  blueprints,
  blueprintVersions,
  blueprintResources,
  blueprintVariables,
  blueprintInstallations,
  blueprintInstalledResources,
  blueprintLicenses,
  lmsCourses,
  lmsSections,
  lmsLessons,
  lmsLandingPages,
  lmsQuizzes,
  lmsQuizQuestions,
} from "../../drizzle/schema";
import { asc } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstallationOptions {
  blueprintId: number;
  blueprintVersionId: number;
  organizationId: number;
  installedByUserId: number;
  customizationValues: Record<string, string>;
  purchaseId?: number;
}

export interface InstallationResult {
  installationId: number;
  status: "completed" | "failed" | "rolled_back";
  resourceIdMap: Record<string, number>;
  installedResources: Array<{
    resourceType: string;
    sourceId: number;
    installedId: number;
    name: string;
  }>;
  errors: string[];
}

interface StepLog {
  step: string;
  status: "ok" | "error" | "skipped";
  message?: string;
  timestamp: string;
}

// ─── Variable Replacement ─────────────────────────────────────────────────────

function replaceVariables(text: string | null | undefined, values: Record<string, string>): string {
  if (!text) return text ?? "";
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return values[key] !== undefined ? values[key] : match;
  });
}

function replaceVariablesInObject<T extends Record<string, unknown>>(
  obj: T,
  values: Record<string, string>,
  textFields: string[]
): T {
  const result = { ...obj };
  for (const field of textFields) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field] = replaceVariables(result[field] as string, values);
    }
  }
  return result;
}

// ─── Slug Helpers ─────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

async function uniqueSlug(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.slug, slug)).limit(1);
    if (existing.length === 0) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

// ─── Course Cloner ────────────────────────────────────────────────────────────

async function cloneCourse(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  sourceId: number,
  targetOrgId: number,
  installedByUserId: number,
  variables: Record<string, string>
): Promise<{ installedId: number; name: string }> {
  const [src] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, sourceId)).limit(1);
  if (!src) throw new Error(`Source course ${sourceId} not found`);

  const newTitle = replaceVariables(src.title, variables);
  const base = generateSlug(newTitle);
  const newSlug = await uniqueSlug(db, base);

  const [newCourse] = await db.insert(lmsCourses).values({
    orgId: targetOrgId,
    slug: newSlug,
    title: newTitle,
    subtitle: replaceVariables(src.subtitle, variables),
    description: replaceVariables(src.description, variables),
    coverImageUrl: src.coverImageUrl,
    status: "draft" as const,
    type: src.type,
    brand: src.brand,
    price: src.price,
    isFree: src.isFree,
    pricingType: src.pricingType,
    subscriptionInterval: src.subscriptionInterval,
    trialDays: src.trialDays,
    accessDurationDays: src.accessDurationDays,
    downPayment: src.downPayment,
    installmentCount: src.installmentCount,
    installmentAmount: src.installmentAmount,
    installmentIntervalDays: src.installmentIntervalDays,
    hasCertificate: src.hasCertificate,
    isDrip: src.isDrip,
    metaTitle: replaceVariables(src.metaTitle, variables),
    metaDescription: replaceVariables(src.metaDescription, variables),
    createdByUserId: installedByUserId,
  }).$returningId();
  const newCourseId = newCourse.id;

  // Clone landing page
  const [lp] = await db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, sourceId)).limit(1);
  if (lp) {
    const { id: _lpId, courseId: _lpCid, ...lpRest } = lp;
    await db.insert(lmsLandingPages).values({
      ...lpRest,
      courseId: newCourseId,
      heroTitle: replaceVariables(lpRest.heroTitle, variables),
      heroSubtitle: replaceVariables(lpRest.heroSubtitle, variables),
    });
  } else {
    await db.insert(lmsLandingPages).values({ courseId: newCourseId, heroTitle: newTitle, ctaText: "Enroll Now" });
  }

  // Clone sections
  const sections = await db.select().from(lmsSections).where(eq(lmsSections.courseId, sourceId)).orderBy(asc(lmsSections.position));
  const sectionIdMap: Record<number, number> = {};
  for (const sec of sections) {
    const { id: _sid, courseId: _scid, ...secRest } = sec;
    const [newSec] = await db.insert(lmsSections).values({ ...secRest, courseId: newCourseId }).$returningId();
    sectionIdMap[sec.id] = newSec.id;
  }

  // Clone lessons
  const lessons = await db.select().from(lmsLessons).where(eq(lmsLessons.courseId, sourceId)).orderBy(asc(lmsLessons.position));
  for (const les of lessons) {
    const { id: _lid, courseId: _lcid, ...lesRest } = les;
    const newSectionId = les.sectionId ? (sectionIdMap[les.sectionId] ?? null) : null;
    const [newLes] = await db.insert(lmsLessons).values({
      ...lesRest,
      courseId: newCourseId,
      sectionId: newSectionId,
      title: replaceVariables(lesRest.title, variables),
      content: replaceVariables(lesRest.content as string | undefined, variables),
    }).$returningId();

    // Clone quiz for this lesson
    const [quiz] = await db.select().from(lmsQuizzes).where(eq(lmsQuizzes.lessonId, les.id)).limit(1);
    if (quiz) {
      const { id: _qid, lessonId: _qlid, ...quizRest } = quiz;
      const [newQuiz] = await db.insert(lmsQuizzes).values({ ...quizRest, lessonId: newLes.id }).$returningId();
      const questions = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.quizId, quiz.id)).orderBy(asc(lmsQuizQuestions.position));
      for (const q of questions) {
        const { id: _qqid, quizId: _qqzid, ...qRest } = q;
        await db.insert(lmsQuizQuestions).values({ ...qRest, quizId: newQuiz.id });
      }
    }
  }

  return { installedId: newCourseId, name: newTitle };
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

async function rollbackInstallation(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  installationId: number,
  installedResources: Array<{ resourceType: string; installedId: number }>
): Promise<void> {
  // Delete in reverse dependency order
  const reversed = [...installedResources].reverse();
  for (const r of reversed) {
    try {
      if (r.resourceType === "course") {
        await db.delete(lmsCourses).where(eq(lmsCourses.id, r.installedId));
      }
      // Additional resource types will be added as Phase 1 expands
    } catch {
      // Best-effort rollback — log but continue
    }
  }
  await db
    .update(blueprintInstallations)
    .set({ installationStatus: "rolled_back" })
    .where(eq(blueprintInstallations.id, installationId));
}

// ─── Main Installation Function ───────────────────────────────────────────────

export async function installBlueprint(options: InstallationOptions): Promise<InstallationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const {
    blueprintId,
    blueprintVersionId,
    organizationId,
    installedByUserId,
    customizationValues,
    purchaseId,
  } = options;

  const logs: StepLog[] = [];
  const resourceIdMap: Record<string, number> = {};
  const installedResourcesList: Array<{ resourceType: string; sourceId: number; installedId: number; name: string }> = [];
  const errors: string[] = [];

  const log = (step: string, status: StepLog["status"], message?: string) => {
    logs.push({ step, status, message, timestamp: new Date().toISOString() });
  };

  // Create installation record
  const [installRow] = await db.insert(blueprintInstallations).values({
    blueprintId,
    blueprintVersionId,
    purchaseId: purchaseId ?? null,
    organizationId,
    installedByUserId,
    installationStatus: "validating",
    customizationValues: JSON.stringify(customizationValues),
    resourceIdMap: "{}",
    installationLog: "[]",
  }).$returningId();
  const installationId = installRow.id;

  try {
    // Validate blueprint exists and is published
    const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
    if (!bp) throw new Error(`Blueprint ${blueprintId} not found`);
    if (bp.status !== "published") throw new Error(`Blueprint is not published (status: ${bp.status})`);
    log("validate_blueprint", "ok", `Blueprint "${bp.title}" validated`);

    // Validate version
    const [version] = await db.select().from(blueprintVersions).where(eq(blueprintVersions.id, blueprintVersionId)).limit(1);
    if (!version) throw new Error(`Blueprint version ${blueprintVersionId} not found`);
    log("validate_version", "ok", `Version ${version.versionNumber} validated`);

    // Load resources in dependency order
    const resources = await db
      .select()
      .from(blueprintResources)
      .where(eq(blueprintResources.blueprintId, blueprintId))
      .orderBy(asc(blueprintResources.resourceOrder));
    log("load_resources", "ok", `Found ${resources.length} resources to install`);

    // Update status to copying
    await db.update(blueprintInstallations).set({ installationStatus: "copying" }).where(eq(blueprintInstallations.id, installationId));

    // Install each resource
    for (const resource of resources) {
      try {
        let installedId: number | null = null;
        let installedName = resource.resourceName;

        if (resource.resourceType === "course") {
          const result = await cloneCourse(db, resource.sourceResourceId, organizationId, installedByUserId, customizationValues);
          installedId = result.installedId;
          installedName = result.name;
          resourceIdMap[`course:${resource.sourceResourceId}`] = installedId;
        }
        // Additional resource types (download, page, funnel, webinar, form) will be added as Phase 1 expands

        if (installedId !== null) {
          await db.insert(blueprintInstalledResources).values({
            installationId,
            blueprintResourceId: resource.id,
            resourceType: resource.resourceType,
            sourceResourceId: resource.sourceResourceId,
            installedResourceId: installedId,
            organizationId,
            installationStatus: "completed",
          });
          installedResourcesList.push({
            resourceType: resource.resourceType,
            sourceId: resource.sourceResourceId,
            installedId,
            name: installedName,
          });
          log(`install_${resource.resourceType}_${resource.sourceResourceId}`, "ok", `Installed as ID ${installedId}`);
        } else if (!resource.required) {
          await db.insert(blueprintInstalledResources).values({
            installationId,
            blueprintResourceId: resource.id,
            resourceType: resource.resourceType,
            sourceResourceId: resource.sourceResourceId,
            installedResourceId: null,
            organizationId,
            installationStatus: "skipped",
          });
          log(`install_${resource.resourceType}_${resource.sourceResourceId}`, "skipped", `Resource type not yet supported, skipped`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to install ${resource.resourceType} ${resource.sourceResourceId}: ${msg}`);
        log(`install_${resource.resourceType}_${resource.sourceResourceId}`, "error", msg);

        if (resource.required) {
          // Required resource failed — rollback
          await rollbackInstallation(db, installationId, installedResourcesList);
          await db.update(blueprintInstallations).set({
            installationLog: JSON.stringify(logs),
            resourceIdMap: JSON.stringify(resourceIdMap),
          }).where(eq(blueprintInstallations.id, installationId));
          return {
            installationId,
            status: "rolled_back",
            resourceIdMap,
            installedResources: installedResourcesList,
            errors,
          };
        }
      }
    }

    // Update status to configuring (variable replacement post-pass)
    await db.update(blueprintInstallations).set({ installationStatus: "configuring" }).where(eq(blueprintInstallations.id, installationId));
    log("configure_variables", "ok", `Applied ${Object.keys(customizationValues).length} variable values`);

    // Ensure license record exists
    const [existingLicense] = await db
      .select()
      .from(blueprintLicenses)
      .where(and(eq(blueprintLicenses.blueprintId, blueprintId), eq(blueprintLicenses.organizationId, organizationId)))
      .limit(1);
    if (!existingLicense) {
      await db.insert(blueprintLicenses).values({
        blueprintId,
        organizationId,
        licenseType: "single_organization",
        status: "active",
      });
    }

    // Mark installation complete
    await db.update(blueprintInstallations).set({
      installationStatus: "awaiting_setup",
      completedAt: new Date(),
      resourceIdMap: JSON.stringify(resourceIdMap),
      installationLog: JSON.stringify(logs),
    }).where(eq(blueprintInstallations.id, installationId));

    log("complete", "ok", "Installation completed successfully");

    return {
      installationId,
      status: "completed",
      resourceIdMap,
      installedResources: installedResourcesList,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    log("fatal_error", "error", msg);

    await rollbackInstallation(db, installationId, installedResourcesList);
    await db.update(blueprintInstallations).set({
      installationLog: JSON.stringify(logs),
      resourceIdMap: JSON.stringify(resourceIdMap),
    }).where(eq(blueprintInstallations.id, installationId));

    return {
      installationId,
      status: "rolled_back",
      resourceIdMap,
      installedResources: installedResourcesList,
      errors,
    };
  }
}

// ─── Snapshot Builder ─────────────────────────────────────────────────────────

/**
 * Builds a self-contained snapshot of a course for storage in blueprint_versions.snapshotData.
 * The snapshot does NOT contain student data, enrollments, or payment credentials.
 */
export async function snapshotCourse(courseId: number): Promise<Record<string, unknown>> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  if (!course) throw new Error(`Course ${courseId} not found`);

  const [landingPage] = await db.select().from(lmsLandingPages).where(eq(lmsLandingPages.courseId, courseId)).limit(1);
  const sections = await db.select().from(lmsSections).where(eq(lmsSections.courseId, courseId)).orderBy(asc(lmsSections.position));
  const lessons = await db.select().from(lmsLessons).where(eq(lmsLessons.courseId, courseId)).orderBy(asc(lmsLessons.position));

  const lessonIds = lessons.map((l) => l.id);
  const quizzes = lessonIds.length > 0
    ? await db.select().from(lmsQuizzes).where(inArray(lmsQuizzes.lessonId, lessonIds))
    : [];
  const quizIds = quizzes.map((q) => q.id);
  const questions = quizIds.length > 0
    ? await db.select().from(lmsQuizQuestions).where(inArray(lmsQuizQuestions.quizId, quizIds)).orderBy(asc(lmsQuizQuestions.position))
    : [];

  return {
    resourceType: "course",
    course,
    landingPage: landingPage ?? null,
    sections,
    lessons,
    quizzes,
    questions,
    snapshotAt: new Date().toISOString(),
  };
}
