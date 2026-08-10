/**
 * googleDriveCme.ts
 * Google Drive integration for saving CME Activity Planning PDFs to an org's Google Drive folder.
 * Credentials are stored per-org in the organizations table (cmeDrive* columns).
 * Each org has its own Google Drive credentials — no cross-org sharing.
 */
import { getDb } from "../db";
import { organizations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) throw new Error("Token refresh failed: " + await res.text());
  return res.json() as any;
}

async function getValidToken(org: any, orgId: number): Promise<string> {
  const now = Date.now();
  if (
    org.cmeDriveAccessToken &&
    org.cmeDriveTokenExpiresAt &&
    org.cmeDriveTokenExpiresAt - 300_000 > now
  ) {
    return org.cmeDriveAccessToken;
  }
  if (!org.cmeDriveRefreshToken) {
    throw new Error("No refresh token — org admin must reconnect Google Drive in CME Settings");
  }
  const tokens = await refreshAccessToken(
    org.cmeDriveClientId!,
    org.cmeDriveClientSecret!,
    org.cmeDriveRefreshToken,
  );
  const db = await getDb();
  if (db) {
    await db.update(organizations).set({
      cmeDriveAccessToken: tokens.access_token,
      cmeDriveTokenExpiresAt: now + tokens.expires_in * 1000,
    } as any).where(eq(organizations.id, orgId));
  }
  return tokens.access_token;
}

/**
 * Upload a PDF buffer to the org's configured Google Drive CME folder.
 * Returns the Drive file ID and web view link, or null if Drive is not configured.
 */
export async function uploadCmePdfToDrive(
  orgId: number,
  pdfBuffer: Buffer,
  fileName: string,
): Promise<{ fileId: string; webViewLink: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org?.cmeDriveEnabled || !org.cmeDriveClientId || !org.cmeDriveRefreshToken) {
    return null; // Drive not configured or disabled for this org
  }
  const accessToken = await getValidToken(org, orgId);
  const folderId = org.cmeDriveFolderId ?? undefined;

  // Multipart upload: metadata + PDF bytes
  const metadata = {
    name: fileName,
    mimeType: "application/pdf",
    ...(folderId ? { parents: [folderId] } : {}),
  };
  const boundary = "cme_pdf_boundary_" + Date.now();
  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n`;
  const filePart =
    `--${boundary}\r\n` +
    `Content-Type: application/pdf\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(metaPart, "utf8"),
    Buffer.from(filePart, "utf8"),
    pdfBuffer,
    Buffer.from(closing, "utf8"),
  ]);

  const uploadRes = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    },
  );
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Drive upload failed: ${err}`);
  }
  const data: any = await uploadRes.json();
  return { fileId: data.id, webViewLink: data.webViewLink ?? "" };
}

/**
 * List files in the org's configured CME Drive folder (for admin preview).
 */
export async function listCmeDriveFiles(
  orgId: number,
): Promise<Array<{ id: string; name: string; webViewLink: string; createdTime: string }>> {
  const db = await getDb();
  if (!db) return [];
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org?.cmeDriveEnabled || !org.cmeDriveClientId || !org.cmeDriveRefreshToken) {
    return [];
  }
  const accessToken = await getValidToken(org, orgId);
  const folderId = org.cmeDriveFolderId;
  const q = folderId
    ? `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`
    : `mimeType='application/pdf' and trashed=false`;
  const res = await fetch(
    `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink,createdTime)&orderBy=createdTime desc&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return [];
  const data: any = await res.json();
  return data.files ?? [];
}

/**
 * Exchange an authorization code for tokens and store them in the org's record.
 * Called from the OAuth callback after the user authorizes Google Drive access.
 */
export async function exchangeCodeForTokens(
  orgId: number,
  code: string,
  redirectUri: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org?.cmeDriveClientId || !org.cmeDriveClientSecret) {
    throw new Error("Google Drive credentials not configured for this org");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: org.cmeDriveClientId,
      client_secret: org.cmeDriveClientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) throw new Error("Token exchange failed: " + await res.text());
  const tokens: any = await res.json();
  await db.update(organizations).set({
    cmeDriveAccessToken: tokens.access_token,
    cmeDriveRefreshToken: tokens.refresh_token ?? org.cmeDriveRefreshToken,
    cmeDriveTokenExpiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    cmeDriveEnabled: true,
  } as any).where(eq(organizations.id, orgId));
}
