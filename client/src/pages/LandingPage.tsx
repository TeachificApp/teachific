import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import LoadingScreen from "@/components/LoadingScreen";
import {
  BookOpen,
  Users,
  BarChart3,
  Zap,
  Shield,
  Globe,
  CheckCircle2,
  X,
  Play,
  Award,
  FileText,
  Video,
  Layers,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Upload,
  Mic,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Brand colors ─────────────────────────────────────────────────────────────
const TEAL = "#24abbc";
const AQUA = "#4ad9e0";

// ─── Navigation ───────────────────────────────────────────────────────────────
function LandingNav({ user }: { user?: { name?: string | null; email?: string | null } | null }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-1 select-none">
          <img
            src="/manus-storage/course360-logo_4b20a5ab.png"
            alt="Course360™"
            className="h-11 w-32 object-contain object-left"
          />
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            How It Works
          </a>
          <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Pricing
          </a>
          {/* Products dropdown */}
          <div className="relative group">
            <button className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1">
              Tools <span className="text-xs opacity-60">&#9662;</span>
            </button>
            <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
              <a href="/creator-pro" className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <span className="text-base mt-0.5">✏️</span>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Course360™ Creator</div>
                  <div className="text-xs text-gray-500">eLearning authoring tool</div>
                </div>
              </a>
              <a href="/studio-pro" className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <span className="text-base mt-0.5">🎦</span>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Course360™ Studio</div>
                  <div className="text-xs text-gray-500">Course authoring &amp; hosting</div>
                </div>
              </a>
              <a href="/quiz-creator-pro" className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <span className="text-base mt-0.5">📝</span>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Course360™ Quiz Creator</div>
                  <div className="text-xs text-gray-500">Standalone quiz builder</div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Auth buttons — context-aware */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-500 hidden sm:block">
                {user.name ?? user.email}
              </span>
              <a
                href="/lms"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-all hover:opacity-90 hover:shadow-md"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }}
              >
                Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </>
          ) : (
            <>
              <a
                href="/login"
                className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                Log In
              </a>
              <a
                href="/register"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-4 py-2 rounded-lg transition-all hover:opacity-90 hover:shadow-md"
                style={{ background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }}
              >
                Create an Account <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section id="hero" className="relative pt-32 pb-24 overflow-hidden bg-white">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl"
          style={{ background: `radial-gradient(circle, ${AQUA}, ${TEAL})` }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-8 blur-3xl"
          style={{ background: `radial-gradient(circle, ${TEAL}, transparent)` }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div
          className="mb-6 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border"
          style={{ color: TEAL, borderColor: `${TEAL}40`, background: `${TEAL}10` }}
        >
          <Sparkles className="w-3 h-3" /> Course tools for online educators
        </div>

        <h1
          className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Build Your Knowledge
          <br />
          <span style={{ color: TEAL }}>Into an Online School</span>
        </h1>

        <p className="max-w-2xl mx-auto text-xl text-gray-500 leading-relaxed mb-10">
          Course360™ provides educators, trainers, and creators with tools to build, sell, and
          deliver online courses.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <a
            href="/register"
            className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-xl text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }}
          >
            Create an Account <ArrowRight className="w-4 h-4" />         </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 text-base font-semibold text-gray-700 px-8 py-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all"
          >
            <Play className="w-4 h-4" style={{ color: TEAL }} /> See How It Works
          </a>
        </div>

        {/* Trust bar */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
          {[
            "Course and quiz tools",
            "Organization workspaces",
            "Plan options",
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" style={{ color: TEAL }} />
              {t}
            </span>
          ))}
        </div>

        {/* Dashboard preview mockup */}
        <div className="mt-16 relative max-w-5xl mx-auto">
          <div className="rounded-2xl border border-gray-200 shadow-2xl overflow-hidden bg-gray-50">
            {/* Browser chrome */}
            <div className="h-8 bg-gray-100 border-b border-gray-200 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-4 h-4 bg-gray-200 rounded-full max-w-xs" />
            </div>
            <div className="flex h-72 sm:h-96">
              {/* Fake sidebar */}
              <div className="w-48 bg-gray-900 p-4 hidden sm:flex flex-col gap-2">
                <div className="h-6 w-24 rounded mb-2" style={{ background: `${TEAL}80` }} />
                {["Dashboard", "Courses", "Members", "Analytics", "Marketing"].map((item) => (
                  <div key={item} className="flex items-center gap-2 px-2 py-1.5 rounded">
                    <div className="w-3 h-3 rounded-sm bg-gray-600" />
                    <div
                      className="h-3 rounded bg-gray-600"
                      style={{ width: `${item.length * 6}px` }}
                    />
                  </div>
                ))}
              </div>
              {/* Fake content area */}
              <div className="flex-1 p-6 bg-white">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Sales tracking", value: "Overview", color: TEAL },
                    { label: "Enrollment tools", value: "Manage", color: AQUA },
                    { label: "Member access", value: "Organize", color: "#6366f1" },
                    { label: "Completion data", value: "Review", color: "#f59e0b" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-gray-100 p-3 bg-gray-50">
                      <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
                      <div className="text-xl font-bold" style={{ color: stat.color }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-gray-100 p-3 bg-gray-50 h-24">
                    <div className="text-xs text-gray-400 mb-2">Activity overview</div>
                    <div className="flex items-end gap-1 h-12">
                      {[40, 65, 45, 80, 60, 90, 75].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t"
                          style={{ height: `${h}%`, background: `${TEAL}60` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-100 p-3 bg-gray-50 h-24">
                    <div className="text-xs text-gray-400 mb-2">Course library</div>
                    {["Course content", "Learner progress"].map((c) => (
                      <div key={c} className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: TEAL }} />
                        <div className="text-xs text-gray-600 truncate">{c}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Floating badges */}
          <div className="absolute -left-4 top-1/3 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 hidden lg:flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: TEAL }} />
            <span className="text-xs font-semibold text-gray-700">Track sales performance</span>
          </div>
          <div className="absolute -right-4 top-1/2 bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 hidden lg:flex items-center gap-2">
            <Award className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-semibold text-gray-700">Monitor learner enrollment</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Wand2,
    title: "AI Course & Page Builder",
    description:
      "Go from idea to income in minutes. Describe your topic and let Course360™ AI generate a complete course outline, lesson content, and a polished sales landing page — ready to publish instantly.",
    color: TEAL,
  },
  {
    icon: BookOpen,
    title: "Powerful Course Builder",
    description:
      "Build multi-section courses with video lessons, quizzes, downloadable resources, and drip scheduling.",
    color: "#10b981",
  },
  {
    icon: Video,
    title: "Course360 Studio™",
    description:
      "Record, edit, and publish video content directly in your browser. Add captions, trim clips, generate highlights, and produce polished lessons without leaving the platform.",
    color: "#6366f1",
  },
  {
    icon: Users,
    title: "Member Management",
    description:
      "Invite students, manage group enrollments, assign roles, track progress, and issue certificates — all from a single, intuitive dashboard.",
    color: "#f59e0b",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description:
      "Understand exactly how learners engage with your content. Track plays, completions, quiz scores, and revenue with beautiful, exportable reports.",
    color: "#10b981",
  },
  {
    icon: Globe,
    title: "Branded School Page",
    description:
      "Launch a fully branded public school page where students can browse your catalog, enroll, and access their courses — all under your name.",
    color: AQUA,
  },
  {
    icon: Zap,
    title: "Marketing & Sales Tools",
    description:
      "Create discount coupons, run email campaigns, build sales funnels, and manage affiliate partners to grow your audience and revenue on autopilot.",
    color: "#ef4444",
  },
  {
    icon: Upload,
    title: "SCORM & HTML5 Support",
    description:
      "Import any SCORM 1.2 or 2004 package, or raw HTML5 content. Course360 serves it securely with full LMS tracking, completion detection, and learner data persistence.",
    color: "#8b5cf6",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description:
      "Role-based access control, secure content delivery, per-file permissions, and session tracking ensure your content is always protected.",
    color: "#0ea5e9",
  },
  {
    icon: Layers,
    title: "Bundles & Memberships",
    description:
      "Package courses into bundles, offer subscription memberships, and create recurring revenue streams that grow while you sleep.",
    color: "#f97316",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div
            className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border"
            style={{ color: TEAL, borderColor: `${TEAL}40`, background: `${TEAL}10` }}
          >
            Everything You Need
          </div>
          <h2
            className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            One platform. Infinite possibilities.
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-gray-500">
            Stop juggling five different tools. Course360™ brings your entire online education
            business under one roof — from content creation to revenue collection.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative p-6 rounded-2xl border border-gray-100 bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Create Your School",
      description:
        "Sign up free and let Course360™ AI generate your branded school page in seconds — logo, colors, tagline, and public URL. Go from blank canvas to live school without touching a design tool.",
      icon: Sparkles,
    },
    {
      number: "02",
      title: "Build Your Courses",
      description:
        "Describe your topic and let Course360™ AI draft a full course outline, lesson content, and a sales landing page. Upload videos, add quizzes, import SCORM, and publish — all in one place.",
      icon: BookOpen,
    },
    {
      number: "03",
      title: "Enroll Your Students",
      description:
        "Invite learners directly, share your public school page, or sell access through our built-in checkout. Group enrollments and memberships make scaling effortless.",
      icon: Users,
    },
    {
      number: "04",
      title: "Track & Grow",
      description:
        "Monitor engagement, completion rates, quiz performance, and revenue in real time. Export reports, run campaigns, and use the data to continuously improve.",
      icon: TrendingUp,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div
            className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border"
            style={{ color: TEAL, borderColor: `${TEAL}40`, background: `${TEAL}10` }}
          >
            Simple Process
          </div>
          <h2
            className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            From idea to income — in no time
          </h2>
          <p className="max-w-xl mx-auto text-lg text-gray-500">
            Course360™ is designed to get you live fast — and keep growing with you as your school
            scales.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative z-10 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${TEAL}20, ${AQUA}20)`,
                    border: `2px solid ${TEAL}30`,
                  }}
                >
                  <Icon className="w-7 h-7" style={{ color: TEAL }} />
                </div>
                <div className="text-xs font-bold tracking-widest mb-2" style={{ color: TEAL }}>
                  {step.number}
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
type PricingTier = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  highlighted: boolean;
  badge?: string;
  features: string[];
};

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    period: "per month",
    description: "A starting plan for creating and publishing courses.",
    cta: "Choose Plan",
    highlighted: false,
    features: [
      "1 course",
      "100 GB storage",
      "Public school page",
      "Video lessons",
      "Quiz builder",
      "Email support",
      "Stripe payments — 0% platform fee",
    ],
  },
  {
    name: "Starter",
    price: "$39",
    period: "per month",
    description: "For creators building their course and membership catalog.",
    cta: "Choose Plan",
    highlighted: false,
    features: [
      "Up to 5 courses",
      "Up to 1,000 students",
      "1 TB storage",
      "1 membership tier",
      "SCORM 1.2 & 2004 support",
      "Stripe payments — 0% platform fee",
    ],
  },
  {
    name: "Builder",
    price: "$99",
    period: "per month",
    description: "For schools using courses, communities, and multiple instructors.",
    cta: "Choose Plan",
    highlighted: true,
    features: [
      "Up to 20 courses",
      "Up to 5,000 students",
      "2 TB storage",
      "3 membership tiers",
      "Community access",
      "Custom domain",
      "White-label branding",
      "Stripe payments — 0% platform fee",
    ],
  },
  {
    name: "Pro",
    price: "$199",
    period: "per month",
    description: "For schools using analytics, email marketing, and broader plan limits.",
    cta: "Choose Plan",
    highlighted: false,
    features: [
      "Up to 50 courses",
      "Up to 15,000 students",
      "5 TB storage",
      "10 membership tiers",
      "Email campaigns",
      "Deep analytics & exports",
      "Affiliate platform",
      "SSO / SAML",
      "Stripe payments — 0% platform fee",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    description: "For organizations that need a custom plan and service configuration.",
    cta: "Contact Sales",
    highlighted: false,
    features: [
      "Custom plan limits",
      "Custom storage allocation",
      "Dedicated account manager",
      "Custom onboarding & training",
      "Service-level planning",
      "Custom integrations & API",
      "Audit logs & compliance reports",
            "Stripe payments — 0% platform fee",
    ],
  },
];
type ComparisonRow = { feature: string; free: boolean | string; starter: boolean | string; builder: boolean | string; pro: boolean | string; enterprise: boolean | string };
const COMPARISON_FEATURES: ComparisonRow[] = [
  { feature: "Courses", free: "1", starter: "5", builder: "20", pro: "50", enterprise: "Unlimited" },
  { feature: "Students", free: "10", starter: "1,000", builder: "5,000", pro: "15,000", enterprise: "Unlimited" },
  { feature: "Storage", free: "100 GB", starter: "1 TB", builder: "2 TB", pro: "5 TB", enterprise: "Unlimited" },
  { feature: "Video lessons", free: true, starter: true, builder: true, pro: true, enterprise: true },
  { feature: "Quiz builder", free: true, starter: true, builder: true, pro: true, enterprise: true },
  { feature: "Public school page", free: true, starter: true, builder: true, pro: true, enterprise: true },
  { feature: "SCORM support", free: false, starter: true, builder: true, pro: true, enterprise: true },
  { feature: "Course360 Studio™", free: false, starter: false, builder: true, pro: true, enterprise: true },
  { feature: "Membership tiers", free: "0", starter: "1", builder: "3", pro: "10", enterprise: "Unlimited" },
  { feature: "Community", free: false, starter: false, builder: true, pro: true, enterprise: true },
  { feature: "Custom domain", free: false, starter: false, builder: true, pro: true, enterprise: true },
  { feature: "White-label branding", free: false, starter: false, builder: true, pro: true, enterprise: true },
  { feature: "Email campaigns", free: false, starter: false, builder: false, pro: true, enterprise: true },
  { feature: "Deep analytics", free: false, starter: false, builder: false, pro: true, enterprise: true },
  { feature: "Affiliate platform", free: false, starter: false, builder: false, pro: true, enterprise: true },
  { feature: "SSO / SAML", free: false, starter: false, builder: false, pro: true, enterprise: true },
  { feature: "Platform transaction fee", free: "0%", starter: "0%", builder: "0%", pro: "0%", enterprise: "0%" },
  { feature: "Stripe payment gateway", free: true, starter: true, builder: true, pro: true, enterprise: true },
  { feature: "Group registrations", free: false, starter: false, builder: false, pro: true, enterprise: true },
  { feature: "Dedicated support", free: false, starter: false, builder: false, pro: false, enterprise: true },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div
            className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border"
            style={{ color: TEAL, borderColor: `${TEAL}40`, background: `${TEAL}10` }}
          >
            Simple Pricing
          </div>
          <h2
            className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Choose a plan for your organization.
          </h2>
          <p className="max-w-xl mx-auto text-lg text-gray-500">
            Review plan features and pricing before choosing an account configuration.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-20 items-start">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                tier.highlighted
                  ? "shadow-2xl border-2"
                  : "border border-gray-200 bg-white"
              }`}
              style={
                tier.highlighted
                  ? {
                      background: `linear-gradient(160deg, #fff 0%, ${TEAL}08 100%)`,
                      borderColor: TEAL,
                    }
                  : {}
              }
            >
              {tier.badge && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white shadow"
                  style={{ background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }}
                >
                  {tier.badge}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span
                    className="text-4xl font-extrabold"
                    style={{
                      color: tier.highlighted ? TEAL : "inherit",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    {tier.price}
                  </span>
                  <span className="text-sm text-gray-400">/ {tier.period}</span>
                </div>
                <p className="text-sm text-gray-500">{tier.description}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2
                      className="w-4 h-4 mt-0.5 shrink-0"
                      style={{ color: TEAL }}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={
                  tier.name === "Enterprise"
                    ? "mailto:hello@course360.app"
                    : "/register"
                }
                className={`w-full text-center py-3 px-6 rounded-xl text-sm font-bold transition-all block ${
                  tier.highlighted
                    ? "text-white shadow-md hover:shadow-lg hover:opacity-90"
                    : "text-gray-700 border border-gray-200 bg-white hover:bg-gray-50"
                }`}
                style={
                  tier.highlighted
                    ? { background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }
                    : {}
                }
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">Full Feature Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 font-semibold text-gray-600 w-1/3">
                    Feature
                  </th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-600">Free</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-600">Starter</th>
                  <th className="text-center px-3 py-3 font-bold" style={{ color: TEAL }}>Builder</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-600">Pro</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-600">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                  >
                    <td className="px-6 py-3 text-gray-700">{row.feature}</td>
                    {(["free", "starter", "builder", "pro", "enterprise"] as const).map((tier) => (
                      <td key={tier} className="px-4 py-3 text-center">
                        {typeof row[tier] === "boolean" ? (
                          row[tier] ? (
                            <CheckCircle2
                              className="w-4 h-4 mx-auto"
                              style={{ color: TEAL }}
                            />
                          ) : (
                            <X className="w-4 h-4 mx-auto text-gray-300" />
                          )
                        ) : (
                          <span
                            className={`font-medium ${tier === "pro" ? "font-semibold" : ""}`}
                            style={tier === "pro" ? { color: TEAL } : { color: "#4b5563" }}
                          >
                            {row[tier] as string}
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
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function CtaSection() {
  return (
    <section
      className="py-24 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${TEAL}, ${AQUA})` }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2
          className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Your school is waiting.
          <br />
          Start building today.
        </h2>
        <p className="text-xl text-white/80 mb-10 max-w-xl mx-auto">
          Use Course360™ to share your expertise, grow an audience, and deliver learning experiences
          from your own branded school.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/register"
            className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-xl bg-white hover:bg-gray-50 shadow-lg transition-all hover:shadow-xl hover:scale-105"
            style={{ color: TEAL }}
          >
            Create Your Account <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="/login"
            className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-xl border-2 border-white/40 text-white hover:bg-white/10 transition-all"
          >
            Already have an account? Log In
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          <div className="sm:col-span-1">
            <div
              className="text-2xl font-extrabold mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <span className="text-white">Course</span>
              <span style={{ color: AQUA }}>360</span>
              <span className="text-white text-lg">™</span>
            </div>
            <p className="text-sm leading-relaxed mb-3">
              Tools for online educators, trainers, and course creators.
            </p>
            <p className="text-xs leading-relaxed text-gray-500">
              Host SCORM 1.2 &amp; SCORM 2004 content, build and sell online courses, manage
              learners, and track completions with a learning management system (LMS).
              Supports HTML5 eLearning, quiz builder, custom subdomains, and course analytics.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
              Platform
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
              Standalone Tools
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/creator-pro" className="hover:text-white transition-colors">
                  Course360™ Creator
                </a>
              </li>
              <li>
                <a href="/studio-pro" className="hover:text-white transition-colors">
                  Course360™ Studio
                </a>
              </li>
              <li>
                <a href="/quiz-creator-pro" className="hover:text-white transition-colors">
                  Course360™ Quiz Creator
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="mailto:hello@course360.app" className="hover:text-white transition-colors">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="/support" className="hover:text-white transition-colors">
                  Support Center
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
              Legal
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/policies" className="hover:text-white transition-colors">
                  All Policies
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} Course360™. All rights reserved. <a href="https://soundmedianow.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">a SoundMedia, Inc. brand</a></p>
          <p className="text-xs">Built for educators, by educators.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Course360™ — Build & Sell Online Courses";
  }, []);

  // Show branded loading screen only while we're waiting for the server
  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white">
      <LandingNav user={user} />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
