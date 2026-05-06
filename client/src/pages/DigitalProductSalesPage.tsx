import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, ShieldCheck, Clock, RefreshCw, Package, Check, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { OrderBumpOffer, OrderBumpInterstitial } from "@/components/OrderBumpOffer";

// ─── Block renderer (simplified for sales page) ────────────────────────────────
function renderBlock(block: any, idx: number) {
  const d = block.data || {};
  switch (block.type) {
    case "banner": {
      const isVid = d.backgroundType === "video" && d.backgroundVideoUrl;
      const bannerBg = d.backgroundType === "gradient"
        ? { background: `linear-gradient(${d.gradientDirection || "to bottom right"}, ${d.gradientFrom || "#1e293b"}, ${d.gradientTo || "#6366f1"})` }
        : d.backgroundType === "image" && (d.backgroundImageUrl || d.backgroundImage)
        ? { backgroundImage: `url(${d.backgroundImageUrl || d.backgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
        : isVid ? { backgroundColor: "#000" }
        : { backgroundColor: d.backgroundColor || "#24abbc" };
      const h1c = d.headlineColor || d.textColor || "#fff";
      const h2c = d.headline2Color || d.textColor || "#fff";
      const hasInline = d.inlineMediaUrl && d.inlineMediaType;
      return (
        <div
          key={block.id}
          className="relative w-full py-20 px-8 overflow-hidden flex items-center justify-center"
          style={bannerBg}
        >
          {isVid && (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0" src={d.backgroundVideoUrl} />
          )}
          {(d.backgroundType === "image" || d.backgroundImage || isVid) && d.overlay !== false && (
            <div className="absolute inset-0 z-[1]" style={{ backgroundColor: `rgba(0,0,0,${d.overlayOpacity ?? 0.4})` }} />
          )}
          <div className={`relative z-10 animate-fade-in-up w-full ${hasInline ? "flex items-center gap-10 max-w-5xl" : "flex flex-col items-center gap-4 max-w-3xl text-center"}`} style={{ flexDirection: hasInline && d.inlineMediaPosition === "left" ? "row-reverse" : "row" }}>
            <div className={hasInline ? "flex-1" : ""}>
              {d.headline && <h1 className="text-4xl font-bold mb-1" style={{ color: h1c }}>{d.headline}</h1>}
              {d.headline2 && <h1 className="text-4xl font-bold mb-2" style={{ color: h2c }}>{d.headline2}</h1>}
              {(d.subheadline || d.subtext) && <p className="text-xl opacity-90 mt-3" style={{ color: d.textColor || "#fff" }}>{d.subheadline || d.subtext}</p>}
              {d.ctaText && (
                <a href={d.ctaUrl || "#"} className="inline-block mt-4">
                  <button className="px-8 py-3 rounded-full font-semibold" style={{ backgroundColor: d.ctaBgColor || "rgba(255,255,255,0.2)", color: d.ctaTextColor || "#fff", border: d.ctaBgColor ? "none" : "2px solid rgba(255,255,255,0.7)" }}>{d.ctaText}</button>
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
    case "text_media":
      return (
        <div key={block.id} className="max-w-4xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-8 items-center">
          <div>
            {d.heading && <h2 className="text-2xl font-bold mb-3">{d.heading}</h2>}
            {d.text && <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: d.text }} />}
          </div>
          {d.imageUrl && (
            <img src={d.imageUrl} alt={d.heading || ""} className="rounded-lg w-full object-cover" />
          )}
        </div>
      );
    case "cta": {
      const ctaBg = d.backgroundType === "gradient"
        ? { background: `linear-gradient(${d.gradientDirection || "to bottom right"}, ${d.gradientFrom || "#0f172a"}, ${d.gradientTo || "#6366f1"})` }
        : { backgroundColor: d.backgroundColor || "#f8fafc" };
      const ctaH1 = d.headlineColor || d.textColor || undefined;
      const ctaH2 = d.headline2Color || d.textColor || undefined;
      return (
        <div
          key={block.id}
          className="py-16 px-8 text-center"
          style={ctaBg}
        >
          {d.headline && <h2 className="text-3xl font-bold mb-1" style={{ color: ctaH1 }}>{d.headline}</h2>}
          {d.headline2 && <h2 className="text-3xl font-bold mb-3" style={{ color: ctaH2 }}>{d.headline2}</h2>}
          {d.subtext && <p className="mb-6 opacity-80" style={{ color: d.textColor }}>{d.subtext}</p>}
          {d.ctaText && (
            <a href={d.ctaUrl || "#"} className="inline-block">
              <button className="px-8 py-3 rounded-lg font-semibold" style={{ backgroundColor: d.ctaBgColor || "#6366f1", color: d.ctaTextColor || "#fff" }}>{d.ctaText}</button>
            </a>
          )}
        </div>
      );
    }
    case "checklist":
      return (
        <div key={block.id} className="max-w-2xl mx-auto px-6 py-10">
          {d.heading && <h2 className="text-2xl font-bold mb-6 text-center">{d.heading}</h2>}
          <ul className="space-y-3">
            {(d.items || []).map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "testimonials":
      return (
        <div key={block.id} className="max-w-4xl mx-auto px-6 py-12">
          {d.heading && <h2 className="text-2xl font-bold mb-8 text-center">{d.heading}</h2>}
          <div className="grid md:grid-cols-2 gap-6">
            {(d.testimonials || []).map((t: any, i: number) => (
              <div key={i} className="border rounded-lg p-5 bg-muted/30">
                <p className="italic mb-3">"{t.quote}"</p>
                <p className="font-semibold text-sm">{t.name}</p>
                {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    case "image":
      return (
        <div key={block.id} className="max-w-3xl mx-auto px-6 py-8 text-center">
          {d.src && <img src={d.src} alt={d.alt || ""} className="rounded-lg w-full" />}
          {d.caption && <p className="text-sm text-muted-foreground mt-2">{d.caption}</p>}
        </div>
      );
    case "video":
      return (
        <div key={block.id} className="max-w-3xl mx-auto px-6 py-8">
          {d.url && (
            <div className="aspect-video rounded-lg overflow-hidden">
              <iframe
                src={d.url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          )}
        </div>
      );
    case "feature_grid":
      return (
        <div key={block.id} className="max-w-5xl mx-auto px-6 py-12">
          {d.heading && <h2 className="text-2xl font-bold mb-8 text-center">{d.heading}</h2>}
          <div className="grid md:grid-cols-3 gap-6">
            {(d.features || []).map((f: any, i: number) => (
              <div key={i} className="border rounded-lg p-5 text-center">
                {f.icon && <div className="text-3xl mb-3">{f.icon}</div>}
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case "faq":
      return (
        <div key={block.id} style={{ backgroundColor: d.backgroundColor || "#fff", padding: "60px 24px" }}>
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
        <div key={block.id} style={{ backgroundColor: d.backgroundColor || "#fff", padding: "40px 24px" }}>
          <div style={{ maxWidth: `${d.maxWidth || 800}px`, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: d.embedCode }} />
        </div>
      ) : null;
    case "columns": {
      const gridCols = d.layout === "33-67" ? "1fr 2fr" : d.layout === "67-33" ? "2fr 1fr" : d.layout === "25-75" ? "1fr 3fr" : d.layout === "75-25" ? "3fr 1fr" : "1fr 1fr";
      return (
        <div key={block.id} style={{ backgroundColor: d.backgroundColor || "#fff", padding: `${d.paddingY || 40}px 24px` }}>
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: `${d.gap || 24}px`, maxWidth: "1100px", margin: "0 auto" }}>
            {d.leftContent && <div dangerouslySetInnerHTML={{ __html: d.leftContent }} />}
            {d.rightContent && <div dangerouslySetInnerHTML={{ __html: d.rightContent }} />}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Checkout Dialog ───────────────────────────────────────────────────────────
function CheckoutDialog({
  open,
  onClose,
  product,
  selectedPriceId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  product: any;
  selectedPriceId: number;
  onSuccess: (email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  // Stripe checkout (when org has Stripe configured)
  const stripeCheckout = trpc.billing.createCourseCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("Redirecting to secure checkout...");
        window.open(data.checkoutUrl, "_blank");
        onClose();
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // Fallback: manual order (no Stripe)
  const createOrder = trpc.lms.downloads.createOrder.useMutation({
    onSuccess: () => {
      onSuccess(email);
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = stripeCheckout.isPending || createOrder.isPending;

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (!email.trim() || !email.includes("@")) { toast.error("Please enter a valid email"); return; }
    if (email !== confirmEmail) { toast.error("Emails do not match"); return; }
    if (product.hasStripe) {
      // Use Stripe checkout with transaction fee applied server-side
      stripeCheckout.mutate({
        orgId: product.orgId,
        productId: product.id,
        priceId: selectedPriceId,
        buyerEmail: email,
        buyerName: name,
        origin: window.location.origin,
      });
    } else {
      // Fallback to manual order
      createOrder.mutate({ productId: product.id, priceId: selectedPriceId, buyerName: name, buyerEmail: email });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Purchase</DialogTitle>
          <DialogDescription>
            Enter your details to receive your download link by email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Email</Label>
            <Input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
          <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 inline mr-1 text-primary" />
            Your download link will be sent to your email immediately after purchase.
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
            ) : (
              product?.hasStripe ? "Proceed to Secure Checkout" : "Complete Purchase"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Success Screen ────────────────────────────────────────────────────────────
function SuccessScreen({ email, productTitle }: { email: string; productTitle: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Purchase Complete!</h1>
        <p className="text-muted-foreground">
          Thank you for purchasing <strong>{productTitle}</strong>. A download link has been sent to{" "}
          <strong>{email}</strong>. Please check your inbox (and spam folder).
        </p>
        <p className="text-sm text-muted-foreground">
          The download link is unique to your purchase and may have time or download limits.
        </p>
      </div>
    </div>
  );
}

// ─── Main Sales Page ───────────────────────────────────────────────────────────
export default function DigitalProductSalesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedPriceId, setSelectedPriceId] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [showBumpInterstitial, setShowBumpInterstitial] = useState<"before" | "after" | null>(null);

  const { data: product, isLoading } = trpc.lms.downloads.getProductBySlug.useQuery({ slug });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
          <p className="text-muted-foreground">This product may no longer be available.</p>
        </div>
      </div>
    );
  }

  // Fetch order bumps for this product
  const { data: beforeBumps } = trpc.lms.orderBumps.getForProduct.useQuery(
    { orgId: product.orgId, productType: "download", productId: product.id, placement: "before_checkout" },
    { enabled: !!product }
  );
  const { data: duringBumps } = trpc.lms.orderBumps.getForProduct.useQuery(
    { orgId: product.orgId, productType: "download", productId: product.id, placement: "during_checkout" },
    { enabled: !!product }
  );
  const { data: afterBumps } = trpc.lms.orderBumps.getForProduct.useQuery(
    { orgId: product.orgId, productType: "download", productId: product.id, placement: "after_checkout" },
    { enabled: !!product }
  );

  // Before checkout interstitial
  if (showBumpInterstitial === "before" && beforeBumps && beforeBumps.length > 0) {
    return (
      <OrderBumpInterstitial
        bumps={beforeBumps}
        orgId={product.orgId}
        onComplete={() => {
          setShowBumpInterstitial(null);
          setCheckoutOpen(true);
        }}
        onSkipAll={() => {
          setShowBumpInterstitial(null);
          setCheckoutOpen(true);
        }}
      />
    );
  }

  // After checkout interstitial
  if (showBumpInterstitial === "after" && afterBumps && afterBumps.length > 0 && successEmail) {
    return (
      <OrderBumpInterstitial
        bumps={afterBumps}
        orgId={product.orgId}
        onComplete={() => setShowBumpInterstitial(null)}
        onSkipAll={() => setShowBumpInterstitial(null)}
      />
    );
  }

  if (successEmail) {
    return <SuccessScreen email={successEmail} productTitle={product.title} />;
  }

  const prices = product.prices || [];
  const activePrices = prices.filter((p: any) => p.isActive);
  const effectivePriceId = selectedPriceId ?? activePrices[0]?.id ?? null;

  let salesPageBlocks: any[] = [];
  try {
    salesPageBlocks = product.salesPageBlocksJson
      ? JSON.parse(product.salesPageBlocksJson as string)
      : [];
    if (!Array.isArray(salesPageBlocks)) salesPageBlocks = [];
  } catch {
    salesPageBlocks = [];
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero / Sales Page Blocks */}
      {salesPageBlocks.length > 0 ? (
        <div>{salesPageBlocks.map((b, i) => renderBlock(b, i))}</div>
      ) : (
        <div className="py-20 px-8 text-center bg-gradient-to-br from-primary/10 to-primary/5">
          {product.thumbnailUrl && (
            <img
              src={product.thumbnailUrl}
              alt={product.title}
              className="w-32 h-32 object-cover rounded-xl mx-auto mb-6 shadow-lg"
            />
          )}
          <h1 className="text-4xl font-bold mb-4">{product.title}</h1>
          {product.description && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{product.description}</p>
          )}
        </div>
      )}

      {/* Pricing + Buy Section */}
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="border rounded-2xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold mb-2 text-center">Get Instant Access</h2>
          <p className="text-muted-foreground text-center mb-6">
            Purchase once, download immediately.
          </p>

          {/* Access info */}
          <div className="flex flex-wrap gap-4 justify-center mb-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Download className="w-4 h-4 text-primary" />
              {product.defaultMaxDownloads
                ? `${product.defaultMaxDownloads} downloads included`
                : "Unlimited downloads"}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              {product.defaultAccessDays
                ? `${product.defaultAccessDays}-day access`
                : "Lifetime access"}
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Secure download
            </div>
          </div>

          {/* Price options */}
          {activePrices.length > 1 && (
            <div className="space-y-3 mb-6">
              {activePrices.map((price: any) => (
                <label
                  key={price.id}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    effectivePriceId === price.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="price"
                      value={price.id}
                      checked={effectivePriceId === price.id}
                      onChange={() => setSelectedPriceId(price.id)}
                      className="accent-primary"
                    />
                    <div>
                      <p className="font-medium">{price.label}</p>
                      {price.type === "payment_plan" && price.installments && (
                        <p className="text-xs text-muted-foreground">
                          {price.installments} payments of ${price.installmentAmount} every {price.intervalDays} days
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      ${Number(price.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{price.currency}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {activePrices.length === 1 && (
            <div className="text-center mb-6">
              <p className="text-4xl font-bold">
                ${Number(activePrices[0].amount).toFixed(2)}
              </p>
              <p className="text-muted-foreground text-sm">{activePrices[0].label}</p>
            </div>
          )}

          {activePrices.length === 0 && (
            <div className="text-center mb-6 text-muted-foreground">
              <p>Pricing not yet available. Check back soon.</p>
            </div>
          )}

          {/* During Checkout bumps - shown inline above buy button */}
          {duringBumps && duringBumps.length > 0 && (
            <div className="space-y-3 mb-4">
              {duringBumps.map((bump: any) => (
                <OrderBumpOffer
                  key={bump.id}
                  bump={bump}
                  orgId={product.orgId}
                  onAccept={() => toast.success("Added to your order!")}
                  onDecline={() => {}}
                  variant="inline"
                />
              ))}
            </div>
          )}
          <Button
            className="w-full h-12 text-base"
            disabled={!effectivePriceId || activePrices.length === 0}
            onClick={() => {
              if (beforeBumps && beforeBumps.length > 0) {
                setShowBumpInterstitial("before");
              } else {
                setCheckoutOpen(true);
              }
            }}
          >
            <Download className="w-5 h-5 mr-2" />
            Buy Now — Get Instant Access
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Download link sent to your email immediately after purchase.
          </p>
        </div>
      </div>

      {/* Checkout Dialog */}
      {effectivePriceId && (
        <CheckoutDialog
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          product={product}
          selectedPriceId={effectivePriceId}
          onSuccess={(email) => {
            setCheckoutOpen(false);
            if (afterBumps && afterBumps.length > 0) {
              setSuccessEmail(email);
              setShowBumpInterstitial("after");
            } else {
              setSuccessEmail(email);
            }
          }}
        />
      )}
    </div>
  );
}
