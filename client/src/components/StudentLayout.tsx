import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { Award, BookOpen, GraduationCap, LayoutDashboard, LogOut, Receipt, User } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";

/**
 * StudentLayout — shown to regular org members (role: "member" | "user").
 * Provides a clean top-nav with links to My Courses, Browse, and Profile.
 * No admin sidebar is shown.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: orgs } = trpc.orgs.myOrgs.useQuery(undefined, { enabled: !!user });
  const orgSlug = orgs?.[0]?.slug;

  const navItems = [
    { label: "My Courses", path: "/lms/my-courses", icon: BookOpen },
    { label: "My Certificates", path: "/lms/my-certificates", icon: Award },
    { label: "My Receipts", path: "/my-receipts", icon: Receipt },
    { label: "Browse", path: orgSlug ? getOrgBaseUrl(orgSlug) : "/school", icon: GraduationCap },
  ];

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 h-14 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container h-full flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => setLocation("/lms/my-courses")}
            className="flex items-center gap-1 focus:outline-none"
          >
            <span
              className="text-[20px] font-bold tracking-tight select-none"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
            >
              <span className="text-foreground">teach</span>
              <span style={{ color: "#24abbc" }}>ific</span>
              <span className="text-foreground" style={{ fontSize: "0.45em", verticalAlign: "super", marginLeft: "1px" }}>™</span>
            </span>
          </button>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.path || location.startsWith(item.path + "/");
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2">
                <p className="text-sm font-medium truncate">{user?.name ?? user?.email ?? "Student"}</p>
                {user?.email && user.name && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/profile")}>
                <User className="h-4 w-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/lms/my-courses")}>
                <LayoutDashboard className="h-4 w-4 mr-2" /> My Learning
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/lms/my-certificates")}>
                <Award className="h-4 w-4 mr-2" /> My Certificates
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLocation("/my-receipts")}>
                <Receipt className="h-4 w-4 mr-2" /> My Receipts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => { await logout(); window.location.href = getLoginUrl(); }}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
