import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { getSubdomain } from "@/hooks/useSubdomain";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { toast } from "sonner";
import { OrderBumpOffer, OrderBumpInterstitial } from "@/components/OrderBumpOffer";
import {
  ChevronLeft,
  Star,
  Clock,
  BookOpen,
  Play,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock,
  Users,
  Award,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type EnrollFn = (pricingId?: number, price?: number) => void;
type LegalDocs = {
  termsOfService?: string | null;
  privacyPolicy?: string | null;
  requireTermsAgreement?: boolean | null;
} | null | undefined;

// ─── Block Renderer (student-facing, read-only) ───────────────────────────────

function RenderBlock({ block, primaryColor, curriculum, pricing, legalDocs, onEnroll, course }: {
  block: any;
  primaryColor: string;
  curriculum: any[];
  pricing: any[];
  legalDocs?: LegalDocs;
  onEnroll?: EnrollFn;
  course?: any;
}) {
  const d = block.data;
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  switch (block.type) {
    case "banner": {
      const isVid = d.backgroundType === "video" && d.backgroundVideoUrl;
      const bannerBg = d.backgroundType === "gradient"
        ? { background: `linear-gradient(${d.gradientDirection || "to bottom right"}, ${d.gradientFrom || "#1e293b"}, ${d.gradientTo || "#6366f1"})` }
        : d.backgroundType === "image" && (d.backgroundImageUrl || d.imageUrl)
        ? { backgroundImage: `url(${d.backgroundImageUrl || d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
        : isVid ? { backgroundColor: "#000" }
        : { backgroundColor: d.backgroundColor || d.bgColor || primaryColor };
      const h1c = d.headlineColor || d.textColor || "#fff";
      const h2c = d.headline2Color || d.textColor || "#fff";
      const hasInline = d.inlineMediaUrl && d.inlineMediaType;
      return (
        <div
          className="relative w-full min-h-[320px] flex items-center justify-center px-8 py-16"
          style={{ ...bannerBg, color: d.textColor || "#fff" }}
        >
          {isVid && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0" src={d.backgroundVideoUrl} />
          )}
          {(d.backgroundType === "image" || d.imageUrl || isVid) && d.overlay !== false && (
            <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${d.overlayOpacity ?? 0.5})` }} />
          )}
          <div className={`relative z-10 animate-fade-in-up w-full ${hasInline ? "flex items-center gap-10 max-w-5xl" : "flex flex-col items-center gap-5 max-w-3xl text-center"}`} style={{ flexDirection: hasInline && d.inlineMediaPosition === "left" ? "row-reverse" : "row" }}>
            <div className={hasInline ? "flex-1" : ""}>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight" style={{ color: h1c }}>{d.headline}</h1>
              {d.headline2 && <h1 className="text-4xl md:text-5xl font-bold leading-tight mt-1" style={{ color: h2c }}>{d.headline2}</h1>}
              {(d.subheadline || d.subtext) && <p className="text-xl opacity-90 mt-4">{d.subheadline || d.subtext}</p>}
              {d.ctaText && (
                <a href={d.ctaUrl || "#pricing"} className="inline-block mt-4">
                  <button
                    className="px-8 py-3 rounded-full font-semibold text-base"
                    style={{ backgroundColor: d.ctaBgColor || "rgba(255,255,255,0.2)", color: d.ctaTextColor || "#fff", border: d.ctaBgColor ? "none" : "2px solid rgba(255,255,255,0.7)" }}
                  >
                    {d.ctaText}
                  </button>
                </a>
              )}
            </div>
            {hasInline && (
              <div className="flex-1 flex justify-center">
                {d.inlineMediaType.startsWith("video") ? (
                  <video autoPlay muted loop playsInline className="max-w-full max-h-[320px] rounded-xl" src={d.inlineMediaUrl} />
                ) : (
                  <img src={d.inlineMediaUrl} alt="" className="max-w-full max-h-[320px] rounded-xl object-cover" />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    case "text":
      return (
        <div className={`flex gap-8 items-start ${d.imagePosition === "left" ? "flex-row-reverse" : "flex-row"}`}>
          <div className="flex-1">
            {d.heading && <h2 className="text-2xl font-bold mb-3">{d.heading}</h2>}
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{d.body}</p>
          </div>
          {d.imageUrl && (
            <div className="w-64 shrink-0">
              <img src={d.imageUrl} alt="" className="rounded-xl w-full object-cover shadow-md" />
            </div>
          )}
        </div>
      );

    case "video":
      return (
        <div className="flex flex-col gap-3">
          <div className="aspect-video bg-muted rounded-xl overflow-hidden shadow-md">
            {d.url ? (
              <iframe src={d.url} className="w-full h-full" allowFullScreen />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Play className="h-12 w-12" />
              </div>
            )}
          </div>
          {d.caption && <p className="text-sm text-muted-foreground text-center">{d.caption}</p>}
        </div>
      );

    case "curriculum": {
      return (
        <div>
          <h2 className="text-2xl font-bold mb-6">{d.heading || "Course Curriculum"}</h2>
          {curriculum.length === 0 ? (
            <p className="text-muted-foreground text-sm">Curriculum coming soon.</p>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {curriculum.map((section: any, si: number) => (
                <div key={section.id}>
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setExpandedSections((s) => ({ ...s, [si]: !s[si] }))}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{section.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {section.lessons?.length || 0} lessons
                      </span>
                    </div>
                    {expandedSections[si] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {expandedSections[si] && (
                    <div className="bg-muted/20 divide-y divide-border/50">
                      {(section.lessons || []).map((lesson: any) => (
                        <div key={lesson.id} className="flex items-center gap-3 px-5 py-3">
                          {lesson.isFreePreview ? (
                            <Play className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                          ) : (
                            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm flex-1">{lesson.title}</span>
                          {lesson.isFreePreview && (
                            <Badge variant="outline" className="text-xs" style={{ borderColor: primaryColor, color: primaryColor }}>
                              Free Preview
                            </Badge>
                          )}
                          {lesson.durationMinutes && (
                            <span className="text-xs text-muted-foreground">{lesson.durationMinutes}m</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "pricing": {
      const requireAgreement = legalDocs?.requireTermsAgreement;
      const [agreed, setAgreed] = useState(false);
      const [termsOpen, setTermsOpen] = useState(false);
      const [privacyOpen, setPrivacyOpen] = useState(false);
      return (
        <div id="pricing">
          <h2 className="text-2xl font-bold mb-2">{d.heading || "Pricing Options"}</h2>
          {d.subheading && <p className="text-muted-foreground mb-6">{d.subheading}</p>}
          {pricing.length === 0 ? (
            <p className="text-muted-foreground text-sm">Pricing options coming soon.</p>
          ) : (
            <div className="space-y-4">
              {requireAgreement && (
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border">
                  <Checkbox
                    id="policy-agree"
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(!!v)}
                    className="mt-0.5"
                  />
                  <label htmlFor="policy-agree" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                    I have read and agree to the{" "}
                    {legalDocs?.termsOfService && (
                      <button
                        type="button"
                        onClick={() => setTermsOpen(true)}
                        className="underline text-foreground hover:text-primary font-medium"
                      >
                        Terms of Service
                      </button>
                    )}
                    {legalDocs?.termsOfService && legalDocs?.privacyPolicy && " and "}
                    {legalDocs?.privacyPolicy && (
                      <button
                        type="button"
                        onClick={() => setPrivacyOpen(true)}
                        className="underline text-foreground hover:text-primary font-medium"
                      >
                        Privacy Policy
                      </button>
                    )}
                    {!legalDocs?.termsOfService && !legalDocs?.privacyPolicy && " site policies"}
                  </label>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pricing.map((p: any) => (
                  <div key={p.id} className="border-2 border-border rounded-xl p-6 hover:border-primary transition-colors">
                    <p className="font-semibold text-lg">{p.name || "Standard"}</p>
                    <div className="mt-2 mb-4">
                      <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                        ${p.price}
                      </span>
                      {p.billingInterval && (
                        <span className="text-muted-foreground text-sm ml-1">/{p.billingInterval}</span>
                      )}
                    </div>
                    {p.description && <p className="text-sm text-muted-foreground mb-4">{p.description}</p>}
                  <Button
                    className="w-full text-white"
                    style={{ backgroundColor: primaryColor }}
                    disabled={requireAgreement ? !agreed : false}
                    title={requireAgreement && !agreed ? "Please agree to the policies above to continue" : undefined}
                    onClick={() => onEnroll?.(p.id, p.price)}
                  >
                    {p.price > 0 ? `Enroll — $${p.price}` : "Enroll Free"}
                  </Button>
                  {/* Course meta below enroll button */}
                  <div className="mt-4 flex flex-col gap-2">
                    {(() => {
                      const totalLessons = curriculum.reduce((acc: number, s: any) => acc + (s.lessons?.length || 0), 0);
                      return totalLessons > 0 ? (
                        <div className="flex items-center gap-2 text-sm" style={{ color: primaryColor }}>
                          <BookOpen className="h-4 w-4 shrink-0" />
                          <span>{totalLessons} lesson{totalLessons !== 1 ? 's' : ''}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center gap-2 text-sm" style={{ color: primaryColor }}>
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        {!course || course.accessDurationType === 'lifetime'
                          ? 'Full lifetime access'
                          : course.accessDurationType === 'days' && course.accessDurationDays
                          ? `Access for ${course.accessDurationDays} days`
                          : course.accessDurationType === 'date' && course.accessExpiryDate
                          ? `Access until ${new Date(course.accessExpiryDate).toLocaleDateString()}`
                          : 'Full lifetime access'}
                      </span>
                    </div>
                  </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Terms of Service Dialog */}
          <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Terms of Service</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="prose prose-sm max-w-none p-1" dangerouslySetInnerHTML={{ __html: legalDocs?.termsOfService || "" }} />
              </ScrollArea>
            </DialogContent>
          </Dialog>
          {/* Privacy Policy Dialog */}
          <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Privacy Policy</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="prose prose-sm max-w-none p-1" dangerouslySetInnerHTML={{ __html: legalDocs?.privacyPolicy || "" }} />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    case "testimonials":
      return (
        <div>
          <h2 className="text-2xl font-bold mb-6">{d.heading || "What Students Say"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(d.testimonials || []).map((t: any, i: number) => (
              <div key={i} className="border border-border rounded-xl p-5">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(t.rating || 5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-muted-foreground italic leading-relaxed">"{t.text}"</p>
                <p className="text-sm font-semibold mt-3">— {t.name}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "cta":
      return (
        <div
          className="rounded-2xl p-10 text-center text-white"
          style={{ backgroundColor: d.bgColor || primaryColor }}
        >
          <h2 className="text-3xl font-bold">{d.heading || "Ready to get started?"}</h2>
          {d.subheading && <p className="mt-3 text-lg opacity-90">{d.subheading}</p>}
          <a href={d.ctaUrl || "#pricing"}>
            <button
              className="mt-6 px-10 py-3 bg-white rounded-full font-semibold text-base"
              style={{ color: d.bgColor || primaryColor }}
            >
              {d.ctaText || "Enroll Now"}
            </button>
          </a>
        </div>
      );

    case "instructor":
      return (
        <div className="flex gap-6 items-start">
          <div className="h-20 w-20 rounded-full bg-muted shrink-0 overflow-hidden">
            {d.avatarUrl ? (
              <img src={d.avatarUrl} alt={d.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-muted-foreground">
                {(d.name || "I")[0]}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{d.heading || "Your Instructor"}</p>
            <h3 className="text-xl font-bold">{d.name}</h3>
            {d.title && <p className="text-sm text-muted-foreground">{d.title}</p>}
            {d.bio && <p className="text-muted-foreground mt-3 leading-relaxed">{d.bio}</p>}
          </div>
        </div>
      );

    case "checklist":
      return (
        <div>
          <h2 className="text-2xl font-bold mb-5">{d.heading || "What's Included"}</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(d.items || []).map((item: string, i: number) => (
              <li key={i} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: primaryColor }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "columns":
      return (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${(d.columns || []).length}, 1fr)` }}
        >
          {(d.columns || []).map((col: any, i: number) => (
            <div key={i}>
              <h3 className="font-bold text-lg mb-2">{col.heading}</h3>
              <p className="text-muted-foreground leading-relaxed">{col.body}</p>
            </div>
          ))}
        </div>
      );

    case "spacer":
      return <div style={{ height: d.height || 40 }} />;

    case "faq":
      return (
        <div style={{ backgroundColor: d.backgroundColor || "#fff", padding: "60px 24px" }}>
          {d.headline && <h2 className="text-2xl font-bold text-center mb-8" style={{ color: d.textColor || "#1e293b" }}>{d.headline}</h2>}
          <div className="max-w-3xl mx-auto space-y-4">
            {(d.items || []).map((item: any) => (
              <details key={item.id} className="border rounded-lg p-4">
                <summary className="font-semibold cursor-pointer" style={{ color: d.textColor || "#1e293b" }}>{item.question}</summary>
                <p className="mt-3 text-sm opacity-75" style={{ color: d.textColor || "#1e293b" }}>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      );

    case "embed_html":
      return d.embedCode ? (
        <div style={{ backgroundColor: d.backgroundColor || "#fff", padding: "40px 24px" }}>
          <div style={{ maxWidth: `${d.maxWidth || 800}px`, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: d.embedCode }} />
        </div>
      ) : null;

    default:
      return null;
  }
}

// ─── Course Sales Page ─────────────────────────────────────────────────────────

export default function CourseSalesPage() {
  const params = useParams<{ courseId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const courseId = parseInt(params.courseId);
  const utils = trpc.useUtils();

  const { data: course, isLoading: courseLoading } = trpc.lms.courses.get.useQuery({ id: courseId });
  const { data: curriculum } = trpc.lms.curriculum.get.useQuery({ courseId });
  const { data: pricing } = trpc.lms.pricing.list.useQuery({ courseId });
  const { data: page } = trpc.lms.pages.getByCourse.useQuery({ courseId });

  // Fetch legal docs using the course's orgId once course is loaded
  const { data: legalDocs } = trpc.orgs.publicLegalDocs.useQuery(
    { orgId: course?.orgId ?? 0 },
    { enabled: !!course?.orgId }
  );

  const { data: theme } = trpc.lms.themes.get.useQuery(
    { orgId: course?.orgId ?? 0 },
    { enabled: !!course?.orgId }
  );
  const { data: enrollments } = trpc.lms.enrollments.myEnrollments.useQuery(
    undefined,
    { enabled: !!user }
  );
  const enrollment = enrollments?.find((e: any) => e.courseId === courseId);

  const enrollMut = trpc.lms.enrollments.enroll.useMutation({
    onSuccess: () => {
      utils.lms.enrollments.myEnrollments.invalidate();
      toast.success("Enrolled successfully!");
      if (course?.afterPurchaseRedirectUrl) {
        window.location.href = course.afterPurchaseRedirectUrl;
      } else if (course?.thankYouPageEnabled) {
        setLocation(`/courses/${courseId}/thank-you`);
      } else {
        setLocation(`/learn/${courseId}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const handleEnroll = (pricingId?: number, price?: number) => {
    if (!user) { window.location.href = "/login"; return; }
    if (!course) return;
    if (price && price > 0) {
      // Route paid enrollments through the hosted checkout (Stripe gateway)
      // TeachificPay is in internal test mode — set TEACHIFIC_PAY_ENABLED in stripePlans.ts when ready
      const slug = (course as any).slug;
      if (slug) {
        setLocation(`/checkout/course/${slug}${pricingId ? `?pricing_option_id=${pricingId}` : ""}`);
      } else {
        toast.error("Unable to start checkout — course not found.");
      }
      return;
    }
    enrollMut.mutate({ courseId, orgId: course.orgId, pricingId, amountPaid: 0 });
  };

  const primaryColor = theme?.studentPrimaryColor || theme?.primaryColor || "#24abbc";
  const [showBumpInterstitial, setShowBumpInterstitial] = useState<"before" | "after" | null>(null);

  // Fetch order bumps for this course
  const { data: beforeBumps } = trpc.lms.orderBumps.getForProduct.useQuery(
    { orgId: course?.orgId ?? 0, productType: "course", productId: courseId, placement: "before_checkout" },
    { enabled: !!course }
  );
  const { data: duringBumps } = trpc.lms.orderBumps.getForProduct.useQuery(
    { orgId: course?.orgId ?? 0, productType: "course", productId: courseId, placement: "during_checkout" },
    { enabled: !!course }
  );

  let blocks: any[] = [];
  if (page?.blocksJson) {
    try { blocks = JSON.parse(page.blocksJson); } catch { blocks = []; }
  }

  if (courseLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Course not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => { const sub = getSubdomain(); window.location.href = sub ? getOrgBaseUrl(sub) : "/school"; }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Courses
          </button>
          <div className="flex items-center gap-3">
            {enrollment ? (
              <Button
                size="sm"
                style={{ backgroundColor: primaryColor }}
                onClick={() => setLocation(`/learn/${courseId}`)}
              >
                Continue Learning
              </Button>
            ) : (
              <Button
                size="sm"
                style={{ backgroundColor: primaryColor }}
                onClick={() => {
                  if (!user) { window.location.href = getLoginUrl(); return; }
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {pricing && pricing.length > 0 && pricing[0].price > 0 ? `Enroll from $${pricing[0].price}` : "Enroll Free"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Page builder blocks OR default layout */}
      {blocks.length > 0 ? (
        <div>
          {blocks.map((block: any) => (
            <div key={block.id} className={block.type === "banner" ? "" : "max-w-4xl mx-auto px-4 py-10"}>
              <RenderBlock
                block={block}
                primaryColor={primaryColor}
                curriculum={curriculum || []}
                pricing={pricing || []}
                legalDocs={legalDocs}
                onEnroll={handleEnroll}
                course={course}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Default layout when no page builder content */
        <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col gap-10">
          {/* Course header */}
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h1 className="text-3xl font-bold leading-tight">{course.title}</h1>
              {course.shortDescription && (
                <p className="text-muted-foreground mt-3 text-lg leading-relaxed">{course.shortDescription}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                {course.status && <Badge variant="outline" className="capitalize">{course.status}</Badge>}
              </div>
            </div>
            {course.thumbnailUrl && (
              <div className="w-full md:w-72 shrink-0">
                <img src={course.thumbnailUrl} alt={course.title} className="w-full rounded-xl shadow-md object-cover aspect-video" />
              </div>
            )}
          </div>

          {/* Curriculum */}
          {curriculum && curriculum.length > 0 && (
            <RenderBlock
              block={{ type: "curriculum", data: { heading: "Course Curriculum", showPreview: true } }}
              primaryColor={primaryColor}
              curriculum={curriculum}
              pricing={pricing || []}
              legalDocs={legalDocs}
            />
          )}

           {/* Pricing */}
          {pricing && pricing.length > 0 && (
            <RenderBlock
              block={{ type: "pricing", data: { heading: "Pricing Options" } }}
              primaryColor={primaryColor}
              curriculum={curriculum || []}
              pricing={pricing}
              legalDocs={legalDocs}
              onEnroll={handleEnroll}
              course={course}
            />
          )}
          {/* During Checkout Order Bumps */}
          {duringBumps && duringBumps.length > 0 && (
            <div className="max-w-2xl mx-auto px-4 py-6">
              <h3 className="text-lg font-semibold mb-3 text-center">Special Offers</h3>
              <div className="space-y-3">
                {duringBumps.map((bump: any) => (
                  <OrderBumpOffer
                    key={bump.id}
                    bump={bump}
                    orgId={course!.orgId}
                    onAccept={() => toast.success("Added to your order!")}
                    onDecline={() => {}}
                    variant="inline"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {course?.title}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
