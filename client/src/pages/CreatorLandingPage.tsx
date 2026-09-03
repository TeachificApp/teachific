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
  Layers,
  Zap,
  FileDown,
  BrainCircuit,
  GitBranch,
  MousePointerClick,
  BarChart3,
  Users,
  Globe,
  Lock,
  Play,
  ChevronRight,
  Sparkles,
  BookOpen,
  PenTool,
  Video,
  Image,
  ListChecks,
  ArrowRight,
} from "lucide-react";

// ─── Pricing ──────────────────────────────────────────────────────────────────
const PLAN_FEATURES = [
  "Unlimited projects",
  "Slide editor with 50+ layouts",
  "Quiz & assessment builder (7 question types)",
  "SCORM 1.2 & SCORM 2004 export",
  "HTML5 standalone export",
  "Branching scenarios & dialogue trees",
  "Advanced interactions (hotspot, timeline, drag-drop, flip cards)",
  "Video & audio narration recording",
  "Publish directly to Course360™",
  "AI slide content & quiz generator",
  "Content Library (characters, backgrounds, icons, objects)",
  "Role-Play scenario builder",
  "PowerPoint import & export",
  "Custom themes & brand kit",
  "50 GB media storage",
  "Priority email & chat support",
];

const PLAN = {
  monthlyPrice: 117,
  annualPrice: 999,
  annualMonthly: 83, // 999/12 rounded
  description: "Core tools to build eLearning in one plan.",
  cta: "Start Free Trial",
  // kept for legacy shape compatibility
  id: "pro",
  name: "Course360 Creator™",
  badge: null,
  highlight: true,
  features: PLAN_FEATURES,
};

// Legacy TIERS kept as single-element array so the grid renders the one card
const TIERS = [
  {
    id: "pro",
    name: "Course360 Creator™",
    badge: null,
    monthlyPrice: 117,
    annualPrice: 999,
    description: "Core tools to build eLearning in one plan.",
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
      "Everything in Course360 Creator™",
      "Unlimited seats",
      "SSO / SAML integration",
      "On-premise deployment option",
      "Service-level planning",
      "Unlimited storage",
      "White-label player",
      "Dedicated onboarding & training",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Drag-and-Drop Slide Editor",
    desc: "Build pixel-perfect slides with a rich canvas. Add text, images, video, shapes, and hotspots with intuitive drag-and-drop controls.",
  },
  {
    icon: ListChecks,
    title: "Quiz & Assessment Builder",
    desc: "Create 7 question types: MCQ, True/False, Matching, Hotspot, Fill-in-Blank, Short Answer, and Image Choice — all with scoring and feedback.",
  },
  {
    icon: GitBranch,
    title: "Branching Scenarios",
    desc: "Design non-linear learning paths with dialogue trees and conditional branching. Let learners experience consequences of their choices.",
  },
  {
    icon: MousePointerClick,
    title: "Interactive Elements",
    desc: "Engage learners with tabs, accordions, timelines, flip cards, drag-and-drop activities, and hotspot images — no coding required.",
  },
  {
    icon: FileDown,
    title: "SCORM 1.2 & 2004 Export",
    desc: "Publish standards-compliant SCORM packages that work with any LMS. Full xAPI/Tin Can support coming soon.",
  },
  {
    icon: Globe,
    title: "HTML5 Standalone Export",
    desc: "Export a self-contained HTML5 package that runs in any browser — no LMS required. Perfect for embedding on websites.",
  },
  {
    icon: Zap,
    title: "Publish to Course360™",
    desc: "One-click publishing directly to your Course360™ school. Your course is live and trackable in seconds.",
  },
  {
    icon: BrainCircuit,
    title: "AI Content Generator",
    desc: "Generate slide outlines, quiz questions, and narration scripts from a topic description using built-in AI assistance.",
  },
  {
    icon: Video,
    title: "Video & Audio Narration",
    desc: "Record screen, camera, or audio directly in the browser. Add captions automatically with AI transcription.",
  },
  {
    icon: Image,
    title: "Media Library",
    desc: "Organize images, videos, and audio clips in a centralized library. Search, tag, and reuse assets across all projects.",
  },
  {
    icon: PenTool,
    title: "Custom Themes & Branding",
    desc: "Apply your brand colors, fonts, and logo to every course. Save themes and apply them across your entire project library.",
  },
  {
    icon: BarChart3,
    title: "Preview & Review Mode",
    desc: "Preview your course exactly as learners will see it. Share a review link with stakeholders for feedback before publishing.",
  },
];

