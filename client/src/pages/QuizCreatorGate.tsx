import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import QuizCreatorPage from "./QuizCreatorPage";

/**
 * QuizCreatorGate
 *
 * Access rules:
 * - Not logged in → redirect to login
 * - Logged in, quizCreatorAccess === "none" AND not Enterprise LMS user → show upgrade wall
 * - Logged in, quizCreatorAccess === "web" OR "premium" → show quiz creator
 * - Logged in, LMS role is "site_owner" | "site_admin" | "org_super_admin" | "org_admin" → always allowed (Enterprise)
 */
export default function QuizCreatorGate() {
  const { user, loading: authLoading } = useAuth();
  const { data: roleData, isLoading: roleLoading } = trpc.quizCreator.getMyRole.useQuery(undefined, {
    enabled: !!user,
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
          <p className="text-white/60 text-sm">Loading Quiz Creator…</p>
        </div>
      </div>
    );
  }

  const qcRole = roleData?.role ?? "none";
  const lmsRole = user?.role ?? "member";
  const isEnterpriseUser = ["site_owner", "site_admin", "org_super_admin", "org_admin"].includes(lmsRole);
  const hasQuizCreatorAccess = isEnterpriseUser || qcRole === "web" || qcRole === "desktop";

  if (!hasQuizCreatorAccess) {
    return <QuizCreatorUpgradeWall />;
  }

  return <QuizCreatorPage />;
}

function QuizCreatorUpgradeWall() {
  return (
    <div className="min-h-screen bg-[#0b1d35] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <span className="text-3xl font-black tracking-tight">
            <span className="text-white">Quiz</span>
            <span className="text-teal-400">Creator</span>
            <span className="text-white/40 text-lg font-medium ml-1">by Course360</span>
          </span>
        </div>

        {/* Lock icon */}
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-9 h-9 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          Course360 Quiz Creator Access Required
        </h1>
        <p className="text-white/60 mb-8 leading-relaxed">
          Quiz Creator is available as a standalone subscription or included with Course360 Enterprise.
          Upgrade to start building professional quizzes with hotspot, matching, and 5 other question types.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/quiz-creator-pro">
            <Button className=" font-semibold px-8 py-3 rounded-xl w-full sm:w-auto">
              View Plans & Pricing
            </Button>
          </Link>
          <Link href="/lms">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-3 rounded-xl w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <p className="text-white/30 text-xs mt-8">
          Already have a license?{" "}
          <a href="mailto:support@course360.app" className="text-teal-400 hover:underline">
            Contact support
          </a>{" "}
          to have it applied to your account.
        </p>
      </div>
    </div>
  );
}
