#!/usr/bin/env node

/**
 * R2 Bucket Sync: source S3-compatible bucket → Cloudflare R2
 * 
 * This script syncs files from a source S3-compatible bucket to Cloudflare R2.
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

const sourceBucket = process.env.SOURCE_S3_BUCKET;
if (!sourceBucket) {
  throw new Error("SOURCE_S3_BUCKET is required.");
}
const sourceAccessKeyId = process.env.SOURCE_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const sourceSecretAccessKey = process.env.SOURCE_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
if (!sourceAccessKeyId || !sourceSecretAccessKey) {
  throw new Error("Source storage credentials missing. Set SOURCE_AWS_ACCESS_KEY_ID and SOURCE_AWS_SECRET_ACCESS_KEY.");
}

// Initialize source S3 client.
const s3Client = new S3Client({
  region: process.env.SOURCE_AWS_REGION || process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.SOURCE_S3_ENDPOINT || undefined,
  forcePathStyle: Boolean(process.env.SOURCE_S3_ENDPOINT),
  credentials: {
    accessKeyId: sourceAccessKeyId,
    secretAccessKey: sourceSecretAccessKey,
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
  const objects = [];
  let ContinuationToken;
  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken,
    });

    const response = await s3Client.send(command);
    objects.push(...(response.Contents || []));
    ContinuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

async function copyObjectToR2(bucket, key) {
  try {
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
  console.log(`🔄 Starting R2 bucket sync from source bucket to Cloudflare R2...\n`);

  try {
    const objects = await listS3Objects(bucket);
    console.log(`📊 Found ${objects.length} objects in source bucket\n`);

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

const watchMode = process.argv.includes('--watch');

if (watchMode) {
  watchBucket(sourceBucket);
} else {
  syncBucket(sourceBucket).then(success => {
    process.exit(success ? 0 : 1);
  });
}
