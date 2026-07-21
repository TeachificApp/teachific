import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Layers, Star, Download, CheckCircle, BookOpen, Video, FileText, Users, Package, Zap, ArrowRight, Clock, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  course: BookOpen,
  webinar: Video,
  download: FileText,
  membership: Users,
  bundle: Package,
  funnel: Zap,
};

const CATEGORY_LABELS: Record<string, string> = {
  course: "Course Blueprint",
  webinar: "Webinar Blueprint",
  download: "Digital Download Blueprint",
  membership: "Membership Blueprint",
  bundle: "Bundle Blueprint",
  funnel: "Funnel Blueprint",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "Beginner-friendly",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

interface BlueprintLandingPageProps {
  slug: string;
}

export default function BlueprintLandingPage({ slug }: BlueprintLandingPageProps) {
  const [, setLocation] = useLocation();
  const [clicked, setClicked] = useState(false);

  const { data, isLoading, error } = trpc.blueprintReferrals.getLandingPage.useQuery({ slug });
  const trackClick = trpc.blueprintReferrals.trackClick.useMutation();
  const createPending = trpc.blueprintReferrals.createPendingInstall.useMutation();

  // Track the page view as a click once on mount
  useEffect(() => {
    if (!clicked && slug) {
      setClicked(true);
      trackClick.mutate({ slug });
    }
  }, [slug]);

  function handleGetStarted() {
    if (!data) return;
    createPending.mutate(
      {
        blueprintId: data.blueprint.id,
        referralLinkId: data.referralLinkId,
      },
      {
        onSuccess: (result) => {
          // Store the session token in localStorage so RegisterPage can pick it up
          localStorage.setItem("blueprint_install_token", result.sessionToken);
          localStorage.setItem("blueprint_install_name", data.blueprint.title);
          // Redirect to register page on the root domain
          const rootDomain = window.location.hostname.replace(/^[^.]+\./, "");
          const protocol = window.location.protocol;
          window.location.href = `${protocol}//${rootDomain}/register?blueprint=${result.sessionToken}&bp_name=${encodeURIComponent(data.blueprint.title)}`;
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#24abbc]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 text-center px-4">
        <Layers className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Blueprint Not Found</h1>
        <p className="text-muted-foreground mb-6">This blueprint link may have expired or been removed.</p>
        <Button onClick={() => window.location.href = "https://teachific.app"}>
          Go to Teachific
        </Button>
      </div>
    );
  }

  const { blueprint } = data;
  const CategoryIcon = CATEGORY_ICONS[blueprint.category ?? "course"] ?? Package;
  const isFree = blueprint.pricingType === "free" || !blueprint.price;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      {/* Nav */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="https://teachific.app" className="flex items-center gap-1.5 font-bold text-lg">
            <span className="text-slate-900">teach</span>
            <span className="text-[#24abbc]">ific</span>
            <span className="text-slate-900 text-sm">™</span>
          </a>
          <Button size="sm" onClick={handleGetStarted} disabled={createPending.isPending}>
            {createPending.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Started Free"}
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 pt-16 pb-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-[#24abbc]/10">
                <CategoryIcon className="w-5 h-5 text-[#24abbc]" />
              </div>
              <Badge variant="secondary" className="text-sm">
                {CATEGORY_LABELS[blueprint.category ?? "course"] ?? "Blueprint"}
              </Badge>
            </div>

            <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
              {blueprint.title}
            </h1>

            {blueprint.shortDescription && (
              <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                {blueprint.shortDescription}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-8">
              {blueprint.setupTimeEstimate && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Setup in {blueprint.setupTimeEstimate}</span>
                </div>
              )}
              {blueprint.difficultyLevel && (
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" />
                  <span>{DIFFICULTY_LABELS[blueprint.difficultyLevel] ?? blueprint.difficultyLevel}</span>
                </div>
              )}
              {blueprint.installCount != null && blueprint.installCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Download className="w-4 h-4" />
                  <span>{blueprint.installCount} schools built</span>
                </div>
              )}
              {blueprint.averageRating != null && (
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span>{blueprint.averageRating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="bg-[#24abbc] hover:bg-[#1d8f9e] text-white text-base px-8"
                onClick={handleGetStarted}
                disabled={createPending.isPending}
              >
                {createPending.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Preparing...</>
                ) : (
                  <>
                    {isFree ? "Install Free" : `Get for $${blueprint.price}`}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-sm text-slate-500 self-center">
                {isFree ? "No credit card required" : "Includes Teachific account"}
              </p>
            </div>
          </div>

          {/* Preview image */}
          <div className="relative">
            {blueprint.thumbnailUrl ? (
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-white">
                <img
                  src={blueprint.thumbnailUrl}
                  alt={blueprint.title}
                  className="w-full object-cover"
                />
              </div>
            ) : (
              <div className="rounded-2xl bg-gradient-to-br from-[#24abbc]/20 to-teal-100 aspect-video flex items-center justify-center shadow-xl border border-white">
                <div className="text-center">
                  <Layers className="w-16 h-16 text-[#24abbc]/50 mx-auto mb-3" />
                  <p className="text-[#24abbc]/70 font-medium">Blueprint Preview</p>
                </div>
              </div>
            )}

            {/* Floating "ready in X" badge */}
            {blueprint.setupTimeEstimate && (
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg border px-4 py-2.5 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-xs text-slate-500">Ready in</p>
                  <p className="text-sm font-bold text-slate-900">{blueprint.setupTimeEstimate}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full description */}
      {blueprint.fullDescription && (
        <div className="max-w-5xl mx-auto px-4 py-12 border-t">
          <h2 className="text-2xl font-bold mb-6">About This Blueprint</h2>
          <div
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: blueprint.fullDescription }}
          />
        </div>
      )}

      {/* What's included */}
      <div className="max-w-5xl mx-auto px-4 py-12 border-t">
        <h2 className="text-2xl font-bold mb-2">What's included</h2>
        <p className="text-slate-500 mb-8">
          Everything you need to launch your school — pre-built and ready to customize.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: CheckCircle, title: "Complete course structure", desc: "Modules, lessons, and learning objectives pre-organized" },
            { icon: CheckCircle, title: "Sales landing page", desc: "Conversion-optimized page ready to publish" },
            { icon: CheckCircle, title: "Checkout flow", desc: "Payment processing wired and ready" },
            { icon: CheckCircle, title: "Email sequences", desc: "Welcome and drip emails pre-written" },
            { icon: CheckCircle, title: "Branding templates", desc: "Customize colors and logo in minutes" },
            { icon: CheckCircle, title: "Analytics dashboard", desc: "Track enrollments, completions, and revenue" },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 p-4 rounded-xl bg-white border shadow-sm">
              <item.icon className="w-5 h-5 text-[#24abbc] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-gradient-to-r from-[#24abbc] to-teal-500 py-16 mt-8">
        <div className="max-w-2xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-3">Ready to launch your school?</h2>
          <p className="text-white/80 mb-8 text-lg">
            Create your free Teachific account and this blueprint will be installed automatically.
          </p>
          <Button
            size="lg"
            variant="outline"
            className="bg-white text-[#24abbc] hover:bg-white/90 border-white text-base px-10"
            onClick={handleGetStarted}
            disabled={createPending.isPending}
          >
            {createPending.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Preparing...</>
            ) : (
              <>{isFree ? "Get Started Free" : `Get Started — $${blueprint.price}`}<ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
          <p className="text-white/60 text-sm mt-3">No credit card required for free blueprints</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-slate-400">
        <a href="https://teachific.app" className="hover:text-[#24abbc] transition-colors">
          Powered by Teachific™
        </a>
        {" · "}
        <a href="https://teachific.app/privacy" className="hover:text-[#24abbc] transition-colors">Privacy</a>
        {" · "}
        <a href="https://teachific.app/terms" className="hover:text-[#24abbc] transition-colors">Terms</a>
      </footer>
    </div>
  );
}
