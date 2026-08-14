/**
 * LMSLayout — Dedicated layout for the teachific.app/learn subdomain.
 * No sidebar — navigation is handled via the top header only.
 *
 * My Dashboard and My Profile redirect to the platform home
 * (the single hub for profile/subscriptions across all apps).
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LogIn, LogOut, Settings, ChevronDown,
  GraduationCap, FolderOpen, ExternalLink, LayoutDashboard,
  BookOpen, Menu, X, ShieldCheck, MessageSquare, Users, DollarSign, Briefcase
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import NameCollectionModal from "@/components/NameCollectionModal";

const PLATFORM_LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/UrcfdRVE8J6mpMNR48QuFe/aaus_logo_ring_01cc7ccd.webp";
const MEMBERS_URL = "/";
import { getAdminUrl, APP_URL, getSubdomain } from "@/hooks/useSubdomain";
import { useSiteNavMenu } from "@/hooks/useSiteNavMenu";
import { SiteNavHeaderLinks, SiteNavProfileLinks } from "@/components/SiteNavLinks";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
  external?: boolean;
}

const PLATFORM_SITE_URL = "https://teachific.app";

const NAV_ITEMS: NavItem[] = [
  { label: "Education Library", href: "/education-library", icon: <BookOpen className="w-4 h-4" /> },
  { label: "Workshops", href: "/workshops", icon: <Briefcase className="w-4 h-4" /> },
  { label: "Community", href: "/community/all-about-ultrasound", icon: <Users className="w-4 h-4" /> },
];

export default function LMSLayout({ children }: { children: React.ReactNode }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const subdomain = getSubdomain();
  const { data: organization } = trpc.orgs.publicSchoolBySlug.useQuery(
    { slug: subdomain! },
    { enabled: !!subdomain },
  );
  const isOrganizationShell = !!subdomain;
  const shellBrandName = organization?.name ?? "Teachific™";
  const shellBrandLogo = organization?.logoUrl ?? PLATFORM_LOGO_URL;
  const defaultNavItems = isOrganizationShell
    ? NAV_ITEMS.map((item) => item.label === "Community" ? { ...item, href: "/community" } : item)
    : NAV_ITEMS;
  const { items: headerNavItems } = useSiteNavMenu("header", defaultNavItems.map((item) => ({
    label: item.label,
    href: item.href,
    external: item.external,
  })));
  const { items: profileNavItems } = useSiteNavMenu("profile", []);

  // Funnel pages (/:slug/:pageSlug) should render without the LMS header.
  // Detect by checking: two path segments, not starting with any known system prefix.
  const SYSTEM_PREFIXES = ["/admin", "/courses", "/downloads", "/product", "/media",
    "/my-", "/auth", "/login", "/register", "/profile", "/platform-admin",
    "/education-library", "/collections", "/bundles", "/quiz", "/community"];
  const isFunnelPage = (() => {
    const parts = location.replace(/^\//,"").split("/").filter(Boolean);
    if (parts.length !== 2) return false;
    return !SYSTEM_PREFIXES.some(p => location.startsWith(p));
  })();

  const { isAuthenticated, user, loading: authLoading, logout } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const appRoles: string[] = (user as any)?.appRoles ?? [];
  const isPlatformAdmin = appRoles.includes("platform_admin") || isAdmin;

  function isActive(href: string, exact?: boolean) {
    if (exact) return location === href;
    return location.startsWith(href);
  }

  // Funnel pages render standalone — no header, no LMS chrome
  if (isFunnelPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#f0fbfc]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200/60 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14">
          {/* Logo + branding */}
          <Link href="/">
            <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none shrink-0">
              {shellBrandLogo ? <img src={shellBrandLogo} alt={`${shellBrandName} logo`} className="w-7 sm:w-8 h-7 sm:h-8 rounded-full object-contain" /> : <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full org-btn flex items-center justify-center text-xs font-bold">{shellBrandName[0]}</div>}
              <div className="flex flex-col leading-none">
                <span className="text-[9px] sm:text-[10px] font-medium text-gray-500 hidden sm:block">{shellBrandName}</span>
                <span className="text-xs sm:text-sm font-bold org-text">{isOrganizationShell ? "Learning Portal" : "Learning Platform"}</span>
              </div>
            </div>
          </Link>

          {/* Desktop nav links */}
          <SiteNavHeaderLinks
            items={headerNavItems}
            location={location}
            className="hidden md:flex ml-4"
          />
          {!isOrganizationShell && <nav className="hidden md:flex items-center gap-1">
            {/* External brand links */}
            <a
              href={PLATFORM_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            >
              Teachific™
            </a>
          </nav>}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated && <NotificationBell />}

            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => { setAccountOpen(!accountOpen); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {(user as any)?.avatarUrl ? (
                    <img src={(user as any).avatarUrl} alt="Avatar" className="w-7 h-7 rounded-full object-cover shrink-0 border" style={{ borderColor: 'color-mix(in srgb, var(--org-primary) 30%, transparent)' }} />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, var(--org-primary) 0%, var(--org-accent) 100%)' }}>
                      {((user as any)?.displayName || (user as any)?.name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm text-gray-700 max-w-[120px] truncate">
                    {(user as any)?.displayName || (user as any)?.name || (user as any)?.email || "Account"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
                      {/* User info */}
                      <div className="px-3 py-2 border-b border-gray-100 mb-1">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {(user as any)?.displayName || (user as any)?.name || "Account"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {(user as any)?.email || ""}
                        </p>
                      </div>

                      {/* My Dashboard — stays on learn domain */}
                      <a
                        href="/my-dashboard"
                        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => setAccountOpen(false)}
                      >
                        <LayoutDashboard className="w-3.5 h-3.5 org-text" /> My Dashboard
                      </a>
                      <SiteNavProfileLinks
                        items={profileNavItems}
                        location={location}
                        onNavigate={() => setAccountOpen(false)}
                      />
                      {isPlatformAdmin && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Admin</div>
                          <a href={getAdminUrl("/platform-admin")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" /> Platform Admin
                          </a>
                          <a href={getAdminUrl("/admin/lms")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <Settings className="w-3.5 h-3.5 text-gray-500" /> LMS Admin
                          </a>
                          <a href={getAdminUrl("/admin/media-repository")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <FolderOpen className="w-3.5 h-3.5 text-gray-500" /> Media Repository
                          </a>
                          <a href={getAdminUrl("/admin/lesson-comments")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-500" /> Lesson Comments
                          </a>
                          <a href={getAdminUrl("/admin/community")} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-gray-500" /> Community Admin
                          </a>
                        </>
                      )}

                      {/* Affiliate Dashboard */}
                      {appRoles.includes("affiliate") && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Affiliate</div>
                          <a href={`${MEMBERS_URL}/affiliate-dashboard`} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-[color-mix(in_srgb,var(--org-primary)_10%,transparent)] hover:text-[var(--org-primary)] cursor-pointer flex items-center gap-2">
                            <DollarSign className="w-3.5 h-3.5 text-[var(--org-primary)]" /> Affiliate Dashboard
                          </a>
                        </>
                      )}

                      {/* Instructor Portal */}
                      {appRoles.includes("instructor") && (
                        <>
                          <div className="border-t border-gray-100 my-1" />
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Instructor</div>
                          <a href={`${MEMBERS_URL}/instructor-portal`} onClick={() => setAccountOpen(false)} className="px-3 py-2 text-sm text-gray-700 hover:bg-[color-mix(in_srgb,var(--org-primary)_10%,transparent)] hover:text-[var(--org-primary)] cursor-pointer flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-[var(--org-primary)]" /> Instructor Portal
                          </a>
                        </>
                      )}

                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setAccountOpen(false); logout(); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-xl"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <a
                href={getLoginUrl()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors org-btn"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </a>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setAccountOpen(false); }}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-3 py-2 flex flex-col gap-0.5">
            <SiteNavHeaderLinks
              items={headerNavItems}
              location={location}
              onNavigate={() => setMobileMenuOpen(false)}
              className="flex-col items-stretch gap-0.5"
            />
            {!isOrganizationShell && <div className="border-t border-gray-100 mt-1 pt-1 flex flex-col gap-1">
              <a
                href={PLATFORM_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ExternalLink className="w-4 h-4" /> Teachific™
              </a>
            </div>}
          </div>
        )}
      </header>

      {/* Page content — full width, no sidebar offset */}
      <main className="flex-1">
        {children}
      </main>

      {/* Name collection gate — shown to authenticated users without a full name */}
      <NameCollectionModal />
    </div>
  );
}
