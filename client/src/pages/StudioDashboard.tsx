import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { ProductSwitcher } from "@/components/ProductSwitcher";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  BookOpen, Plus, Video, Brain, FileCode2, BarChart3,
  Settings, LogOut, Layers, Zap, ArrowRight, Clock,
} from "lucide-react";

import RecordEditPage from "./RecordEditPage";

// ── Tier badge colours ─────────────────────────────────────────────────────
const TIER_STYLES: Record<string, string> = {
  none: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  creator: "bg-[#24abbc]/20 text-[#4ad9e0] border-[#24abbc]/30",
  pro: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  team: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const TIER_LABELS: Record<string, string> = {
  none: "Free",
  creator: "Creator",
  pro: "Pro",
  team: "Team",
};

// ── Quick action cards ─────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    icon: Video,
    label: "New Recording",
    desc: "Record screen, camera, or audio",
    href: "/media-library#record-edit",
    color: "text-[#24abbc]",
    bg: "bg-[#24abbc]/10",
  },
  {
    icon: BookOpen,
    label: "New Course",
    desc: "Start building a new course",
    href: "/lms/courses",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    icon: Brain,
    label: "Media Library",
    desc: "Manage your uploaded assets",
    href: "/media-library",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: FileCode2,
    label: "SCORM Export",
    desc: "Export courses for any LMS",
    href: "/lms/courses",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
];

// ── Sidebar nav items ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: Video, label: "Record & Upload", href: "#record" },
  { icon: BookOpen, label: "My Courses", href: "/lms/courses" },
  { icon: Brain, label: "Media Library", href: "/media-library" },
  { icon: Layers, label: "Creator", href: "/creator" },
  { icon: FileCode2, label: "Quiz Builder", href: "/quizzes/new" },
  { icon: Settings, label: "Settings", href: "/profile" },

];

