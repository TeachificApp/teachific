import { useParams } from "wouter";
import { sanitize, sanitizeCss } from "@/lib/sanitize";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, Shield } from "lucide-react";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { getSubdomain } from "@/hooks/useSubdomain";

export default function OrgPoliciesPage() {
  const params = useParams<{ orgSlug?: string }>();
  // On subdomain routes (/policies, /terms, /privacy), orgSlug param is absent.
  // Fall back to the current subdomain so the page still resolves the correct org.
  const orgSlug = params.orgSlug ?? getSubdomain() ?? undefined;

  // Load org by slug (public)
  const { data: org } = trpc.orgs.publicSchoolBySlug.useQuery(
    { slug: orgSlug! },
    { enabled: !!orgSlug }
  );
  // Load legal docs by org slug (public)
  const { data: legalDocs, isLoading } = trpc.orgs.publicLegalDocsBySlug.useQuery(
    { slug: orgSlug! },
    { enabled: !!orgSlug }
  );

  const schoolName = org?.name ?? "Our School";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => { window.location.href = orgSlug ? getOrgBaseUrl(orgSlug) : "/school"; }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {schoolName}
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-sm">Legal Policies</span>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Legal Policies</h1>
          <p className="text-muted-foreground">{schoolName}</p>
        </div>
        <Tabs defaultValue="terms">
          <TabsList className="mb-6">
            <TabsTrigger value="terms" className="gap-2">
              <FileText className="w-4 h-4" />
              Terms of Service
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="w-4 h-4" />
              Privacy Policy
            </TabsTrigger>
          </TabsList>
          <TabsContent value="terms">
            <div className="rounded-xl border border-border bg-card p-8">
              {legalDocs?.termsOfService ? (
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitize(legalDocs.termsOfService) }}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No Terms of Service published yet.</p>
                  <p className="text-sm mt-1">Please check back later or contact the school directly.</p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="privacy">
            <div className="rounded-xl border border-border bg-card p-8">
              {legalDocs?.privacyPolicy ? (
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: sanitize(legalDocs.privacyPolicy) }}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No Privacy Policy published yet.</p>
                  <p className="text-sm mt-1">Please check back later or contact the school directly.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
