import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSubdomain } from "@/hooks/useSubdomain";

/**
 * useOrgScope — resolves the active org for the current user.
 *
 * Subdomain override (highest priority):
 *   - If on an org subdomain (e.g. myorg.teachific.app), auto-select that org
 *     by matching the slug, ignoring any saved activeOrgPref.
 *
 * Platform admins (site_owner / site_admin):
 *   - Fetches ALL orgs via platformAdmin.listOrgs
 *   - Also fetches accepted org links and merges linked orgs into the list
 *   - Auto-selects the org with isPrimary = true (platform school org)
 *
 * Regular users (org_admin / user):
 *   - Fetches their own orgs via orgs.myOrgs
 *   - Also fetches accepted org links and merges linked orgs into the list
 *   - Auto-selects the first one
 */
export function useOrgScope() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "site_owner" || user?.role === "site_admin";
  const [selectedOrgId, setSelectedOrgIdState] = useState<number | null>(null);
  const setActiveOrg = trpc.orgs.setActiveOrg.useMutation();
  const utils = trpc.useUtils();

  // Detect subdomain slug (e.g. "sona-medical-solutions" from sona-medical-solutions.teachific.app)
  const subdomainSlug = getSubdomain();

  // Look up org by subdomain slug (only when on a subdomain)
  const { data: subdomainOrg } = trpc.orgs.getBySlug.useQuery(
    { slug: subdomainSlug! },
    { enabled: !!user && !!subdomainSlug }
  );

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

  // Active org preference from server (ignored when on a subdomain)
  const { data: activeOrgPref } = trpc.orgs.getActiveOrg.useQuery(undefined, {
    enabled: !!user && !subdomainSlug,
  });

  // Linked orgs for the currently selected org (accepted links only)
  const { data: linkedOrgsData } = trpc.orgs.link.list.useQuery(
    { orgId: selectedOrgId! },
    {
      enabled: !!selectedOrgId && (isPlatformAdmin || !!(myAdminOrgs && myAdminOrgs.length > 0)),
    }
  );

  const isOrgAdmin = isPlatformAdmin || (myAdminOrgs && myAdminOrgs.length > 0);

  // Base admin orgs (without linked)
  const baseAdminOrgs = useMemo(
    () => (isPlatformAdmin ? (allOrgs ?? []) : (myAdminOrgs ?? [])) as any[],
    [isPlatformAdmin, allOrgs, myAdminOrgs]
  );

  // Merge linked orgs into adminOrgs (deduplicated by id)
  const adminOrgs = useMemo(() => {
    if (!linkedOrgsData || linkedOrgsData.length === 0) return baseAdminOrgs;
    const existingIds = new Set(baseAdminOrgs.map((o: any) => o.id));
    const extras = linkedOrgsData
      .map((l: any) => ({ ...l.linkedOrg, isLinked: true }))
      .filter((o: any) => o && !existingIds.has(o.id));
    return [...baseAdminOrgs, ...extras];
  }, [baseAdminOrgs, linkedOrgsData]);

  // Subdomain override: always select the org matching the current subdomain slug
  useEffect(() => {
    if (!subdomainOrg || !subdomainSlug) return;
    if (selectedOrgId === subdomainOrg.id) return;
    setSelectedOrgIdState(subdomainOrg.id);
  }, [subdomainOrg, subdomainSlug, selectedOrgId]);

  // Auto-select for platform admins (skipped when subdomain override is active)
  useEffect(() => {
    if (subdomainSlug) return; // subdomain takes priority
    if (!isPlatformAdmin || !allOrgs || allOrgs.length === 0) return;
    if (selectedOrgId !== null) return;
    if (activeOrgPref?.orgId) {
      const saved = adminOrgs.find((o: any) => o.id === activeOrgPref.orgId);
      if (saved) { setSelectedOrgIdState(saved.id); return; }
    }
    const primary = (allOrgs as any[]).find((o: any) => o.isPrimary);
    setSelectedOrgIdState(primary ? primary.id : (allOrgs as any[])[0].id);
  }, [isPlatformAdmin, allOrgs, selectedOrgId, activeOrgPref, adminOrgs, subdomainSlug]);

  // Auto-select for org admins (skipped when subdomain override is active)
  useEffect(() => {
    if (subdomainSlug) return; // subdomain takes priority
    if (isPlatformAdmin || !myAdminOrgs || myAdminOrgs.length === 0) return;
    if (selectedOrgId !== null) return;
    if (activeOrgPref?.orgId) {
      const saved = adminOrgs.find((o: any) => o.id === activeOrgPref.orgId);
      if (saved) { setSelectedOrgIdState(saved.id); return; }
    }
    setSelectedOrgIdState((myAdminOrgs as any[])[0].id);
  }, [isPlatformAdmin, myAdminOrgs, selectedOrgId, activeOrgPref, adminOrgs, subdomainSlug]);

  // Fallback for regular members (skipped when subdomain override is active)
  useEffect(() => {
    if (subdomainSlug) return; // subdomain takes priority
    if (isPlatformAdmin) return;
    if (myAdminOrgs && myAdminOrgs.length > 0) return;
    if (!myOrgs || myOrgs.length === 0) return;
    if (selectedOrgId !== null) return;
    setSelectedOrgIdState((myOrgs as any[])[0].id);
  }, [isPlatformAdmin, myAdminOrgs, myOrgs, selectedOrgId, subdomainSlug]);

  const setSelectedOrgId = async (orgId: number) => {
    setSelectedOrgIdState(orgId);
    if (isOrgAdmin) {
      try {
        await setActiveOrg.mutateAsync({ orgId });
        utils.orgs.getActiveOrg.invalidate();
        // Refresh linked orgs for the new active org
        utils.orgs.link.list.invalidate({ orgId });
      } catch { /* non-critical */ }
    }
  };

  const orgId: number | null = selectedOrgId;

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
