import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { useOrgAuthBranding } from "@/hooks/useOrgAuthBranding";

const NAVY = "#0b1d35";
const NAVY_MID = "#0f2847";
const TEAL = "#24abbc";
const TEAL_LIGHT = "#4ad9e0";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  const { branding, primary, buttonText, displayName } = useOrgAuthBranding();
  const isOrgSubdomain = !!branding;

  const verify = trpc.customAuth.verifyEmail.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setMessage(data.message);
    },
    onError: (err) => {
      setStatus("error");
      setMessage(err.message);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      verify.mutate({ token: t });
    } else {
      setStatus("error");
      setMessage("Invalid or missing verification token.");
    }
  }, []);

  return (
    <div className="min-h-screen flex">
      {/* Left panel (hidden on org subdomains) */}
      {!isOrgSubdomain && <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: `linear-gradient(145deg, ${NAVY} 0%, ${NAVY_MID} 60%, #0d3352 100%)` }}
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, ${TEAL_LIGHT}, transparent 70%)` }} />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-8"
          style={{ background: `radial-gradient(circle, ${TEAL}, transparent 70%)` }} />

        <div className="relative z-10">
          <div className="flex items-baseline gap-0.5">
            <span className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>teach</span>
            <span className="text-3xl font-bold tracking-tight" style={{ color: TEAL_LIGHT, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ific</span>
            <span className="text-sm font-bold ml-0.5" style={{ color: TEAL_LIGHT, verticalAlign: "super", fontSize: "0.55em" }}>™</span>
          </div>
          <p className="text-xs font-semibold tracking-widest uppercase mt-1" style={{ color: `${TEAL_LIGHT}80` }}>Learning Management Platform</p>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: `${TEAL}25`, border: `1px solid ${TEAL}40` }}>
            <ShieldCheck className="w-8 h-8" style={{ color: TEAL_LIGHT }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Almost there.<br />
              <span style={{ color: TEAL_LIGHT }}>Verify your email.</span>
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-sm">
              We're confirming your email address to keep your account secure. This only takes a second.
            </p>
          </div>
        </div>

        <p className="relative z-10 text-white/25 text-xs">© {new Date().getFullYear()} Course360™. All rights reserved. <a href="https://soundmedianow.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">a SoundMedia, Inc. brand</a></p>
      </div>}

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-8 py-12">
        <div className="mb-8 text-center">
          {isOrgSubdomain ? (
            branding?.logoUrl ? (
              <img src={branding.logoUrl} alt={displayName} className="h-12 max-w-[200px] object-contain mx-auto" />
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

        <div className="w-full max-w-sm text-center">
          {status === "loading" && (
            <div className="space-y-4">
              <Loader2 className="w-16 h-16 mx-auto animate-spin" style={{ color: TEAL }} />
              <h2 className="text-2xl font-bold" style={{ color: NAVY, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Verifying your email...</h2>
              <p className="text-slate-500">Please wait a moment.</p>
            </div>
          )}
          {status === "success" && (
            <div className="space-y-4">
              <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: TEAL }} />
              <h2 className="text-2xl font-bold" style={{ color: NAVY, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Email verified!</h2>
              <p className="text-slate-500 leading-relaxed">{message}</p>
              <Link href="/login">
                <Button className="font-semibold w-full mt-4" style={{ background: isOrgSubdomain ? primary : `linear-gradient(135deg, ${TEAL} 0%, #15b8c0 100%)`, color: buttonText }}>
                  Sign In to Your Account
                </Button>
              </Link>
            </div>
          )}
          {status === "error" && (
            <div className="space-y-4">
              <XCircle className="w-16 h-16 mx-auto text-red-500" />
              <h2 className="text-2xl font-bold" style={{ color: NAVY, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Verification failed</h2>
              <p className="text-slate-500 leading-relaxed">{message}</p>
              <Link href="/login">
                <Button className="font-semibold w-full mt-4" style={{ background: isOrgSubdomain ? primary : `linear-gradient(135deg, ${TEAL} 0%, #15b8c0 100%)`, color: buttonText }}>
                  Back to Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
