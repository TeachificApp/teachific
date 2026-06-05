/**
 * ProductSwitcher
 * Shows links to other Teachific products the current user is subscribed to.
 * Renders nothing if the user has no cross-product subscriptions.
 */
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Product icon CDN URLs (compressed webp)
const PRODUCT_ICON_URLS: Record<string, string> = {
  creator: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-creator-Q43rWNPW6eUUYkvwYEJxKM.webp",
  studio: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-studio-7F38Gi9E9JiKgfVToa93B8.webp",
  quizCreator: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-quizcreator-kzKXGqXXzBGSWcXxf64Xiw.webp",
};

type ProductSwitcherProps = {
  /** Which product the user is currently on — that product is hidden from the switcher */
  current: "lms" | "studio" | "creator" | "quizCreator";
  /** Visual variant: "sidebar" for the LMS sidebar, "topbar" for standalone dashboards */
  variant?: "sidebar" | "topbar";
};

const PRODUCTS = [
  {
    key: "lms" as const,
    label: "Teachific LMS",
    shortLabel: "LMS",
    // LMS is the current app — navigates internally
    href: "/lms",
    external: false,
    iconUrl: null as string | null,
    color: "text-[#24abbc]",
    bg: "bg-[#24abbc]/10 hover:bg-[#24abbc]/20",
    border: "border-[#24abbc]/30",
  },
  {
    key: "quizCreator" as const,
    label: "QuizMaker™",
    shortLabel: "Quiz",
    href: "/quiz-creator-app",
    external: false,
    iconUrl: PRODUCT_ICON_URLS.quizCreator,
    color: "text-[#0e8a96]",
    bg: "bg-[#0e8a96]/10 hover:bg-[#0e8a96]/20",
    border: "border-[#0e8a96]/30",
  },
  {
    key: "studio" as const,
    label: "Teachific Studio™",
    shortLabel: "Studio",
    href: "/studio",
    external: false,
    iconUrl: PRODUCT_ICON_URLS.studio,
    color: "text-[#24abbc]",
    bg: "bg-[#24abbc]/10 hover:bg-[#24abbc]/20",
    border: "border-[#24abbc]/30",
  },
];

export function ProductSwitcher({ current, variant = "topbar" }: ProductSwitcherProps) {
  const { subs, isLoading } = useSubscriptions();

  if (isLoading || !subs) return null;

  const subscriptionMap: Record<string, boolean> = {
    lms: subs.lms.isActive,
    studio: subs.studio.isActive || subs.creator.isActive,
    quizCreator: subs.quizCreator.isActive,
  };

  const available = PRODUCTS.filter(
    (p) => p.key !== current && subscriptionMap[p.key]
  );

  if (available.length === 0) return null;

  if (variant === "sidebar") {
    return (
      <div className="px-3 py-2 border-t border-sidebar-border/40">
        <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1.5 px-1">
          My Apps
        </p>
        <div className="space-y-0.5">
          {available.map((product) => {
            const isInTrial =
              product.key !== "lms" &&
              (subs as any)[product.key]?.isInTrial;
            return (
              <a
                key={product.key}
                href={product.href}
                target={product.external ? "_blank" : undefined}
                rel={product.external ? "noopener noreferrer" : undefined}
              >
                <button className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${product.bg} ${product.color}`}>
                  {product.iconUrl ? (
                    <img src={product.iconUrl} alt={product.label} className="w-4 h-4 rounded shrink-0" />
                  ) : (
                    <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{product.label}</span>
                  {isInTrial && (
                    <Badge className="ml-auto text-[9px] px-1 py-0 h-4 bg-[#24abbc]/20 text-[#24abbc] border-[#24abbc]/30">
                      Trial
                    </Badge>
                  )}
                </button>
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  // topbar variant — compact pill buttons
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-white/30 mr-1">Switch to:</span>
      {available.map((product) => (
        <a
          key={product.key}
          href={product.href}
          target={product.external ? "_blank" : undefined}
          rel={product.external ? "noopener noreferrer" : undefined}
        >
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${product.bg} ${product.color} ${product.border}`}
          >
            {product.iconUrl ? (
              <img src={product.iconUrl} alt={product.shortLabel} className="w-3.5 h-3.5 rounded shrink-0" />
            ) : (
              <LayoutDashboard className="w-3 h-3 shrink-0" />
            )}
            {product.shortLabel}
          </button>
        </a>
      ))}
    </div>
  );
}
