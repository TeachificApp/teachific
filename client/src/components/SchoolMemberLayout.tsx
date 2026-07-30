import { useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen,
  Award,
  User,
  LogOut,
  LayoutGrid,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getOrgBaseUrl } from "@/lib/orgUrl";

interface SchoolMemberLayoutProps {
  children: React.ReactNode;
  orgSlug?: string;
}

const NAV_ITEMS = [
  { label: "My Courses", icon: BookOpen, path: "my-courses" },
  { label: "Certificates", icon: Award, path: "certificates" },
  { label: "Profile", icon: User, path: "profile" },
];

export default function SchoolMemberLayout({ children, orgSlug }: SchoolMemberLayoutProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // When on an org subdomain, the base URL is the org's subdomain URL.
  // On localhost/preview, it falls back to /school/:slug.
  const baseUrl = orgSlug ? getOrgBaseUrl(orgSlug) : "/school";

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = baseUrl; },
  });

  // Resolve the org theme for branding
  const { data: orgBySlug } = trpc.orgs.publicSchoolBySlug.useQuery(
    { slug: orgSlug! },
    { enabled: !!orgSlug }
  );
  const { data: theme } = trpc.lms.themes.get.useQuery(
    { orgId: orgBySlug?.id! },
    { enabled: !!orgBySlug?.id }
  );

  // primaryColor is injected as --org-primary CSS variable by SubdomainThemeProvider.
  // We still read it here for inline style fallbacks in non-subdomain contexts.
  const primaryColor = theme?.primaryColor ?? "#189aa1";
  const schoolName = orgBySlug?.name ?? "Learning Portal";

  // If not logged in, redirect to login
  if (!user) {
    window.location.href = getLoginUrl() + "&returnPath=" + encodeURIComponent(window.location.pathname);
    return null;
  }

  const currentPath = window.location.pathname;

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* School branding */}
      <div className="px-4 py-5 border-b border-border/60">
        <button
          onClick={() => { window.location.href = baseUrl; }}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          {theme?.adminLogoUrl ? (
            <img src={theme.adminLogoUrl} alt={schoolName} className="h-7 object-contain" />
          ) : (
            <div
              className="h-7 w-7 rounded-md flex items-center justify-center text-white font-bold text-xs"
              style={{ backgroundColor: 'var(--org-primary)' }}
            >
              {schoolName[0]}
            </div>
          )}
          <span className="font-semibold text-sm truncate">{schoolName}</span>
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <button
          onClick={() => { window.location.href = baseUrl; }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LayoutGrid className="h-4 w-4" />
          Browse Courses
        </button>
        <div className="pt-2 pb-1">
          <p className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">My Learning</p>
        </div>
        {NAV_ITEMS.map((item) => {
          // Nav items are relative paths within the org's subdomain
          const href = `/${item.path}`;
          const isActive = currentPath === href || currentPath.startsWith(href + "/");
          return (
            <button
              key={item.path}
              onClick={() => { setLocation(href); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "text-white font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={isActive ? { backgroundColor: 'var(--org-primary)' } : {}}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-border/60 space-y-2">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={undefined} />
            <AvatarFallback className="text-xs" style={{ backgroundColor: 'color-mix(in srgb, var(--org-primary) 18%, transparent)', color: 'var(--org-primary)' }}>
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border/60 bg-card">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border/60 z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <span className="font-semibold text-sm">Menu</span>
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-card">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-sm">{schoolName}</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
