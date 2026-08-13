import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getOrgWebinarUrl, getOrgWebinarWatchUrl } from "@/lib/orgUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Save,
  Globe,
  Eye,
  Video,
  Calendar,
  Users,
  Bot,
  GitBranch,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  GripVertical,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import CheckoutPageEditor from "@/components/CheckoutPageEditor";
import CmeFormTab from "@/components/CmeFormTab";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const VIDEO_SOURCES = [
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "upload", label: "Uploaded File" },
  { value: "zoom", label: "Zoom (Live)" },
  { value: "teams", label: "Microsoft Teams (Live)" },
  { value: "embed", label: "Custom Embed Code" },
];

const FUNNEL_STEP_TYPES = [
  { value: "registration", label: "Registration Page" },
  { value: "confirmation", label: "Confirmation Page" },
  { value: "reminder", label: "Reminder Email" },
  { value: "watch", label: "Watch Page" },
  { value: "offer", label: "Post-Webinar Offer" },
  { value: "thankyou", label: "Thank You Page" },
];

const POST_WEBINAR_ACTIONS = [
  { value: "none", label: "Nothing (stay on watch page)" },
  { value: "thankyou", label: "Show Thank You message" },
  { value: "url", label: "Redirect to URL" },
  { value: "product", label: "Show product offer overlay" },
];

// ─── Tab definitions ──────────────────────────────────────────────────────────
type TabId = "details" | "curriculum" | "video" | "schedule" | "ai_viewers" | "sales_page" | "funnel" | "checkout_page" | "cme";

const tabs = [
  { id: "details" as const, label: "Details", icon: FileText },
  { id: "curriculum" as const, label: "Curriculum", icon: FileText },
  { id: "video" as const, label: "Video", icon: Video },
  { id: "schedule" as const, label: "Schedule", icon: Calendar },
  { id: "ai_viewers" as const, label: "AI Viewers", icon: Bot },
  { id: "sales_page" as const, label: "Sales Page", icon: Globe },
  { id: "funnel" as const, label: "Funnel", icon: GitBranch },
  { id: "checkout_page" as const, label: "Checkout Page", icon: Globe },
  { id: "cme" as const, label: "CME", icon: FileText },
];

