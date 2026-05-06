import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

const sql = readFileSync('./drizzle/0003_fair_eddie_brock.sql', 'utf8');
const statements = sql
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.length > 0);

const conn = await mysql.createConnection(process.env.DATABASE_URL);

for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.slice(0, 60).replace(/\n/g, ' '));
  } catch (err) {
    if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_KEYNAME') {
      console.log('SKIP (already exists):', stmt.slice(0, 60).replace(/\n/g, ' '));
    } else {
      console.error('ERROR:', err.message, '\nSQL:', stmt.slice(0, 120));
    }
  }
}

await conn.end();
console.log('Migration complete.');
