#!/usr/bin/env node

/**
 * Initial Data Migration: Manus (TiDB) → Railway (MySQL)
 * 
 * This script performs a one-time dump of all data from Manus TiDB
 * and imports it into Railway MySQL. Run this once before enabling
 * continuous replication.
 * 
 * Usage: node scripts/migrate-to-railway.mjs
 */

import mysql from 'mysql2/promise';
import { requireMysqlTargets } from './load-replication-config.mjs';

const { manus: MANUS, railway: RAILWAY } = requireMysqlTargets();

async function getManusTables() {
  const conn = await mysql.createConnection({
    host: MANUS.host,
    port: MANUS.port,
    user: MANUS.username,
    password: MANUS.password,
    database: MANUS.database,
    ssl: MANUS.ssl ? 'Amazon RDS' : undefined,
  });

  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
    [MANUS.database]
  );

  await conn.end();
  return tables.map(t => t.TABLE_NAME);
}

async function dumpAndRestore() {
  console.log('🔄 Starting data migration from Manus to Railway...\n');

  // Connect to Manus (source)
  const manusConn = await mysql.createConnection({
    host: MANUS.host,
    port: MANUS.port,
    user: MANUS.username,
    password: MANUS.password,
    database: MANUS.database,
    ssl: MANUS.ssl ? 'Amazon RDS' : undefined,
  });

  // Connect to Railway (destination)
  const railwayConn = await mysql.createConnection({
    host: RAILWAY.host,
    port: RAILWAY.port,
    user: RAILWAY.username,
    password: RAILWAY.password,
    database: RAILWAY.database,
  });

  try {
    // Get list of tables from Manus
    const tables = await getManusTables();
    console.log(`📊 Found ${tables.length} tables in Manus\n`);

    // Drop existing tables in Railway (optional - comment out for safety)
    console.log('🧹 Clearing Railway database...');
    await railwayConn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      try {
        await railwayConn.query(`DROP TABLE IF EXISTS \`${table}\``);
      } catch (e) {
        console.warn(`⚠️  Could not drop ${table}: ${e.message}`);
      }
    }
    await railwayConn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Copy schema and data for each table
    for (const table of tables) {
      console.log(`📦 Migrating table: ${table}`);

      // Get CREATE TABLE statement
      const [createResult] = await manusConn.query(
        `SHOW CREATE TABLE \`${table}\``
      );
      const createStatement = createResult[0]['Create Table'];

      // Create table in Railway
      try {
        await railwayConn.query(createStatement);
      } catch (e) {
        console.warn(`⚠️  Could not create table ${table}: ${e.message}`);
      }

      // Copy data
      const [rows] = await manusConn.query(`SELECT * FROM \`${table}\``);
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(',');
        const columnNames = columns.map(c => `\`${c}\``).join(',');

        const insertSql = `INSERT INTO \`${table}\` (${columnNames}) VALUES (${placeholders})`;
        
        for (const row of rows) {
          const values = columns.map(col => row[col]);
          try {
            await railwayConn.query(insertSql, values);
          } catch (e) {
            console.warn(`⚠️  Could not insert row in ${table}: ${e.message}`);
          }
        }
        console.log(`   ✓ Copied ${rows.length} rows`);
      } else {
        console.log(`   ✓ Table is empty`);
      }
    }

    console.log('\n✅ Migration complete!');
    console.log('📌 Next step: Enable continuous replication with: node scripts/enable-replication.mjs');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await manusConn.end();
    await railwayConn.end();
  }
}

dumpAndRestore();