export default function WebinarEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const webinarId = Number(id);
  const [activeTab, setActiveTab] = useState<TabId>("details");

  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();
  const { data: webinar, refetch } = trpc.lms.webinars.get.useQuery(
    { id: webinarId },
    { enabled: !!webinarId }
  );
  const { data: funnelSteps, refetch: refetchFunnel } = trpc.lms.webinars.getFunnelSteps.useQuery(
    { webinarId },
    { enabled: !!webinarId }
  );
  const { data: courseOptionsData } = trpc.lmsAdmin.listCourses.useQuery({ status: "all", type: "course", page: 1, pageSize: 200 });
  const courseOptions = ((courseOptionsData as any)?.courses ?? courseOptionsData ?? []) as any[];

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    type: "evergreen" as "live" | "evergreen",
    videoSource: "youtube" as string,
    videoUrl: "",
    videoFileUrl: "",
    meetingUrl: "",
    meetingId: "",
    scheduledAt: "",
    durationMinutes: 60,
    timezone: "UTC",
    replayDelayMinutes: 0,
    aiViewersEnabled: false,
    aiViewersMin: 50,
    aiViewersMax: 300,
    aiViewersPeakAt: 30,
    thumbnailUrl: "",
    requireRegistration: true,
    postWebinarAction: "thankyou" as string,
    postWebinarUrl: "",
    postWebinarMessage: "Thank you for attending!",
    postWebinarDelaySeconds: 300,
    isPublished: false,
    // Checkout purchase terms override
    purchaseTermsAgreement: "",
    purchaseTermsLink1Label: "",
    purchaseTermsLink1Url: "",
    purchaseTermsLink2Label: "",
    purchaseTermsLink2Url: "",
    linkedCourseId: "",
  });

  const [salesBlocks, setSalesBlocks] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (webinar) {
      setForm({
        title: webinar.title ?? "",
        slug: webinar.slug ?? "",
        description: webinar.description ?? "",
        type: (webinar.type as "live" | "evergreen") ?? "evergreen",
        videoSource: (webinar.videoSource ?? "youtube") as string,
        videoUrl: webinar.videoUrl ?? "",
        videoFileUrl: webinar.videoFileUrl ?? "",
        meetingUrl: webinar.meetingUrl ?? "",
        meetingId: webinar.meetingId ?? "",
        scheduledAt: webinar.scheduledAt
          ? new Date(webinar.scheduledAt).toISOString().slice(0, 16)
          : "",
        durationMinutes: webinar.durationMinutes ?? 60,
        timezone: webinar.timezone ?? "UTC",
        replayDelayMinutes: webinar.replayDelayMinutes ?? 0,
        aiViewersEnabled: webinar.aiViewersEnabled ?? false,
        aiViewersMin: webinar.aiViewersMin ?? 50,
        aiViewersMax: webinar.aiViewersMax ?? 300,
        aiViewersPeakAt: webinar.aiViewersPeakAt ?? 30,
        thumbnailUrl: webinar.thumbnailUrl ?? "",
        requireRegistration: webinar.requireRegistration ?? true,
        postWebinarAction: webinar.postWebinarAction ?? "thankyou",
        postWebinarUrl: webinar.postWebinarUrl ?? "",
        postWebinarMessage: webinar.postWebinarMessage ?? "Thank you for attending!",
        postWebinarDelaySeconds: webinar.postWebinarDelaySeconds ?? 300,
        isPublished: webinar.isPublished ?? false,
        purchaseTermsAgreement: (webinar as any).purchaseTermsAgreement ?? "",
        purchaseTermsLink1Label: (webinar as any).purchaseTermsLink1Label ?? "",
        purchaseTermsLink1Url: (webinar as any).purchaseTermsLink1Url ?? "",
        purchaseTermsLink2Label: (webinar as any).purchaseTermsLink2Label ?? "",
        purchaseTermsLink2Url: (webinar as any).purchaseTermsLink2Url ?? "",
        linkedCourseId: (webinar as any).linkedCourseId ? String((webinar as any).linkedCourseId) : "",
      });
      if (webinar.salesPageBlocksJson) {
        setSalesBlocks(
          Array.isArray(webinar.salesPageBlocksJson)
            ? webinar.salesPageBlocksJson
            : []
        );
      }
    }
  }, [webinar]);

  useEffect(() => {
    if (funnelSteps) setSteps(funnelSteps);
  }, [funnelSteps]);

  const updateMutation = trpc.lms.webinars.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const saveFunnelMutation = trpc.lms.webinars.saveFunnelSteps.useMutation({
    onSuccess: () => { refetchFunnel(); toast.success("Funnel saved"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: webinarId,
      ...form,
      videoSource: form.videoSource as "youtube" | "vimeo" | "upload" | "zoom" | "teams" | "embed",
      postWebinarAction: form.postWebinarAction as "product" | "url" | "thankyou" | "none",
      durationMinutes: Number(form.durationMinutes),
      replayDelayMinutes: Number(form.replayDelayMinutes),
      aiViewersMin: Number(form.aiViewersMin),
      aiViewersMax: Number(form.aiViewersMax),
      aiViewersPeakAt: Number(form.aiViewersPeakAt),
      postWebinarDelaySeconds: Number(form.postWebinarDelaySeconds),
      salesPageBlocksJson: salesBlocks,
      purchaseTermsAgreement: form.purchaseTermsAgreement.trim() || null,
      purchaseTermsLink1Label: form.purchaseTermsLink1Label.trim() || null,
      purchaseTermsLink1Url: form.purchaseTermsLink1Url.trim() || null,
      purchaseTermsLink2Label: form.purchaseTermsLink2Label.trim() || null,
      purchaseTermsLink2Url: form.purchaseTermsLink2Url.trim() || null,
      linkedCourseId: form.linkedCourseId ? Number(form.linkedCourseId) : null,
    });
  };

  const handleSaveFunnel = () => {
    saveFunnelMutation.mutate({ webinarId, steps: steps as any });
  };

  const wOrg = myOrgs?.[0];
  const regUrl = wOrg && form.slug
    ? getOrgWebinarUrl(wOrg.slug, form.slug, wOrg.customDomain, wOrg.domainVerificationStatus)
    : `${window.location.origin}/webinar/${form.slug}/register`;
  const watchUrl = wOrg && form.slug
    ? getOrgWebinarWatchUrl(wOrg.slug, form.slug, wOrg.customDomain, wOrg.domainVerificationStatus)
    : `${window.location.origin}/webinar/${form.slug}/watch`;

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addFunnelStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        stepType: "reminder",
        title: "New Step",
        emailSubject: "",
        emailBody: "",
        triggerType: "delay",
        triggerDelayMinutes: 60,
        isActive: true,
      },
    ]);
  };

  const removeFunnelStep = (i: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateStep = (i: number, patch: any) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  // Loading state
  if (!webinar) {
    return (
      <div className="flex flex-col h-full p-6 gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/lms/webinars")}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold leading-tight">{form.title || "Webinar"}</h1>
              <Badge
                variant="outline"
                className={
                  form.isPublished
                    ? "text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
                    : "text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20"
                }
              >
                {form.isPublished ? "Published" : "Draft"}
              </Badge>
              <Badge variant="outline" className="capitalize text-xs">
                {form.type === "live" ? "Live" : "Evergreen"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateMutation.mutate({ id: webinarId, isPublished: !form.isPublished })
            }
            className="gap-1.5"
          >
            <Globe className="h-3.5 w-3.5" />
            {form.isPublished ? "Unpublish" : "Publish"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-2 sm:px-6 border-b border-border bg-background overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "details" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* URL bar */}
            <div className="border rounded-lg p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Registration Page</p>
                  <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 text-sm font-mono">
                    <span className="truncate flex-1">{regUrl}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyUrl(regUrl)}>
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <a href={regUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </a>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Watch Page</p>
                  <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 text-sm font-mono">
                    <span className="truncate flex-1">{watchUrl}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyUrl(watchUrl)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Webinar Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Webinar Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>URL Slug</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="What will attendees learn?"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((f) => ({ ...f, type: v as "live" | "evergreen" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evergreen">Evergreen (on-demand)</SelectItem>
                      <SelectItem value="live">Live (scheduled)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Thumbnail URL</Label>
                  <Input
                    value={form.thumbnailUrl}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.requireRegistration}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, requireRegistration: v }))}
                />
                <Label>Require registration before watching</Label>
              </div>
            </div>

            {/* Post-Webinar Action */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Post-Webinar Action</h3>
              <p className="text-sm text-muted-foreground">What happens after the webinar ends?</p>
              <div className="space-y-1.5">
                <Label>Action</Label>
                <Select
                  value={form.postWebinarAction}
                  onValueChange={(v) => setForm((f) => ({ ...f, postWebinarAction: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_WEBINAR_ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.postWebinarAction === "url" && (
                <div className="space-y-1.5">
                  <Label>Redirect URL</Label>
                  <Input
                    value={form.postWebinarUrl}
                    onChange={(e) => setForm((f) => ({ ...f, postWebinarUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              )}
              {form.postWebinarAction === "thankyou" && (
                <div className="space-y-1.5">
                  <Label>Thank You Message</Label>
                  <Textarea
                    value={form.postWebinarMessage}
                    onChange={(e) => setForm((f) => ({ ...f, postWebinarMessage: e.target.value }))}
                    rows={3}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Show CTA after (seconds into webinar)</Label>
                <Input
                  type="number"
                  value={form.postWebinarDelaySeconds}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, postWebinarDelaySeconds: Number(e.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {Math.floor(form.postWebinarDelaySeconds / 60)} minutes into the webinar
                </p>
              </div>
            </div>

            {/* ── Checkout Terms Override ─────────────────────────────── */}
            <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" /> Checkout Terms Override
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Override the checkout agreement checkbox for this webinar. Leave blank to use the org-level default.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agreement sentence</Label>
                <Textarea
                  value={form.purchaseTermsAgreement}
                  onChange={e => setForm(f => ({ ...f, purchaseTermsAgreement: e.target.value }))}
                  placeholder="e.g. I have reviewed and agree to the"
                  rows={3}
                  maxLength={2048}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">Text before the links. Supports basic HTML (&lt;strong&gt;, &lt;em&gt;, &lt;a&gt;).</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Link 1 label</Label>
                  <Input value={form.purchaseTermsLink1Label} onChange={e => setForm(f => ({ ...f, purchaseTermsLink1Label: e.target.value }))} placeholder="e.g. Terms of Service" className="text-sm h-8" maxLength={255} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link 1 URL</Label>
                  <Input value={form.purchaseTermsLink1Url} onChange={e => setForm(f => ({ ...f, purchaseTermsLink1Url: e.target.value }))} placeholder="https://example.com/terms" className="text-sm h-8" maxLength={1024} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link 2 label</Label>
                  <Input value={form.purchaseTermsLink2Label} onChange={e => setForm(f => ({ ...f, purchaseTermsLink2Label: e.target.value }))} placeholder="e.g. Privacy Policy" className="text-sm h-8" maxLength={255} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link 2 URL</Label>
                  <Input value={form.purchaseTermsLink2Url} onChange={e => setForm(f => ({ ...f, purchaseTermsLink2Url: e.target.value }))} placeholder="https://example.com/privacy" className="text-sm h-8" maxLength={1024} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "curriculum" && (
          <div className="max-w-3xl mx-auto space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Webinar curriculum</h2>
              <p className="text-sm text-muted-foreground mt-1">Link this webinar to a course in the same organization. That course uses the shared Course Builder, including standalone QuizMaker lessons.</p>
            </div>
            <div className="rounded-lg border p-5 space-y-4">
              <div>
                <Label>Linked course</Label>
                <Select value={form.linkedCourseId || "none"} onValueChange={(value) => setForm((prev) => ({ ...prev, linkedCourseId: value === "none" ? "" : value }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a course" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked course</SelectItem>
                    {courseOptions.map((course) => <SelectItem key={course.id} value={String(course.id)}>{course.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={updateMutation.isPending}><Save className="h-4 w-4 mr-2" />Save curriculum link</Button>
                {form.linkedCourseId && <Button variant="outline" onClick={() => navigate(`/lms/courses/${form.linkedCourseId}`)}>Open Course Builder<ExternalLink className="h-4 w-4 ml-2" /></Button>}
              </div>
            </div>
          </div>
        )}

        {activeTab === "video" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="font-semibold">Video Source</h3>
              <p className="text-sm text-muted-foreground">Choose how your webinar video is delivered.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Video Source</Label>
                <Select
                  value={form.videoSource}
                  onValueChange={(v) => setForm((f) => ({ ...f, videoSource: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(form.videoSource === "youtube" || form.videoSource === "vimeo") && (
                <div className="space-y-1.5">
                  <Label>Video URL</Label>
                  <Input
                    value={form.videoUrl}
                    onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                    placeholder={
                      form.videoSource === "youtube"
                        ? "https://www.youtube.com/watch?v=..."
                        : "https://vimeo.com/..."
                    }
                  />
                </div>
              )}

              {form.videoSource === "upload" && (
                <div className="space-y-1.5">
                  <Label>Video File URL</Label>
                  <Input
                    value={form.videoFileUrl}
                    onChange={(e) => setForm((f) => ({ ...f, videoFileUrl: e.target.value }))}
                    placeholder="https://cdn.../video.mp4"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload your video file via the Media Library, then paste the URL here.
                  </p>
                </div>
              )}

              {(form.videoSource === "zoom" || form.videoSource === "teams") && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Meeting URL</Label>
                    <Input
                      value={form.meetingUrl}
                      onChange={(e) => setForm((f) => ({ ...f, meetingUrl: e.target.value }))}
                      placeholder={
                        form.videoSource === "zoom"
                          ? "https://zoom.us/j/..."
                          : "https://teams.microsoft.com/..."
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Meeting ID (optional)</Label>
                    <Input
                      value={form.meetingId}
                      onChange={(e) => setForm((f) => ({ ...f, meetingId: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {form.videoSource === "embed" && (
                <div className="space-y-1.5">
                  <Label>Embed URL or Code</Label>
                  <Textarea
                    value={form.videoUrl}
                    onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                    rows={4}
                    placeholder="<iframe ...></iframe> or embed URL"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="font-semibold">Schedule</h3>
              <p className="text-sm text-muted-foreground">
                {form.type === "live"
                  ? "Set the date and time for your live webinar."
                  : "For evergreen webinars, viewers can watch anytime. Optionally set a replay delay."}
              </p>
            </div>
            <div className="space-y-4">
              {form.type === "live" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Scheduled Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Timezone</Label>
                    <Input
                      value={form.timezone}
                      onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                      placeholder="America/New_York"
                    />
                  </div>
                </>
              )}
              {form.type === "evergreen" && (
                <div className="space-y-1.5">
                  <Label>Replay Delay (minutes after registration)</Label>
                  <Input
                    type="number"
                    value={form.replayDelayMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, replayDelayMinutes: Number(e.target.value) }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Set to 0 for instant access. Set to e.g. 15 to simulate a "starting soon" delay.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "ai_viewers" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                AI-Generated Viewer Count
              </h3>
              <p className="text-sm text-muted-foreground">
                Simulate a live audience by showing a dynamic viewer count that follows a
                realistic bell-curve pattern.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.aiViewersEnabled}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, aiViewersEnabled: v }))}
                />
                <Label>Enable AI viewer count</Label>
              </div>
              {form.aiViewersEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Minimum viewers</Label>
                    <Input
                      type="number"
                      value={form.aiViewersMin}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, aiViewersMin: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Maximum viewers</Label>
                    <Input
                      type="number"
                      value={form.aiViewersMax}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, aiViewersMax: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Peak at (minutes)</Label>
                    <Input
                      type="number"
                      value={form.aiViewersPeakAt}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, aiViewersPeakAt: Number(e.target.value) }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Viewer count peaks at this minute mark
                    </p>
                  </div>
                </div>
              )}
              {form.aiViewersEnabled && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                  <strong>Preview:</strong> Viewers will ramp from {form.aiViewersMin} to{" "}
                  {form.aiViewersMax} over {form.aiViewersPeakAt} minutes, then gradually
                  decline. A ±5% random jitter is applied each update.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "sales_page" && (
          <div className="max-w-3xl mx-auto">
            <div className="border border-border rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Registration / Sales Page</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Build the page visitors see before registering. Use the full-screen editor for the best experience.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="gap-2"
                  onClick={() => navigate(`/lms/webinars/${webinarId}/page-builder`)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Sales Page Builder
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(regUrl, "_blank")}
                >
                  <Eye className="h-4 w-4" />
                  Preview Registration Page
                </Button>
              </div>
              {salesBlocks.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {salesBlocks.length} block{salesBlocks.length !== 1 ? "s" : ""} configured on this registration page
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                The sales page builder opens in full-screen mode. Your changes are saved automatically.
              </p>
            </div>
          </div>
        )}

        {activeTab === "funnel" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary" />
                Sales Funnel Builder
              </h3>
              <p className="text-sm text-muted-foreground">
                Define the sequence of pages and emails that guide registrants through your
                webinar funnel — from registration to post-webinar offer.
              </p>
            </div>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Step {i + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={step.isActive ?? true}
                        onCheckedChange={(v) => updateStep(i, { isActive: v })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeFunnelStep(i)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Step Type</Label>
                      <Select
                        value={step.stepType}
                        onValueChange={(v) => updateStep(i, { stepType: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FUNNEL_STEP_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Title</Label>
                      <Input
                        value={step.title ?? ""}
                        onChange={(e) => updateStep(i, { title: e.target.value })}
                      />
                    </div>
                  </div>
                  {(step.stepType === "reminder" || step.stepType === "confirmation") && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Email Subject</Label>
                        <Input
                          value={step.emailSubject ?? ""}
                          onChange={(e) => updateStep(i, { emailSubject: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email Body</Label>
                        <Textarea
                          value={step.emailBody ?? ""}
                          onChange={(e) => updateStep(i, { emailBody: e.target.value })}
                          rows={4}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Trigger</Label>
                          <Select
                            value={step.triggerType ?? "delay"}
                            onValueChange={(v) => updateStep(i, { triggerType: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="immediate">Immediately</SelectItem>
                              <SelectItem value="delay">After delay</SelectItem>
                              <SelectItem value="scheduled">At scheduled time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {step.triggerType === "delay" && (
                          <div className="space-y-1.5">
                            <Label>Delay (minutes)</Label>
                            <Input
                              type="number"
                              value={step.triggerDelayMinutes ?? 60}
                              onChange={(e) =>
                                updateStep(i, { triggerDelayMinutes: Number(e.target.value) })
                              }
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" onClick={addFunnelStep}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
                <Button onClick={handleSaveFunnel} disabled={saveFunnelMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Funnel
                </Button>
              </div>
            </div>
          </div>
        )}
        {activeTab === "checkout_page" && webinar && (
          <div className="max-w-3xl mx-auto">
            <CheckoutPageEditor
              contentType="webinar"
              contentId={webinar.id}
              orgId={webinar.orgId ?? 1}
              contentSlug={webinar.slug}
            />
          </div>
        )}
        {activeTab === "cme" && webinar && (
          <div className="max-w-3xl mx-auto">
            <CmeFormTab
              courseId={webinar.id}
              productType="webinar"
              orgId={webinar.orgId ?? undefined}
              productTitle={webinar.title}
            />
          </div>
        )}
      </div>
    </div>
  );
}
