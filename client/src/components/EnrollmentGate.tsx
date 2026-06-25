/**
 * EnrollmentGate — Teachific's auth/enrollment guard component.
 *
 * Wraps any content with a blur overlay and shows one of three prompts:
 *  1. Loading — checking auth/enrollment status
 *  2. Not logged in — sign-in CTA
 *  3. Not enrolled — enroll/buy CTA
 *
 * Usage:
 *   <EnrollmentGate isLoading={...} isAuthenticated={!!user} isEnrolled={!!enrollment} checkoutUrl="/checkout/course/my-course">
 *     <LockedContent />
 *   </EnrollmentGate>
 *
 * Variants:
 *   - "full"   (default) — blurs children and shows overlay card
 *   - "inline" — renders a compact inline badge/link
 *   - "banner" — renders a top/bottom banner strip
 */
import { Lock, LogIn, ShoppingCart, Loader2, ArrowRight, Sparkles, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

export type EnrollmentGateVariant = "full" | "inline" | "banner";

interface EnrollmentGateProps {
  /** Whether auth/enrollment data is still loading */
  isLoading?: boolean;
  /** Whether the current user is authenticated */
  isAuthenticated?: boolean;
  /** Whether the current user has enrollment/access */
  isEnrolled?: boolean;
  /** URL to the checkout/enroll page for this content */
  checkoutUrl?: string;
  /** Label for the content being gated (e.g. "this course", "this lesson") */
  contentLabel?: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Display variant */
  variant?: EnrollmentGateVariant;
  /** Children to render (blurred) when not enrolled */
  children?: React.ReactNode;
  /** Called when the user clicks "Enroll" — use instead of checkoutUrl for custom logic */
  onEnroll?: () => void;
  /** Whether the enroll action is in progress */
  enrolling?: boolean;
  /** Custom enroll button label */
  enrollLabel?: string;
  /** Whether to show the gate at all (pass false to render children directly) */
  enabled?: boolean;
}

export function EnrollmentGate({
  isLoading = false,
  isAuthenticated = false,
  isEnrolled = false,
  checkoutUrl,
  contentLabel = "this content",
  primaryColor = "#179ca3",
  variant = "full",
  children,
  onEnroll,
  enrolling = false,
  enrollLabel,
  enabled = true,
}: EnrollmentGateProps) {
  // If gate is disabled or user is enrolled, render children directly
  if (!enabled || isEnrolled) return <>{children}</>;

  const handleEnroll = () => {
    if (onEnroll) { onEnroll(); return; }
    if (checkoutUrl) { window.location.href = checkoutUrl; }
  };

  const handleLogin = () => {
    window.location.href = getLoginUrl(window.location.pathname);
  };

  // ── Inline variant ──────────────────────────────────────────────────────────
  if (variant === "inline") {
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Checking access…</span>
        </span>
      );
    }
    if (!isAuthenticated) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
          <Lock className="w-3 h-3" />
          <span>Sign in required</span>
          <button
            onClick={handleLogin}
            className="font-medium hover:underline cursor-pointer"
            style={{ color: primaryColor }}
          >
            Sign in →
          </button>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
        <GraduationCap className="w-3 h-3" />
        <span>Enrollment required</span>
        {(checkoutUrl || onEnroll) && (
          <button
            onClick={handleEnroll}
            className="font-medium hover:underline cursor-pointer"
            style={{ color: primaryColor }}
          >
            Enroll →
          </button>
        )}
      </span>
    );
  }

  // ── Banner variant ──────────────────────────────────────────────────────────
  if (variant === "banner") {
    if (isLoading) {
      return (
        <div className="w-full py-2 px-4 bg-muted text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking access…</span>
        </div>
      );
    }
    if (!isAuthenticated) {
      return (
        <div className="w-full py-2.5 px-4 text-white text-sm flex items-center justify-center gap-3" style={{ backgroundColor: primaryColor }}>
          <Lock className="w-4 h-4 shrink-0" />
          <span>Sign in to access {contentLabel}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white/20 border-white/40 text-white hover:bg-white/30"
            onClick={handleLogin}
          >
            Sign In <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      );
    }
    return (
      <div className="w-full py-2.5 px-4 text-white text-sm flex items-center justify-center gap-3" style={{ backgroundColor: primaryColor }}>
        <GraduationCap className="w-4 h-4 shrink-0" />
        <span>Enroll to access {contentLabel}</span>
        {(checkoutUrl || onEnroll) && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white/20 border-white/40 text-white hover:bg-white/30"
            onClick={handleEnroll}
            disabled={enrolling}
          >
            {enrolling ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ShoppingCart className="w-3 h-3 mr-1" />{enrollLabel ?? "Enroll Now"}</>}
          </Button>
        )}
      </div>
    );
  }

  // ── Full variant (default) — blur overlay ───────────────────────────────────
  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content preview */}
      {children && (
        <div
          className="select-none pointer-events-none"
          style={{ filter: "blur(5px)", opacity: 0.4 }}
          aria-hidden="true"
        >
          {children}
        </div>
      )}
      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] z-10">
        <div className="w-full max-w-sm mx-4">
          {isLoading ? (
            <LoadingCard />
          ) : !isAuthenticated ? (
            <NotLoggedInCard
              contentLabel={contentLabel}
              primaryColor={primaryColor}
              onLogin={handleLogin}
            />
          ) : (
            <EnrollCard
              contentLabel={contentLabel}
              primaryColor={primaryColor}
              onEnroll={handleEnroll}
              enrolling={enrolling}
              enrollLabel={enrollLabel}
              checkoutUrl={checkoutUrl}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl p-7 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 animate-pulse">
        <Lock className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">Checking access…</p>
    </div>
  );
}

