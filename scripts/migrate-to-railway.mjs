#!/usr/bin/env node

/**
 * Initial Data Migration: source MySQL/TiDB → Railway MySQL
 * 
 * This script performs a one-time copy of all source tables and data
 * into Railway MySQL.
 * 
 * Usage: node scripts/migrate-to-railway.mjs
 */

import mysql from 'mysql2/promise';
import { requireMysqlTargets } from './load-replication-config.mjs';

const { source: SOURCE, railway: RAILWAY } = requireMysqlTargets();

async function getSourceTables() {
  const conn = await mysql.createConnection({
    host: SOURCE.host,
    port: SOURCE.port,
    user: SOURCE.username,
    password: SOURCE.password,
    database: SOURCE.database,
    ssl: SOURCE.ssl ? 'Amazon RDS' : undefined,
  });

  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
    [SOURCE.database]
  );

  await conn.end();
  return tables.map(t => t.TABLE_NAME);
}

async function dumpAndRestore() {
  console.log('🔄 Starting data migration from source DB to Railway...\n');

  const sourceConn = await mysql.createConnection({
    host: SOURCE.host,
    port: SOURCE.port,
    user: SOURCE.username,
    password: SOURCE.password,
    database: SOURCE.database,
    ssl: SOURCE.ssl ? 'Amazon RDS' : undefined,
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
    const tables = await getSourceTables();
    console.log(`📊 Found ${tables.length} tables in source DB\n`);

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
      const [createResult] = await sourceConn.query(
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
      const [rows] = await sourceConn.query(`SELECT * FROM \`${table}\``);
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
    console.log('📌 Next step: copy files, rewrite old file URLs, then smoke-test Railway.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sourceConn.end();
    await railwayConn.end();
  }
}

dumpAndRestore();
