import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { CreatorExchangeDraft } from "../shared/course360CreatorExchangeDraft";
const tickets = new Map<string, { digest: string; userId: number; orgId: number; expires: number; claimed: boolean }>();
const digest = (draft: CreatorExchangeDraft) => createHash("sha256").update(JSON.stringify(draft)).digest("hex");
function prune() { const now = Date.now(); for (const [key, ticket] of tickets) if (ticket.expires <= now) tickets.delete(key); }
/** Process-local safe review lifecycle: restart/another instance fails closed and asks for re-preview. */
export function issueCreatorExchangeReviewTicket(draft: CreatorExchangeDraft, userId: number, orgId: number) {
  prune();
  if (tickets.size >= 1000) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Draft review capacity is busy. Try previewing again shortly." });
  const token = randomUUID(); tickets.set(token, { digest: digest(draft), userId, orgId, expires: Date.now() + 15 * 60 * 1000, claimed: false }); return token;
}
export function claimCreatorExchangeReviewTicket(token: string, draft: CreatorExchangeDraft, userId: number, orgId: number) {
  prune(); const ticket = tickets.get(token);
  if (!ticket || ticket.userId !== userId || ticket.orgId !== orgId || ticket.digest !== digest(draft) || ticket.claimed) throw new TRPCError({ code: "CONFLICT", message: "Preview this exact edited draft again before applying. Reviews expire after 15 minutes or server restart; an already-applied review cannot be reused." });
  ticket.claimed = true;
  return { complete: () => tickets.delete(token), retry: () => { if (tickets.get(token) === ticket) ticket.claimed = false; } };
}
