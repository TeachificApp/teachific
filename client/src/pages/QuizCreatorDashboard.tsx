import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import QuizCreatorPage from "./QuizCreatorPage";
import { ProductSwitcher } from "@/components/ProductSwitcher";

/**
 * QuizCreatorDashboard
 *
 * Standalone shell for users who have a QuizMaker subscription but no LMS access.
 * Shows a minimal top nav with the QuizMaker branding, then embeds the full Quiz Creator tool.
 */
export default function QuizCreatorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { data: roleData, isLoading: roleLoading } = trpc.quizCreator.getMyRole.useQuery(undefined, {
    enabled: !!user,
  });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/quiz-creator-pro"; },
  });

  // Not logged in
  if (!authLoading && !user) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1d35]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const qcRole = roleData?.role ?? "none";
  const qcTrialEndsAt = roleData?.trialEndsAt ?? null;
  const qcIsTrialing = qcRole !== "none" && qcTrialEndsAt && new Date(qcTrialEndsAt) > new Date();
  const qcIsPaid = qcRole !== "none" && !qcIsTrialing;
  const showQcWatermarkBanner = qcRole !== "none" && !qcIsPaid;
  const qcTrialDaysLeft = qcTrialEndsAt
    ? Math.max(0, Math.ceil((new Date(qcTrialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  if (qcRole === "none") {
    // No access — redirect to sales page
    return (
      <div className="min-h-screen bg-[#0b1d35] flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="mb-8">
            <span className="text-3xl font-black tracking-tight">
              <span className="text-white">Quiz</span>
              <span className="text-teal-400">Maker</span>
            </span>
          </div>
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-9 h-9 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">No Active Subscription</h1>
          <p className="text-white/60 mb-8">
            You don't have an active QuizMaker subscription. View plans to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/quiz-creator-pro">
              <Button className=" font-semibold px-8 py-3 rounded-xl w-full sm:w-auto">
                View Plans
              </Button>
            </Link>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 px-8 py-3 rounded-xl w-full sm:w-auto"
              onClick={() => logoutMutation.mutate()}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b1d35]">
      {showQcWatermarkBanner && (
        <div className="bg-teal-600 text-white text-sm font-medium flex items-center justify-center gap-3 px-4 py-2">
          {qcIsTrialing && qcTrialDaysLeft !== null && (
            <span className="flex items-center gap-1.5">
              <span>⏱</span>
              <strong>{qcTrialDaysLeft} day{qcTrialDaysLeft !== 1 ? "s" : ""} left in trial</strong>
            </span>
          )}
          <span>Your quiz exports include a <strong>Created with Course360™</strong> watermark on the free/trial plan.</span>
          <Link href="/quiz-creator-pro">
            <span className="underline underline-offset-2 cursor-pointer hover:text-teal-200 transition-colors">Upgrade to remove →</span>
          </Link>
        </div>
      )}
      {/* Top navigation bar */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#0b1d35] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black tracking-tight">
            <span className="text-white">Quiz</span>
            <span className="text-teal-400">Maker</span>
          </span>
          <Badge
            className={
              qcRole === "desktop" || qcRole === "bundle"
                ? "bg-teal-500/20 text-teal-300 border-teal-500/30 text-xs"
                : "bg-white/10 text-white/60 border-white/20 text-xs"
            }
          >
            {qcRole === "desktop" || qcRole === "bundle" ? "Pro" : "Standard"}
          </Badge>
          {qcIsTrialing && qcTrialDaysLeft !== null && (
            <div className="flex items-center gap-1 text-xs bg-[#24abbc]/20 text-[#4ad9e0] border border-[#24abbc]/30 rounded-full px-2 py-0.5">
              <span className="text-[10px]">⏱</span>
              <span>{qcTrialDaysLeft}d trial</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <ProductSwitcher current="quizCreator" variant="topbar" />
          <span className="text-white/50 text-sm hidden sm:block">{user?.name ?? user?.email}</span>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white text-xs"
            onClick={() => logoutMutation.mutate()}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Free tier banner */}
      {qcRole === "web" && (
        <div className="bg-teal-900/40 border-b border-teal-500/20 px-6 py-2 flex items-center justify-between">
          <p className="text-teal-300 text-xs">
            <strong>Standard plan:</strong> Up to 10 quizzes, 20 questions per quiz. Encrypted export requires Pro.
          </p>
          <Link href="/quiz-creator-pro">
            <Button size="sm" className=" text-xs h-7 px-3 rounded-lg">
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      )}

      {/* Full quiz creator tool */}
      <div className="flex-1 overflow-hidden">
        <QuizCreatorPage />
      </div>
    </div>
  );
}
