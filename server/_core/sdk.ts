import { COOKIE_NAME, IMPERSONATION_ORIGINAL_COOKIE, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  /** Set when this session is an impersonation — contains the real admin's openId */
  impersonatedBy?: string;
};

class AppSessionService {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }
    return new TextEncoder().encode(secret);
  }

  /** Create a signed app session token for a user openId. */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId || "teachific",
        name: options.name || "",
      },
      options
    );
  }

  /** Create an impersonation session token for a target user. */
  async createImpersonationToken(
    targetOpenId: string,
    targetName: string,
    adminOpenId: string,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId: targetOpenId,
        appId: ENV.appId || "teachific",
        name: targetName,
        impersonatedBy: adminOpenId,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      ...(payload.impersonatedBy ? { impersonatedBy: payload.impersonatedBy } : {}),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string; impersonatedBy?: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, impersonatedBy } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        return null;
      }

      return {
        openId,
        appId,
        name,
        impersonatedBy: typeof impersonatedBy === "string" ? impersonatedBy : undefined,
      };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User & { impersonatedBy?: string }> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie =
      cookies.get(COOKIE_NAME) || cookies.get(IMPERSONATION_ORIGINAL_COOKIE);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const signedInAt = new Date();
    const user = await db.getUserByOpenId(session.openId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    if (!session.impersonatedBy) {
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: signedInAt,
      });
    }

    return { ...user, impersonatedBy: session.impersonatedBy };
  }
}

export const sdk = new AppSessionService();
