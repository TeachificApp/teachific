import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const getDb = vi.hoisted(() => vi.fn());
const getOrgIdForUserWithFallback = vi.hoisted(() => vi.fn());
const requireOrgAdmin = vi.hoisted(() => vi.fn());
const invokeLLM = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ getDb, getOrgIdForUserWithFallback, requireOrgAdmin }));
vi.mock("./_core/llm", () => ({ invokeLLM }));

import { socialContentRouter } from "./routers/socialContentRouter";

function organizationDb(name = "Northwind Learning") {
  const chain = {
    from() { return chain; },
    where() { return chain; },
    limit() { return Promise.resolve([{ id: 7, name }]); },
  };
  return { select: vi.fn(() => chain) };
}

const organizationAdmin = { id: 101, email: "admin@example.test", role: "org_admin" };

describe("Course360 organization-scoped social generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrgIdForUserWithFallback.mockResolvedValue(7);
    requireOrgAdmin.mockResolvedValue(7);
    getDb.mockResolvedValue(organizationDb());
    invokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        headline: "Build a stronger learning community",
        body: "Share a useful teaching insight with your audience.",
        subtext: "Adapt this draft to your organization voice.",
        socialCaption: "A ready-to-edit Course360 social draft for your community.",
      }) } }],
    });
  });

  it("rejects generation when no server-resolved active organization exists", async () => {
    getOrgIdForUserWithFallback.mockResolvedValue(null);
    const caller = socialContentRouter.createCaller({ user: organizationAdmin } as any);

    await expect(caller.generateContent({
      contentType: "creator_tip",
      category: "Creator Tips",
    })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Select an active organization before generating social content.",
    });
    expect(requireOrgAdmin).not.toHaveBeenCalled();
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("requires organization-admin authorization before calling the model", async () => {
    requireOrgAdmin.mockRejectedValue(new TRPCError({ code: "FORBIDDEN", message: "Organization admin access required" }));
    const caller = socialContentRouter.createCaller({ user: { ...organizationAdmin, role: "user" } } as any);

    await expect(caller.getOptions()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("returns drafts only under the server-resolved organization, ignoring caller org hints", async () => {
    const caller = socialContentRouter.createCaller({ user: organizationAdmin } as any);
    const result = await caller.generateContent({
      contentType: "educational_insight",
      category: "Learning & Development",
      customTopic: "Explain how a course creator can welcome new learners.",
      count: 1,
      orgId: 999,
    } as any);

    expect(getOrgIdForUserWithFallback).toHaveBeenCalledWith(101, "org_admin");
    expect(requireOrgAdmin).toHaveBeenCalledWith(101, "org_admin", 7);
    expect(result.items).toEqual([expect.objectContaining({
      organizationId: 7,
      organizationName: "Northwind Learning",
      contentType: "educational_insight",
      category: "Learning & Development",
    })]);
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      outputSchema: expect.objectContaining({ name: "course360_social_content", strict: true }),
      messages: expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining("Northwind Learning") }),
      ]),
    }));
    expect(JSON.stringify(invokeLLM.mock.calls)).not.toContain("orgId");
  });

  it("keeps the social generator and default LLM free of prohibited read-aloud and source branding", async () => {
    const { readFileSync } = await import("node:fs");
    const socialSource = readFileSync(new URL("./routers/socialContentRouter.ts", import.meta.url), "utf8");
    const llmSource = readFileSync(new URL("./_core/llm.ts", import.meta.url), "utf8");

    expect(socialSource).toContain("getOrgIdForUserWithFallback");
    expect(socialSource).toContain("requireOrgAdmin");
    expect(socialSource).not.toMatch(/read[ -]?aloud|text[ -]?to[ -]?speech|speechSynthesis|All About Ultrasound|iHeartEcho|UltrasoundAssist/i);
    expect(llmSource).toContain('model: "gemini-3-flash-preview"');
    expect(llmSource).not.toContain('model: "gemini-2.5-flash"');
    expect(llmSource).toContain("max_tokens: maxTokens ?? max_tokens ?? 32768");
  });
});
