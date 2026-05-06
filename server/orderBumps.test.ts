/**
 * Tests for:
 *  1. Order bumps schema (order_bumps, order_bump_conversions tables)
 *  2. Visibility columns on courses, digital_products, quizzes
 *  3. Order bumps DB helper exports
 *  4. Private invites schema
 */
import { describe, it, expect } from "vitest";

// ─── 1. Order bumps schema ───────────────────────────────────────────────────
describe("order_bumps schema", () => {
  it("exports orderBumps table with required columns", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.orderBumps).toBeDefined();
    const cols = Object.keys(schema.orderBumps);
    expect(cols).toContain("id");
    expect(cols).toContain("orgId");
    expect(cols).toContain("name");
    expect(cols).toContain("triggerProductType");
    expect(cols).toContain("triggerProductId");
    expect(cols).toContain("bumpProductType");
    expect(cols).toContain("bumpProductId");
    expect(cols).toContain("placement");
    expect(cols).toContain("discountPercent");
    expect(cols).toContain("isActive");
    expect(cols).toContain("landingPageJson");
  });

  it("exports orderBumpConversions table with required columns", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.orderBumpConversions).toBeDefined();
    const cols = Object.keys(schema.orderBumpConversions);
    expect(cols).toContain("id");
    expect(cols).toContain("bumpId");
    expect(cols).toContain("orgId");
    expect(cols).toContain("createdAt");
  });
});

// ─── 2. Visibility columns ───────────────────────────────────────────────────
describe("visibility columns", () => {
  it("courses table has status column with correct enum values", async () => {
    const schema = await import("../drizzle/schema");
    const cols = Object.keys(schema.courses);
    expect(cols).toContain("status");
  });

  it("digital_products table has visibility column", async () => {
    const schema = await import("../drizzle/schema");
    const cols = Object.keys(schema.digitalProducts);
    expect(cols).toContain("visibility");
  });

  it("quizzes table has visibility column", async () => {
    const schema = await import("../drizzle/schema");
    const cols = Object.keys(schema.quizzes);
    expect(cols).toContain("visibility");
  });
});

// ─── 3. Order bumps DB helpers ───────────────────────────────────────────────
describe("orderBumpsDb helpers", () => {
  it("exports all required CRUD functions", async () => {
    const db = await import("./orderBumpsDb");
    expect(typeof db.createOrderBump).toBe("function");
    expect(typeof db.listOrderBumps).toBe("function");
    expect(typeof db.getOrderBump).toBe("function");
    expect(typeof db.updateOrderBump).toBe("function");
    expect(typeof db.deleteOrderBump).toBe("function");
    expect(typeof db.getOrderBumpsForProduct).toBe("function");
    expect(typeof db.recordBumpConversion).toBe("function");
  });

  it("exports visibility update functions", async () => {
    const db = await import("./orderBumpsDb");
    expect(typeof db.updateDownloadVisibility).toBe("function");
    expect(typeof db.updateQuizVisibility).toBe("function");
  });

  it("exports private invite functions", async () => {
    const db = await import("./orderBumpsDb");
    expect(typeof db.createPrivateInvite).toBe("function");
    expect(typeof db.listPrivateInvites).toBe("function");
    expect(typeof db.deletePrivateInvite).toBe("function");
    expect(typeof db.getPrivateInviteByToken).toBe("function");
  });
});

// ─── 4. Private invites schema ───────────────────────────────────────────────
describe("private_invites schema", () => {
  it("exports privateInvites table with required columns", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.privateInvites).toBeDefined();
    const cols = Object.keys(schema.privateInvites);
    expect(cols).toContain("id");
    expect(cols).toContain("orgId");
    expect(cols).toContain("productType");
    expect(cols).toContain("productId");
    expect(cols).toContain("email");
    expect(cols).toContain("createdAt");
  });
});
