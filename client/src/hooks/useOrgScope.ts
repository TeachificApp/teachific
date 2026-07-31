import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * useOrgScope — resolves the active org for the current user.
 *
 * Platform admins (site_owner / site_admin):
 *   - Fetches ALL orgs via platformAdmin.listOrgs
 *   - Auto-selects the org with isPrimary = true (platform school org)
 *   - Falls back to allOrgs[0] if no primary org is found
 *   - showOrgSelector is false (selector removed per design)
 *
 * Regular users (org_admin / user):
 *   - Fetches their own orgs via orgs.myOrgs
 *   - Auto-selects the first one
 *   - showOrgSelector is false
 */
export function useOrgScope() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "site_owner" || user?.role === "site_admin";
  const [selectedOrgId, setSelectedOrgIdState] = useState<number | null>(null);

  const setActiveOrg = trpc.orgs.setActiveOrg.useMutation();
  const utils = trpc.useUtils();

  // Platform admins: use platformAdmin.listOrgs
  const { data: allOrgs } = trpc.platformAdmin.listOrgs.useQuery(undefined, {
    enabled: !!user && isPlatformAdmin,
  });

  // Org admins: only orgs where user has admin-level role
  const { data: myAdminOrgs } = trpc.orgs.myAdminOrgs.useQuery(undefined, {
    enabled: !!user && !isPlatformAdmin,
  });

  // All orgs (for regular member fallback)
  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery(undefined, {
    enabled: !!user && !isPlatformAdmin,
  });

  // Active org preference from server
  const { data: activeOrgPref } = trpc.orgs.getActiveOrg.useQuery(undefined, {
    enabled: !!user,
  });

  const isOrgAdmin = isPlatformAdmin || (myAdminOrgs && myAdminOrgs.length > 0);

  // Auto-select for platform admins
  useEffect(() => {
    if (!isPlatformAdmin || !allOrgs || allOrgs.length === 0) return;
    if (selectedOrgId !== null) return;
    if (activeOrgPref?.orgId) {
      const saved = allOrgs.find((o: any) => o.id === activeOrgPref.orgId);
      if (saved) { setSelectedOrgIdState(saved.id); return; }
    }
    const primary = allOrgs.find((o: any) => o.isPrimary);
    setSelectedOrgIdState(primary ? primary.id : allOrgs[0].id);
  }, [isPlatformAdmin, allOrgs, selectedOrgId, activeOrgPref]);

  // Auto-select for org admins
  useEffect(() => {
    if (isPlatformAdmin || !myAdminOrgs || myAdminOrgs.length === 0) return;
    if (selectedOrgId !== null) return;
    if (activeOrgPref?.orgId) {
      const saved = myAdminOrgs.find((o: any) => o.id === activeOrgPref.orgId);
      if (saved) { setSelectedOrgIdState(saved.id); return; }
    }
    setSelectedOrgIdState(myAdminOrgs[0].id);
  }, [isPlatformAdmin, myAdminOrgs, selectedOrgId, activeOrgPref]);

  // Fallback for regular members
  useEffect(() => {
    if (isPlatformAdmin) return;
    if (myAdminOrgs && myAdminOrgs.length > 0) return;
    if (!myOrgs || myOrgs.length === 0) return;
    if (selectedOrgId !== null) return;
    setSelectedOrgIdState(myOrgs[0].id);
  }, [isPlatformAdmin, myAdminOrgs, myOrgs, selectedOrgId]);

  const setSelectedOrgId = async (orgId: number) => {
    setSelectedOrgIdState(orgId);
    if (isOrgAdmin) {
      try {
        await setActiveOrg.mutateAsync({ orgId });
        utils.orgs.getActiveOrg.invalidate();
      } catch { /* non-critical */ }
    }
  };

  const orgId: number | null = selectedOrgId;
  const adminOrgs = isPlatformAdmin ? (allOrgs ?? []) : (myAdminOrgs ?? []);

  return {
    showOrgSelector: false,
    orgId,
    orgs: isPlatformAdmin ? (allOrgs ?? []) : (myOrgs ?? []),
    adminOrgs,
    isOrgAdmin: !!isOrgAdmin,
    setSelectedOrgId,
    ready: orgId !== null,
  };
}
