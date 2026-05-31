import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { config } from "dotenv";

config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await createConnection(DB_URL);

// Get all tables in DB
const [dbRows] = await conn.execute(
  "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT LIKE '__drizzle%' ORDER BY TABLE_NAME"
);
const dbTables = new Set(dbRows.map((r) => r.TABLE_NAME));

// Get schema tables from file
const schemaContent = readFileSync("/home/ubuntu/scorm-host/drizzle/schema.ts", "utf-8");
const schemaTableMatches = [...schemaContent.matchAll(/^export const \w+ = mysqlTable\("([^"]+)"/gm)];
const schemaTables = new Set(schemaTableMatches.map((m) => m[1]));

console.log(`\nSchema defines: ${schemaTables.size} tables`);
console.log(`DB has: ${dbTables.size} tables`);

const missingInDb = [...schemaTables].filter((t) => !dbTables.has(t)).sort();
const extraInDb = [...dbTables].filter((t) => !schemaTables.has(t)).sort();

if (missingInDb.length === 0) {
  console.log("\n✅ All schema tables exist in the DB!");
} else {
  console.log(`\n❌ Missing in DB (${missingInDb.length} tables):`);
  missingInDb.forEach((t) => console.log(`  - ${t}`));
}

if (extraInDb.length > 0) {
  console.log(`\n⚠️  Extra in DB (not in schema, ${extraInDb.length} tables):`);
  extraInDb.forEach((t) => console.log(`  - ${t}`));
}

// Now check columns for tables that exist in both
console.log("\n--- Checking columns for key new tables ---");
const keyTables = [
  "quiz_banks", "quiz_bank_questions", "quiz_bank_tags", "quiz_question_tags",
  "quiz_import_jobs", "question_bank_folders", "question_bank_items",
  "quiz_attempts", "quiz_answer_choices", "quiz_attempt_responses",
  "quiz_questions", "quiz_question_pools", "quiz_question_overrides",
  "quiz_access_grants", "quizzes", "lms_courses", "lms_enrollments",
  "lms_cohort_sessions", "lms_certificates", "lms_affiliate_conversions",
];

for (const table of keyTables) {
  if (!dbTables.has(table)) {
    console.log(`  ⚠️  ${table}: MISSING FROM DB`);
    continue;
  }
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [table]
  );
  const dbCols = new Set(cols.map((c) => c.COLUMN_NAME));
  console.log(`  ✅ ${table}: ${dbCols.size} columns [${[...dbCols].join(", ")}]`);
}

await conn.end();