function NotLoggedInCard({
  contentLabel,
  primaryColor,
  onLogin,
}: {
  contentLabel: string;
  primaryColor: string;
  onLogin: () => void;
}) {
  return (
    <div
      className="rounded-2xl border bg-card shadow-2xl p-7 text-center"
      style={{ borderColor: `${primaryColor}40` }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: `${primaryColor}18` }}
      >
        <Lock className="w-7 h-7" style={{ color: primaryColor }} />
      </div>
      <h3 className="font-bold text-foreground text-lg mb-2">Sign In to Continue</h3>
      <p className="text-muted-foreground text-sm mb-5">
        Please sign in to access {contentLabel}.
      </p>
      <Button
        className="w-full text-white font-semibold"
        style={{ backgroundColor: primaryColor }}
        onClick={onLogin}
      >
        <LogIn className="w-4 h-4 mr-2" />
        Sign In
        <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

function EnrollCard({
  contentLabel,
  primaryColor,
  onEnroll,
  enrolling,
  enrollLabel,
  checkoutUrl,
}: {
  contentLabel: string;
  primaryColor: string;
  onEnroll: () => void;
  enrolling: boolean;
  enrollLabel?: string;
  checkoutUrl?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-card shadow-2xl p-7 text-center">
      {/* Icon */}
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center mx-auto mb-4 shadow-md">
        <GraduationCap className="w-7 h-7 text-amber-600" />
      </div>
      {/* Badge */}
      <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
        <Sparkles className="w-3 h-3" />
        Enrollment Required
      </div>
      <h3 className="font-bold text-foreground text-lg mb-2 leading-snug">
        Unlock {contentLabel}
      </h3>
      <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
        Enroll to get full access to all lessons, track your progress, and earn your certificate.
      </p>
      <Button
        className="w-full text-white font-semibold"
        style={{ backgroundColor: primaryColor }}
        onClick={onEnroll}
        disabled={enrolling}
      >
        {enrolling ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <ShoppingCart className="w-4 h-4 mr-2" />
        )}
        {enrollLabel ?? "Enroll Now"}
        {!enrolling && <ArrowRight className="w-4 h-4 ml-1" />}
      </Button>
    </div>
  );
}

export default EnrollmentGate;
