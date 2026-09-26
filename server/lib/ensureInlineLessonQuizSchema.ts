import { sql } from "drizzle-orm";
import type { getDb } from "../db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Course360's normal migration is the source of truth for these tables.
 * This idempotent fallback only covers a safe mixed-version deploy window in
 * which the learner route becomes available before migration 0088 has reached
 * a database replica. It creates no learner records and never alters existing
 * tables.
 */
const CREATE_ATTEMPTS_TABLE = [
  "CREATE TABLE IF NOT EXISTS `lms_inline_quiz_attempts` (",
  "  `id` int NOT NULL AUTO_INCREMENT,",
  "  `orgId` int NOT NULL,",
  "  `user_id` int NOT NULL,",
  "  `enrollment_id` int NOT NULL,",
  "  `course_id` int NOT NULL,",
  "  `lesson_id` int NOT NULL,",
  "  `quiz_block_id` varchar(128) NOT NULL,",
  "  `score` int NOT NULL,",
  "  `passed` boolean NOT NULL,",
  "  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,",
  "  PRIMARY KEY (`id`),",
  "  KEY `lms_inline_quiz_attempts_org_course_lesson_idx` (`orgId`, `course_id`, `lesson_id`),",
  "  KEY `lms_inline_quiz_attempts_enrollment_block_idx` (`enrollment_id`, `quiz_block_id`)",
  ")",
].join("\n");

const CREATE_RESPONSES_TABLE = [
  "CREATE TABLE IF NOT EXISTS `lms_inline_quiz_responses` (",
  "  `id` int NOT NULL AUTO_INCREMENT,",
  "  `orgId` int NOT NULL,",
  "  `attempt_id` int NOT NULL,",
  "  `question_key` varchar(128) NOT NULL,",
  "  `question_text` text NOT NULL,",
  "  `question_type` varchar(32) NOT NULL,",
  "  `answer_value` text,",
  "  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,",
  "  PRIMARY KEY (`id`),",
  "  KEY `lms_inline_quiz_responses_org_attempt_idx` (`orgId`, `attempt_id`)",
  ")",
].join("\n");

let schemaPromise: Promise<void> | null = null;

/**
 * Ensure only the existing, organization- and enrollment-owned reporting
 * tables exist. This operation is cached once per process and deliberately
 * does not add, transform, or delete columns on an existing table.
 */
export async function ensureInlineLessonQuizSchema(db: Db | null | undefined): Promise<void> {
  if (!db) return;
  if (!schemaPromise) {
    schemaPromise = Promise.all([
      db.execute(sql.raw(CREATE_ATTEMPTS_TABLE)),
      db.execute(sql.raw(CREATE_RESPONSES_TABLE)),
    ]).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

/** Isolated test reset for the process-level assurance cache. */
export function resetInlineLessonQuizSchemaAssuranceForTests() {
  schemaPromise = null;
}

export const INLINE_LESSON_QUIZ_SCHEMA_CONTRACT = {
  attemptsTable: "lms_inline_quiz_attempts",
  responsesTable: "lms_inline_quiz_responses",
  requiredAttemptColumns: ["orgId", "user_id", "enrollment_id", "course_id", "lesson_id", "quiz_block_id"],
  requiredResponseColumns: ["orgId", "attempt_id", "question_key"],
} as const;
