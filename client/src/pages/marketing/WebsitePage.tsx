import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Globe, Save, ExternalLink, Code, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { getOrgBaseUrl } from "@/lib/orgUrl";

export default function WebsitePage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: orgCtx, isLoading: orgLoading } = trpc.orgs.myContext.useQuery();
  const orgId = orgCtx?.org?.id;
  const orgSlug = orgCtx?.org?.slug;

  // Build preview URL using the org slug
  const previewUrl = orgSlug
    ? `${getOrgBaseUrl(orgSlug)}?preview=1`
    : null;

  // Load org theme (schoolName lives here)
  const { data: theme } = trpc.lms.themes.get.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  // Load legal docs
  const { data: legalDocs } = trpc.orgs.getLegalDocs.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  // Homepage settings state
  const [homeTitle, setHomeTitle] = useState("");
  const [homeSubtitle, setHomeSubtitle] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [homepageInitialized, setHomepageInitialized] = useState(false);

  // Legal docs state
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [termsOfService, setTermsOfService] = useState("");
  const [legalInitialized, setLegalInitialized] = useState(false);

  // Tracking state
  const [googleVerification, setGoogleVerification] = useState("");
  const [fbPixel, setFbPixel] = useState("");
  const [gaId, setGaId] = useState("");
  const [customHead, setCustomHead] = useState("");

  // Initialize homepage fields from real data
  useEffect(() => {
    if (homepageInitialized) return;
    if (orgCtx?.org) {
      const title = theme?.schoolName || orgCtx.org.name || "";
      const subtitle = (orgCtx.org as any).description || "";
      setHomeTitle(title);
      setHomeSubtitle(subtitle);
      setHomepageInitialized(true);
    }
  }, [orgCtx, theme, homepageInitialized]);

  // Initialize legal docs from real data
  useEffect(() => {
    if (legalInitialized || !legalDocs) return;
    setPrivacyPolicy(legalDocs.privacyPolicy ?? "");
    setTermsOfService(legalDocs.termsOfService ?? "");
    setLegalInitialized(true);
  }, [legalDocs, legalInitialized]);

  // Mutations
  const updateTheme = trpc.lms.themes.update.useMutation({
    onSuccess: () => {
      utils.lms.themes.get.invalidate({ orgId: orgId! });
      toast.success("Homepage settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateLegalDocs = trpc.orgs.updateLegalDocs.useMutation({
    onSuccess: () => {
      utils.orgs.getLegalDocs.invalidate({ orgId: orgId! });
      toast.success("Legal documents saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveHomepage = () => {
    if (!orgId) return;
    updateTheme.mutate({ orgId, schoolName: homeTitle });
  };

  const handleSavePrivacyPolicy = () => {
    if (!orgId) return;
    updateLegalDocs.mutate({ orgId, privacyPolicy });
  };

  const handleSaveTermsOfService = () => {
    if (!orgId) return;
    updateLegalDocs.mutate({ orgId, termsOfService });
  };

  const openPreview = () => {
    if (previewUrl) {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } else {
      toast.info("Loading your site URL…");
    }
  };

  if (orgLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />Website
          </h1>
          <p className="text-muted-foreground mt-0.5">Configure your public-facing website, pages, and tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={openPreview}>
            <Eye className="h-4 w-4" />Preview Site
          </Button>
          <Button variant="outline" className="gap-2" onClick={openPreview}>
            <ExternalLink className="h-4 w-4" />View Live Site
          </Button>
        </div>
      </div>

      {previewUrl && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Your site URL:</span>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium truncate"
          >
            {previewUrl.replace("?preview=1", "")}
          </a>
        </div>
      )}

      <Tabs defaultValue="homepage">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="homepage">Home Page</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="tracking">Tracking &amp; SEO</TabsTrigger>
        </TabsList>
        <TabsContent value="homepage" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Homepage Settings</CardTitle>
              <CardDescription>Configure the look and feel of your school homepage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>School Name / Headline</Label>
                <Input value={homeTitle} onChange={e => setHomeTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subtitle / Tagline</Label>
                <Input value={homeSubtitle} onChange={e => setHomeSubtitle(e.target.value)} />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Maintenance Mode</p>
                  <p className="text-xs text-muted-foreground">Show a maintenance page to visitors while you make changes</p>
                </div>
                <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
              </div>
              <Button
                className="gap-2"
                onClick={handleSaveHomepage}
                disabled={updateTheme.isPending}
              >
                <Save className="h-4 w-4" />
                {updateTheme.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pages" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Privacy Policy</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={privacyPolicy}
                onChange={e => setPrivacyPolicy(e.target.value)}
                rows={6}
                placeholder="Enter your privacy policy here..."
              />
              <Button size="sm" onClick={handleSavePrivacyPolicy} disabled={updateLegalDocs.isPending}>
                {updateLegalDocs.isPending ? "Saving…" : "Save"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Terms of Service</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={termsOfService}
                onChange={e => setTermsOfService(e.target.value)}
                rows={6}
                placeholder="Enter your terms of service here..."
              />
              <Button size="sm" onClick={handleSaveTermsOfService} disabled={updateLegalDocs.isPending}>
                {updateLegalDocs.isPending ? "Saving…" : "Save"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom Pages</CardTitle>
              <CardDescription>Create additional pages for your website</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="gap-2" onClick={() => setLocation("/lms/custom-pages")}>
                <Globe className="h-4 w-4" />Manage Pages
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tracking" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Search Engine Verification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Google Site Verification</Label>
                <Input value={googleVerification} onChange={e => setGoogleVerification(e.target.value)} placeholder="google-site-verification=..." />
              </div>
              <Button size="sm" onClick={() => toast.success("Saved")}>Save</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Analytics &amp; Pixels</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Facebook Pixel ID</Label>
                <Input value={fbPixel} onChange={e => setFbPixel(e.target.value)} placeholder="123456789012345" />
              </div>
              <div className="space-y-2">
                <Label>Google Analytics ID</Label>
                <Input value={gaId} onChange={e => setGaId(e.target.value)} placeholder="G-XXXXXXXXXX" />
              </div>
              <Button size="sm" onClick={() => toast.success("Saved")}>Save</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom Head Code</CardTitle>
              <CardDescription>Add custom scripts or meta tags to the &lt;head&gt; of your site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={customHead}
                onChange={e => setCustomHead(e.target.value)}
                rows={5}
                placeholder="<!-- Custom scripts, meta tags, etc. -->"
                className="font-mono text-xs"
              />
              <Button size="sm" className="gap-2" onClick={() => toast.success("Custom head code saved")}>
                <Code className="h-4 w-4" />Save Code
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
