/**
 * Storage abstraction layer
 *
 * Supports AWS S3 or Cloudflare R2 (Railway / self-hosted deployments)
 *    Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET
 *    R2 aliases: CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY, CF_R2_BUCKET_NAME, CF_R2_ACCOUNT_ID
 *    Optional: AWS_S3_PUBLIC_URL  (CDN/CloudFront prefix, e.g. https://cdn.example.com)
 */

// ─── Backend detection ────────────────────────────────────────────────────────

function isAwsConfigured(): boolean {
  return Boolean(getAccessKeyId() && getSecretAccessKey() && getStorageBucket());
}

function getAccessKeyId(): string {
  return process.env.AWS_ACCESS_KEY_ID || process.env.CF_R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY || "";
}

function getSecretAccessKey(): string {
  return process.env.AWS_SECRET_ACCESS_KEY || process.env.CF_R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_KEY || "";
}

function getStorageBucket(): string {
  return process.env.AWS_S3_BUCKET || process.env.CF_R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET || "";
}

function getStorageRegion(): string {
  return process.env.AWS_REGION || "auto";
}

function getStorageEndpoint(): string | undefined {
  if (process.env.AWS_S3_ENDPOINT) return process.env.AWS_S3_ENDPOINT;
  if (process.env.CF_R2_ENDPOINT) return process.env.CF_R2_ENDPOINT;
  if (process.env.CLOUDFLARE_R2_ENDPOINT) return process.env.CLOUDFLARE_R2_ENDPOINT;
  if (process.env.CF_R2_ACCOUNT_ID) return `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return undefined;
}

function getStoragePublicUrl(): string | undefined {
  return process.env.AWS_S3_PUBLIC_URL || process.env.CF_R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || undefined;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

// ─── AWS S3 Backend ───────────────────────────────────────────────────────────

function buildS3PublicUrl(key: string): string {
  const bucket = getStorageBucket();
  const region = getStorageRegion();
  const publicUrl = getStoragePublicUrl();
  return publicUrl
    ? `${publicUrl.replace(/\/$/, "")}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: getStorageRegion(),
    endpoint: getStorageEndpoint(),
    forcePathStyle: Boolean(getStorageEndpoint()),
    credentials: {
      accessKeyId: getAccessKeyId(),
      secretAccessKey: getSecretAccessKey(),
    },
  });
  const key = normalizeKey(relKey);
  await client.send(
    new PutObjectCommand({
      Bucket: getStorageBucket(),
      Key: key,
      Body: typeof data === "string" ? Buffer.from(data) : data,
      ContentType: contentType,
    })
  );
  return { key, url: buildS3PublicUrl(key) };
}

async function s3PutStream(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { createReadStream, statSync } = await import("fs");
  const client = new S3Client({
    region: getStorageRegion(),
    endpoint: getStorageEndpoint(),
    forcePathStyle: Boolean(getStorageEndpoint()),
    credentials: {
      accessKeyId: getAccessKeyId(),
      secretAccessKey: getSecretAccessKey(),
    },
  });
  const key = normalizeKey(relKey);
  const fileSize = statSync(filePath).size;
  await client.send(
    new PutObjectCommand({
      Bucket: getStorageBucket(),
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      ContentLength: fileSize,
    })
  );
  return { key, url: buildS3PublicUrl(key) };
}

async function s3Get(relKey: string): Promise<{ key: string; url: string }> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = new S3Client({
    region: getStorageRegion(),
    endpoint: getStorageEndpoint(),
    forcePathStyle: Boolean(getStorageEndpoint()),
    credentials: {
      accessKeyId: getAccessKeyId(),
      secretAccessKey: getSecretAccessKey(),
    },
  });
  const key = normalizeKey(relKey);
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getStorageBucket(), Key: key }),
    { expiresIn: 3600 }
  );
  return { key, url };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (isAwsConfigured()) return s3Put(relKey, data, contentType);
  throw new Error("No storage backend configured. Set AWS/R2 storage variables for Railway.");
}

export async function storagePutStream(
  relKey: string,
  filePath: string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (isAwsConfigured()) return s3PutStream(relKey, filePath, contentType);
  throw new Error("No storage backend configured. Set AWS/R2 storage variables for Railway.");
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  if (isAwsConfigured()) {
    return s3Get(relKey);
  }
  throw new Error("No storage backend configured. Set AWS/R2 storage variables for Railway.");
}

/**
 * Generate a presigned PUT URL for direct browser-to-storage uploads.
 * Returns { uploadUrl, fileUrl, key } where:
 *   - uploadUrl: the URL the browser should PUT the file to (presigned S3 URL or server proxy)
 *   - fileUrl: the public URL of the file after upload
 *   - key: the storage key
 */
export async function storagePresignedPut(
  relKey: string,
  contentType = "application/octet-stream",
  expiresIn = 3600
): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
  const key = normalizeKey(relKey);
  if (isAwsConfigured()) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = new S3Client({
      region: getStorageRegion(),
      endpoint: getStorageEndpoint(),
      forcePathStyle: Boolean(getStorageEndpoint()),
      credentials: {
        accessKeyId: getAccessKeyId(),
        secretAccessKey: getSecretAccessKey(),
      },
    });
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: getStorageBucket(), Key: key, ContentType: contentType }),
      { expiresIn }
    );
    return { uploadUrl, fileUrl: buildS3PublicUrl(key), key };
  }
  throw new Error("No storage backend configured. Set AWS/R2 storage variables for Railway.");
}

export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);
  try {
    if (isAwsConfigured()) {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: getStorageRegion(),
        endpoint: getStorageEndpoint(),
        forcePathStyle: Boolean(getStorageEndpoint()),
        credentials: {
          accessKeyId: getAccessKeyId(),
          secretAccessKey: getSecretAccessKey(),
        },
      });
      await client.send(new DeleteObjectCommand({ Bucket: getStorageBucket(), Key: key }));
      return;
    }
  } catch {
    // Ignore delete errors — file may already be gone
  }
}
