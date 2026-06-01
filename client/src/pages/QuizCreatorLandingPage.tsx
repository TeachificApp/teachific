import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Star,
  Users,
  Lock,
  FileDown,
  BarChart3,
  Layers,
  Sparkles,
  ListChecks,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const QUESTION_TYPES = [
  {
    icon: "☑",
    name: "Multiple Choice",
    description:
      "Single or multi-select options with optional image attachments. Supports partial scoring and randomized answer order.",
  },
  {
    icon: "⊙",
    name: "True / False",
    description:
      "Fast binary questions with optional explanation feedback shown after submission.",
  },
  {
    icon: "🔥",
    name: "Hotspot",
    description:
      "Upload any image and define clickable regions. Perfect for anatomy diagrams, equipment labeling, and map-based questions.",
  },
  {
    icon: "⇄",
    name: "Matching",
    description:
      "Drag-and-drop pair builder. Students match terms to definitions, images to labels, or concepts to categories.",
  },
  {
    icon: "___",
    name: "Fill in the Blank",
    description:
      "Inline blanks inside a sentence or paragraph. Supports exact match, case-insensitive, or keyword-based grading.",
  },
  {
    icon: "✏",
    name: "Short Answer",
    description:
      "Open-ended text responses with optional model answer for instructor review or AI-assisted grading.",
  },
  {
    icon: "🖼",
    name: "Image Choice",
    description:
      "Replace text options with images. Ideal for visual identification, specimen recognition, and clinical image interpretation.",
  },
];

const FEATURES = [
  {
    icon: Lock,
    title: "AES-256 Encrypted .quiz Files",
    description:
      "Every quiz exports as a portable, encrypted .quiz file you own. Share it, archive it, or import it into any Teachific LMS course with one click.",
  },
  {
    icon: Sparkles,
    title: "AI Quiz Generator",
    description:
      "Generate complete question sets from a topic, document, or learning objective using built-in AI assistance.",
  },
  {
    icon: BarChart3,
    title: "Detailed Scoring Controls",
    description:
      "Assign custom point values per question, set passing thresholds, enable partial credit, and configure time limits — all from one settings panel.",
  },
  {
    icon: Layers,
    title: "Branching & Conditional Logic",
    description:
      "Route learners to different questions based on their answers. Build adaptive assessments that respond to performance.",
  },
  {
    icon: FileDown,
    title: "XLS Import & Export",
    description:
      "Import question banks from Excel/CSV or export your quiz to XLS for offline review, sharing, or backup.",
  },
  {
    icon: ListChecks,
    title: "Teachific LMS™ Integration",
    description:
      "Publish any .quiz file directly to a Teachific course lesson. Student attempts, scores, and completion data flow back to your LMS gradebook automatically.",
  },
];

// ─── Pricing ──────────────────────────────────────────────────────────────────
const PLAN_FEATURES = [
  "Unlimited quizzes",
  "Unlimited questions per quiz",
  "All 7 question types",
  "AES-256 encrypted .quiz export",
  "XLS import & export",
  "AI quiz generator",
  "Branching & conditional logic",
  "Hotspot region drawing tools",
  "Matching drag-and-drop builder",
  "Student preview mode",
  "Detailed scoring & partial credit",
  "Teachific LMS™ direct publish",
  "50 GB media storage",
  "Priority email & chat support",
];

