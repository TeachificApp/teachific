import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type PaidSchoolClaim = { claimId: string; orgId: number; createdAt: Date };
type Identity = { userId: number | null; generation: number };
type ClaimsView = {
  identity: Identity;
  status: "loading" | "error" | "ready";
  claims: PaidSchoolClaim[];
};
type ClaimAction = { identity: Identity; claimId: string; status: "pending" | "error" | "success" | "stale" };

const recoveryInstruction = "Sign in normally with the account used at checkout and verify your email, then retry.";
const controlClass = "rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 c360-focus-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Owner consent only: the server verifies identity, email and the exact separate school. */
export default function Course360PaidSchoolClaims() {
  const { user, loading: authLoading, isAuthenticated, error: authError } = useAuth();
  const userId = !authLoading && !authError && isAuthenticated && user ? user.id : null;
  const identityRef = useRef<Identity>({ userId, generation: 0 });
  // Invalidate old event handlers/results immediately, before the identity-change effect runs.
  if (identityRef.current.userId !== userId) {
    identityRef.current = { userId, generation: identityRef.current.generation + 1 };
  }
  const identity = identityRef.current;
  const mounted = useRef(false);
  const loadSequence = useRef(0);
  const lock = useRef<ClaimAction | null>(null);
  const [view, setView] = useState<ClaimsView | null>(null);
  const viewRef = useRef<ClaimsView | null>(null);
  const [action, setAction] = useState<ClaimAction | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [consent, setConsent] = useState<{ identity: Identity; claimIds: Set<string> }>({ identity, claimIds: new Set() });

  // Hooks are unconditional. A guest never enables this protected query or calls refetch.
  const claimsQuery = trpc.billing.listPaidSchoolClaims.useQuery(undefined, {
    enabled: userId !== null,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
  });
  const claimMutation = trpc.billing.claimPaidSchool.useMutation();
  const utils = trpc.useUtils();
  const queryRef = useRef(claimsQuery);
  const utilsRef = useRef(utils);
  queryRef.current = claimsQuery;
  utilsRef.current = utils;

  const isCurrent = (owner: Identity) => mounted.current && identityRef.current === owner && owner.userId !== null;
  const publishView = (next: ClaimsView) => {
    viewRef.current = next;
    setView(next);
  };

  async function loadClaims(owner: Identity) {
    if (!isCurrent(owner)) return;
    const sequence = ++loadSequence.current;
    publishView({ identity: owner, status: "loading", claims: [] });
    setConsent({ identity: owner, claimIds: new Set() });
    try {
      // No-input tRPC cache is shared across sessions. Cancel in-flight old work and
      // accept only this explicit fresh fetch, never cached query.data at mount/login.
      await utilsRef.current.billing.listPaidSchoolClaims.cancel();
      if (!isCurrent(owner) || sequence !== loadSequence.current) return;
      const result = await queryRef.current.refetch({ cancelRefetch: true });
      if (!isCurrent(owner) || sequence !== loadSequence.current) return;
      if (result.error || !result.data) {
        publishView({ identity: owner, status: "error", claims: [] });
        return;
      }
      publishView({ identity: owner, status: "ready", claims: result.data });
    } catch {
      if (isCurrent(owner) && sequence === loadSequence.current) {
        publishView({ identity: owner, status: "error", claims: [] });
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (identity.userId !== null) void loadClaims(identity);
    return () => {
      mounted.current = false;
      ++loadSequence.current;
      // Cancellation is safe locally; do not modify identity, cookies or active org.
      void utilsRef.current.billing.listPaidSchoolClaims.cancel().catch(() => {});
    };
  }, [identity]);

  const currentView = view?.identity === identity ? view : null;
  const currentAction = action?.identity === identity ? action : null;
  const acknowledged = consent.identity === identity ? consent.claimIds : new Set<string>();
  const busy = requestPending || claimMutation.isPending || lock.current !== null;

  async function claimAccess(listedClaim: PaidSchoolClaim, owner: Identity) {
    const latest = viewRef.current;
    if (!isCurrent(owner) || lock.current || claimMutation.isPending ||
        consent.identity !== owner || !consent.claimIds.has(listedClaim.claimId) ||
        latest?.identity !== owner || latest.status !== "ready" ||
        !latest.claims.some(item => item.claimId === listedClaim.claimId && item.orgId === listedClaim.orgId)) return;

    const pending: ClaimAction = { identity: owner, claimId: listedClaim.claimId, status: "pending" };
    lock.current = pending; // Synchronous lock also prevents clicks before React renders pending state.
    setRequestPending(true);
    setAction(pending);
    setConsent({ identity: owner, claimIds: new Set() });
    try {
      const result = await claimMutation.mutateAsync({ claimId: listedClaim.claimId });
      if (!isCurrent(owner)) return;
      const latestClaims = viewRef.current;
      if (result.orgId !== listedClaim.orgId || latestClaims?.identity !== owner ||
          latestClaims.status !== "ready" || !latestClaims.claims.some(item =>
            item.claimId === listedClaim.claimId && item.orgId === listedClaim.orgId)) {
        setAction({ ...pending, status: "stale" });
        await loadClaims(owner);
        return;
      }
      setAction({ ...pending, status: "success" });
      // Refresh membership lists only, never active-org/auth/subscription/role state.
      await Promise.allSettled([
        utilsRef.current.billing.listPaidSchoolClaims.invalidate(undefined, { refetchType: "none" }),
        utilsRef.current.orgs.myOrgs.invalidate(undefined, { refetchType: "none" }),
        utilsRef.current.orgs.myAdminOrgs.invalidate(undefined, { refetchType: "none" }),
      ]);
      if (isCurrent(owner)) await loadClaims(owner);
    } catch {
      if (isCurrent(owner)) setAction({ ...pending, status: "error" });
    } finally {
      if (lock.current === pending) {
        lock.current = null;
        if (mounted.current) setRequestPending(false);
      }
    }
  }

  return (
    <section aria-label="Claim separate paid schools" className="c360-setup-claims space-y-3 rounded-xl border c360-aqua-border c360-soft-subtle p-4 text-left">
      <h2 className="text-sm font-semibold text-slate-900">Claim separate paid schools</h2>
      <p className="text-sm leading-relaxed text-slate-600">Only pending claims listed by the server for your signed-in account appear here. Claiming access does not merge schools, switch your active school, or confirm app subscription entitlements.</p>
      {authLoading ? <p role="status" className="text-sm text-slate-600">Checking your sign-in status…</p> : userId === null ? (
        <p className="text-sm text-slate-600">Sign in normally to check for pending school claims. Your email must be verified before the server can grant school access.</p>
      ) : (
        <>
          {!user?.emailVerified && <p className="text-sm text-slate-700">Verify your email before claiming access. {recoveryInstruction}</p>}
          {currentAction?.status === "success" && (
            <div role="status" className="space-y-2 text-sm c360-text">
              <p>Access claimed. Use your dashboard school switcher to select it.</p>
              <Link href="/lms" className="font-semibold underline focus-visible:outline-none focus-visible:ring-2 c360-focus-ring">Go to your dashboard</Link>
            </div>
          )}
          {currentAction?.status === "error" && <p role="alert" className="text-sm text-red-800">Unable to claim access. {recoveryInstruction} Acknowledge the separate school again before retrying.</p>}
          {currentAction?.status === "stale" && <p role="alert" className="text-sm text-slate-700">The claim list changed or the response did not match this school. Refresh and review the current list before trying again.</p>}
          {!currentView || currentView.status === "loading" ? (
            <p role="status" className="text-sm text-slate-600">Loading pending school claims…</p>
          ) : currentView.status === "error" ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-red-800">We couldn't load pending school claims. {recoveryInstruction}</p>
              <button type="button" className={`${controlClass} border c360-border c360-text`} onClick={() => void loadClaims(identity)}>Retry loading claims</button>
            </div>
          ) : (
            <>
              {currentView.claims.length === 0 ? (
                <p className="text-sm text-slate-600">No pending paid-school claims are listed for this account. Verified checkout may still be processing; this does not confirm payment or existing school access.</p>
              ) : (
                <ul className="space-y-3">
                  {currentView.claims.map(item => {
                    const claimed = currentAction?.claimId === item.claimId && currentAction.status === "success";
                    const pending = currentAction?.claimId === item.claimId && currentAction.status === "pending";
                    return (
                      <li key={item.claimId} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                        <h3 className="text-sm font-semibold text-slate-900">Paid school #{item.orgId}</h3>
                        <p className="text-sm text-slate-600">Created <time dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleDateString()}</time></p>
                        <label className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                          <input type="checkbox" className="mt-1 c360-accent" checked={acknowledged.has(item.claimId)} disabled={busy || claimed} onChange={event => {
                            if (!isCurrent(identity)) return;
                            const next = new Set(acknowledged);
                            if (event.target.checked) next.add(item.claimId); else next.delete(item.claimId);
                            setConsent({ identity, claimIds: next });
                          }} />
                          I acknowledge that paid school #{item.orgId} remains separate and claiming access will not switch my active school.
                        </label>
                        <button type="button" className={`${controlClass} w-full c360-action text-white c360-hover-action`} disabled={busy || claimed || !acknowledged.has(item.claimId)} onClick={() => void claimAccess(item, identity)}>
                          {pending ? "Claiming access…" : "Claim access to this separate school"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button type="button" className={`${controlClass} border c360-border c360-text`} onClick={() => void loadClaims(identity)}>Refresh claim list</button>
            </>
          )}
        </>
      )}
      <Link href="/login?returnTo=/account-setup" className="inline-block text-sm font-semibold c360-text underline focus-visible:outline-none focus-visible:ring-2 c360-focus-ring">Sign in and return to school claims</Link>
    </section>
  );
}
