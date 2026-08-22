#!/usr/bin/env node

/**
 * Rewrite old file URL bases in the Railway database after files have been
 * copied to the new S3/R2 public URL.
 *
 * Required:
 *   OLD_STORAGE_BASE_URL=https://old-file-host
 *   NEW_STORAGE_BASE_URL=https://files.example.com
 *
 * DB connection:
 *   DATABASE_URL=mysql://...
 *   or RAILWAY_DB_HOST/PORT/USER/PASS/NAME
 *
 * Optional:
 *   DRY_RUN=1  prints matching columns without updating data
 */
import mysql from "mysql2/promise";
import { loadReplicationConfig } from "./load-replication-config.mjs";

const oldBase = process.env.OLD_STORAGE_BASE_URL?.replace(/\/+$/, "");
const newBase = process.env.NEW_STORAGE_BASE_URL?.replace(/\/+$/, "");
const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!oldBase || !newBase) {
  throw new Error("OLD_STORAGE_BASE_URL and NEW_STORAGE_BASE_URL are required.");
}

async function createRailwayConnection() {
  if (process.env.DATABASE_URL) {
    return mysql.createConnection(process.env.DATABASE_URL);
  }
  const { railway } = loadReplicationConfig();
  if (!railway) {
    throw new Error("Railway DB settings missing. Set DATABASE_URL or RAILWAY_DB_HOST/PORT/USER/PASS/NAME.");
  }
  return mysql.createConnection({
    host: railway.host,
    port: railway.port,
    user: railway.username,
    password: railway.password,
    database: railway.database,
  });
}

async function main() {
  const conn = await createRailwayConnection();
  try {
    const [[dbRow]] = await conn.query("SELECT DATABASE() AS dbName");
    const dbName = dbRow.dbName;
    const [columns] = await conn.query(
      `SELECT TABLE_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND DATA_TYPE IN ('char','varchar','tinytext','text','mediumtext','longtext','json')`,
      [dbName]
    );

    let touchedColumns = 0;
    let changedRows = 0;

    for (const { TABLE_NAME, COLUMN_NAME } of columns) {
      const [countRows] = await conn.query(
        `SELECT COUNT(*) AS count FROM \`${TABLE_NAME}\` WHERE \`${COLUMN_NAME}\` LIKE ?`,
        [`%${oldBase}%`]
      );
      const count = Number(countRows[0]?.count ?? 0);
      if (count === 0) continue;

      touchedColumns++;
      console.log(`${dryRun ? "would update" : "updating"} ${TABLE_NAME}.${COLUMN_NAME}: ${count} row(s)`);

      if (!dryRun) {
        const [result] = await conn.query(
          `UPDATE \`${TABLE_NAME}\`
           SET \`${COLUMN_NAME}\` = REPLACE(\`${COLUMN_NAME}\`, ?, ?)
           WHERE \`${COLUMN_NAME}\` LIKE ?`,
          [oldBase, newBase, `%${oldBase}%`]
        );
        changedRows += result.affectedRows ?? 0;
      }
    }

    console.log(dryRun
      ? `Dry run complete. ${touchedColumns} column(s) contain old URLs.`
      : `Rewrite complete. Updated ${changedRows} row(s) across ${touchedColumns} column(s).`
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Storage URL rewrite failed:", err.message);
  process.exit(1);
});
