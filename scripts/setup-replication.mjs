#!/usr/bin/env node

/**
 * MySQL Replication Setup: Manus (Master) → Railway (Slave)
 * 
 * This script configures real-time binary log replication from Manus TiDB
 * to Railway MySQL. After running this, changes on Manus will automatically
 * sync to Railway in real-time.
 * 
 * Prerequisites:
 * - Manus TiDB must have binary logging enabled (usually default)
 * - Railway MySQL must be accessible
 * - Must run from a machine with network access to both databases
 * 
 * Usage: node scripts/setup-replication.mjs
 */

import mysql from 'mysql2/promise';
import readline from 'readline';
import { requireMysqlTargets } from './load-replication-config.mjs';

const { manus: MANUS, railway: RAILWAY } = requireMysqlTargets();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function checkManusBinaryLogging() {
  console.log('\n📋 Checking Manus binary logging status...');

  const conn = await mysql.createConnection({
    host: MANUS.host,
    port: MANUS.port,
    user: MANUS.username,
    password: MANUS.password,
    database: MANUS.database,
    ssl: MANUS.ssl ? 'Amazon RDS' : undefined,
  });

  try {
    const [result] = await conn.query('SHOW VARIABLES LIKE "log_bin"');
    if (result.length > 0 && result[0].Value === 'ON') {
      console.log('✅ Binary logging is enabled on Manus');
      return true;
    } else {
      console.log('❌ Binary logging is NOT enabled on Manus');
      console.log('   Contact Manus support to enable binary logging');
      return false;
    }
  } finally {
    await conn.end();
  }
}

async function createReplicationUser() {
  console.log('\n👤 Creating replication user on Manus...');

  const conn = await mysql.createConnection({
    host: MANUS.host,
    port: MANUS.port,
    user: MANUS.username,
    password: MANUS.password,
    database: MANUS.database,
    ssl: MANUS.ssl ? 'Amazon RDS' : undefined,
  });

  try {
    const replUser = 'replication';
    const replPassword = Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15);

    // Drop existing user if exists
    await conn.query(`DROP USER IF EXISTS '${replUser}'@'%'`);

    // Create new replication user
    await conn.query(
      `CREATE USER '${replUser}'@'%' IDENTIFIED BY '${replPassword}'`
    );

    // Grant replication privileges
    await conn.query(
      `GRANT REPLICATION SLAVE ON *.* TO '${replUser}'@'%'`
    );

    await conn.query('FLUSH PRIVILEGES');

    console.log(`✅ Replication user created: ${replUser}`);
    console.log(`   Password: ${replPassword}`);

    return { user: replUser, password: replPassword };
  } finally {
    await conn.end();
  }
}

async function getMasterStatus() {
  console.log('\n📍 Getting Manus master status...');

  const conn = await mysql.createConnection({
    host: MANUS.host,
    port: MANUS.port,
    user: MANUS.username,
    password: MANUS.password,
    database: MANUS.database,
    ssl: MANUS.ssl ? 'Amazon RDS' : undefined,
  });

  try {
    const [result] = await conn.query('SHOW MASTER STATUS');
    if (result.length === 0) {
      throw new Error('Could not get master status. Binary logging may not be enabled.');
    }

    const status = result[0];
    console.log(`✅ Master status retrieved:`);
    console.log(`   File: ${status.File}`);
    console.log(`   Position: ${status.Position}`);

    return {
      file: status.File,
      position: status.Position,
    };
  } finally {
    await conn.end();
  }
}

async function configureReplica(replUser, replPassword, masterStatus) {
  console.log('\n⚙️  Configuring Railway as replica...');

  const conn = await mysql.createConnection({
    host: RAILWAY.host,
    port: RAILWAY.port,
    user: RAILWAY.username,
    password: RAILWAY.password,
    database: RAILWAY.database,
  });

  try {
    // Stop any existing replication
    await conn.query('STOP SLAVE');

    // Configure master
    const changeMasterSQL = `
      CHANGE MASTER TO
        MASTER_HOST='${MANUS.host}',
        MASTER_PORT=${MANUS.port},
        MASTER_USER='${replUser}',
        MASTER_PASSWORD='${replPassword}',
        MASTER_LOG_FILE='${masterStatus.file}',
        MASTER_LOG_POS=${masterStatus.position},
        MASTER_SSL=1;
    `;

    await conn.query(changeMasterSQL);
    console.log('✅ Master configured');

    // Start replication
    await conn.query('START SLAVE');
    console.log('✅ Replication started');

    // Check slave status
    const [slaveStatus] = await conn.query('SHOW SLAVE STATUS');
    if (slaveStatus.length > 0) {
      const status = slaveStatus[0];
      console.log(`\n📊 Slave Status:`);
      console.log(`   Slave_IO_Running: ${status.Slave_IO_Running}`);
      console.log(`   Slave_SQL_Running: ${status.Slave_SQL_Running}`);
      console.log(`   Seconds_Behind_Master: ${status.Seconds_Behind_Master}`);

      if (status.Slave_IO_Running === 'Yes' && status.Slave_SQL_Running === 'Yes') {
        console.log('\n✅ Replication is active and running!');
        return true;
      } else {
        console.log('\n⚠️  Replication is configured but not running');
        if (status.Last_Error) {
          console.log(`   Error: ${status.Last_Error}`);
        }
        return false;
      }
    }
  } finally {
    await conn.end();
  }
}

async function setupReplication() {
  console.log('🔄 MySQL Replication Setup: Manus → Railway\n');
  console.log('This will configure real-time replication from Manus TiDB to Railway MySQL.\n');

  const confirm = await question('Continue? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    process.exit(0);
  }

  try {
    // Step 1: Check binary logging
    const hasLogging = await checkManusBinaryLogging();
    if (!hasLogging) {
      console.log('\n❌ Cannot proceed without binary logging');
      process.exit(1);
    }

    // Step 2: Create replication user
    const replUser = await createReplicationUser();

    // Step 3: Get master status
    const masterStatus = await getMasterStatus();

    // Step 4: Configure replica
    const success = await configureReplica(
      replUser.user,
      replUser.password,
      masterStatus
    );

    if (success) {
      console.log('\n✅ Replication setup complete!');
      console.log('\n📌 Next steps:');
      console.log('   1. Monitor replication: node scripts/failover-monitor.mjs monitor');
      console.log('   2. Check sync lag: SHOW SLAVE STATUS on Railway');
      console.log('   3. Test failover: Stop Manus and verify Railway takes over');
    } else {
      console.log('\n⚠️  Replication configured but not running. Check error logs.');
    }

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setupReplication();
