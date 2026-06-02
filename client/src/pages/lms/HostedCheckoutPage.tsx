/**
 * HostedCheckoutPage — platform-hosted checkout for all content types.
 * Route: /checkout/:contentType/:slug
 *
 * Two-column layout:
 *   Left  — cover image, title, subtitle, description, org branding, trust badges
 *   Right — pricing selector, terms checkbox, subscription disclosure, Buy Now button
 *           (redirects to Stripe Checkout Session URL)
 */
import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Shield,
  Lock,
  Star,
  Check,
  Award,
  RefreshCw,
  Zap,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const CONTENT_TYPES = ["course", "download", "physical_product", "webinar", "membership", "membership_plan"] as const;
type ContentType = typeof CONTENT_TYPES[number];

const BADGE_ICONS: Record<string, React.ReactNode> = {
  shield:  <Shield className="w-4 h-4" />,
  lock:    <Lock className="w-4 h-4" />,
  star:    <Star className="w-4 h-4" />,
  check:   <Check className="w-4 h-4" />,
  award:   <Award className="w-4 h-4" />,
  refresh: <RefreshCw className="w-4 h-4" />,
  zap:     <Zap className="w-4 h-4" />,
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  course:           "Course",
  download:         "Digital Download",
  physical_product: "Physical Product",
  webinar:          "Webinar",
  membership:       "Membership",
  membership_plan:  "Membership Plan",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(price: string | number | null | undefined, currency = "usd") {
  const n = Number(price ?? 0);
  if (n === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(n);
}

function intervalLabel(interval: string | null | undefined) {
  if (!interval) return "";
  const map: Record<string, string> = {
    monthly: "/month",
    quarterly: "/quarter",
    annual: "/year",
    month: "/month",
    year: "/year",
  };
  return map[interval] ?? `/${interval}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HostedCheckoutPage() {
  const params = useParams<{ contentType: string; slug: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const contentType = (params.contentType ?? "course") as ContentType;
  const slug = params.slug ?? "";

  const [selectedOptionId, setSelectedOptionId] = useState<number | undefined>(undefined);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const validContentType = CONTENT_TYPES.includes(contentType);

  const { data, isLoading, error } = trpc.lmsCheckout.getCheckoutPageDetails.useQuery(
    { contentType: contentType as any, slug },
    { enabled: validContentType && !!slug, retry: false }
  );

  const createSession = trpc.lmsCheckoutLearner.createHostedCheckoutSession.useMutation({
    onSuccess: (result) => {
      if (result.type === "free") {
        toast.success("Access granted!");
        const target = result.contentType === "course"
          ? `/courses/${result.slug}/player`
          : "/dashboard";
        navigate(target);
      } else if (result.type === "redirect") {
        setIsRedirecting(true);
        window.location.href = result.checkoutUrl;
      }
    },
    onError: (e) => {
      setIsRedirecting(false);
      toast.error(e.message || "Failed to start checkout");
    },
  });

  useEffect(() => {
    if (data?.pricingOptions?.length && !selectedOptionId) {
      setSelectedOptionId((data.pricingOptions[0] as any).id);
    }
  }, [data?.pricingOptions]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const content = data?.content;
  const org = data?.org;
  const checkoutConfig = data?.checkoutConfig;
  const pricingOptions = (data?.pricingOptions ?? []) as any[];
  const hasAccess = data?.hasAccess ?? false;

  const primaryColor = (checkoutConfig as any)?.primaryColor ?? content?.primaryColor ?? "#179ca3";
  const accentColor  = (checkoutConfig as any)?.accentColor  ?? content?.accentColor  ?? "#0d9488";
  const bgColor      = (checkoutConfig as any)?.bgColor ?? "#f8fafc";

  const selectedOption = pricingOptions.find((o: any) => o.id === selectedOptionId);
  const effectivePrice = selectedOption
    ? Number(selectedOption.price ?? selectedOption.amount ?? 0)
    : Number(content?.price ?? 0);
  const effectivePricingType: string = selectedOption
    ? (selectedOption.pricingType ?? selectedOption.type ?? "one_time")
    : (content?.pricingType ?? "one_time");
  const effectiveCurrency = selectedOption?.currency ?? content?.currency ?? "usd";
  const effectiveInterval = selectedOption?.subscriptionInterval ?? selectedOption?.billingInterval ?? content?.subscriptionInterval;
  const isFree = effectivePrice === 0 || effectivePricingType === "free";
  const isSubscription = effectivePricingType === "subscription";
  const trialDays = selectedOption?.trialDays ?? content?.trialDays;

  const submitButtonText = (checkoutConfig?.paymentForm as any)?.submitButtonText ?? "Buy Now";
  const showPromoCode = (checkoutConfig?.paymentForm as any)?.showPromoCode ?? true;
  const trustBadges = (checkoutConfig?.trustBadges as any)?.enabled
    ? ((checkoutConfig?.trustBadges as any)?.badges ?? []).filter((b: any) => b.enabled)
    : [];

  const canSubmit = termsAccepted && !isRedirecting && !createSession.isPending;

  const handleCheckout = () => {
    if (!user) {
      window.location.href = getLoginUrl(window.location.pathname);
      return;
    }
    if (!termsAccepted) {
      toast.error("Please accept the terms to continue");
      return;
    }
    createSession.mutate({
      contentType: contentType as any,
      slug,
      pricingOptionId: selectedOptionId,
      origin: window.location.origin,
      promoCode: promoCode.trim() || undefined,
    });
  };

  // ── States ────────────────────────────────────────────────────────────────

  if (!validContentType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Invalid Content Type</h2>
        </div>
      </div>
    );
  }

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Content Not Found</h2>
          <p className="text-muted-foreground">This checkout page is no longer available.</p>
        </div>
      </div>
    );
  }

  if (hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-4">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">You already have access!</h2>
          <p className="text-muted-foreground">
            You already have access to <strong>{content.title}</strong>.
          </p>
          {contentType === "course" && (
            <Button
              style={{ backgroundColor: primaryColor }}
              className="text-white w-full"
              onClick={() => navigate(`/courses/${slug}/player`)}
            >
              Go to Course
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      {/* Header banner */}
      {(checkoutConfig?.header as any)?.enabled && ((checkoutConfig?.header as any)?.headline || (checkoutConfig?.header as any)?.subheadline) && (
        <div
          className="w-full py-3 px-4 text-center text-white"
          style={{ backgroundColor: (checkoutConfig?.header as any)?.bgColor ?? primaryColor }}
        >
          {(checkoutConfig?.header as any)?.headline && (
            <p className="font-semibold text-sm">{(checkoutConfig?.header as any).headline}</p>
          )}
          {(checkoutConfig?.header as any)?.subheadline && (
            <p className="text-xs opacity-90">{(checkoutConfig?.header as any).subheadline}</p>
          )}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

          {/* ── Left: Content Info ────────────────────────────────────── */}
          {(checkoutConfig?.contentInfo as any)?.enabled !== false && (
            <div className="space-y-5">
              {org && (
                <div className="flex items-center gap-2">
                  {org.logoUrl && (
                    <img src={org.logoUrl} alt={org.name} className="h-7 object-contain" />
                  )}
                  <span className="text-sm font-medium text-muted-foreground">{org.name}</span>
                </div>
              )}

              {(checkoutConfig?.contentInfo as any)?.showCoverImage !== false && content.coverImageUrl && (
                <div className="rounded-xl overflow-hidden shadow-md aspect-video">
                  <img
                    src={content.coverImageUrl}
                    alt={content.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <Badge
                variant="outline"
                style={{ backgroundColor: primaryColor + "22", color: primaryColor, borderColor: primaryColor + "44" }}
                className="text-xs font-medium"
              >
                {CONTENT_TYPE_LABELS[contentType]}
              </Badge>

              <div>
                <h1 className="text-2xl lg:text-3xl font-bold leading-tight text-foreground">
                  {content.title}
                </h1>
                {(checkoutConfig?.contentInfo as any)?.showSubtitle !== false && content.subtitle && (
                  <p className="text-base text-muted-foreground mt-1">{content.subtitle}</p>
                )}
              </div>

              {(checkoutConfig?.contentInfo as any)?.showDescription !== false && content.description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
                  {content.description}
                </p>
              )}

              {trustBadges.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {trustBadges.map((badge: any) => (
                    <div key={badge.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span style={{ color: primaryColor }}>
                        {BADGE_ICONS[badge.icon] ?? <Check className="w-4 h-4" />}
                      </span>
                      <span>{badge.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Right: Payment Panel ──────────────────────────────────── */}
          <div className="rounded-2xl border border-border shadow-sm p-6 space-y-5 bg-card">
            <div>
              <h2 className="text-lg font-semibold">Complete Your Purchase</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Secure checkout powered by Stripe</p>
            </div>

            <Separator />

            {/* Pricing options */}
            {pricingOptions.length > 1 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Plan</Label>
                <div className="space-y-2">
                  {pricingOptions.map((opt: any) => {
                    const optPrice = Number(opt.price ?? opt.amount ?? 0);
                    const optInterval = opt.subscriptionInterval ?? opt.billingInterval;
                    const optType = opt.pricingType ?? opt.type ?? "one_time";
                    const isSelected = selectedOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedOptionId(opt.id)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isSelected ? "" : "border-border hover:border-primary/50"
                        }`}
                        style={isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor + "10" } : {}}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{opt.label}</p>
                            {opt.sublabel && <p className="text-xs text-muted-foreground">{opt.sublabel}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">
                              {fmtPrice(optPrice, opt.currency ?? "usd")}
                              {optType === "subscription" && optInterval && (
                                <span className="text-xs font-normal text-muted-foreground ml-0.5">
                                  {intervalLabel(optInterval)}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price summary */}
            <div
              className="rounded-xl p-4 text-white"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm opacity-90">
                    {pricingOptions.length === 1 ? pricingOptions[0]?.label : "Total"}
                  </p>
                  <p className="text-3xl font-bold mt-0.5">
                    {isFree ? "Free" : fmtPrice(effectivePrice, effectiveCurrency)}
                    {isSubscription && effectiveInterval && !isFree && (
                      <span className="text-base font-normal opacity-80 ml-1">
                        {intervalLabel(effectiveInterval)}
                      </span>
                    )}
                  </p>
                </div>
                {isSubscription && trialDays && trialDays > 0 && (
                  <Badge className="bg-white/20 text-white border-0 text-xs">
                    {trialDays}-day free trial
                  </Badge>
                )}
              </div>
            </div>

            {/* Promo code */}
            {showPromoCode && !isFree && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Promo Code (optional)</Label>
                <Input
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  className="h-9 text-sm font-mono uppercase"
                />
              </div>
            )}

            {/* Terms */}
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={v => setTermsAccepted(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                I agree to the{" "}
                {org?.termsUrl ? (
                  <a href={org.termsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    Terms of Service
                  </a>
                ) : "Terms of Service"}{" "}
                and{" "}
                {org?.privacyUrl ? (
                  <a href={org.privacyUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    Privacy Policy
                  </a>
                ) : "Privacy Policy"}
                .
              </Label>
            </div>

            {/* Subscription disclosure */}
            {isSubscription && !isFree && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed">
                <RefreshCw className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
                Your subscription renews automatically{" "}
                {effectiveInterval ? intervalLabel(effectiveInterval).replace("/", "every ") : "periodically"}{" "}
                at {fmtPrice(effectivePrice, effectiveCurrency)} unless cancelled.
                {trialDays && trialDays > 0
                  ? ` Your free trial lasts ${trialDays} days before billing begins.`
                  : ""}
              </div>
            )}

            {/* CTA */}
            {!user ? (
              <Button
                className="w-full h-12 text-base font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
                onClick={() => window.location.href = getLoginUrl(window.location.pathname)}
              >
                Sign In to Continue
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                className="w-full h-12 text-base font-semibold text-white"
                style={{ backgroundColor: canSubmit ? primaryColor : undefined }}
                disabled={!canSubmit}
                onClick={handleCheckout}
              >
                {isRedirecting || createSession.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting…</>
                ) : (
                  <>{isFree ? "Get Free Access" : submitButtonText}<ChevronRight className="w-4 h-4 ml-1.5" /></>
                )}
              </Button>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              <span>Secured by Stripe — payment info is never stored</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {(checkoutConfig?.footer as any)?.enabled && (checkoutConfig?.footer as any)?.text && (
        <div className="border-t border-border py-4 px-4 text-center text-xs text-muted-foreground">
          {(checkoutConfig?.footer as any).text}
        </div>
      )}
    </div>
  );
}
