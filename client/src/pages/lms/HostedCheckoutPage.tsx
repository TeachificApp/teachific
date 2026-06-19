/**
 * HostedCheckoutPage — platform-hosted checkout for all content types.
 * Route: /checkout/:contentType/:slug
 *
 * Features:
 *  - Multi-tier pricing option selector (radio cards)
 *  - Team / group pricing: seat count stepper shown when isTeamPricing tier selected
 *  - Order bump add-ons: per-tier or global, opt-in checkboxes
 *  - Live order summary (base + bumps + seat multiplier)
 *  - Promo code input
 *  - Stripe redirect or free-access grant
 */
import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { EnrollmentGate } from "@/components/EnrollmentGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Shield, Lock, Star, Check, Award, RefreshCw, Zap,
  ChevronRight, AlertCircle, CheckCircle2, Loader2,
  Users, Minus, Plus, ShoppingCart,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  "course", "download", "physical_product", "webinar", "membership", "membership_plan", "workshop",
] as const;
type ContentType = typeof CONTENT_TYPES[number];

const BADGE_ICONS: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  shield: Shield, lock: Lock, star: Star, check: Check,
  award: Award, refresh: RefreshCw, zap: Zap,
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  course: "Course", download: "Digital Download", physical_product: "Physical Product",
  webinar: "Webinar", membership: "Membership", membership_plan: "Membership Plan",
  workshop: "Workshop",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(price: number, currency = "usd") {
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

function intervalLabel(interval: string | null | undefined) {
  if (!interval) return "";
  const map: Record<string, string> = {
    monthly: "/month", quarterly: "/quarter", annual: "/year",
    month: "/month", year: "/year",
  };
  return map[interval] ?? `/${interval}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PricingTierCard({
  option, selected, onSelect, currency, primaryColor,
}: {
  option: any; selected: boolean; onSelect: () => void; currency: string; primaryColor: string;
}) {
  const price = Number(option.price ?? option.amount ?? 0);
  const pricingType = option.pricingType ?? option.type ?? "one_time";
  const interval = option.subscriptionInterval ?? option.billingInterval;
  const isFree = price === 0 || pricingType === "free";
  const isTeam = option.isTeamPricing ?? false;
  const perSeat = option.perSeatPrice ? Number(option.perSeatPrice) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
        selected ? "" : "border-border hover:border-muted-foreground/40"
      }`}
      style={selected ? { borderColor: primaryColor, backgroundColor: primaryColor + "0d" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div
            className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
            style={selected ? { borderColor: primaryColor } : { borderColor: "#94a3b8" }}
          >
            {selected && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm">{option.label}</span>
              {isTeam && (
                <Badge variant="secondary" className="text-xs gap-1 px-1.5 py-0">
                  <Users className="w-3 h-3" /> Team
                </Badge>
              )}
            </div>
            {option.sublabel && (
              <p className="text-xs text-muted-foreground mt-0.5">{option.sublabel}</p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {isFree ? (
            <span className="font-bold text-sm">Free</span>
          ) : isTeam && perSeat ? (
            <div>
              <span className="font-bold text-sm">{fmtPrice(perSeat, currency)}</span>
              <span className="text-xs text-muted-foreground">/seat{interval ? intervalLabel(interval) : ""}</span>
            </div>
          ) : (
            <div>
              <span className="font-bold text-sm">{fmtPrice(price, currency)}</span>
              {interval && pricingType === "subscription" && (
                <span className="text-xs text-muted-foreground">{intervalLabel(interval)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function OrderBumpCard({
  bump, checked, onToggle, currency, primaryColor,
}: {
  bump: any; checked: boolean; onToggle: () => void; currency: string; primaryColor: string;
}) {
  const bumpPrice = bump.discountedPrice ? Number(bump.discountedPrice) : 0;
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all cursor-pointer ${
        checked ? "" : "border-border hover:border-muted-foreground/40"
      }`}
      style={checked ? { borderColor: primaryColor, backgroundColor: primaryColor + "0d" } : undefined}
      onClick={onToggle}
    >
      <div className="flex gap-3">
        {bump.imageUrl && (
          <img src={bump.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <Checkbox
              checked={checked}
              onCheckedChange={onToggle}
              className="mt-0.5 flex-shrink-0"
              style={checked ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
              onClick={e => e.stopPropagation()}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm leading-tight">{bump.headline ?? bump.name}</p>
                {bumpPrice > 0 && (
                  <span className="font-bold text-sm flex-shrink-0 ml-2">
                    +{fmtPrice(bumpPrice, currency)}
                  </span>
                )}
              </div>
              {bump.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{bump.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HostedCheckoutPage() {
  const params = useParams<{ contentType: string; slug: string }>();
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const contentType = (params.contentType ?? "course") as ContentType;
  const slug = params.slug ?? "";

  const [selectedOptionId, setSelectedOptionId] = useState<number | undefined>(undefined);
  const [seatCount, setSeatCount] = useState(2);
  const [selectedBumpIds, setSelectedBumpIds] = useState<Set<number>>(new Set());
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
        navigate(result.contentType === "course" ? `/courses/${result.slug}/player` : "/dashboard");
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

  // Auto-select first pricing option
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
  const allBumps = (data?.orderBumps ?? []) as any[];
  const hasAccess = data?.hasAccess ?? false;

  const primaryColor = (checkoutConfig as any)?.primaryColor ?? content?.primaryColor ?? "#179ca3";
  const accentColor  = (checkoutConfig as any)?.accentColor  ?? content?.accentColor  ?? "#0d9488";
  const bgColor      = (checkoutConfig as any)?.bgColor ?? "#f8fafc";

  const selectedOption = pricingOptions.find((o: any) => o.id === selectedOptionId);
  const isTeamTier   = selectedOption?.isTeamPricing ?? false;
  const minSeats     = selectedOption?.minSeats ?? 2;
  const maxSeats     = selectedOption?.maxSeats ?? 100;
  const perSeatPrice = selectedOption?.perSeatPrice ? Number(selectedOption.perSeatPrice) : null;

  // Reset seat count when switching tiers
  useEffect(() => {
    if (isTeamTier) setSeatCount(minSeats);
  }, [selectedOptionId]);

  const effectiveBasePrice = useMemo(() => {
    if (!selectedOption) return Number(content?.price ?? 0);
    if (isTeamTier && perSeatPrice) return perSeatPrice * seatCount;
    return Number(selectedOption.price ?? selectedOption.amount ?? 0);
  }, [selectedOption, isTeamTier, perSeatPrice, seatCount, content?.price]);

  const effectivePricingType: string = selectedOption
    ? (selectedOption.pricingType ?? selectedOption.type ?? "one_time")
    : (content?.pricingType ?? "one_time");
  const effectiveCurrency = selectedOption?.currency ?? content?.currency ?? "usd";
  const effectiveInterval = selectedOption?.subscriptionInterval ?? selectedOption?.billingInterval ?? content?.subscriptionInterval;
  const isFree = effectiveBasePrice === 0 || effectivePricingType === "free";
  const isSubscription = effectivePricingType === "subscription";
  const trialDays = selectedOption?.trialDays ?? content?.trialDays;

  // Filter bumps: global (null pricingOptionId) + those matching the selected tier
  const visibleBumps = useMemo(() => {
    return allBumps.filter((b: any) =>
      b.pricingOptionId === null || b.pricingOptionId === selectedOptionId
    );
  }, [allBumps, selectedOptionId]);

  // Clear bumps that are no longer visible when tier changes
  useEffect(() => {
    const visibleIds = new Set(visibleBumps.map((b: any) => b.id));
    setSelectedBumpIds(prev => {
      const next = new Set<number>();
      prev.forEach(id => { if (visibleIds.has(id)) next.add(id); });
      return next;
    });
  }, [visibleBumps]);

  const bumpTotal = useMemo(() => {
    return visibleBumps
      .filter((b: any) => selectedBumpIds.has(b.id))
      .reduce((sum: number, b: any) => sum + (b.discountedPrice ? Number(b.discountedPrice) : 0), 0);
  }, [visibleBumps, selectedBumpIds]);

  const orderTotal = effectiveBasePrice + bumpTotal;

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
      seatCount: isTeamTier ? seatCount : undefined,
      selectedBumpIds: selectedBumpIds.size > 0 ? Array.from(selectedBumpIds) : undefined,
    });
  };

  const toggleBump = (id: number) => {
    setSelectedBumpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Loading / Error states ────────────────────────────────────────────────

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
          <p className="text-muted-foreground">You already have access to <strong>{content.title}</strong>.</p>
          {contentType === "course" && (
            <Button style={{ backgroundColor: primaryColor }} className="text-white w-full"
              onClick={() => navigate(`/courses/${slug}/player`)}>
              Go to Course
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>

      {/* Header banner */}
      {(checkoutConfig?.header as any)?.enabled && (
        <div
          className="w-full py-4 px-4 text-center text-white"
          style={{
            background: (checkoutConfig?.header as any)?.bgColor
              ?? `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
          }}
        >
          {org?.logoUrl && (
            <img src={org.logoUrl} alt={org.name} className="h-7 object-contain mx-auto mb-2" />
          )}
          {(checkoutConfig?.header as any)?.headline && (
            <p className="font-bold text-lg">{(checkoutConfig?.header as any).headline}</p>
          )}
          {(checkoutConfig?.header as any)?.subheadline && (
            <p className="text-sm opacity-90 mt-0.5">{(checkoutConfig?.header as any).subheadline}</p>
          )}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

          {/* ── Left: Content Info ────────────────────────────────────── */}
          {(checkoutConfig?.contentInfo as any)?.enabled !== false && (
            <div className="space-y-5">
              {org && !(checkoutConfig?.header as any)?.enabled && (
                <div className="flex items-center gap-2">
                  {org.logoUrl && <img src={org.logoUrl} alt={org.name} className="h-7 object-contain" />}
                  <span className="text-sm font-medium text-muted-foreground">{org.name}</span>
                </div>
              )}

              {(checkoutConfig?.contentInfo as any)?.showCoverImage !== false && content.coverImageUrl && (
                <div className="rounded-xl overflow-hidden shadow-md aspect-video">
                  <img src={content.coverImageUrl} alt={content.title} className="w-full h-full object-cover" />
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
                <h1 className="text-2xl lg:text-3xl font-bold leading-tight">{content.title}</h1>
                {(checkoutConfig?.contentInfo as any)?.showSubtitle !== false && content.subtitle && (
                  <p className="text-base text-muted-foreground mt-1">{content.subtitle}</p>
                )}
              </div>

              {(checkoutConfig?.contentInfo as any)?.showDescription !== false && content.description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">{content.description}</p>
              )}

              {trustBadges.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {trustBadges.map((badge: any) => {
                    const Icon = BADGE_ICONS[badge.icon] ?? Check;
                    return (
                      <div key={badge.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                        <span>{badge.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Order bumps — left column (during_checkout) */}
              {visibleBumps.filter((b: any) => b.placement === "during_checkout").length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Special Add-ons
                  </h3>
                  {visibleBumps
                    .filter((b: any) => b.placement === "during_checkout")
                    .map((bump: any) => (
                      <OrderBumpCard
                        key={bump.id}
                        bump={bump}
                        checked={selectedBumpIds.has(bump.id)}
                        onToggle={() => toggleBump(bump.id)}
                        currency={effectiveCurrency}
                        primaryColor={primaryColor}
                      />
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

            {/* Pricing tier selector */}
            {pricingOptions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {pricingOptions.length === 1 ? "Pricing" : "Select Plan"}
                </Label>
                <div className="space-y-2">
                  {pricingOptions.map((opt: any) => (
                    <PricingTierCard
                      key={opt.id}
                      option={opt}
                      selected={selectedOptionId === opt.id}
                      onSelect={() => setSelectedOptionId(opt.id)}
                      currency={effectiveCurrency}
                      primaryColor={primaryColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Team seat stepper */}
            {isTeamTier && (
              <div className="space-y-2 rounded-xl p-4 border border-border bg-muted/30">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Users className="w-4 h-4" style={{ color: primaryColor }} />
                  Number of Seats
                </Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button" variant="outline" size="icon" className="h-9 w-9"
                    disabled={seatCount <= minSeats}
                    onClick={() => setSeatCount(s => Math.max(minSeats, s - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="text-xl font-bold w-10 text-center tabular-nums">{seatCount}</span>
                  <Button
                    type="button" variant="outline" size="icon" className="h-9 w-9"
                    disabled={seatCount >= maxSeats}
                    onClick={() => setSeatCount(s => Math.min(maxSeats, s + 1))}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    min {minSeats} – max {maxSeats}
                  </span>
                </div>
                {perSeatPrice && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {fmtPrice(perSeatPrice, effectiveCurrency)} × {seatCount} seats
                    {" = "}
                    <strong className="text-foreground">{fmtPrice(effectiveBasePrice, effectiveCurrency)}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Order bumps — right column (checkout_form) */}
            {visibleBumps.filter((b: any) => b.placement === "checkout_form").length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Add to Order</h3>
                {visibleBumps
                  .filter((b: any) => b.placement === "checkout_form")
                  .map((bump: any) => (
                    <OrderBumpCard
                      key={bump.id}
                      bump={bump}
                      checked={selectedBumpIds.has(bump.id)}
                      onToggle={() => toggleBump(bump.id)}
                      currency={effectiveCurrency}
                      primaryColor={primaryColor}
                    />
                  ))}
              </div>
            )}

            {/* Order summary */}
            {!isFree && (
              <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: primaryColor + "12" }}>
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4" style={{ color: primaryColor }} />
                  Order Summary
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground truncate mr-2">
                      {isTeamTier
                        ? `${content.title} (${seatCount} seats)`
                        : (selectedOption?.label ?? content.title)}
                    </span>
                    <span className="flex-shrink-0">{fmtPrice(effectiveBasePrice, effectiveCurrency)}</span>
                  </div>
                  {visibleBumps
                    .filter((b: any) => selectedBumpIds.has(b.id) && b.discountedPrice)
                    .map((b: any) => (
                      <div key={b.id} className="flex justify-between text-muted-foreground">
                        <span className="truncate mr-2">{b.headline ?? b.name}</span>
                        <span className="flex-shrink-0">+{fmtPrice(Number(b.discountedPrice), effectiveCurrency)}</span>
                      </div>
                    ))}
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-sm">
                  <span>Total{isSubscription && effectiveInterval ? intervalLabel(effectiveInterval) : ""}</span>
                  <span style={{ color: primaryColor }}>{fmtPrice(orderTotal, effectiveCurrency)}</span>
                </div>
                {isSubscription && trialDays && trialDays > 0 && (
                  <Badge
                    className="text-xs mt-1"
                    style={{ backgroundColor: primaryColor + "20", color: primaryColor, border: "none" }}
                  >
                    {trialDays}-day free trial
                  </Badge>
                )}
              </div>
            )}

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
                ) : "Privacy Policy"}.
              </Label>
            </div>

            {/* Subscription disclosure */}
            {isSubscription && !isFree && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed">
                <RefreshCw className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
                Your subscription renews automatically
                {effectiveInterval ? ` ${intervalLabel(effectiveInterval).replace("/", "every ")}` : " periodically"}
                {" "}at {fmtPrice(orderTotal, effectiveCurrency)} unless cancelled.
                {trialDays && trialDays > 0
                  ? ` Your free trial lasts ${trialDays} days before billing begins.`
                  : ""}
              </div>
            )}

            {/* CTA */}
            {!user ? (
              <div className="space-y-3">
                <EnrollmentGate
                  isLoading={authLoading}
                  isAuthenticated={false}
                  isEnrolled={false}
                  contentLabel={content?.title ?? "this content"}
                  primaryColor={primaryColor}
                  variant="full"
                  enabled={true}
                />
                <p className="text-xs text-center text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    className="underline font-medium"
                    style={{ color: primaryColor }}
                    onClick={() => window.location.href = getLoginUrl(window.location.pathname)}
                  >
                    Sign in
                  </button>
                </p>
              </div>
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
                  <>{isFree ? "Get Free Access" : submitButtonText} <ChevronRight className="w-4 h-4 ml-1.5" /></>
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
