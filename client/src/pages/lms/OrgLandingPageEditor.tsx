/**
 * OrgLandingPageEditor.tsx
 * Full-screen block-based editor for an org's public landing (home) page.
 * Route: /lms/school/landing-builder
 *
 * - Org admins can edit the blocks that appear on their school's public home page.
 * - Auto-seeds a default 4-block layout if the org has no landing page yet.
 * - Saves via trpc.orgs.saveLandingPage (blocksJson + flat fields).
 * - Preview opens the org's public home page in a new tab.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { PageBuilder, Block } from "@/components/PageBuilder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import {
  ArrowLeft,
  Eye,
  Save,
  Loader2,
  Globe,
  LayoutTemplate,
  CheckCircle2,
} from "lucide-react";

// ─── Helper: generate a stable uid ───────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── Default blocks seeded client-side when server hasn't seeded yet ─────────
function makeDefaultBlocks(orgName: string): Block[] {
  return [
    {
      id: uid(), type: "banner", visible: true,
      data: {
        headline: `Welcome to ${orgName}`,
        subtext: "Explore our courses and start learning today.",
        ctaText: "Browse Courses", ctaUrl: "#",
        backgroundType: "color", backgroundColor: "#0f2942",
        textColor: "#ffffff", ctaBgColor: "#0ea5e9", ctaTextColor: "#ffffff",
        alignment: "center", minHeight: 480,
      },
    },
    {
      id: uid(), type: "feature_grid", visible: true,
      data: {
        headline: `Why Choose ${orgName}`,
        subheadline: "Everything you need to learn and grow.",
        columns: 3,
        features: [
          { id: "f1", icon: "BookOpen", title: "Expert Content", description: "Courses created by industry professionals." },
          { id: "f2", icon: "Award", title: "Earn Certificates", description: "Get recognized for your achievements." },
          { id: "f3", icon: "Users", title: "Community", description: "Learn alongside a supportive community." },
        ],
        backgroundColor: "#ffffff", textColor: "#1e293b", accentColor: "#0ea5e9",
      },
    },
    {
      id: uid(), type: "course_outline", visible: true,
      data: {
        headline: "Our Courses",
        subheadline: "Start your learning journey today.",
        backgroundColor: "#f8fafc", textColor: "#1e293b", accentColor: "#0ea5e9",
      },
    },
    {
      id: uid(), type: "cta", visible: true,
      data: {
        headline: "Ready to get started?",
        subtext: "Join thousands of learners already on the platform.",
        ctaText: "Enroll Now", ctaUrl: "#",
        backgroundType: "color", backgroundColor: "#0ea5e9",
        textColor: "#ffffff", alignment: "center",
      },
    },
  ];
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrgLandingPageEditor() {
  const [, setLocation] = useLocation();
  const { orgId, orgs, ready } = useOrgScope();
  const activeOrg = orgs.find((org: any) => org.id === orgId);

  // ── Fetch landing page data ──────────────────────────────────────────────────
  const { data, isLoading, error } = trpc.orgs.getLandingPageForEditor.useQuery(
    { orgId: orgId! },
    { enabled: ready && orgId !== null, staleTime: 0 }
  );

  // ── Block state ──────────────────────────────────────────────────────────────
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isPublished, setIsPublished] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // Track which orgId we last loaded blocks for — reset when org changes
  const loadedForOrgId = useRef<number | null>(null);

  useEffect(() => {
    if (!data) return;
    // Only reload if we haven't loaded for this specific org yet
    if (loadedForOrgId.current === orgId) return;
    loadedForOrgId.current = orgId ?? null;
    setIsPublished(data.landingPage?.isPublished ?? true);
    // Parse blocksJson if present, otherwise fall back to default blocks
    if (data.landingPage?.blocksJson) {
      try {
        const parsed = JSON.parse(data.landingPage.blocksJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBlocks(parsed as Block[]);
          return;
        }
      } catch (_) { /* fall through to defaults */ }
    }
    setBlocks(makeDefaultBlocks(data.org?.name ?? "Our School"));
  }, [data, orgId]);

  // ── Save mutation ────────────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const saveMutation = trpc.orgs.saveLandingPage.useMutation({
    onSuccess: () => {
      setSavedAt(new Date());
      utils.orgs.getLandingPage.invalidate();
      toast.success("Home page saved!");
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const handleSave = useCallback(async () => {
    if (!orgId) return;
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({
        orgId,
        blocksJson: JSON.stringify(blocks),
        isPublished,
        // Sync flat hero fields from the first banner block for legacy rendering
        ...(blocks[0]?.type === "banner" ? {
          heroHeadline: blocks[0].data.headline ?? "",
          heroSubheadline: blocks[0].data.subtext ?? "",
          heroCtaText: blocks[0].data.ctaText ?? "",
          heroCtaUrl: blocks[0].data.ctaUrl ?? "",
          heroBgColor: blocks[0].data.backgroundColor ?? "#0f2942",
          heroTextColor: blocks[0].data.textColor ?? "#ffffff",
          accentColor: blocks[0].data.ctaBgColor ?? "#0ea5e9",
        } : {}),
      });
    } finally {
      setIsSaving(false);
    }
  }, [orgId, blocks, isPublished, saveMutation]);

  // ── Preview URL ──────────────────────────────────────────────────────────────
  const previewUrl = activeOrg
    ? `${getOrgBaseUrl(activeOrg.slug, (activeOrg as any).customDomain, (activeOrg as any).domainVerificationStatus)}?preview=1`
    : null;

  // ── Keyboard shortcut: Ctrl/Cmd+S ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // ── Loading / error states ───────────────────────────────────────────────────
  if (!ready || isLoading) {
    return (
      <div className="flex flex-col h-screen bg-slate-950">
        {/* Toolbar skeleton */}
        <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center gap-3 px-4">
          <Skeleton className="h-8 w-24 bg-slate-800" />
          <Skeleton className="h-8 w-40 bg-slate-800" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-24 bg-slate-800" />
          <Skeleton className="h-8 w-24 bg-slate-800" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading editor…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-slate-400">
        <LayoutTemplate className="h-12 w-12 opacity-40" />
        <p className="text-lg font-medium text-white">Could not load editor</p>
        <p className="text-sm">{error.message}</p>
        <Button variant="outline" onClick={() => setLocation("/lms")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* ── Top toolbar ─────────────────────────────────────────────────────── */}
      <div className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center gap-2 px-4 z-50">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white gap-1.5"
          onClick={() => setLocation("/lms")}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        {/* Title */}
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-semibold text-white">
            {data?.org?.name ?? "School"} — Home Page
          </span>
          <Badge
            variant="outline"
            className={`text-xs ${isPublished ? "border-emerald-500/50 text-emerald-400" : "border-amber-500/50 text-amber-400"}`}
          >
            {isPublished ? "Published" : "Draft"}
          </Badge>
        </div>

        <div className="flex-1" />

        {/* Published toggle */}
        <div className="flex items-center gap-2 mr-2">
          <Label htmlFor="published-toggle" className="text-xs text-slate-400 cursor-pointer select-none">
            {isPublished ? "Live" : "Draft"}
          </Label>
          <Switch
            id="published-toggle"
            checked={isPublished}
            onCheckedChange={setIsPublished}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>

        {/* Saved indicator */}
        {savedAt && (
          <span className="text-xs text-slate-500 flex items-center gap-1 mr-2">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}

        {/* Preview */}
        {previewUrl && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 bg-transparent"
            onClick={() => window.open(previewUrl, "_blank")}
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        )}

        {/* Save */}
        <Button
          size="sm"
          className="gap-1.5 bg-sky-600 hover:bg-sky-500 text-white"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* ── Page Builder canvas ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <PageBuilder
          initialBlocks={blocks}
          onChange={setBlocks}
          orgId={orgId ?? 0}
        />
      </div>
    </div>
  );
}
