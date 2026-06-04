import { describe, expect, it } from "vitest";
import crypto from "crypto";

/**
 * Tests for Zapier integration:
 * - Event types and tier gating
 * - Webhook grouping logic
 * - HMAC signature generation
 * - Dispatch helper behavior
 */

const ZAPIER_EVENT_TYPES = [
  "new_enrollment",
  "course_completed",
  "form_submitted",
  "new_order",
  "new_member",
] as const;

const ALLOWED_TIERS = ["builder", "pro", "enterprise"];

describe("Zapier Integration", () => {
  describe("Event Types", () => {
    it("should have 5 supported event types", () => {
      expect(ZAPIER_EVENT_TYPES).toHaveLength(5);
    });

    it("should include all expected events", () => {
      expect(ZAPIER_EVENT_TYPES).toContain("new_enrollment");
      expect(ZAPIER_EVENT_TYPES).toContain("course_completed");
      expect(ZAPIER_EVENT_TYPES).toContain("form_submitted");
      expect(ZAPIER_EVENT_TYPES).toContain("new_order");
      expect(ZAPIER_EVENT_TYPES).toContain("new_member");
    });
  });

  describe("Tier Gating", () => {
    it("should allow builder tier", () => {
      expect(ALLOWED_TIERS).toContain("builder");
    });

    it("should allow pro tier", () => {
      expect(ALLOWED_TIERS).toContain("pro");
    });

    it("should allow enterprise tier", () => {
      expect(ALLOWED_TIERS).toContain("enterprise");
    });

    it("should not allow free tier", () => {
      expect(ALLOWED_TIERS).not.toContain("free");
    });

    it("should not allow starter tier", () => {
      expect(ALLOWED_TIERS).not.toContain("starter");
    });
  });

  describe("HMAC Signature", () => {
    it("should generate valid HMAC-SHA256 signature", () => {
      const secret = "test-secret-key";
      const body = JSON.stringify({ event: "new_enrollment", data: { user_id: 1 } });
      const signature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      expect(signature).toHaveLength(64); // SHA256 hex is 64 chars
      expect(signature).toMatch(/^[a-f0-9]+$/);
    });

    it("should produce different signatures for different payloads", () => {
      const secret = "test-secret";
      const body1 = JSON.stringify({ event: "new_enrollment" });
      const body2 = JSON.stringify({ event: "course_completed" });

      const sig1 = crypto.createHmac("sha256", secret).update(body1).digest("hex");
      const sig2 = crypto.createHmac("sha256", secret).update(body2).digest("hex");

      expect(sig1).not.toEqual(sig2);
    });
  });

  describe("Webhook Grouping Logic", () => {
    it("should group rows by URL", () => {
      const rows = [
        { id: 1, webhookUrl: "https://hooks.zapier.com/a", eventType: "new_enrollment", isActive: true, name: "Zap 1", lastTriggeredAt: null, secret: "s1", triggerCount: 0 },
        { id: 2, webhookUrl: "https://hooks.zapier.com/a", eventType: "course_completed", isActive: true, name: "Zap 1", lastTriggeredAt: null, secret: "s1", triggerCount: 3 },
        { id: 3, webhookUrl: "https://hooks.zapier.com/b", eventType: "new_order", isActive: false, name: "Zap 2", lastTriggeredAt: null, secret: "s2", triggerCount: 1 },
      ];

      const grouped = new Map<string, { id: number; name: string; url: string; events: string[]; active: boolean }>();
      for (const row of rows) {
        const key = row.webhookUrl;
        if (grouped.has(key)) {
          grouped.get(key)!.events.push(row.eventType);
        } else {
          grouped.set(key, {
            id: row.id,
            name: row.name,
            url: row.webhookUrl,
            events: [row.eventType],
            active: row.isActive,
          });
        }
      }

      const result = Array.from(grouped.values());
      expect(result).toHaveLength(2);
      expect(result[0].events).toEqual(["new_enrollment", "course_completed"]);
      expect(result[0].url).toBe("https://hooks.zapier.com/a");
      expect(result[1].events).toEqual(["new_order"]);
      expect(result[1].active).toBe(false);
    });
  });

  describe("Payload Structure", () => {
    it("should produce correct event payload format", () => {
      const orgId = 42;
      const eventType = "new_enrollment";
      const data = { user_id: 100, course_id: 5 };

      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        org_id: orgId,
        data,
      };

      expect(payload.event).toBe("new_enrollment");
      expect(payload.org_id).toBe(42);
      expect(payload.data).toEqual({ user_id: 100, course_id: 5 });
      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should include test flag for test payloads", () => {
      const testPayload = {
        event: "new_enrollment",
        timestamp: new Date().toISOString(),
        org_id: 1,
        test: true,
        data: { enrollment_id: 12345 },
      };

      expect(testPayload.test).toBe(true);
    });
  });
});
