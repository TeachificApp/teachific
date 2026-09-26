import { useMemo, useRef, useState } from "react";
import { useParams, useSearch } from "wouter";
import { CheckCircle2, Loader2, Package, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getSubdomain } from "@/hooks/useSubdomain";

const DEFAULT_PRIMARY = "#189aa1";
const DEFAULT_ACCENT = "#4ad9e0";

function validColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function formatPrice(value: unknown, currency: string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Price unavailable";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(amount);
}

function parseFeatures(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    // Plain-text descriptions are not interpreted as HTML or executable content.
  }
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function htmlToPlainText(value: unknown) {
  if (typeof value !== "string") return "";
  if (typeof window === "undefined") return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent || element.innerText || "").replace(/\s+/g, " ").trim();
}

function parseLandingBlocks(value: string | null | undefined): Array<{ id: string; type: string; data: Record<string, unknown> }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((block): block is { id: string; type: string; data: Record<string, unknown> } =>
      !!block && typeof block.id === "string" && typeof block.type === "string" && !!block.data && typeof block.data === "object",
    );
  } catch {
    return [];
  }
}

export default function PublicPhysicalProductSalesPage() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const orgSlug = getSubdomain() ?? undefined;
  const preview = new URLSearchParams(search).get("preview") === "admin";
  const [selectedOptionId, setSelectedOptionId] = useState<number | undefined>();
  const [promoCode, setPromoCode] = useState("");
  const checkoutRef = useRef<HTMLElement>(null);

  const productQuery = trpc.productsPublic.getBySlug.useQuery(
    { slug: slug ?? "", ...(orgSlug ? { orgSlug } : {}), ...(preview ? { preview: true } : {}) },
    { enabled: !!slug, retry: false },
  );
  const checkout = trpc.productsLearner.createCheckout.useMutation({
    onSuccess: (result) => {
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
      else if (result.free) toast.success("Your product access has been recorded.");
    },
    onError: (error) => toast.error(error.message),
  });

  const product = productQuery.data?.product;
  const options = productQuery.data?.pricingOptions ?? [];
  const organization = productQuery.data?.organization;
  const selectedOption = options.find((option: any) => option.id === selectedOptionId) ?? options[0];
  const price = selectedOption?.price ?? product?.price;
  const primary = validColor(organization?.primaryColor ?? organization?.buttonColor, DEFAULT_PRIMARY);
  const accent = validColor(organization?.accentColor, DEFAULT_ACCENT);
  const features = useMemo(() => parseFeatures(product?.landingFeatures), [product?.landingFeatures]);
  const landingBlocks = useMemo(() => parseLandingBlocks(product?.landingBlocks), [product?.landingBlocks]);
  const checkoutComplete = new URLSearchParams(search).get("success") === "1";

  if (productQuery.isLoading) {
    return <main className="min-h-screen grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></main>;
  }

  if (!product || productQuery.isError) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 px-6 text-center">
        <div className="max-w-md">
          <Package className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900">Product not found</h1>
          <p className="mt-2 text-slate-600">This product may no longer be available from this organization.</p>
        </div>
      </main>
    );
  }

  const isNative = product.checkoutMode === "native";
  const beginCheckout = () => {
    if (!isNative) {
      toast.error("This product is not currently available through Course360 checkout.");
      return;
    }
    checkout.mutate({
      productId: product.id,
      ...(selectedOption?.id ? { pricingOptionId: selectedOption.id } : {}),
      ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}),
    });
  };

  const scrollToCheckout = () => checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  const renderLandingBlock = (block: { id: string; type: string; data: Record<string, unknown> }) => {
    const data = block.data;
    const heading = htmlToPlainText(data.headline ?? data.heading ?? data.title);
    const text = htmlToPlainText(data.subheadline ?? data.text ?? data.content ?? data.description);
    const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl : typeof data.src === "string" ? data.src : "";
    const items = Array.isArray(data.items) ? data.items.map((item) => typeof item === "string" ? item : htmlToPlainText((item as any)?.text ?? (item as any)?.title)).filter(Boolean) : [];

    if (["hero", "cta_standalone", "pricing_cta", "cta"].includes(block.type)) {
      return (
        <section key={block.id} className="border-y bg-white px-5 py-14 text-center">
          <div className="mx-auto max-w-3xl">
            {heading && <h2 className="text-3xl font-bold text-slate-950">{heading}</h2>}
            {text && <p className="mt-4 text-lg leading-7 text-slate-700">{text}</p>}
            <button type="button" onClick={scrollToCheckout} className="mt-6 rounded-lg px-6 py-3 font-semibold text-white" style={{ backgroundColor: primary }}>
              {htmlToPlainText(data.ctaText ?? data.buttonText) || "Buy securely"}
            </button>
          </div>
        </section>
      );
    }
    if (block.type === "image" && imageUrl) {
      return <section key={block.id} className="mx-auto max-w-5xl px-5 py-10"><img src={imageUrl} alt={htmlToPlainText(data.alt ?? data.caption)} className="w-full rounded-2xl object-cover" /></section>;
    }
    if (["bullets", "checklist", "numbered_list"].includes(block.type) && items.length > 0) {
      return (
        <section key={block.id} className="mx-auto max-w-3xl px-5 py-10">
          {heading && <h2 className="text-2xl font-bold text-slate-950">{heading}</h2>}
          <ul className="mt-5 space-y-3">
            {items.map((item, index) => <li key={`${block.id}-${index}`} className="flex gap-3 text-slate-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primary }} />{item}</li>)}
          </ul>
        </section>
      );
    }
    if (block.type === "faq" && Array.isArray(data.items)) {
      return (
        <section key={block.id} className="mx-auto max-w-3xl px-5 py-10">
          {heading && <h2 className="text-2xl font-bold text-slate-950">{heading}</h2>}
          <div className="mt-5 space-y-3">{data.items.map((item: any, index: number) => <details key={`${block.id}-${index}`} className="rounded-lg border bg-white p-4"><summary className="cursor-pointer font-semibold">{htmlToPlainText(item?.question)}</summary><p className="mt-3 leading-6 text-slate-700">{htmlToPlainText(item?.answer)}</p></details>)}</div>
        </section>
      );
    }
    if (heading || text) {
      return <section key={block.id} className="mx-auto max-w-3xl px-5 py-10"><>{heading && <h2 className="text-2xl font-bold text-slate-950">{heading}</h2>}{text && <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{text}</p>}</></section>;
    }
    return null;
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          {organization?.logoUrl ? (
            <img src={organization.logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded text-sm font-bold text-white" style={{ backgroundColor: primary }}>
              {(organization?.name || "C").slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-semibold">{organization?.name || "Course360™"}</span>
        </div>
      </header>

      {checkoutComplete && (
        <div className="border-b bg-emerald-50 px-5 py-3 text-center text-sm font-medium text-emerald-800">
          Thank you. Your order is confirmed and fulfillment is being prepared.
        </div>
      )}

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[1.15fr_.85fr] lg:py-16">
        <div>
          {product.thumbnailUrl ? (
            <img src={product.thumbnailUrl} alt={product.title} className="aspect-square w-full rounded-2xl border bg-white object-cover shadow-sm" />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-2xl border bg-white text-slate-400 shadow-sm"><Package className="h-20 w-20" /></div>
          )}
        </div>

        <div className="self-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: primary }}>Physical product</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{product.landingHeadline || product.title}</h1>
          {product.subtitle && <p className="mt-4 text-xl text-slate-600">{product.subtitle}</p>}
          {product.landingBody || product.description ? <p className="mt-5 whitespace-pre-line leading-7 text-slate-700">{product.landingBody || product.description}</p> : null}

          <section ref={checkoutRef} className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
            {options.length > 1 && (
              <label className="block text-sm font-semibold text-slate-800">
                Choose an option
                <select
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
                  value={selectedOption?.id ?? ""}
                  onChange={(event) => setSelectedOptionId(Number(event.target.value) || undefined)}
                >
                  {options.map((option: any) => <option key={option.id} value={option.id}>{option.label} — {formatPrice(option.price, product.currency)}</option>)}
                </select>
              </label>
            )}
            <p className="mt-4 text-3xl font-bold text-slate-950">{product.isFree ? "Free" : formatPrice(price, product.currency)}</p>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Discount code <span className="font-normal text-slate-500">(optional)</span>
              <input
                value={promoCode}
                onChange={(event) => setPromoCode(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Enter code"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              onClick={beginCheckout}
              disabled={checkout.isPending || !isNative}
              className="mt-5 flex w-full items-center justify-center rounded-lg px-5 py-3 font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
            >
              {checkout.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Opening secure checkout…</> : product.isFree ? "Request product" : "Buy securely"}
            </button>
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Secure checkout is provided by Stripe. Shipping details are collected only during checkout.</p>
          </section>

          {features.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">Product details</h2>
              <ul className="mt-3 space-y-2">
                {features.map((feature) => <li key={feature} className="flex gap-2 text-slate-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primary }} />{feature}</li>)}
              </ul>
            </section>
          )}
        </div>
      </section>

      {landingBlocks.length > 0 && <div className="border-t bg-white">{landingBlocks.map(renderLandingBlock)}</div>}

      <footer className="border-t bg-white px-5 py-8 text-center text-sm text-slate-500">
        {organization?.name ? `${organization.name} · ` : ""}Powered by Course360™
      </footer>
    </main>
  );
}
