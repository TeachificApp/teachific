import { useAuth } from "@/_core/hooks/useAuth";
import StudentLayout from "./StudentLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { getSubdomain } from "@/hooks/useSubdomain";
import { usePlanLimits, PLAN_DISPLAY } from "@/hooks/usePlanLimits";
import {
  Activity,
  BarChart3,
  BookOpen,
  Box,
  Building2,
  ChevronDown,
  ClipboardList,
  Code2,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Globe,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  PanelLeft,
  PenTool,
  Receipt,
  Settings,
  Share2,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Ticket,
  TrendingUp,
  User,
  UserCheck,
  UserCog,
  Users,
  Video,
  Wallet,
  Webhook,
  Zap,
  Library,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { ProductSwitcher } from "./ProductSwitcher";

// ─── Impersonation Banner ────────────────────────────────────────────────────
function ImpersonationBanner({ userName }: { userName: string }) {
  return (
    <div className="sticky top-14 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium border-b border-amber-600 shadow-sm">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4" />
        <span>Viewing as <strong>{userName}</strong> — impersonation session active</span>
      </div>
      <button
        onClick={async () => {
          try {
            await fetch("/api/trpc/platformAdmin.endImpersonation", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ json: null }),
            });
          } finally {
            window.location.href = "/platform-admin";
          }
        }}
        className="ml-4 px-3 py-1 rounded bg-amber-700 text-white hover:bg-amber-800 text-xs font-semibold transition-colors"
      >
        Exit Impersonation
      </button>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type NavSubItem = { label: string; path: string; external?: boolean };
type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  subItems?: NavSubItem[];
};
type NavGroup = {
  label?: string;
  dividerBefore?: boolean;
  adminOnly?: boolean;
  items: NavItem[];
};

