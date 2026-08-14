#!/usr/bin/env node

/**
 * R2 Bucket Sync: Manus S3 → Cloudflare R2
 * 
 * This script continuously syncs files from Manus S3 to Cloudflare R2.
 * It can be run as a cron job or daemon process.
 * 
 * Usage: node scripts/sync-r2-bucket.mjs [--watch]
 * 
 * --watch: Enable continuous monitoring (polls every 5 minutes)
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { loadReplicationConfig } from './load-replication-config.mjs';

const { r2: R2_CONFIG } = loadReplicationConfig();
if (!R2_CONFIG.endpoint || !R2_CONFIG.accessKeyId || !R2_CONFIG.bucketName) {
  throw new Error(
    "R2 settings missing. Set CLOUDFLARE_R2_ENDPOINT / CLOUDFLARE_R2_ACCESS_KEY / CLOUDFLARE_R2_BUCKET or provide replication-config.json."
  );
}

// Initialize S3 client for Manus (using environment variables)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Initialize R2 client for Cloudflare
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey || process.env.CLOUDFLARE_R2_SECRET_KEY,
  },
});

async function listS3Objects(bucket, prefix = '') {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  return response.Contents || [];
}

async function copyObjectToR2(bucket, key) {
  try {
    // Get object from Manus S3
    const getCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const s3Object = await s3Client.send(getCommand);
    const body = await s3Object.Body.transformToByteArray();

    // Put object in Cloudflare R2
    const putCommand = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: body,
      ContentType: s3Object.ContentType,
      Metadata: s3Object.Metadata,
    });

    await r2Client.send(putCommand);
    console.log(`✓ Synced: ${key}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to sync ${key}: ${error.message}`);
    return false;
  }
}

async function syncBucket(bucket) {
  console.log(`🔄 Starting R2 bucket sync from Manus S3 to Cloudflare R2...\n`);

  try {
    const objects = await listS3Objects(bucket);
    console.log(`📊 Found ${objects.length} objects in Manus S3\n`);

    let synced = 0;
    let failed = 0;

    for (const obj of objects) {
      const success = await copyObjectToR2(bucket, obj.Key);
      if (success) synced++;
      else failed++;
    }

    console.log(`\n✅ Sync complete: ${synced} synced, ${failed} failed`);
    return failed === 0;
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    return false;
  }
}

async function watchBucket(bucket, intervalMinutes = 5) {
  console.log(`👀 Watching bucket for changes (checking every ${intervalMinutes} minutes)...\n`);

  setInterval(async () => {
    const success = await syncBucket(bucket);
    if (!success) {
      console.error('⚠️  Sync encountered errors');
    }
  }, intervalMinutes * 60 * 1000);

  // Run once immediately
  await syncBucket(bucket);
}

// Main execution
const bucket = process.env.MANUS_S3_BUCKET || 'teachific';
const watchMode = process.argv.includes('--watch');

if (watchMode) {
  watchBucket(bucket);
} else {
  syncBucket(bucket).then(success => {
    process.exit(success ? 0 : 1);
  });
}