export default function StudioDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activePage, setActivePage] = useState<"dashboard" | "record">("dashboard");

  const { data: studioSub, isLoading: subLoading } = trpc.billing.getStudioSubscription.useQuery(undefined, {
    enabled: !!user,
  });

  // Courses are accessed via the LMS builder which has org context
  const coursesLoading = false;
  const courses: any[] = [];

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  // ── Auth guard ──────────────────────────────────────────────────────────
  if (!authLoading && !user) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (authLoading || (user && subLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#24abbc] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading Studio…</p>
        </div>
      </div>
    );
  }

  // Site owners and admins always have full access — no subscription required
  const isPrivileged = (user as any)?.role === "site_owner" || (user as any)?.role === "site_admin";
  const tier = isPrivileged ? "pro" : (studioSub?.tier ?? "none");

  // ── No active subscription ──────────────────────────────────────────────
  if (!isPrivileged && !studioSub?.isActive) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="mb-8">
            <span className="text-3xl font-black tracking-tight">
              <span className="text-white">Teachific</span>
              <span className="text-[#24abbc]"> Studio</span>
            </span>
          </div>
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-9 h-9 text-[#24abbc]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Activate Your Studio</h1>
          <p className="text-white/50 mb-8 leading-relaxed">
            You need an active Teachific Studio subscription to access the course authoring tools.
            Start free — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              className="bg-[#0e8a96] hover:bg-[#0a6e78] text-white font-semibold"
              onClick={() => navigate("/studio-pro")}
            >
              View Plans <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => logoutMutation.mutate()}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Full dashboard ──────────────────────────────────────────────────────
  const showStudioWatermarkBanner = !isPrivileged && studioSub && !studioSub.isPaid;
  const studioTrialDaysLeft = studioSub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(studioSub.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;
  const studioIsInTrial = studioSub?.isInTrial ?? false;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col">
      {showStudioWatermarkBanner && (
        <div className="bg-[#0e8a96] text-white text-sm font-medium flex items-center justify-center gap-3 px-4 py-2 shrink-0">
          {studioIsInTrial && studioTrialDaysLeft !== null && (
            <span className="flex items-center gap-1.5">
              <span className="text-[#a0f0f5]">⏱</span>
              <strong>{studioTrialDaysLeft} day{studioTrialDaysLeft !== 1 ? "s" : ""} left in trial</strong>
            </span>
          )}
          <span>Your exports include a <strong>Created with Teachific™</strong> watermark on the free/trial plan.</span>
          <Link href="/studio-pro">
            <span className="underline underline-offset-2 cursor-pointer hover:text-[#a0f0f5] transition-colors">Upgrade to remove →</span>
          </Link>
        </div>
      )}
      <div className="flex flex-1">
      {/* Sidebar */}
      <aside className="w-64 bg-white/[0.03] border-r border-white/10 flex flex-col shrink-0 hidden md:flex">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <span className="text-lg font-black tracking-tight">
            <span className="text-white">Teachific</span>
            <span className="text-[#24abbc]"> Studio</span>
          </span>
        </div>

        {/* Plan badge + trial countdown */}
        <div className="px-4 py-3 border-b border-white/10 space-y-2">
          <Badge className={`text-xs px-2 py-0.5 ${TIER_STYLES[tier]}`}>
            {isPrivileged ? "Owner" : TIER_LABELS[tier]} Plan
          </Badge>
          {studioIsInTrial && studioTrialDaysLeft !== null && (
            <div className="flex items-center gap-1.5 text-xs bg-[#24abbc]/20 text-[#4ad9e0] border border-[#24abbc]/30 rounded-full px-2 py-0.5 w-fit">
              <span className="text-[10px]">⏱</span>
              <span>{studioTrialDaysLeft}d trial left</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) =>
            (item.href === "#record") ? (
              <button
                key={item.href}
                onClick={() => setActivePage("record")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer text-sm font-medium ${
                  activePage === "record"
                    ? "text-white bg-white/10"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            ) : (
              <Link key={item.href} href={item.href}>
                <div
                  onClick={() => setActivePage("dashboard")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer text-sm font-medium"
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            )
          )}
        </nav>

        {/* User + logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#0e8a96] flex items-center justify-center text-xs font-bold shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name ?? "User"}</p>
              <p className="text-xs text-white/40 truncate">{user?.email ?? ""}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/50 hover:text-white hover:bg-white/10 text-xs"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign Out
          </Button>
        </div>
        {/* Cross-product switcher */}
        <ProductSwitcher current="studio" variant="sidebar" />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 sticky top-0 bg-[#0a0f1e]/90 backdrop-blur z-10">
          <div>
            <h1 className="text-lg font-bold">Studio Dashboard</h1>
            <p className="text-xs text-white/40">Welcome back, {user?.name?.split(" ")[0] ?? "Creator"}</p>
          </div>
          <div className="flex items-center gap-3">
            <ProductSwitcher current="studio" variant="topbar" />
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => setActivePage("record")}
            >
              <Video className="w-3.5 h-3.5 mr-1.5" />
              Record
            </Button>
            <Button
              size="sm"
              className="bg-[#0e8a96] hover:bg-[#0a6e78] text-white"
              onClick={() => navigate("/lms/courses")}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Course
            </Button>
          </div>
        </div>

        <div className="p-6 max-w-6xl mx-auto space-y-8">

          {activePage === "record" && (
            <div className="-mx-6 -mt-6">
              <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10">
                <button onClick={() => setActivePage("dashboard")} className="text-white/50 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
                  ← Back to Dashboard
                </button>
              </div>
              <div className="h-[calc(100vh-8rem)] overflow-auto">
                <RecordEditPage />
              </div>
            </div>
          )}
          {activePage !== "record" && <>
          {/* Quick actions */}
          <section>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {QUICK_ACTIONS.map((action) => (
                <Link key={action.label} href={action.href}>
                  <Card className="bg-white/5 border-white/10 hover:border-[#24abbc]/40 hover:bg-white/[0.07] transition-all cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className={`w-9 h-9 rounded-xl ${action.bg} flex items-center justify-center mb-3`}>
                        <action.icon className={`w-4 h-4 ${action.color}`} />
                      </div>
                      <p className="font-semibold text-sm text-white">{action.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{action.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent courses */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Recent Courses</h2>
              <Link href="/lms/courses">
                <span className="text-xs text-[#24abbc] hover:text-[#4ad9e0] cursor-pointer transition-colors">
                  View all →
                </span>
              </Link>
            </div>

            {coursesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 bg-white/5 rounded-xl" />
                ))}
              </div>
            ) : !courses?.length ? (
              <Card className="bg-white/5 border-white/10 border-dashed">
                <CardContent className="p-10 text-center">
                  <BookOpen className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50 text-sm mb-4">No courses yet. Create your first course to get started.</p>
                  <Button
                    size="sm"
                    className="bg-[#0e8a96] hover:bg-[#0a6e78] text-white"
                    onClick={() => navigate("/lms/courses")}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Create Course
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(courses as any[]).slice(0, 6).map((course: any) => (
                  <Link key={course.id} href={`/lms/courses/${course.id}`}>
                    <Card className="bg-white/5 border-white/10 hover:border-[#24abbc]/40 transition-all cursor-pointer h-full">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-9 h-9 rounded-lg bg-[#24abbc]/20 flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4 text-[#24abbc]" />
                          </div>
                          <Badge className={`text-xs ${
                            course.status === "published"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          }`}>
                            {course.status ?? "draft"}
                          </Badge>
                        </div>
                        <p className="font-semibold text-sm text-white line-clamp-2 mb-1">{course.title}</p>
                        <div className="flex items-center gap-3 text-xs text-white/40 mt-2">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {course.lessonCount ?? 0} lessons
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {course.updatedAt
                              ? new Date(course.updatedAt).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Plan usage */}
          <section>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Plan Usage</h2>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-white">
                      {isPrivileged ? "Owner" : TIER_LABELS[tier]} Plan
                    </p>
                    <p className="text-sm text-white/40">
                      {isPrivileged && "Full access — no limits"}
                      {!isPrivileged && tier === "none" && "Free tier — upgrade to unlock more"}
                      {!isPrivileged && tier === "web" && "Web app access · 5 GB storage"}
                      {!isPrivileged && tier === "desktop" && "Pro · 50 GB storage"}
                      {!isPrivileged && tier === "bundle" && "Team · Unlimited storage · 5 seats"}
                    </p>
                  </div>
                  {!isPrivileged && tier !== "desktop" && tier !== "bundle" && (
                    <Button
                      size="sm"
                      className="bg-[#0e8a96] hover:bg-[#0a6e78] text-white"
                      onClick={() => navigate("/studio-pro#pricing")}
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: "Courses", value: courses?.length ?? 0, max: isPrivileged || tier === "desktop" || tier === "bundle" || tier === "pro" ? "∞" : tier === "web" ? 10 : 1 },
                    { label: "Storage Used", value: "—", max: isPrivileged ? "∞" : tier === "none" ? "100 MB" : tier === "web" ? "5 GB" : "50 GB" },
                    { label: "Team Seats", value: tier === "bundle" ? "5" : "1", max: tier === "bundle" ? "5" : "1" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white/5 rounded-xl p-3">
                      <p className="text-xl font-bold text-white">{stat.value}</p>
                      <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                      <p className="text-xs text-white/20 mt-0.5">of {stat.max}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
          </>}
        </div>
      </main>
      </div>
    </div>
  );
}
