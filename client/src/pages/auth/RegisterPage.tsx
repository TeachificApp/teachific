import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, CheckCircle2, Sparkles, Shield, Zap, Globe, Layers } from "lucide-react";
import { useOrgAuthBranding } from "@/hooks/useOrgAuthBranding";

const NAVY = "#0b1d35";
const NAVY_MID = "#0f2847";
const TEAL = "#24abbc";
const TEAL_LIGHT = "#4ad9e0";

const perks = [
  { icon: Sparkles, text: "Free plan — no credit card required" },
  { icon: Zap, text: "Launch your school in under 10 minutes" },
  { icon: Globe, text: "Custom school page with your own branding" },
  { icon: Shield, text: "SSL-secured, GDPR-ready platform" },
];

// ── Blueprint install context ─────────────────────────────────────────────────
function useBlueprintInstallContext() {
  const [blueprintToken, setBlueprintToken] = useState<string | null>(null);
  const [blueprintName, setBlueprintName] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("blueprint") || localStorage.getItem("blueprint_install_token");
    const name = params.get("bp_name") || localStorage.getItem("blueprint_install_name");
    if (token) {
      setBlueprintToken(token);
      setBlueprintName(name ? decodeURIComponent(name) : "your blueprint");
    }
  }, []);

  return { blueprintToken, blueprintName };
}

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Org white-labeling
  const { branding, primary, buttonText, displayName } = useOrgAuthBranding();
  const isOrgSubdomain = !!branding;

  // Blueprint install context (from referral link)
  const { blueprintToken, blueprintName } = useBlueprintInstallContext();
  const hasBlueprintInstall = !!blueprintToken;

  const utils = trpc.useUtils();
  const claimInstall = trpc.blueprintReferrals.claimPendingInstall.useMutation();

  const register = trpc.customAuth.register.useMutation({
    onSuccess: async (data) => {
      if (data.autoSignedIn && data.user) {
        // Seed the auth.me cache so DashboardLayout doesn't flash the sign-in screen
        utils.auth.me.setData(undefined, data.user as never);
        try { localStorage.setItem("teachific_auth_cache", JSON.stringify(data.user)); } catch {}

        // If there's a pending blueprint install, claim it now
        if (blueprintToken) {
          try {
            const claimed = await claimInstall.mutateAsync({ sessionToken: blueprintToken });
            // Clear the stored token
            try {
              localStorage.removeItem("blueprint_install_token");
              localStorage.removeItem("blueprint_install_name");
            } catch {}
            // Redirect to blueprint install confirmation page
            const isProduction = window.location.hostname.endsWith(".teachific.app") || window.location.hostname === "teachific.app";
            const orgSlug = data.orgSlug;
            if (isProduction && orgSlug) {
              window.location.href = `https://${orgSlug}.teachific.app/blueprints/install-confirm?pending=${claimed.pendingInstallId}`;
            } else {
              navigate(`/blueprints/install-confirm?pending=${claimed.pendingInstallId}`);
            }
            return;
          } catch {
            // Non-fatal: if claim fails, just proceed to normal redirect
          }
        }

        // Normal post-signup redirect
        if (data.orgSlug) {
          const { protocol, port } = window.location;
          const portSuffix = port ? `:${port}` : "";
          const isProduction = window.location.hostname.endsWith(".teachific.app") || window.location.hostname === "teachific.app";
          if (isProduction) {
            window.location.href = `${protocol}//${data.orgSlug}.teachific.app/lms`;
          } else {
            navigate("/lms");
          }
        } else {
          navigate("/lms");
        }
      } else {
        setSuccess(true);
      }
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    register.mutate({ name, email, password });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: `linear-gradient(145deg, ${NAVY} 0%, ${NAVY_MID} 60%, #0d3352 100%)` }}>
        <div className="w-full max-w-md text-center">
          <div className="flex items-baseline gap-0.5 justify-center mb-8">
            <span className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>teach</span>
            <span className="text-3xl font-bold tracking-tight" style={{ color: TEAL_LIGHT, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ific</span>
            <span className="text-sm font-bold ml-0.5" style={{ color: TEAL_LIGHT, verticalAlign: "super", fontSize: "0.55em" }}>™</span>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-10 shadow-2xl">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: TEAL_LIGHT }} />
            <h2 className="text-2xl font-semibold text-white mb-3">Check your inbox</h2>
            <p className="text-white/60 leading-relaxed mb-6">
              We've sent a verification email to{" "}
              <span className="font-medium" style={{ color: TEAL_LIGHT }}>{email}</span>.
              Click the link in the email to activate your account.
            </p>
            {hasBlueprintInstall && (
              <div className="mb-6 rounded-xl p-4" style={{ background: `${TEAL}15`, border: `1px solid ${TEAL}30` }}>
                <Layers className="w-6 h-6 mx-auto mb-2" style={{ color: TEAL_LIGHT }} />
                <p className="text-white/70 text-sm">
                  Once verified, <strong style={{ color: TEAL_LIGHT }}>{blueprintName}</strong> will be automatically installed in your school.
                </p>
              </div>
            )}
            <Link href="/login">
              <Button className="font-semibold w-full text-white" style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #15b8c0 100%)` }}>
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: brand (hidden on org subdomains) ───────────── */}
      {!isOrgSubdomain && <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: `linear-gradient(145deg, ${NAVY} 0%, ${NAVY_MID} 60%, #0d3352 100%)` }}
      >
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, ${TEAL_LIGHT}, transparent 70%)` }} />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-8"
          style={{ background: `radial-gradient(circle, ${TEAL}, transparent 70%)` }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-baseline gap-0.5">
            <span className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>teach</span>
            <span className="text-3xl font-bold tracking-tight" style={{ color: TEAL_LIGHT, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ific</span>
            <span className="text-sm font-bold ml-0.5" style={{ color: TEAL_LIGHT, verticalAlign: "super", fontSize: "0.55em" }}>™</span>
          </div>
          <p className="text-xs font-semibold tracking-widest uppercase mt-1" style={{ color: `${TEAL_LIGHT}80` }}>
            Learning Management Platform
          </p>
        </div>

        {/* Hero copy — blueprint context or default */}
        <div className="relative z-10 space-y-8">
          {hasBlueprintInstall ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${TEAL}25`, border: `1px solid ${TEAL}40` }}>
                  <Layers className="w-5 h-5" style={{ color: TEAL_LIGHT }} />
                </div>
                <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: `${TEAL_LIGHT}80` }}>Blueprint Install</span>
              </div>
              <h1 className="text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Your school is<br />
                <span style={{ color: TEAL_LIGHT }}>ready to build.</span>
              </h1>
              <p className="text-white/60 text-base leading-relaxed max-w-sm">
                Create your free account and <strong className="text-white/80">{blueprintName}</strong> will be automatically installed in your new school.
              </p>
              <div className="mt-6 rounded-xl p-4" style={{ background: `${TEAL}15`, border: `1px solid ${TEAL}30` }}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: TEAL_LIGHT }} />
                  <span className="text-white/80 text-sm font-medium">What happens next</span>
                </div>
                <ol className="space-y-1.5 text-white/60 text-sm">
                  <li>1. Create your free account</li>
                  <li>2. Blueprint is installed automatically</li>
                  <li>3. Customize and launch in minutes</li>
                </ol>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Start teaching.<br />
                <span style={{ color: TEAL_LIGHT }}>Start earning.</span><br />
                Start today.
              </h1>
              <p className="text-white/60 text-base leading-relaxed max-w-sm">
                Everything you need to launch, grow, and monetize your online school — in one place.
              </p>
            </div>
          )}

          {/* Perks */}
          <div className="space-y-3">
            {perks.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${TEAL}25`, border: `1px solid ${TEAL}40` }}>
                  <Icon className="w-4 h-4" style={{ color: TEAL_LIGHT }} />
                </div>
                <span className="text-white/75 text-sm">{text}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          {!hasBlueprintInstall && (
            <div className="rounded-xl p-4" style={{ background: `${TEAL}15`, border: `1px solid ${TEAL}30` }}>
              <p className="text-white/70 text-sm italic leading-relaxed">
                "Teachific helped me go from zero to $12K/month in under 6 months. The platform just works."
              </p>
              <p className="text-white/40 text-xs mt-2">— Sarah K., Nutrition Coach</p>
            </div>
          )}
        </div>

        <p className="relative z-10 text-white/25 text-xs">
          © {new Date().getFullYear()} Teachific™. All rights reserved. Teachific™ is a{" "}<a href="https://www.soundmedianow.com" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">SoundMedia, Inc.</a>{" "}brand
        </p>
      </div>}

      {/* ── Right panel: form ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-8 py-12">
        {/* Logo: org branding on subdomain, Teachific on root */}
        <div className="mb-8 text-center">
          {isOrgSubdomain ? (
            branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={displayName} className="h-12 max-w-[200px] object-contain mx-auto mb-2" />
            ) : (
              <h1 className="text-2xl font-bold" style={{ color: primary }}>{displayName}</h1>
            )
          ) : (
            <div className="lg:hidden flex items-baseline gap-0.5 justify-center">
              <span className="text-3xl font-bold tracking-tight" style={{ color: NAVY, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>teach</span>
              <span className="text-3xl font-bold tracking-tight" style={{ color: TEAL, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ific</span>
              <span className="text-sm font-bold ml-0.5" style={{ color: TEAL, verticalAlign: "super", fontSize: "0.55em" }}>™</span>
            </div>
          )}
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-1" style={{ color: NAVY, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {isOrgSubdomain ? `Join ${displayName}` : "Create your account"}
            </h2>
            <p className="text-sm text-slate-500">
              {isOrgSubdomain ? `Create your student account` : "Free forever — upgrade when you're ready"}
            </p>
          </div>

          {/* Blueprint install banner */}
          {hasBlueprintInstall && (
            <div className="mb-5 rounded-xl p-3.5 flex items-start gap-3" style={{ background: `${TEAL}10`, border: `1px solid ${TEAL}30` }}>
              <Layers className="w-5 h-5 mt-0.5 shrink-0" style={{ color: TEAL }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: NAVY }}>Blueprint ready to install</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-medium" style={{ color: TEAL }}>{blueprintName}</span> will be installed automatically after you sign up.
                </p>
              </div>
            </div>
          )}

          {error && (
            <Alert className="mb-5 border-red-200 bg-red-50">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium" style={{ color: NAVY }}>Full name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoComplete="name"
                className="h-11 border-slate-200 focus:border-[#24abbc] focus:ring-[#24abbc]/20 text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium" style={{ color: NAVY }}>Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="h-11 border-slate-200 focus:border-[#24abbc] focus:ring-[#24abbc]/20 text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium" style={{ color: NAVY }}>Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11 border-slate-200 focus:border-[#24abbc] focus:ring-[#24abbc]/20 text-slate-800 placeholder:text-slate-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && password.length < 8 && (
                <p className="text-amber-600 text-xs">Password must be at least 8 characters</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={register.isPending || claimInstall.isPending}
              className="w-full h-11 font-semibold rounded-lg transition-all shadow-sm"
              style={{
                background: isOrgSubdomain ? primary : `linear-gradient(135deg, ${TEAL} 0%, #15b8c0 100%)`,
                color: buttonText,
              }}
            >
              {register.isPending || claimInstall.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{claimInstall.isPending ? "Installing blueprint..." : "Creating account..."}</>
                : hasBlueprintInstall
                  ? "Create account & install blueprint"
                  : isOrgSubdomain ? "Create account" : "Create free account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login"
                className="font-semibold transition-colors hover:opacity-80"
                style={{ color: isOrgSubdomain ? primary : TEAL }}>
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              By creating an account you agree to our{" "}
              <a href="/policies/teachific" className="underline hover:text-slate-600 transition-colors">Terms of Service</a>
              {" "}and{" "}
              <a href="/policies/teachific" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