// ─── Nav Definition ───────────────────────────────────────────────────────────
const navGroups: NavGroup[] = [
  // ── Top level ──
  {
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/lms" },
    ],
  },

  // ── Members ──
  {
    dividerBefore: true,
    items: [
      {
        icon: Users,
        label: "Members",
        path: "/members",
        subItems: [
          { label: "All Users", path: "/members/users" },
          { label: "Groups", path: "/members/groups" },
          { label: "Certificates", path: "/members/certificates" },
          { label: "Discussions", path: "/members/discussions" },
          { label: "Assignments", path: "/members/assignments" },
        ],
      },
    ],
  },

  // ── Products ──
  {
    dividerBefore: true,
    items: [
      {
        icon: Package,
        label: "Products",
        path: "/products",
        subItems: [
          { label: "Courses", path: "/lms/courses" },
          { label: "Cohorts", path: "/lms/courses?type=cohort" },
          { label: "Digital Downloads", path: "/lms/downloads" },
          { label: "Webinars", path: "/lms/webinars" },
          { label: "Memberships", path: "/products/memberships" },
          { label: "Bundles", path: "/products/bundles" },
          { label: "Physical Products", path: "/products/physical" },
          { label: "Workshops", path: "/products/workshops" },
          { label: "Forms", path: "/lms/forms" },
          { label: "Community", path: "/products/community" },
          { label: "Categories", path: "/products/categories" },
          { label: "Media Library", path: "/media-library" },
          { label: "Question Bank", path: "/question-bank" },
          { label: "Teachific Studio™", path: "/studio" },
        ],
      },
    ],
  },

  // ── Marketing ──
  {
    dividerBefore: true,
    items: [
      {
        icon: TrendingUp,
        label: "Marketing",
        path: "/marketing",
        subItems: [
          { label: "Website", path: "/marketing/website" },
          { label: "Widgets", path: "/marketing/widgets" },
          { label: "Email Campaigns", path: "/marketing/email" },
          { label: "Funnels", path: "/admin/funnels" },
          { label: "Affiliates", path: "/marketing/affiliates" },
        ],
      },
    ],
  },

  // ── Sales ──
  {
    dividerBefore: true,
    items: [
      {
        icon: ShoppingCart,
        label: "Sales",
        path: "/sales",
        subItems: [
          { label: "Orders", path: "/sales/orders" },
          { label: "Subscriptions", path: "/sales/subscriptions" },
          { label: "Group Orders", path: "/sales/group-orders" },
          { label: "Coupons", path: "/sales/coupons" },
          { label: "Invoices", path: "/sales/invoices" },
          { label: "Revenue Partners", path: "/sales/revenue-partners" },
          { label: "Order Bumps", path: "/sales/order-bumps" },
        ],
      },
    ],
  },

  // ── Analytics ──
  {
    dividerBefore: true,
    items: [
      {
        icon: BarChart3,
        label: "Analytics",
        path: "/analytics-hub",
        subItems: [
          { label: "Revenue", path: "/analytics/revenue" },
          { label: "Engagement", path: "/analytics/engagement" },
          { label: "Organization", path: "/analytics/organization" },
          { label: "Marketing", path: "/analytics/marketing" },
          { label: "Custom Reports", path: "/analytics/custom-reports" },
          { label: "Downloads Reports", path: "/admin/downloads/reports" },
          { label: "Webinar Reports", path: "/lms/webinars/reports" },
        ],
      },
    ],
  },

  // ── Integrations ──
  {
    dividerBefore: true,
    items: [
      {
        icon: Webhook,
        label: "Integrations",
        path: "/integrations",
        adminOnly: true,
        subItems: [
          { label: "All Integrations", path: "/integrations" },
          { label: "Import from Thinkific", path: "/integrations/thinkific" },
          { label: "Import from Teachable", path: "/integrations/teachable" },
          { label: "Import from Kajabi", path: "/integrations/kajabi" },
          { label: "Webhooks / Zapier", path: "/integrations/webhooks" },
          { label: "API Keys", path: "/integrations/api" },
        ],
      },
    ],
  },
  // ── Settings ──
  {
    dividerBefore: true,
    items: [
      {
        icon: Settings,
        label: "Settings",
        path: "/lms/settings",
        adminOnly: true,
      },
    ],
  },
  // ── Platform Admin ──
  {
    dividerBefore: true,
    adminOnly: true,
    items: [
      {
        icon: Shield,
        label: "Platform Admin",
        path: "/platform-admin",
        adminOnly: true,
      },
    ],
  },
  // ── Help & Support ──
  {
    dividerBefore: true,
    items: [
      {
        icon: HelpCircle,
        label: "Help & Support",
        path: "/support",
      },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 220;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  // Detect subdomain so myContext scopes to the correct org when on a subdomain
  const currentSubdomain = getSubdomain() ?? undefined;
  // Fetch org membership role to determine if user is admin or a regular member
  const { data: orgCtx, isLoading: orgLoading } = trpc.orgs.myContext.useQuery(
    { subdomain: currentSubdomain },
    { enabled: !!user }
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading || (user && orgLoading)) return <DashboardLayoutSkeleton />;

  // Regular members (role: member or user) get the student layout — no admin sidebar
  const isAdminRole = (
    user?.role === "site_owner" ||
    user?.role === "site_admin" ||
    user?.role === "org_super_admin" ||
    orgCtx?.role === "org_admin"
  );
  if (user && !isAdminRole) {
    return <StudentLayout>{children}</StudentLayout>;
  }

  if (!user) {
    const searchParams = new URLSearchParams(window.location.search);
    const errorCode = searchParams.get("error");
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full bg-white/5 backdrop-blur rounded-2xl border border-white/10 shadow-2xl">
          <div className="flex flex-col items-center gap-4">
            <span className="text-4xl font-bold tracking-tight select-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.03em" }}>
              <span className="text-white">teach</span>
              <span style={{ color: "#24abbc" }}>ific</span>
              <span className="text-white" style={{ fontSize: "0.45em", verticalAlign: "super", marginLeft: "2px" }}>™</span>
            </span>
            {errorCode === "registration_closed" ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-300 text-center">
                <p className="font-semibold mb-1">Registration is currently closed</p>
                <p className="text-xs text-amber-400/80">Contact the platform administrator to request access.</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center max-w-sm">
                Sign in to access your content library, manage SCORM packages, and track learner progress.
              </p>
            )}
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full">
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "site_admin" || user?.role === "site_owner";
  const isOwner = user?.role === "site_owner";

  // Fetch org slug for the Preview link
  const { data: orgs } = trpc.orgs.myOrgs.useQuery();
  const orgSlug = orgs?.[0]?.slug;
  const previewUrl = orgSlug
    ? `${getOrgBaseUrl(orgSlug, orgs?.[0]?.customDomain, orgs?.[0]?.domainVerificationStatus)}?preview=1`
    : null;

  // Determine which accordion groups are open
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.subItems) {
          const anyActive = item.subItems.some(
            (s) => location === s.path || (s.path !== "/" && location.startsWith(s.path))
          );
          if (anyActive) initial.add(item.path);
        }
      }
    }
    return initial;
  });

  const toggleGroup = (path: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const isItemActive = (item: NavItem) => {
    if (item.path === "/lms") return location === "/lms" || location === "/";
    return location.startsWith(item.path);
  };

  const isSubItemActive = (sub: NavSubItem) =>
    location === sub.path || (sub.path !== "/" && location.startsWith(sub.path));

  // Find active item for header breadcrumb
  const allItems = navGroups.flatMap((g) => g.items);
  const activeItem =
    allItems.find((i) => {
      if (i.path === "/lms") return location === "/lms" || location === "/";
      return location.startsWith(i.path) && i.path !== "/lms";
    }) ?? allItems.find((i) => i.path === "/lms");

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-border/40">
          {/* Logo header */}
          <SidebarHeader className="h-14 justify-center border-b border-border/40 px-3">
            <div className="flex items-center gap-2.5 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/50" />
              </button>
              {!isCollapsed && (
                <span className="text-[21px] font-bold tracking-tight select-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}>
                  <span className="text-sidebar-foreground">teach</span>
                  <span style={{ color: "#24abbc" }}>ific</span>
                  <span className="text-sidebar-foreground" style={{ fontSize: "0.45em", verticalAlign: "super", marginLeft: "1px" }}>™</span>
                </span>
              )}
              {isCollapsed && (
                <span className="text-[21px] font-bold select-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#24abbc" }}>t</span>
              )}
            </div>
          </SidebarHeader>

          {/* Nav items */}
          <SidebarContent className="py-2 px-0 overflow-y-auto">
            {navGroups.map((group, groupIdx) => {
              if (group.adminOnly && !isAdmin) return null;
              return (
                <div key={groupIdx}>
                  {group.dividerBefore && (
                    <div className="mx-3 my-1.5 border-t border-border/25" />
                  )}
                  <div className="px-2 space-y-0.5">
                    {group.items
                      .filter((item) => {
                        if (item.ownerOnly && !isOwner) return false;
                        if (item.adminOnly && !isAdmin) return false;
                        return true;
                      })
                      .map((item) => {
                        const active = isItemActive(item);
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const isOpen = openGroups.has(item.path);

                        return (
                          <div key={item.path}>
                            <button
                              onClick={() => {
                                if (hasSubItems && !isCollapsed) {
                                  toggleGroup(item.path);
                                } else {
                                  setLocation(item.path);
                                }
                              }}
                              title={isCollapsed ? item.label : undefined}
                              className={[
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group",
                                active
                                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                isCollapsed ? "justify-center px-2" : "",
                              ].join(" ")}
                            >
                              <item.icon
                                className={[
                                  "h-[17px] w-[17px] shrink-0",
                                  active
                                    ? "text-primary-foreground"
                                    : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                                ].join(" ")}
                              />
                              {!isCollapsed && (
                                <>
                                  <span className="flex-1 text-left leading-none">{item.label}</span>
                                  {hasSubItems && (
                                    <ChevronDown
                                      className={[
                                        "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                                        isOpen ? "rotate-0" : "-rotate-90",
                                        active ? "text-primary-foreground/70" : "text-sidebar-foreground/35",
                                      ].join(" ")}
                                    />
                                  )}
                                </>
                              )}
                            </button>

                            {/* Sub-items */}
                            {hasSubItems && !isCollapsed && isOpen && (
                              <div className="ml-4 mt-0.5 mb-1 pl-3 border-l-2 border-primary/25 space-y-0.5">
                                {/* Inject Preview sub-item under Website */}
                                {item.path === "/marketing" && previewUrl && (
                                  <button
                                    key="preview"
                                    onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
                                    className="w-full text-left px-2 py-1.5 rounded-md text-[13px] transition-all duration-150 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 flex items-center gap-1.5"
                                  >
                                    <Globe className="h-3 w-3 shrink-0 opacity-60" />
                                    Preview Site
                                  </button>
                                )}
                                {item.subItems!.map((sub) => {
                                  const subActive = isSubItemActive(sub);
                                  return (
                                    <button
                                      key={sub.label + sub.path}
                                      onClick={() => {
                                        if (sub.external) {
                                          window.open(sub.path, "_blank", "noopener,noreferrer");
                                        } else {
                                          setLocation(sub.path);
                                        }
                                      }}
                                      className={[
                                        "w-full text-left px-2 py-1.5 rounded-md text-[13px] transition-all duration-150",
                                        subActive && !sub.external
                                          ? "text-primary font-medium bg-primary/8"
                                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                                      ].join(" ")}
                                    >
                                      {sub.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </SidebarContent>
          {/* Cross-product switcher — only shown when user has other subscriptions */}
          {!isCollapsed && (
            <ProductSwitcher current="lms" variant="sidebar" />
          )}
          {/* Plan badge in sidebar footer */}
          {!isCollapsed && (
            <div className="px-3 py-2 border-t border-sidebar-border/40">
              <PlanBadgeSidebar />
            </div>
          )}
        </Sidebar>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors z-50"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset style={{ marginLeft: "2px" }}>
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg" />}
            {activeItem && (
              <div className="flex items-center gap-2">
                <activeItem.icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{activeItem.label}</span>
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-7 w-7 border shrink-0">
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {user?.name?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                {!isMobile && (
                  <div className="hidden sm:flex flex-col items-start min-w-0 max-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate leading-none">{user?.name || "User"}</span>
                      {(isAdmin || user?.role === "org_admin") && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">
                          {isOwner ? "Owner" : user?.role === "site_admin" ? "Admin" : "Org Admin"}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate mt-0.5 w-full">{user?.email || ""}</span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/billing")} className="cursor-pointer">
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {(user as any)?.impersonatedBy && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await fetch("/api/trpc/platformAdmin.endImpersonation", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ json: null }),
                        });
                      } finally {
                        window.location.href = "/platform-admin";
                      }
                    }}
                    className="cursor-pointer text-amber-600 focus:text-amber-600"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Exit Impersonation
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={async () => { await logout(); window.location.href = "/"; }} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Impersonation banner */}
        {(user as any)?.impersonatedBy && (
          <ImpersonationBanner userName={user?.name || user?.email || "User"} />
        )}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)]">{children}</main>
      </SidebarInset>
    </>
  );
}

// ─── Plan Badge Sidebar ───────────────────────────────────────────────────────
function PlanBadgeSidebar() {
  const { plan, isLoading } = usePlanLimits();
  const [, setLocation] = useLocation();
  if (isLoading) return null;
  const display = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.free;
  const isPaid = plan !== "free";
  return (
    <button
      onClick={() => setLocation("/billing")}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${isPaid ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
        <span className={`text-xs font-medium ${display.color}`}>{display.label} Plan</span>
      </div>
      {!isPaid && (
        <span className="text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">Upgrade →</span>
      )}
    </button>
  );
}
