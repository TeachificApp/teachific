/**
 * Storage abstraction layer
 *
 * S3-compatible object storage only (AWS S3 or Cloudflare R2).
 * Manus Forge storage is not used.
 *
 * AWS S3:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET
 *   Optional: AWS_S3_PUBLIC_URL, AWS_ENDPOINT_URL
 *
 * Cloudflare R2:
 *   R2_ENDPOINT (or CF_R2_ACCOUNT_ID), R2_ACCESS_KEY_ID (or CF_R2_ACCESS_KEY_ID),
 *   R2_SECRET_ACCESS_KEY (or CF_R2_SECRET_ACCESS_KEY), R2_BUCKET_NAME (or CF_R2_BUCKET_NAME)
 *   Optional: R2_PUBLIC_URL / CF_R2_PUBLIC_URL
 */

type ObjectStorageConfig = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  publicUrl?: string;
  forcePathStyle: boolean;
};

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function getObjectStorageConfig(): ObjectStorageConfig | null {
  const accessKeyId = firstEnv("AWS_ACCESS_KEY_ID", "R2_ACCESS_KEY_ID", "CF_R2_ACCESS_KEY_ID");
  const secretAccessKey = firstEnv("AWS_SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY", "CF_R2_SECRET_ACCESS_KEY");
  const bucket = firstEnv("AWS_S3_BUCKET", "R2_BUCKET_NAME", "CF_R2_BUCKET_NAME");
  const accountId = firstEnv("CF_R2_ACCOUNT_ID", "R2_ACCOUNT_ID");
  const endpoint =
    firstEnv("AWS_ENDPOINT_URL", "R2_ENDPOINT") ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const region = firstEnv("AWS_REGION", "R2_REGION") || (endpoint ? "auto" : "");
  const publicUrl = firstEnv("AWS_S3_PUBLIC_URL", "R2_PUBLIC_URL", "CF_R2_PUBLIC_URL");

  if (!accessKeyId || !secretAccessKey || !bucket || !region) return null;
  return {
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: endpoint || undefined,
    publicUrl: publicUrl || undefined,
    forcePathStyle: Boolean(endpoint),
  };
}

function requireObjectStorage(): ObjectStorageConfig {
  const cfg = getObjectStorageConfig();
  if (!cfg) {
    throw new Error(
      "No storage backend configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET " +
        "(or R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME) on Railway."
    );
  }
  return cfg;
}

async function getS3Client() {
  const cfg = requireObjectStorage();
  const { S3Client } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: cfg.forcePathStyle } : {}),
  });
  return { client, cfg };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildPublicUrl(cfg: ObjectStorageConfig, key: string): string {
  if (cfg.publicUrl) return `${cfg.publicUrl.replace(/\/$/, "")}/${key}`;
  if (cfg.endpoint) return `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${key}`;
  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { client, cfg } = await getS3Client();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const key = normalizeKey(relKey);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: typeof data === "string" ? Buffer.from(data) : data,
      ContentType: contentType,
    })
  );
  return { key, url: buildPublicUrl(cfg, key) };
}

export async function storagePutStream(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { client, cfg } = await getS3Client();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { createReadStream, statSync } = await import("fs");
  const key = normalizeKey(relKey);
  const fileSize = statSync(filePath).size;
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      ContentLength: fileSize,
    })
  );
  return { key, url: buildPublicUrl(cfg, key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { client, cfg } = await getS3Client();
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const key = normalizeKey(relKey);
  if (cfg.publicUrl) {
    return { key, url: buildPublicUrl(cfg, key) };
  }
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), {
    expiresIn: 3600,
  });
  return { key, url };
}

/**
 * Generate a presigned PUT URL for direct browser-to-storage uploads.
 * Returns { uploadUrl, fileUrl, key } where:
 *   - uploadUrl: the URL the browser should PUT the file to
 *   - fileUrl: the public URL of the file after upload
 *   - key: the storage key
 */
export async function storagePresignedPut(
  relKey: string,
  contentType = "application/octet-stream",
  expiresIn = 3600
): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
  const { client, cfg } = await getS3Client();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const key = normalizeKey(relKey);
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }),
    { expiresIn }
  );
  return { uploadUrl, fileUrl: buildPublicUrl(cfg, key), key };
}

export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  try {
    const { client, cfg } = await getS3Client();
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
  } catch {
    // Ignore delete errors — file may already be gone
  }
}
