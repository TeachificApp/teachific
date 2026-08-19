/**
 * Shared request authentication helper.
 * Supports Teachific email/password cookies and an optional legacy Manus OAuth bridge.
 * Use this instead of sdk.authenticateRequest directly for all Express route handlers.
 */
import type { Request } from "express";
import type { User } from "../drizzle/schema";
import { isManusOAuthEnabled, sdk } from "./_core/sdk";
import { getUserById } from "./db";
import { verifySessionToken } from "./_core/context";

/** Parse a single named cookie from the Cookie header */
function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Resolve a user from the custom Teachific email/password session cookie */
async function resolveTeachificSession(cookieHeader: string | undefined): Promise<User | null> {
  try {
    const raw = parseCookie(cookieHeader, "teachific_session");
    if (!raw) return null;
    const payload = verifySessionToken(raw);
    if (!payload) return null;
    const user = await getUserById(payload.userId);
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Authenticate an Express request using both auth methods:
 * 1. Teachific email/password (teachific_session cookie)
 * 2. Optional legacy Manus OAuth (app_session_id cookie) when ENABLE_MANUS_OAUTH=true
 *
 * Returns the authenticated User or null if neither method succeeds.
 */
export async function authenticateRequest(req: Request): Promise<(User & { impersonatedBy?: string }) | null> {
  const user = await resolveTeachificSession(req.headers.cookie);
  if (user) return user;

  if (isManusOAuthEnabled()) {
    try {
      return await sdk.authenticateRequest(req);
    } catch {
      // Fall through to unauthenticated.
    }
  }

  return null;
}
