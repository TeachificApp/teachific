/**
 * WidgetRenderer — public iframe page served at /widget/:token
 *
 * This page is designed to be embedded in an iframe on any external website.
 * It fetches the widget configuration by token and renders the content cards.
 * No auth required — the widget must be marked as isActive.
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

// ─── Type helpers ─────────────────────────────────────────────────────────────

type ResolvedItem = {
  type: string;
  id: number;
  title: string;
  subtitle: string | null;
  coverImageUrl: string | null;
  slug: string | null;
  price: string | null;
  isFree: boolean;
  currency: string | null;
  url: string | null;
};

type WidgetData = {
  id: number;
  orgId: number;
  token: string;
  name: string;
  title: string;
  subtitle: string | null;
  layout: "grid" | "carousel" | "list";
  theme: "light" | "dark" | "brand";
  cardStyle: "standard" | "compact" | "minimal";
  showPrice: boolean;
  showEnrollButton: boolean;
  showCourseDetails: boolean;
  buttonText: string;
  buttonUrl: string;
  maxCards: number;
  organizationTheme: {
    primaryColor: string | null;
    accentColor: string | null;
    buttonColor: string | null;
    buttonTextColor: string | null;
    fontFamily: string | null;
  } | null;
  items: ResolvedItem[];
};

// ─── Theme styles ─────────────────────────────────────────────────────────────

const THEMES = {
  light: {
    bg: "#ffffff",
    cardBg: "#f9fafb",
    cardBorder: "#e5e7eb",
    text: "#111827",
    subtext: "#6b7280",
    badge: "#f3f4f6",
    badgeText: "#374151",
    btn: "#24abbc",
    btnText: "#ffffff",
    btnHover: "#1d8fa0",
  },
  dark: {
    bg: "#0f172a",
    cardBg: "#1e293b",
    cardBorder: "#334155",
    text: "#f1f5f9",
    subtext: "#94a3b8",
    badge: "#334155",
    badgeText: "#cbd5e1",
    btn: "#24abbc",
    btnText: "#ffffff",
    btnHover: "#1d8fa0",
  },
  brand: {
    bg: "#0d1a2e",
    cardBg: "#132036",
    cardBorder: "#1e3a5f",
    text: "#e2f4f7",
    subtext: "#7ecdd8",
    badge: "#1e3a5f",
    badgeText: "#7ecdd8",
    btn: "#24abbc",
    btnText: "#ffffff",
    btnHover: "#1d8fa0",
  },
};

const TYPE_LABELS: Record<string, string> = {
  course: "Course",
  quiz: "Quiz",
  download: "Download",
  bundle: "Bundle",
  webinar: "Webinar",
  workshop: "Workshop",
  membership: "Membership",
  physical: "Product",
  community: "Community",
};

// ─── Card components ──────────────────────────────────────────────────────────

function ContentCard({
  item,
  theme,
  cardStyle,
  showPrice,
  showEnrollButton,
  buttonText,
  buttonUrl,
  organizationTheme,
}: {
  item: ResolvedItem;
  theme: keyof typeof THEMES;
  cardStyle: "standard" | "compact" | "minimal";
  showPrice: boolean;
  showEnrollButton: boolean;
  buttonText: string;
  buttonUrl: string;
  organizationTheme: WidgetData["organizationTheme"];
}) {
  const baseTheme = THEMES[theme];
  const t = {
    ...baseTheme,
    btn: organizationTheme?.buttonColor || organizationTheme?.primaryColor || baseTheme.btn,
    btnText: organizationTheme?.buttonTextColor || baseTheme.btnText,
    btnHover: organizationTheme?.accentColor || baseTheme.btnHover,
  };
  const targetUrl = buttonUrl || item.url || "#";
  const isCompact = cardStyle === "compact";
  const isMinimal = cardStyle === "minimal";

  const priceDisplay = useMemo(() => {
    if (!showPrice) return null;
    if (item.isFree) return "Free";
    if (item.price) {
      const num = parseFloat(item.price);
      if (!isNaN(num)) {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: (item.currency || "usd").toUpperCase(),
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(num);
      }
    }
    return null;
  }, [item.price, item.isFree, item.currency, showPrice]);

  if (isMinimal) {
    return (
      <div style={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </div>
          {priceDisplay && (
            <div style={{ fontSize: 12, color: t.subtext, marginTop: 2 }}>{priceDisplay}</div>
          )}
        </div>
        {showEnrollButton && (
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: t.btn,
              color: t.btnText,
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {buttonText}
          </a>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: t.cardBg,
      border: `1px solid ${t.cardBorder}`,
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Cover image */}
      {!isCompact && item.coverImageUrl && (
        <div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden", flexShrink: 0 }}>
          <img
            src={item.coverImageUrl}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        </div>
      )}
      {!isCompact && !item.coverImageUrl && (
        <div style={{
          width: "100%", aspectRatio: "16/9", background: t.badge,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <span style={{ fontSize: 32 }}>
            {item.type === "course" ? "📚" : item.type === "webinar" ? "🎥" : item.type === "workshop" ? "🛠️" : item.type === "community" ? "👥" : "📦"}
          </span>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: isCompact ? "10px 12px" : "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Type badge */}
        <div style={{
          display: "inline-block",
          background: t.badge,
          color: t.badgeText,
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 4,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          alignSelf: "flex-start",
        }}>
          {TYPE_LABELS[item.type] || item.type}
        </div>

        <div style={{ fontSize: isCompact ? 13 : 15, fontWeight: 700, color: t.text, lineHeight: 1.3 }}>
          {item.title}
        </div>

        {!isCompact && item.subtitle && (
          <div style={{ fontSize: 12, color: t.subtext, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {item.subtitle}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Price + CTA row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
          {priceDisplay && (
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{priceDisplay}</div>
          )}
          {showEnrollButton && (
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: t.btn,
                color: t.btnText,
                padding: isCompact ? "5px 12px" : "7px 16px",
                borderRadius: 7,
                fontSize: isCompact ? 12 : 13,
                fontWeight: 600,
                textDecoration: "none",
                whiteSpace: "nowrap",
                marginLeft: priceDisplay ? 0 : "auto",
              }}
            >
              {buttonText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export default function WidgetRenderer() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data: widget, isLoading, error } = trpc.widgetAdmin.getByToken.useQuery(
    { token: token || "" },
    { enabled: !!token, retry: false }
  );

  if (!token) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, color: "#6b7280", textAlign: "center" }}>
        No widget token provided.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#24abbc", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !widget) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, color: "#6b7280", textAlign: "center", fontSize: 14 }}>
        Widget not found or unavailable.
      </div>
    );
  }

  const baseTheme = THEMES[widget.theme as keyof typeof THEMES] || THEMES.light;
  const t = {
    ...baseTheme,
    btn: widget.organizationTheme?.buttonColor || widget.organizationTheme?.primaryColor || baseTheme.btn,
    btnText: widget.organizationTheme?.buttonTextColor || baseTheme.btnText,
    btnHover: widget.organizationTheme?.accentColor || baseTheme.btnHover,
  };
  const items = (widget.items as ResolvedItem[]).slice(0, widget.maxCards);

  const gridCols = widget.layout === "list" ? 1
    : items.length === 1 ? 1
    : items.length === 2 ? 2
    : 3;

  return (
    <div style={{
      fontFamily: widget.organizationTheme?.fontFamily || "'Inter', system-ui, -apple-system, sans-serif",
      background: t.bg,
      minHeight: "100vh",
      padding: "20px 16px 24px",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      {(widget.title || widget.subtitle) && (
        <div style={{ marginBottom: 20, textAlign: "center" }}>
          {widget.title && (
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, lineHeight: 1.2 }}>
              {widget.title}
            </h2>
          )}
          {widget.subtitle && (
            <p style={{ margin: "8px 0 0", fontSize: 14, color: t.subtext, lineHeight: 1.5 }}>
              {widget.subtitle}
            </p>
          )}
        </div>
      )}

      {/* Content grid */}
      {items.length === 0 ? (
        <div style={{ textAlign: "center", color: t.subtext, fontSize: 14, padding: "32px 0" }}>
          No content items in this widget.
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gap: widget.cardStyle === "minimal" ? 8 : 16,
        }}>
          {items.map(item => (
            <ContentCard
              key={`${item.type}:${item.id}`}
              item={item}
              theme={widget.theme as keyof typeof THEMES}
              cardStyle={widget.cardStyle as "standard" | "compact" | "minimal"}
              showPrice={widget.showPrice}
              showEnrollButton={widget.showEnrollButton}
              buttonText={widget.buttonText}
              buttonUrl={widget.buttonUrl}
              organizationTheme={widget.organizationTheme}
            />
          ))}
        </div>
      )}

      {/* Powered by footer */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <a
          href="https://course360.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: t.subtext, textDecoration: "none", opacity: 0.6 }}
        >
          Powered by Course360™
        </a>
      </div>
    </div>
  );
}
