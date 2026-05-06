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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowLeft,
  Save,
  Globe,
  EyeOff,
  Video,
  Calendar,
  Users,
  LayoutTemplate,
  GitBranch,
  Bot,
  Upload,
  Link2,
  ExternalLink,
  Copy,
  CheckCircle,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { WysiwygPageBuilder as PageBuilder } from "@/components/WysiwygPageBuilder";

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

export default function WebinarEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const webinarId = Number(id);

  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();
  const { data: webinar, refetch } = trpc.lms.webinars.get.useQuery(
    { id: webinarId },
    { enabled: !!webinarId }
  );
  const { data: funnelSteps, refetch: refetchFunnel } = trpc.lms.webinars.getFunnelSteps.useQuery(
    { webinarId },
    { enabled: !!webinarId }
  );

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
        videoSource: (webinar.videoSource ?? "youtube") as "youtube" | "vimeo" | "upload" | "zoom" | "teams" | "embed",
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

  if (!webinar) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading webinar...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/lms/webinars")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{webinar.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {webinar.isPublished ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                    <Globe className="w-3 h-3 mr-1" />Published
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs">
                    <EyeOff className="w-3 h-3 mr-1" />Draft
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize text-xs">
                  {webinar.type === "live" ? "🔴 Live" : "♻️ Evergreen"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                updateMutation.mutate({ id: webinarId, isPublished: !form.isPublished })
              }
            >
              {form.isPublished ? (
                <><EyeOff className="w-4 h-4 mr-2" />Unpublish</>
              ) : (
                <><Globe className="w-4 h-4 mr-2" />Publish</>
              )}
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* URL bar */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Registration Page</p>
                <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 text-sm font-mono">
                  <span className="truncate flex-1">{regUrl}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyUrl(regUrl)}>
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <a href={regUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </a>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Watch Page</p>
                <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 text-sm font-mono">
                  <span className="truncate flex-1">{watchUrl}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyUrl(watchUrl)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="details">
          <div className="overflow-x-auto pb-1"><TabsList className="flex w-max min-w-full sm:grid sm:grid-cols-6 sm:w-full sm:max-w-3xl">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="ai-viewers">AI Viewers</TabsTrigger>
            <TabsTrigger value="sales-page">Sales Page</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
          </TabsList></div>

          {/* ── Details ── */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Webinar Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                        <SelectItem value="evergreen">♻️ Evergreen (on-demand)</SelectItem>
                        <SelectItem value="live">🔴 Live (scheduled)</SelectItem>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Post-Webinar Action</CardTitle>
                <CardDescription>What happens after the webinar ends?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Video ── */}
          <TabsContent value="video" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Video Source</CardTitle>
                <CardDescription>
                  Choose how your webinar video is delivered.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Schedule ── */}
          <TabsContent value="schedule" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>
                  {form.type === "live"
                    ? "Set the date and time for your live webinar."
                    : "For evergreen webinars, viewers can watch anytime. Optionally set a replay delay."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AI Viewers ── */}
          <TabsContent value="ai-viewers" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  AI-Generated Viewer Count
                </CardTitle>
                <CardDescription>
                  Simulate a live audience by showing a dynamic viewer count that follows a
                  realistic bell-curve pattern — ramping up, peaking, then gradually declining.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                    <strong>Preview:</strong> Viewers will ramp from {form.aiViewersMin} to{" "}
                    {form.aiViewersMax} over {form.aiViewersPeakAt} minutes, then gradually
                    decline. A ±5% random jitter is applied each update.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Sales Page ── */}
          <TabsContent value="sales-page" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Registration / Sales Page Builder</CardTitle>
                <CardDescription>
                  Build the page visitors see before registering. Use the full-screen editor for the best experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => navigate(`/lms/webinars/${webinarId}/page-builder`)}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Full-Screen Page Editor
                </Button>
                {salesBlocks.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {salesBlocks.length} block{salesBlocks.length !== 1 ? "s" : ""} configured on this registration page
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Funnel ── */}
          <TabsContent value="funnel" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-primary" />
                  Sales Funnel Builder
                </CardTitle>
                <CardDescription>
                  Define the sequence of pages and emails that guide registrants through your
                  webinar funnel — from registration to post-webinar offer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}
