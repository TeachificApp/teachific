import React from "react";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { subscriptionCancellationState, type CustomerSubscriptionBillingSnapshot } from "@shared/customerSubscriptionBilling";

export function SubscriptionCancellationIndicator({ subscriptionId, snapshot, accessExpiresAt }: {
  subscriptionId?: string | null;
  snapshot?: CustomerSubscriptionBillingSnapshot | null;
  accessExpiresAt?: Date | string | number | null;
}) {
  if (!subscriptionId) return null;
  const state = subscriptionCancellationState(subscriptionId, snapshot);
  const ended = state.kind === "cancelled" || state.kind === "ended";
  const access = accessExpiresAt == null ? null : new Date(accessExpiresAt);
  const valid = access && Number.isFinite(access.getTime()) ? access : null;
  const Icon = ended ? CheckCircle2 : state.kind === "unverified" ? AlertCircle : Clock;
  return <div className="mt-2 space-y-1" role="status" aria-live="polite" data-subscription-cancellation={state.kind}>
    <span className={`inline-flex items-start gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${ended
      ? "bg-red-50 text-red-800 border-red-200" : state.kind === "unverified"
        ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
      <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /><span>{state.label}</span>
    </span>
    {ended && valid && <p className="text-xs text-gray-600">{valid.getTime() > Date.now() ? "Access remains until " : "Access expired "}
      {valid.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}.</p>}
    {state.kind === "unverified" && <p className="text-xs text-amber-700">An access expiry date alone does not confirm cancellation.</p>}
  </div>;
}
