import { Link } from "wouter";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { COURSE360_PLATFORM_LOGO_ALT, COURSE360_PLATFORM_LOGO_URL } from "@/config/platformBrand";
import Course360PaidSchoolClaims from "@/components/Course360PaidSchoolClaims";

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
          <h1 className="mt-4 text-2xl font-bold text-white">Finish setting up your school</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">After verified checkout, school setup may take a few moments. This page does not confirm payment or sign you in.</p>
        </div>

        <div className="space-y-6 p-8">
          <div className="flex gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 text-left">
            <Mail className="mt-0.5 h-5 w-5 shrink-0" style={{ color: TEAL }} />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Check your email</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                New account? After checkout is verified, we will send a secure password-setup link to the email used at checkout. Follow that email to finish setting up your account.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Already have an account with that email? Sign in normally with your existing account, verify your email if needed, and claim your new school separately. Check your checkout email for guidance. Checkout does not reset your password or automatically sign you in.
              </p>
            </div>
          </div>

          <div className="flex gap-3 text-left">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm leading-relaxed text-slate-500">
              A card is required at secure Stripe checkout. After checkout is verified, your selected paid plan begins charging automatically after the 14-day trial unless you cancel before it ends. Opening this page or changing its URL does not grant access.
            </p>
          </div>

          <p className="text-sm leading-relaxed text-slate-500">
            Schools purchased with the same email remain separate. There is no automatic school merging or active-school switching; access to each school requires verified membership.
          </p>

          <Course360PaidSchoolClaims />

          <Link
            href="/login"
            className="flex h-11 w-full items-center justify-center rounded-md font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }}
          >
            Go to sign in
          </Link>

          <div className="space-y-2 text-center text-sm leading-relaxed text-slate-500">
            <p>Already signed in? <Link href="/lms" className="font-semibold underline" style={{ color: TEAL }}>Open your dashboard</Link> to view schools you can access.</p>
            <p>Need help signing in? <Link href="/forgot-password" className="font-semibold underline" style={{ color: TEAL }}>Recover your password</Link>.</p>
            <p>If your setup or claim email has not arrived, check your spam folder and allow time for checkout processing. <Link href="/support" className="font-semibold underline" style={{ color: TEAL }}>Contact support</Link> before starting another checkout.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
