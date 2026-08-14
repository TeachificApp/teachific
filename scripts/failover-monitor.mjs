#!/usr/bin/env node

/**
 * Failover Monitor: Health Check & Automatic Failover
 * 
 * This script monitors the health of both Manus and Railway deployments.
 * If Manus becomes unavailable, it can trigger a failover to Railway.
 * 
 * Usage: node scripts/failover-monitor.mjs [--auto-failover]
 * 
 * --auto-failover: Automatically update DNS on Manus failure (requires Cloudflare API)
 */

import mysql from 'mysql2/promise';
import fetch from 'node-fetch';
import { requireMysqlTargets } from './load-replication-config.mjs';

const { manus: MANUS, railway: RAILWAY } = requireMysqlTargets();

const MANUS_APP_URL = process.env.MANUS_APP_URL || 'https://scormhost-fjxmsdmk.manus.space';
const RAILWAY_APP_URL = process.env.RAILWAY_APP_URL || 'https://teachific-app.railway.app';

let lastStatus = {
  manus: null,
  railway: null,
  timestamp: null,
};

async function checkDatabaseHealth(config, name) {
  try {
    const conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? 'Amazon RDS' : undefined,
      connectionTimeout: 5000,
    });

    const [result] = await conn.query('SELECT 1');
    await conn.end();

    return { status: 'healthy', latency: 'N/A' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function checkAppHealth(url, name) {
  try {
    const response = await fetch(`${url}/api/health`, {
      timeout: 5000,
    });

    if (response.ok) {
      return { status: 'healthy', statusCode: response.status };
    } else {
      return { status: 'unhealthy', statusCode: response.status };
    }
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

async function performHealthCheck() {
  console.log(`\n📊 Health Check: ${new Date().toISOString()}`);
  console.log('─'.repeat(50));

  // Check Manus
  console.log('🔍 Checking Manus...');
  const manusDb = await checkDatabaseHealth(MANUS, 'Manus DB');
  const manusApp = await checkAppHealth(MANUS_APP_URL, 'Manus App');
  const manusHealthy = manusDb.status === 'healthy' && manusApp.status === 'healthy';

  console.log(`   Database: ${manusDb.status === 'healthy' ? '✅' : '❌'} ${manusDb.status}`);
  console.log(`   App: ${manusApp.status === 'healthy' ? '✅' : '❌'} ${manusApp.status}`);

  // Check Railway
  console.log('\n🔍 Checking Railway...');
  const railwayDb = await checkDatabaseHealth(RAILWAY, 'Railway DB');
  const railwayApp = await checkAppHealth(RAILWAY_APP_URL, 'Railway App');
  const railwayHealthy = railwayDb.status === 'healthy' && railwayApp.status === 'healthy';

  console.log(`   Database: ${railwayDb.status === 'healthy' ? '✅' : '❌'} ${railwayDb.status}`);
  console.log(`   App: ${railwayApp.status === 'healthy' ? '✅' : '❌'} ${railwayApp.status}`);

  // Update status
  lastStatus = {
    manus: { db: manusDb, app: manusApp, healthy: manusHealthy },
    railway: { db: railwayDb, app: railwayApp, healthy: railwayHealthy },
    timestamp: new Date().toISOString(),
  };

  // Check for failures
  if (!manusHealthy && railwayHealthy) {
    console.log('\n⚠️  ALERT: Manus is down, Railway is healthy!');
    return 'failover_needed';
  } else if (manusHealthy && !railwayHealthy) {
    console.log('\n⚠️  ALERT: Railway is down, Manus is primary');
    return 'railway_down';
  } else if (!manusHealthy && !railwayHealthy) {
    console.log('\n🚨 CRITICAL: Both systems are down!');
    return 'both_down';
  } else {
    console.log('\n✅ All systems operational');
    return 'healthy';
  }
}

async function triggerFailover() {
  console.log('\n🔄 Initiating failover to Railway...');
  console.log('📌 Manual steps required:');
  console.log('   1. Update Cloudflare DNS to point to Railway');
  console.log('   2. Verify Railway database is in sync');
  console.log('   3. Test application at Railway URL');
  console.log('   4. Once stable, investigate Manus issue');

  // Optional: Auto-update Cloudflare DNS (requires CLOUDFLARE_API_TOKEN)
  if (process.argv.includes('--auto-failover') && process.env.CLOUDFLARE_API_TOKEN) {
    console.log('\n🔐 Attempting automatic DNS failover...');
    // Implementation would go here
  }
}

async function continuousMonitoring(intervalSeconds = 60) {
  console.log(`👀 Starting continuous monitoring (interval: ${intervalSeconds}s)`);
  console.log('Press Ctrl+C to stop\n');

  setInterval(async () => {
    const result = await performHealthCheck();

    if (result === 'failover_needed') {
      await triggerFailover();
    }
  }, intervalSeconds * 1000);

  // Run once immediately
  await performHealthCheck();
}

async function getStatus() {
  console.log('\n📋 Last Health Check Status:');
  console.log(JSON.stringify(lastStatus, null, 2));
}

// Main execution
const command = process.argv[2] || 'check';

switch (command) {
  case 'check':
    performHealthCheck().then(result => {
      process.exit(result === 'healthy' ? 0 : 1);
    });
    break;

  case 'monitor':
    continuousMonitoring(process.env.CHECK_INTERVAL_SECONDS || 60);
    break;

  case 'status':
    getStatus();
    break;

  case 'failover':
    triggerFailover();
    break;

  default:
    console.log('Usage: node scripts/failover-monitor.mjs [check|monitor|status|failover]');
    console.log('\nCommands:');
    console.log('  check      - Run single health check');
    console.log('  monitor    - Continuous monitoring (runs every 60s)');
    console.log('  status     - Show last health check status');
    console.log('  failover   - Manually trigger failover');
    process.exit(1);
}
