import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useOrgBranding } from "@/hooks/useOrgBranding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Search, Clock, BookOpen, GraduationCap, ChevronRight, Play, FileText } from "lucide-react";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { useOrgScope } from "@/hooks/useOrgScope";

function CourseCard({
  course,
  primaryColor,
  onClick,
}: {
  course: any;
  primaryColor: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-muted relative overflow-hidden">
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: primaryColor + "20" }}>
            <BookOpen className="h-10 w-10" style={{ color: primaryColor }} />
          </div>
        )}
        {course.isFeatured && (
          <Badge className="absolute top-2 left-2 text-xs" style={{ backgroundColor: primaryColor }}>Featured</Badge>
        )}
        {course.level && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-xs capitalize">{course.level}</Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        {course.shortDescription && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{course.shortDescription}</p>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          {course.totalLessons > 0 && (
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              {course.totalLessons} lessons
            </span>
          )}
          {course.estimatedHours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {course.estimatedHours}h
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <div>
            {course.isFree ? (
              <span className="font-bold text-sm text-green-600">Free</span>
            ) : course.startingPrice ? (
              <span className="font-bold text-sm">${course.startingPrice}</span>
            ) : (
              <span className="font-bold text-sm" style={{ color: primaryColor }}>Enroll</span>
            )}
          </div>
          <button
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            View Course
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchoolPage({ subdomainOrg }: { subdomainOrg?: string } = {}) {
  // orgSlug param is present when visiting /school/:orgSlug
  // subdomainOrg is passed when accessed via an org subdomain (e.g. myorg.teachific.app)
  const params = useParams<{ orgSlug?: string }>();
  const orgSlug = subdomainOrg ?? params?.orgSlug;

  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { orgId: activeOrgId, orgs: activeOrgs } = useOrgScope();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [policyModal, setPolicyModal] = useState<"terms" | "privacy" | null>(null);

  // ── Slug-based resolution (public, no auth required) ──────────────────────
  // When a slug is in the URL, look up the org by slug first (works for unauthenticated visitors).
  const { data: orgBySlug } = trpc.orgs.publicSchoolBySlug.useQuery(
    { slug: orgSlug! },
    { enabled: !!orgSlug }
  );

  // ── Fallback: active organization (for /school without a slug) ────────────
  // Resolved orgId: prefer slug-based lookup, then the authenticated active org.
  const orgId: number | undefined = orgSlug
    ? (orgBySlug?.id ?? undefined)
    : (activeOrgId ?? undefined);

  // ── Data queries (all keyed on orgId) ────────────────────────────────────
  // When visiting via a subdomain (orgSlug present), always use the public slug-based procedures.
  // This avoids race conditions where orgId hasn't resolved yet and ensures learners always see
  // published courses regardless of auth state. The admin LMS dashboard uses separate routes.
  const { data: publicCourses, isLoading: publicCoursesLoading } = trpc.lms.publicSchool.coursesBySlug.useQuery(
    { slug: orgSlug! },
    { enabled: !!orgSlug }
  );
  const { data: authedCourses, isLoading: authedCoursesLoading } = trpc.lms.courses.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && !!user && !orgSlug }
  );
  const courses = orgSlug ? publicCourses : (user ? authedCourses : undefined);
  const coursesLoading = orgSlug ? publicCoursesLoading : authedCoursesLoading;

  const { data: publicTheme } = trpc.lms.publicSchool.themeBySlug.useQuery(
    { slug: orgSlug! },
    { enabled: !!orgSlug }
  );
  const { data: authedTheme } = trpc.lms.themes.get.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && !!user && !orgSlug }
  );
  const theme = orgSlug ? publicTheme : (user ? authedTheme : undefined);

  // ── Legal docs: use slug-based endpoint when slug is present ─────────────
  const { data: legalDocsBySlug } = trpc.orgs.publicLegalDocsBySlug.useQuery(
    { slug: orgSlug! },
    { enabled: !!orgSlug }
  );
  const { data: legalDocsByOrgId } = trpc.orgs.publicLegalDocs.useQuery(
    { orgId: orgId! },
    { enabled: !orgSlug && !!orgId }
  );
  // Use whichever source is available
  const legalDocs = orgSlug ? legalDocsBySlug : legalDocsByOrgId;

  const primaryColor = theme?.studentPrimaryColor || theme?.primaryColor || "#24abbc";
  const activeOrgName = activeOrgs.find((org: any) => org.id === activeOrgId)?.name;
  const schoolName = theme?.schoolName || orgBySlug?.name || activeOrgName || "Our School";

  // Inject org favicon, SEO meta tags, and custom CSS into document <head>
  useOrgBranding({
    faviconUrl: theme?.faviconUrl,
    schoolName,
    logoUrl: theme?.adminLogoUrl,
    seoTitle: (theme as any)?.seoTitle,
    seoDescription: (theme as any)?.seoDescription,
    seoKeywords: (theme as any)?.seoKeywords,
    seoOgImageUrl: (theme as any)?.seoOgImageUrl,
    seoRobotsIndex: (theme as any)?.seoRobotsIndex,
    customCss: (theme as any)?.customCss,
  });

  const filteredCourses = (courses || []).filter((c: any) => {
    const matchesSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || c.category === selectedCategory;
    return matchesSearch && matchesCategory && c.status === "published";
  });

  const categories = Array.from(new Set((courses || []).filter((c: any) => c.category).map((c: any) => c.category)));

  // Course click: navigate to the org's subdomain course URL
  const handleCourseClick = (courseId: number) => {
    if (orgSlug) {
      // Navigate to the course sales page on the org's subdomain
      window.location.href = `${getOrgBaseUrl(orgSlug)}/courses/${courseId}`;
    } else {
      setLocation(`/school/courses/${courseId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme?.adminLogoUrl ? (
              <img src={theme.adminLogoUrl} alt={schoolName} className="h-8 object-contain" />
            ) : (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {schoolName[0]}
              </div>
            )}
            <span className="font-bold text-base">{schoolName}</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#courses" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Courses</a>
            {user ? (
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => { window.location.href = orgSlug ? `${getOrgBaseUrl(orgSlug)}/my-courses` : "/school/my-courses"; }}>
                  My Courses
                </Button>
                <Button size="sm" style={{ backgroundColor: primaryColor }} onClick={() => setLocation("/")}>
                  Dashboard
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { window.location.href = getLoginUrl(); }}>
                  Sign In
                </Button>
                <Button size="sm" style={{ backgroundColor: primaryColor }} onClick={() => { window.location.href = getLoginUrl(); }}>
                  Get Started
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className="py-20 px-4 text-center"
        style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)` }}
      >
        <div className="max-w-3xl mx-auto">
          <Badge className="mb-4 text-xs" style={{ backgroundColor: primaryColor + "20", color: primaryColor, border: `1px solid ${primaryColor}40` }}>
            Online Learning Platform
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Welcome to <span style={{ color: primaryColor }}>{schoolName}</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Expand your knowledge with expert-led courses. Learn at your own pace, anytime, anywhere.
          </p>
          <div className="flex gap-3 justify-center">
            <Button size="lg" style={{ backgroundColor: primaryColor }} onClick={() => document.getElementById("courses")?.scrollIntoView({ behavior: "smooth" })}>
              Browse Courses
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            {!user && (
              <Button size="lg" variant="outline" onClick={() => { window.location.href = getLoginUrl(); }}>
                Sign In Free
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold" style={{ color: primaryColor }}>{(courses || []).filter((c: any) => c.status === "published").length}</p>
            <p className="text-xs text-muted-foreground">Courses Available</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: primaryColor }}>Expert</p>
            <p className="text-xs text-muted-foreground">Instructors</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: primaryColor }}>Self-Paced</p>
            <p className="text-xs text-muted-foreground">Learning</p>
          </div>
        </div>
      </section>

      {/* Course catalog */}
      <section id="courses" className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold">All Courses</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""} available
            </p>
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !selectedCategory ? "text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
              style={!selectedCategory ? { backgroundColor: primaryColor } : {}}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat as string}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat as string)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat ? "text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
                style={selectedCategory === cat ? { backgroundColor: primaryColor } : {}}
              >
                {cat as string}
              </button>
            ))}
          </div>
        )}

        {coursesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No courses found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term" : "No published courses yet"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course: any) => (
              <CourseCard
                key={course.id}
                course={course}
                primaryColor={primaryColor}
                onClick={() => handleCourseClick(course.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Top row: branding + copyright + policy links */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* School branding */}
            <div className="flex items-center gap-2">
              {theme?.adminLogoUrl ? (
                <img src={theme.adminLogoUrl} alt={schoolName} className="h-6 object-contain" />
              ) : (
                <div
                  className="h-6 w-6 rounded-md flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  {schoolName[0]}
                </div>
              )}
              <span className="text-sm font-medium">{schoolName}</span>
            </div>

            {/* Copyright */}
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} {schoolName}. All rights reserved.
            </p>

            {/* Policy links — shown only when the org has configured them */}
            {(legalDocs?.termsOfService || legalDocs?.privacyPolicy) ? (
              <div className="flex items-center gap-3">
                {legalDocs.termsOfService && (
                  <button
                    onClick={() => setPolicyModal("terms")}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3" />
                    Terms of Service
                  </button>
                )}
                {legalDocs.termsOfService && legalDocs.privacyPolicy && (
                  <span className="text-muted-foreground/40 text-xs">·</span>
                )}
                {legalDocs.privacyPolicy && (
                  <button
                    onClick={() => setPolicyModal("privacy")}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors flex items-center gap-1"
                  >
                    <FileText className="h-3 w-3" />
                    Privacy Policy
                  </button>
                )}
              </div>
            ) : (
              /* Spacer to keep layout balanced when no policies are set */
              <div className="hidden md:block" />
            )}
          </div>

        </div>
      </footer>

      {/* Policy Modals */}
      <Dialog open={policyModal !== null} onOpenChange={() => setPolicyModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {policyModal === "terms" ? "Terms of Service" : "Privacy Policy"}
            </DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: policyModal === "terms"
                ? (legalDocs?.termsOfService ?? "")
                : (legalDocs?.privacyPolicy ?? ""),
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
