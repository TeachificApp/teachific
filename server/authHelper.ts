/**
 * Shared request authentication helper.
 * Supports both Manus OAuth (app_session_id) and Teachific email/password (teachific_session) cookies.
 * Use this instead of sdk.authenticateRequest directly for all Express route handlers.
 */
import type { Request } from "express";
import type { User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
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
    for (const name of ["teachific_session", "teachific_session_lax", "teachific_session_host"]) {
      const raw = parseCookie(cookieHeader, name);
      if (!raw) continue;
      const payload = verifySessionToken(raw);
      if (!payload) continue;
      const user = await getUserById(payload.userId);
      if (user) return user;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Authenticate an Express request using both auth methods:
 * 1. Primary: Manus OAuth (app_session_id cookie)
 * 2. Fallback: Teachific email/password (teachific_session cookie)
 *
 * Returns the authenticated User or null if neither method succeeds.
 */
export async function authenticateRequest(req: Request): Promise<(User & { impersonatedBy?: string }) | null> {
  // Try Manus OAuth first
  try {
    const user = await sdk.authenticateRequest(req);
    return user;
  } catch {
    // Fall through to teachific_session
  }

  // Fallback: custom Teachific email/password session (HMAC-verified)
  const user = await resolveTeachificSession(req.headers.cookie);
  return user;
}