const PLANS = [
  {
    id: "pro",
    name: "Teachific QuizMaker™",
    badge: null,
    monthlyPrice: 47,
    annualPrice: 399,
    description: "Every question type. Every export format. One simple plan.",
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
      "Everything in Teachific QuizMaker™",
      "Unlimited seats",
      "SSO / SAML integration",
      "White-label quiz player",
      "Unlimited storage",
      "Custom SLA & uptime guarantee",
      "Dedicated onboarding & training",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The hotspot question editor is unlike anything else on the market. I can annotate any diagram or image and turn it into an interactive question in under two minutes.",
    name: "Dr. M. Chen",
    title: "Clinical Educator, Medical Sciences",
    stars: 5,
  },
  {
    quote:
      "I've tried every quiz builder out there. QuizMaker™ is the only one that gives me a portable file I actually own — not locked inside someone else's platform.",
    name: "Prof. A. Okonkwo",
    title: "Medical Education Faculty",
    stars: 5,
  },
  {
    quote:
      "The matching drag-and-drop builder made creating anatomy pairing exercises trivially easy. My students love it and my completion rates went up 40%.",
    name: "T. Nakamura",
    title: "Allied Health Instructor",
    stars: 5,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuizCreatorLandingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <div className="min-h-screen bg-[#0b1d35] text-white font-sans">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#0b1d35]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <span className="text-xl font-black tracking-tight cursor-pointer">
                <span className="text-white">Teachific</span>
                <span className="text-teal-400"> QuizMaker</span>
                <sup className="text-[10px] text-teal-400 ml-0.5">™</sup>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm text-white/70">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
              <Link href="/quiz-creator-app" className="hover:text-white transition-colors">Dashboard</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className=" font-semibold rounded-lg px-4">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 mb-6 text-sm px-4 py-1">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            7 Question Types · Encrypted .quiz Files · Teachific LMS™ Integration
          </Badge>

          <h1 className="text-5xl sm:text-6xl font-black leading-tight mb-6">
            Build Professional Quizzes.
            <br />
            <span className="text-teal-400">Own Every Question.</span>
          </h1>

          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Teachific QuizMaker™ is the standalone quiz authoring tool built for educators who demand more
            than a basic form builder. Create hotspot, matching, and 5 other question types — then export to a
            portable, encrypted .quiz file that belongs to you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button className=" font-bold text-lg px-10 py-4 rounded-xl h-auto">
                Start Free Trial — No Card Required
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/quiz-creator-app">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 text-lg px-10 py-4 rounded-xl h-auto"
              >
                Open the App
              </Button>
            </Link>
          </div>

          <p className="text-white/30 text-sm mt-6">
            14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* ── Social proof bar ── */}
      <section className="border-y border-white/10 py-8 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: "7", label: "Question Types" },
            { value: "AES-256", label: "Encryption Standard" },
            { value: ".quiz", label: "Portable File Format" },
            { value: "14-day", label: "Free Trial" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-black text-teal-400 mb-1">{s.value}</div>
              <div className="text-white/50 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Question Types ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-teal-500/20 text-teal-300 border-teal-500/30">
              Question Types
            </Badge>
            <h2 className="text-4xl font-black mb-4">
              Every Question Type You'll Ever Need
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              From simple multiple choice to complex image hotspots — QuizMaker™ gives you the full toolkit
              to build assessments that actually measure understanding.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {QUESTION_TYPES.map((qt) => (
              <div
                key={qt.name}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-teal-500/40 hover:bg-white/[0.08] transition-all"
              >
                <div className="text-3xl mb-4">{qt.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{qt.name}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{qt.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature deep-dives ── */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-teal-500/20 text-teal-300 border-teal-500/30">
              Everything Included
            </Badge>
            <h2 className="text-4xl font-black mb-4">
              Built for Serious Content Creators
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Teachific QuizMaker™ isn't a form builder with a quiz skin. It's purpose-built authoring software
              for educators who create content professionally.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Card key={f.title} className="bg-white/5 border-white/10 hover:border-teal-500/40 transition-colors">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-teal-400" />
                  </div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hotspot spotlight ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-teal-900/40 to-[#0b1d35] border border-teal-500/20 rounded-3xl p-10 sm:p-14">
            <div className="max-w-2xl">
              <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 mb-6">
                Signature Feature
              </Badge>
              <h2 className="text-4xl font-black mb-6 leading-tight">
                The Hotspot Editor That Changes Everything
              </h2>
              <p className="text-white/70 text-lg leading-relaxed mb-8">
                Upload any image — an anatomy diagram, a piece of medical equipment, a map, a screenshot —
                and draw clickable regions directly on it. Define which regions are correct, add feedback
                for each zone, and set partial scoring. No coding. No external tools. Just click, draw, done.
              </p>
              <p className="text-white/50 text-base leading-relaxed mb-10">
                Hotspot questions are the gold standard for visual assessment in healthcare education,
                engineering training, and technical certification programs. Teachific QuizMaker™ is the only
                standalone tool that makes them this easy to build.
              </p>
              <Link href="/register">
                <Button className=" font-bold px-8 py-3 rounded-xl h-auto">
                  Try the Hotspot Editor Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 px-6 bg-white/[0.02] border-y border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-black text-center mb-16">
            Trusted by Educators Who Create at Scale
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="bg-white/5 border-white/10">
                <CardContent className="p-7 flex flex-col gap-4">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed italic">"{t.quote}"</p>
                  <div className="mt-auto">
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-white/40 text-xs">{t.title}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-teal-500/20 text-teal-300 border-teal-500/30">
              Simple Pricing
            </Badge>
            <h2 className="text-4xl font-black mb-4">Simple, Transparent Pricing</h2>
            <p className="text-white/60 text-lg mb-8">
              One plan. All features. 14-day free trial. No credit card required.
            </p>
            {/* Toggle */}
            <div className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full p-1">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === "monthly" ? "bg-teal-500 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === "annual" ? "bg-teal-500 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                Annual{" "}
                <span className="ml-1 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                  Save 29%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 flex flex-col gap-6 border transition-all ${
                  plan.highlight
                    ? "bg-teal-500/10 border-teal-500/40 shadow-lg shadow-teal-500/10"
                    : "bg-white/5 border-white/10"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-teal-500 text-white border-0 px-4 text-xs font-bold">
                      All Features Included
                    </Badge>
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
                  <p className="text-white/50 text-sm">{plan.description}</p>
                </div>

                <div className="flex items-end gap-1">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <span className="text-4xl font-black text-white">
                        ${billing === "monthly" ? plan.monthlyPrice : Math.round((plan.annualPrice ?? 0) / 12)}
                      </span>
                      <span className="text-white/40 text-sm mb-1">/mo</span>
                      {billing === "annual" && (
                        <span className="text-xs text-green-400 mb-1 ml-2">
                          ${plan.annualPrice}/yr — save ${(plan.monthlyPrice * 12) - (plan.annualPrice ?? 0)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-3xl font-black text-white">Custom</span>
                  )}
                </div>

                <Link href={plan.id === "enterprise" ? "mailto:sales@teachific.app" : "/register"}>
                  <Button
                    className={`w-full font-semibold rounded-xl py-3 h-auto ${
                      plan.highlight
                        ? "bg-teal-500 hover:bg-teal-400 text-white"
                        : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                    }`}
                  >
                    {plan.cta}
                    <ChevronRight className="ml-1 w-4 h-4" />
                  </Button>
                </Link>

                <ul className="flex flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-6 py-4 text-white/60 font-medium">Feature</th>
                  <th className="text-center px-4 py-4 text-teal-400 font-bold">Teachific QuizMaker™</th>
                  <th className="text-center px-4 py-4 text-white/40 font-medium">Google Forms</th>
                  <th className="text-center px-4 py-4 text-white/40 font-medium">Typeform</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Hotspot questions", true, false, false],
                  ["Matching drag-and-drop", true, false, false],
                  ["Encrypted portable file export", true, false, false],
                  ["XLS import & export", true, false, false],
                  ["Branching & conditional logic", true, false, true],
                  ["Teachific LMS™ integration", true, false, false],
                  ["AI quiz generator", true, false, false],
                  ["Starting price/mo", "$47", "Free", "$25"],
                ].map(([feature, qc, gf, tf], i) => (
                  <tr
                    key={i}
                    className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                  >
                    <td className="px-6 py-3 text-white/70">{feature}</td>
                    {[qc, gf, tf].map((val, j) => (
                      <td key={j} className="px-4 py-3 text-center">
                        {typeof val === "boolean" ? (
                          val ? (
                            <CheckCircle2 className="w-5 h-5 text-teal-400 mx-auto" />
                          ) : (
                            <span className="text-white/20">—</span>
                          )
                        ) : (
                          <span className={j === 0 ? "text-teal-400 font-bold" : "text-white/40"}>
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

      {/* ── Final CTA ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent to-teal-900/20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative rounded-3xl border border-teal-500/30 bg-gradient-to-b from-teal-500/15 to-transparent p-12">
            <div className="absolute inset-0 rounded-3xl bg-teal-500/5 blur-xl" />
            <div className="relative">
              <ListChecks className="w-12 h-12 text-teal-400 mx-auto mb-6" />
              <h2 className="text-4xl font-black mb-6">
                Start Building Better Assessments Today
              </h2>
              <p className="text-white/60 text-lg mb-10 leading-relaxed">
                Join educators who have moved beyond basic quiz forms. Teachific QuizMaker™ gives you the
                authoring power to build assessments that are as sophisticated as the subjects you teach.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register">
                  <Button className=" font-bold text-lg px-10 py-4 rounded-xl h-auto">
                    Start Your Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/">
                  <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 text-lg px-10 py-4 rounded-xl h-auto"
                  >
                    <Users className="mr-2 w-5 h-5" />
                    View Teachific LMS™
                  </Button>
                </Link>
              </div>
              <p className="text-white/30 text-sm mt-6">14-day free trial · No credit card required · Cancel anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">
              <span className="text-white">Teachific</span>
              <span className="text-teal-400"> QuizMaker</span>
              <sup className="text-[10px] text-teal-400">™</sup>
            </span>
            <span className="text-white/30 text-sm">by Teachific™</span>
          </div>
          <div className="flex items-center gap-6 text-white/40 text-sm">
            <Link href="/" className="hover:text-white transition-colors">Teachific Home</Link>
            <Link href="/creator-pro" className="hover:text-white transition-colors">TeachificCreator™</Link>
            <Link href="/studio-pro" className="hover:text-white transition-colors">Teachific Studio™</Link>
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-white transition-colors">Register</Link>
          </div>
          <p className="text-white/30 text-xs">© {new Date().getFullYear()} Teachific™. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
