import { Link } from "wouter";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { COURSE360_PLATFORM_LOGO_ALT, COURSE360_PLATFORM_LOGO_URL } from "@/config/platformBrand";

const NAVY = "#0b1d35";
const TEAL = "#24abbc";
const AQUA = "#4ad9e0";

/**
 * Stripe redirects here after a platform trial checkout. Account and school
 * creation remains webhook-authoritative, so this page intentionally exposes no
 * purchaser data and never tries to fulfill a checkout from the browser.
 */
export default function AccountSetupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="p-8 text-center" style={{ background: `linear-gradient(145deg, ${NAVY}, #0f2847)` }}>
          <img
            src={COURSE360_PLATFORM_LOGO_URL}
            alt={COURSE360_PLATFORM_LOGO_ALT}
            className="mx-auto h-14 w-auto rounded-lg bg-white p-1 object-contain"
          />
          <div className="mt-6 flex justify-center">
            <span className="rounded-full border border-white/20 bg-white/10 p-3">
              <CheckCircle2 className="h-8 w-8" style={{ color: AQUA }} />
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Your trial checkout is complete</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">We are securely setting up your Course360 school.</p>
        </div>

        <div className="space-y-6 p-8">
          <div className="flex gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 text-left">
            <Mail className="mt-0.5 h-5 w-5 shrink-0" style={{ color: TEAL }} />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Check your email</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                We will send a secure password-setup link to the email used at checkout. Open it to sign in to your new school.
              </p>
            </div>
          </div>

          <div className="flex gap-3 text-left">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm leading-relaxed text-slate-500">
              Your card was securely collected by Stripe. Your selected paid plan starts automatically after the 14-day trial unless you cancel before it ends.
            </p>
          </div>

          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center rounded-md font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }}
          >
            Go to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