export default function CreatorLandingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const checkout = trpc.billing.createCreatorSingleCheckout.useMutation({
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
      window.location.href = "mailto:sales@course360.app";
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
              <span className="text-xl font-bold tracking-tight">
                <span className="text-white">Course360</span>
                <span className="text-[#4ad9e0]">Creator</span>
                <sup className="text-[10px] text-[#4ad9e0] ml-0.5">™</sup>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm text-white/70">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <Link href="/creator" className="hover:text-white transition-colors">Dashboard</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/creator">
                  <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">Dashboard</Button>
                </Link>
                <Button
                  size="sm"
                  className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold"
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
                  <Button size="sm" className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-semibold">
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
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#24abbc]/20 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <Badge className="mb-6 bg-[#24abbc]/20 text-[#4ad9e0] border-[#24abbc]/40 text-sm px-4 py-1">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Browser-based eLearning authoring
          </Badge>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
            Author{" "}
            <span className="bg-gradient-to-r from-[#24abbc] to-[#4ad9e0] bg-clip-text text-transparent">
              SCORM Courses
            </span>
            <br />
            Right in Your Browser
          </h1>

          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Course360 Creator™ is a powerful, web-based eLearning authoring tool. Build interactive
            slides, quizzes, branching scenarios, and publish to SCORM 1.2, SCORM 2004, or HTML5 —
            all from your browser.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/creator">
              <Button size="lg" className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-bold px-8 h-14 text-base">
                Start Building for Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 h-14 text-base px-8"
            >
              <Play className="mr-2 w-5 h-5 fill-current" />
              Watch Demo
            </Button>
          </div>

          <p className="mt-5 text-sm text-white/40">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>

        {/* Mock editor preview */}
        <div className="relative max-w-5xl mx-auto mt-16">
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-[#24abbc]/10 bg-[#111827]">
            {/* Toolbar bar */}
            <div className="h-10 bg-[#0d1424] border-b border-white/10 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <div className="ml-4 flex-1 h-5 bg-white/5 rounded text-xs text-white/30 flex items-center px-3">
                Course360 Creator™ — Module 1: Introduction to eLearning
              </div>
            </div>
            {/* Editor layout */}
            <div className="flex h-[380px]">
              {/* Slide panel */}
              <div className="w-48 bg-[#0d1424] border-r border-white/10 p-3 flex flex-col gap-2 overflow-hidden">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={`rounded-lg h-20 border flex items-center justify-center text-xs font-medium ${
                      n === 1
                        ? "border-[#24abbc] bg-[#24abbc]/10 text-[#4ad9e0]"
                        : "border-white/10 bg-white/5 text-white/30"
                    }`}
                  >
                    Slide {n}
                  </div>
                ))}
              </div>
              {/* Canvas */}
              <div className="flex-1 bg-[#1a2236] flex items-center justify-center relative">
                <div className="w-[480px] h-[270px] bg-gradient-to-br from-[#0d2a3a] to-[#0a1628] rounded-xl border border-white/10 shadow-xl flex flex-col items-center justify-center gap-4 p-8">
                  <div className="w-full h-6 bg-white/10 rounded-full" />
                  <div className="w-3/4 h-4 bg-white/6 rounded-full" />
                  <div className="w-1/2 h-4 bg-white/6 rounded-full" />
                  <div className="mt-4 flex gap-3">
                    <div className="w-24 h-8 bg-[#24abbc]/40 rounded-lg" />
                    <div className="w-24 h-8 bg-white/10 rounded-lg" />
                  </div>
                </div>
              </div>
              {/* Properties panel */}
              <div className="w-56 bg-[#0d1424] border-l border-white/10 p-4 flex flex-col gap-3">
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Properties</p>
                {["Background", "Font", "Animation", "Timing", "Branching"].map((prop) => (
                  <div key={prop} className="flex items-center justify-between">
                    <span className="text-xs text-white/50">{prop}</span>
                    <div className="w-16 h-4 bg-white/10 rounded" />
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
            { value: "Web", label: "Browser-based authoring" },
            { value: "7", label: "Question Types" },
            { value: "SCORM 1.2 & 2004", label: "Export Standards" },
            { value: "14-day", label: "Free Trial" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl md:text-3xl font-extrabold text-[#4ad9e0]">{s.value}</p>
              <p className="text-sm text-white/50 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#24abbc]/20 text-[#4ad9e0] border-[#24abbc]/40">
              Everything You Need
            </Badge>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              Built for Instructional Designers
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Create eLearning materials in your browser with integrated authoring tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Card key={f.title} className="bg-white/5 border-white/10 hover:border-[#24abbc]/40 transition-colors">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-[#24abbc]/20 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-[#4ad9e0]" />
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
            Course360 Creator™ vs. Traditional Authoring Tools
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-white/60 font-medium">Feature</th>
                  <th className="py-3 px-4 text-[#4ad9e0] font-bold">Course360 Creator™</th>
                  <th className="py-3 px-4 text-white/40 font-medium">iSpring Suite</th>
                  <th className="py-3 px-4 text-white/40 font-medium">Articulate 360</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Web-based (no install)", true, false, false],
                  ["SCORM 1.2 & 2004 export", true, true, true],
                  ["HTML5 export", true, true, true],
                  ["Branching scenarios", true, true, true],
                  ["Direct LMS publish", true, false, false],
                  ["AI content generation", true, false, false],
                  ["Team collaboration", true, false, true],
                  ["Starting price/mo", "$117", "$770/yr", "$1,299/yr"],
                ].map(([feature, tc, ispring, art], i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white/70">{feature}</td>
                    {[tc, ispring, art].map((val, j) => (
                      <td key={j} className="py-3 px-4 text-center">
                        {typeof val === "boolean" ? (
                          val ? (
                            <CheckCircle2 className="w-5 h-5 text-[#4ad9e0] mx-auto" />
                          ) : (
                            <span className="text-white/20">—</span>
                          )
                        ) : (
                          <span className={j === 0 ? "text-[#4ad9e0] font-bold" : "text-white/40"}>
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
            <Badge className="mb-4 bg-[#24abbc]/20 text-[#4ad9e0] border-[#24abbc]/40">
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
                  billing === "monthly" ? "bg-[#24abbc] text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  billing === "annual" ? "bg-[#24abbc] text-white" : "text-white/60 hover:text-white"
                }`}
              >
                Annual
                <span className="ml-1.5 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  tier.highlight
                    ? "border-[#24abbc] bg-gradient-to-b from-[#24abbc]/20 to-[#24abbc]/5 shadow-xl shadow-[#24abbc]/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#24abbc] text-white border-0 text-xs px-3 py-1">
                      {tier.badge}
                    </Badge>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                  <p className="text-sm text-white/50 mt-1">{tier.description}</p>
                </div>
                <div className="mb-6">
                  {tier.monthlyPrice !== null ? (
                    <>
                      <span className="text-4xl font-extrabold text-white">
                        ${billing === "monthly" ? tier.monthlyPrice : Math.round((tier.annualPrice ?? 0) / 12)}
                      </span>
                      <span className="text-white/50 text-sm ml-1">/mo</span>
                      {billing === "annual" && (
                        <p className="text-xs text-green-400 mt-1">
                          ${tier.annualPrice}/yr billed annually — save ${(tier.monthlyPrice! * 12) - (tier.annualPrice ?? 0)}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-2xl font-extrabold text-white">Custom</span>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <CheckCircle2 className="w-4 h-4 text-[#4ad9e0] mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleCTA(tier.id)}
                  disabled={checkout.isPending && tier.id !== "enterprise"}
                  className={`w-full font-semibold ${
                    tier.highlight
                      ? "bg-[#24abbc] hover:bg-[#4ad9e0] text-white"
                      : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  }`}
                >
                  {checkout.isPending && tier.id !== "enterprise" ? "Redirecting..." : tier.cta}
                  <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow ────────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-white/5 border-y border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-12">
            From Outline to Learning Experience
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Structure", detail: "Create lessons, arrange content blocks, and build a clear path through each learning objective." },
              { step: "02", title: "Enrich", detail: "Add media, interactive checks, and SCORM-compatible course content within an editable workspace." },
              { step: "03", title: "Review", detail: "Preview the learner experience and publish only when the course is ready for your organization." },
            ].map((item) => (
              <Card key={item.step} className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <p className="text-sm font-black text-[#4ad9e0] mb-4">{item.step}</p>
                  <h3 className="font-semibold text-white text-base mb-2">{item.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{item.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl border border-[#24abbc]/30 bg-gradient-to-b from-[#24abbc]/15 to-transparent p-12">
            <div className="absolute inset-0 rounded-3xl bg-[#24abbc]/5 blur-xl" />
            <div className="relative">
              <BookOpen className="w-12 h-12 text-[#4ad9e0] mx-auto mb-6" />
              <h2 className="text-4xl font-extrabold mb-4">
                Start Authoring Today
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Join instructional designers building with Course360 Creator™.
                No installs. No plugins. Just pure web-based eLearning authoring power.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-[#24abbc] hover:bg-[#4ad9e0] text-white font-bold px-10 h-14 text-base"
                  onClick={() => handleCTA("pro")}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? "Redirecting..." : "Start Your Free Trial"}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Link href="/lms">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 h-14 text-base px-8"
                  >
                    <Users className="mr-2 w-5 h-5" />
                    View Course360™
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/40">
                Already have an account?{" "}
                <Link href="/creator" className="text-[#4ad9e0] hover:underline">
                  Sign in
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
              Course360<span className="text-[#4ad9e0]"> Creator</span>
              <sup className="text-[10px] text-[#4ad9e0]">™</sup>
            </span>
            <span className="text-white/30 text-sm">by Course360™</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/" className="hover:text-white transition-colors">Course360 Home</Link>
            <Link href="/studio-pro" className="hover:text-white transition-colors">Course360 Studio™</Link>
            <Link href="/quiz-creator-pro" className="hover:text-white transition-colors">Quiz Creator™</Link>
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
