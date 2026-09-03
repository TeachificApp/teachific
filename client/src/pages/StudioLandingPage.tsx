import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Video,
  Mic,
  Scissors,
  Captions,
  Zap,
  Download,
  Monitor,
  Camera,
  Sparkles,
  ArrowRight,
  Play,
  Star,
  Users,
  Clock,
  BarChart3,
  ChevronRight,
} from "lucide-react";

// ─── Pricing ──────────────────────────────────────────────────────────────────
const PLAN_FEATURES = [
  "Screen recording (full screen, window, or tab)",
  "Camera recording (webcam overlay or standalone)",
  "Screen + camera simultaneous recording",
  "AI-powered transcription (Whisper)",
  "Transcript-based editing — cut by deleting text",
  "Auto-generate 10 highlight clips from transcript",
  "Closed captions with 8 style presets",
  "Caption color, font, background & opacity controls",
  "Export to MP4 (up to 4K)",
  "Auto-save recordings to Media Library",
  "Snap-to-corner draggable camera bubble",
  "Publish directly to Teachific LMS™",
  "50 GB media storage",
  "Priority email & chat support",
];

const PLANS = [
  {
    id: "pro",
    name: "Teachific Studio™",
    badge: null,
    monthlyPrice: 47,
    annualPrice: 399,
    description: "Everything you need to record, edit, and publish professional training videos — one simple plan.",
    features: PLAN_FEATURES,
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    badge: null,
    monthlyPrice: null,
    annualPrice: null,
    description: "For large organizations with custom requirements.",
    features: [
      "Everything in Teachific Studio™",
      "Unlimited seats",
      "SSO / SAML integration",
      "Unlimited storage",
      "Custom SLA & uptime guarantee",
      "White-label player",
      "Dedicated onboarding & training",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

const FEATURES = [
  {
    icon: Monitor,
    title: "Screen Recording",
    desc: "Capture your full screen, a specific window, or a browser tab in crystal-clear quality — up to 4K.",
  },
  {
    icon: Camera,
    title: "Camera Recording",
    desc: "Record from your webcam as a full-screen feed or as a draggable picture-in-picture bubble overlay.",
  },
  {
    icon: Captions,
    title: "AI Transcription",
    desc: "Whisper-powered transcription generates accurate captions automatically after every recording.",
  },
  {
    icon: Scissors,
    title: "Transcript-Based Editing",
    desc: "Edit your video by editing the transcript — delete words to cut footage, just like editing a document.",
  },
  {
    icon: Zap,
    title: "Auto-Highlight Clips",
    desc: "Studio AI scans your transcript and auto-generates 10 highlight clips for social media or previews.",
  },
  {
    icon: Download,
    title: "MP4 Export",
    desc: "Export finished videos as MP4 with burned-in captions, or as a separate SRT file for any player.",
  },
  {
    icon: BarChart3,
    title: "Caption Style Editor",
    desc: "Choose from 8 caption presets or fully customize font, color, background, opacity, and size.",
  },
  {
    icon: Video,
    title: "Media Library",
    desc: "All recordings auto-save to your Media Library. Organize, search, and reuse clips across projects.",
  },
  {
    icon: Mic,
    title: "Publish to Teachific LMS™",
    desc: "One-click publish your finished video directly to your Teachific school. Live in seconds.",
  },
];

const TESTIMONIALS = [
  {
    name: "James R.",
    role: "L&D Manager",
    company: "TechCorp Global",
    quote:
      "The transcript-based editing is a game-changer. I cut a 30-minute recording down to 12 minutes in under 5 minutes — just by deleting text.",
    stars: 5,
  },
  {
    name: "Anika S.",
    role: "Instructional Designer",
    company: "HealthLearn Inc.",
    quote:
      "Auto-highlight clips save me hours every week. Studio finds the best moments and I just approve them. My learners love the short-form previews.",
    stars: 5,
  },
  {
    name: "Tom W.",
    role: "Freelance Trainer",
    company: "Self-employed",
    quote:
      "At $47/mo I get everything I need: screen + cam recording, captions, and direct publish to my Teachific school. No other tool comes close.",
    stars: 5,
  },
];

export default function StudioLandingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const checkout = trpc.billing.createStudioSingleCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.success("Redirecting to Stripe checkout...");
        window.open(data.checkoutUrl, "_blank");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  function handleCTA(planId: string) {
    if (planId === "enterprise") {
      window.location.href = "mailto:sales@teachific.app";
      return;
    }
    if (user) {
      checkout.mutate({ interval: billing, origin: window.location.origin });
    } else {
      navigate("/register");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-sans">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0f1e]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <span className="text-xl font-bold tracking-tight cursor-pointer">
                <span className="text-white">Teachific</span>
                <span className="text-violet-400"> Studio</span>
                <sup className="text-[10px] text-violet-400 ml-0.5">™</sup>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm text-white/70">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
              <Link href="/studio" className="hover:text-white transition-colors">Dashboard</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/studio">
                  <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">Dashboard</Button>
                </Link>
                <Button
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                  onClick={() => checkout.mutate({ interval: billing, origin: window.location.origin })}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? "Redirecting..." : "Subscribe Now"}
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white font-semibold">
                    Start Free Trial
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-32 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet-600/20 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-violet-500/20 text-violet-300 border-violet-500/30 text-sm px-4 py-1">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Record. Transcribe. Edit. Publish.
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
            Training Videos{" "}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Made Simple
            </span>
          </h1>

          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Teachific Studio™ is a professional screen and camera recording tool with AI transcription,
            transcript-based editing, auto-highlight clips, and one-click publish to your Teachific LMS™.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 h-14 text-base">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 h-14 text-base px-8"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Play className="mr-2 w-5 h-5 fill-current" />
              See Features
            </Button>
          </div>

          <p className="mt-5 text-sm text-white/40">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>

        {/* Mock recorder preview */}
        <div className="relative max-w-5xl mx-auto mt-16">
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-violet-600/10 bg-[#111827]">
            <div className="h-10 bg-[#0d1424] border-b border-white/10 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <div className="ml-4 flex-1 h-5 bg-white/5 rounded text-xs text-white/30 flex items-center px-3">
                Teachific Studio™ — Module 3: Product Demo Recording
              </div>
            </div>
            <div className="flex h-[380px]">
              {/* Transcript panel */}
              <div className="w-64 bg-[#0d1424] border-r border-white/10 p-4 flex flex-col gap-2 overflow-hidden">
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Transcript</p>
                {[
                  { time: "0:00", text: "Welcome to the product demo...", selected: false },
                  { time: "0:12", text: "Today we'll cover the main features", selected: true },
                  { time: "0:28", text: "Starting with the dashboard overview", selected: false },
                  { time: "0:45", text: "Notice the new analytics panel", selected: false },
                  { time: "1:02", text: "You can filter by date range here", selected: false },
                ].map((seg) => (
                  <div
                    key={seg.time}
                    className={`rounded-lg p-2 text-xs border cursor-pointer ${
                      seg.selected
                        ? "border-violet-500 bg-violet-500/20 text-violet-200"
                        : "border-white/5 bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-[10px] text-white/30 block mb-0.5">{seg.time}</span>
                    {seg.text}
                  </div>
                ))}
              </div>
              {/* Video canvas */}
              <div className="flex-1 bg-[#1a2236] flex items-center justify-center relative">
                <div className="w-[480px] h-[270px] bg-gradient-to-br from-[#1a0d3a] to-[#0a1628] rounded-xl border border-white/10 shadow-xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-violet-600/30 flex items-center justify-center">
                      <Play className="w-8 h-8 text-violet-400 fill-current ml-1" />
                    </div>
                  </div>
                  {/* Camera bubble */}
                  <div className="absolute bottom-3 right-3 w-16 h-16 rounded-full border-2 border-violet-500/60 bg-[#0d1424] flex items-center justify-center">
                    <Camera className="w-6 h-6 text-violet-400" />
                  </div>
                  {/* Caption overlay */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1 rounded text-xs text-white whitespace-nowrap">
                    Today we'll cover the main features
                  </div>
                </div>
              </div>
              {/* Timeline */}
              <div className="w-48 bg-[#0d1424] border-l border-white/10 p-4 flex flex-col gap-3">
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Highlight Clips</p>
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] text-violet-400 font-bold">
                      {n}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-white/10 rounded-full mb-1" />
                      <div className="h-1.5 bg-white/5 rounded-full w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "AI", label: "Whisper Transcription" },
            { value: "10", label: "Auto Highlight Clips" },
            { value: "4K", label: "Max Export Quality" },
            { value: "14-day", label: "Free Trial" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl md:text-3xl font-extrabold text-violet-400">{s.value}</p>
              <p className="text-sm text-white/50 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-violet-500/20 text-violet-300 border-violet-500/30">
              Everything You Need
            </Badge>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              Built for Training Video Creators
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Record, transcribe, edit, and publish — all in one place, without leaving your browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Card key={f.title} className="bg-white/5 border-white/10 hover:border-violet-500/40 transition-colors">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison ──────────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-white/5 border-y border-white/10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-10">
            Teachific Studio™ vs. Other Recording Tools
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/60 font-medium">Feature</th>
                  <th className="py-3 px-4 text-violet-400 font-bold">Teachific Studio™</th>
                  <th className="py-3 px-4 text-white/40 font-medium">Other Tools</th>
                  <th className="py-3 px-4 text-white/40 font-medium">Screen Recorders</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Screen + camera recording", true, true, true],
                  ["AI transcription", true, true, false],
                  ["Transcript-based editing", true, true, false],
                  ["Auto-generate highlight clips", true, false, false],
                  ["Direct LMS publish", true, false, false],
                  ["Closed caption style editor", true, false, true],
                  ["Starting price/mo", "$47", "$12.50", "$33"],
                ].map(([feature, ts, other, cam], i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white/70">{feature}</td>
                    {[ts, other, cam].map((val, j) => (
                      <td key={j} className="py-3 px-4 text-center">
                        {typeof val === "boolean" ? (
                          val ? (
                            <CheckCircle2 className="w-5 h-5 text-violet-400 mx-auto" />
                          ) : (
                            <span className="text-white/20">—</span>
                          )
                        ) : (
                          <span className={j === 0 ? "text-violet-400 font-bold" : "text-white/40"}>
                            {val}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-violet-500/20 text-violet-300 border-violet-500/30">
              Simple Pricing
            </Badge>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-white/60 mb-8">
              One plan. All features. 14-day free trial. No credit card required.
            </p>
            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 bg-white/10 rounded-full p-1">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  billing === "monthly" ? "bg-violet-600 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  billing === "annual" ? "bg-violet-600 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Annual
                <span className="ml-1.5 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                  Save 29%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.highlight
                    ? "border-violet-500 bg-gradient-to-b from-violet-600/20 to-violet-600/5 shadow-xl shadow-violet-500/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-violet-600 text-white border-0 text-xs px-3 py-1">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-sm text-white/50 mt-1">{plan.description}</p>
                </div>
                <div className="mb-6">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <span className="text-4xl font-extrabold text-white">
                        ${billing === "monthly" ? plan.monthlyPrice : Math.round((plan.annualPrice ?? 0) / 12)}
                      </span>
                      <span className="text-white/50 text-sm ml-1">/mo</span>
                      {billing === "annual" && (
                        <p className="text-xs text-green-400 mt-1">
                          ${plan.annualPrice}/yr billed annually — save ${(plan.monthlyPrice! * 12) - (plan.annualPrice ?? 0)}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-2xl font-extrabold text-white">Custom</span>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleCTA(plan.id)}
                  disabled={checkout.isPending && plan.id !== "enterprise"}
                  className={`w-full font-semibold ${
                    plan.highlight
                      ? "bg-violet-600 hover:bg-violet-700 text-white"
                      : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  }`}
                >
                  {checkout.isPending && plan.id !== "enterprise" ? "Redirecting..." : plan.cta}
                  <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-20 px-6 bg-white/5 border-y border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-12">
            Loved by Training Video Creators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed mb-4">"{t.quote}"</p>
                  <div>
                    <p className="font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-xs text-white/40">
                      {t.role} · {t.company}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl border border-violet-500/30 bg-gradient-to-b from-violet-600/15 to-transparent p-12">
            <div className="absolute inset-0 rounded-3xl bg-violet-600/5 blur-xl" />
            <div className="relative">
              <Video className="w-12 h-12 text-violet-400 mx-auto mb-6" />
              <h2 className="text-4xl font-extrabold mb-4">
                Start Recording Today
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Join thousands of trainers and instructional designers who use Teachific Studio™ to create
                professional training videos — without the complexity.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-10 h-14 text-base"
                  onClick={() => handleCTA("studio")}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? "Redirecting..." : "Start Your Free Trial"}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Link href="/">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 h-14 text-base px-8"
                  >
                    <Users className="mr-2 w-5 h-5" />
                    View Teachific LMS™
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/40">
                Already have an account?{" "}
                <Link href="/studio" className="text-violet-400 hover:underline">
                  Open Studio
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">
              Course360<span className="text-violet-400"> Studio</span>
              <sup className="text-[10px] text-violet-400">™</sup>
            </span>
            <span className="text-white/30 text-sm">by Course360™</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/" className="hover:text-white transition-colors">Course360 Home</Link>
            <Link href="/creator-pro" className="hover:text-white transition-colors">Course360 Creator™</Link>
            <Link href="/quiz-creator-pro" className="hover:text-white transition-colors">Course360 Quiz Creator™</Link>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} Course360™. All rights reserved. <a href="https://soundmedianow.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">a SoundMedia, Inc. brand</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
