/**
 * WidgetsPage — Admin page for generating embeddable course widgets.
 * 
 * Widget types:
 *  1. Course Card — Shows thumbnail, title, description, price, and "Enroll Now" button
 *  2. Curriculum — Shows course outline with sections and lessons
 * 
 * Options:
 *  - Course Card: toggle to include curriculum below the card
 *  - Curriculum: toggle to include a mini course card header above the curriculum
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, Code2, LayoutGrid, ListTree, ExternalLink, Eye } from "lucide-react";

function copyToClipboard(text: string, label = "Copied!") {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

export default function WidgetsPage() {
  const { data: coursesData, isLoading } = trpc.lmsAdmin.listCourses.useQuery({});
  const courses = coursesData?.courses;
  const [selectedCourseSlug, setSelectedCourseSlug] = useState<string>("");
  const [widgetType, setWidgetType] = useState<"card" | "curriculum">("card");
  const [cardShowCurriculum, setCardShowCurriculum] = useState(false);
  const [curriculumShowCard, setCurriculumShowCard] = useState(true);

  const origin = window.location.origin;

  const selectedCourse = useMemo(
    () => (courses ?? []).find((c: any) => c.slug === selectedCourseSlug),
    [courses, selectedCourseSlug]
  );

  const embedCode = useMemo(() => {
    if (!selectedCourseSlug) return "";
    if (widgetType === "card") {
      const params = cardShowCurriculum ? "?curriculum=1" : "";
      return `<script src="${origin}/api/widget/card/${selectedCourseSlug}${params}"></script>`;
    } else {
      const params = curriculumShowCard ? "?card=1" : "";
      return `<script src="${origin}/api/widget/curriculum/${selectedCourseSlug}${params}"></script>`;
    }
  }, [selectedCourseSlug, widgetType, cardShowCurriculum, curriculumShowCard, origin]);

  const previewUrl = useMemo(() => {
    if (!selectedCourseSlug) return "";
    if (widgetType === "card") {
      const params = cardShowCurriculum ? "?curriculum=1" : "";
      return `${origin}/api/widget/card/${selectedCourseSlug}${params}`;
    } else {
      const params = curriculumShowCard ? "?card=1" : "";
      return `${origin}/api/widget/curriculum/${selectedCourseSlug}${params}`;
    }
  }, [selectedCourseSlug, widgetType, cardShowCurriculum, curriculumShowCard, origin]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Embeddable Widgets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate embed codes for course cards and curriculum outlines. Paste the code on any external website to display your courses.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Configuration */}
        <div className="space-y-4">
          {/* Course Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Select Course</CardTitle>
              <CardDescription className="text-xs">Choose a published course to generate a widget for</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading courses…</p>
              ) : (
                <Select value={selectedCourseSlug} onValueChange={setSelectedCourseSlug}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a course…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(courses ?? [])
                      .filter((c: any) => c.status === "public" || c.status === "hidden")
                      .map((c: any) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          <div className="flex items-center gap-2">
                            <span>{c.title}</span>
                            <Badge variant="outline" className="text-[10px] ml-1">{c.status}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Widget Type */}
          {selectedCourseSlug && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Widget Type</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={widgetType} onValueChange={(v) => setWidgetType(v as "card" | "curriculum")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="card" className="gap-1.5 text-xs">
                      <LayoutGrid className="h-3.5 w-3.5" /> Course Card
                    </TabsTrigger>
                    <TabsTrigger value="curriculum" className="gap-1.5 text-xs">
                      <ListTree className="h-3.5 w-3.5" /> Curriculum
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="card" className="mt-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Displays a course card with thumbnail, title, description, price, and an "Enroll Now" button.
                    </p>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="card-curriculum" className="text-sm">Include curriculum below card</Label>
                      <Switch
                        id="card-curriculum"
                        checked={cardShowCurriculum}
                        onCheckedChange={setCardShowCurriculum}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="curriculum" className="mt-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Displays the course curriculum outline with sections and lessons.
                    </p>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="curriculum-card" className="text-sm">Include course card header</Label>
                      <Switch
                        id="curriculum-card"
                        checked={curriculumShowCard}
                        onCheckedChange={setCurriculumShowCard}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Embed Code */}
          {embedCode && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-[var(--org-primary)]" /> Embed Code
                </CardTitle>
                <CardDescription className="text-xs">
                  Copy this code and paste it into your website's HTML where you want the widget to appear.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={embedCode}
                  readOnly
                  rows={3}
                  className="text-xs font-mono resize-none bg-gray-50"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyToClipboard(embedCode, "Embed code copied!")}>
                    <Copy className="h-3.5 w-3.5" /> Copy Code
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" asChild>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> View Script
                    </a>
                  </Button>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Auto-updating:</strong> Widget styles are loaded from the server. Any changes you make here will automatically reflect on all sites using this embed code — no need to update existing embeds.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-4">
          {selectedCourseSlug ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[var(--org-primary)]" /> Live Preview
                </CardTitle>
                <CardDescription className="text-xs">
                  This is how the widget will appear on external websites.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-6 bg-gray-50 min-h-[300px]">
                  <WidgetPreview
                    courseSlug={selectedCourseSlug}
                    widgetType={widgetType}
                    cardShowCurriculum={cardShowCurriculum}
                    curriculumShowCard={curriculumShowCard}
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <LayoutGrid className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">Select a course to see a live preview of the widget</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Live Preview Component ──────────────────────────────────────────────────
function WidgetPreview({
  courseSlug,
  widgetType,
  cardShowCurriculum,
  curriculumShowCard,
}: {
  courseSlug: string;
  widgetType: "card" | "curriculum";
  cardShowCurriculum: boolean;
  curriculumShowCard: boolean;
}) {
  const origin = window.location.origin;
  const src = widgetType === "card"
    ? `${origin}/api/widget/card/${courseSlug}${cardShowCurriculum ? "?curriculum=1" : ""}`
    : `${origin}/api/widget/curriculum/${courseSlug}${curriculumShowCard ? "?card=1" : ""}`;

  // Use an iframe to sandbox the widget preview
  const iframeContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}</style></head>
<body><script src="${src}"><\/script></body></html>`;

  return (
    <iframe
      key={src}
      srcDoc={iframeContent}
      className="w-full border-0 rounded"
      style={{ minHeight: "350px", height: "auto" }}
      onLoad={(e) => {
        // Auto-resize iframe to content
        const iframe = e.target as HTMLIFrameElement;
        setTimeout(() => {
          try {
            const h = iframe.contentDocument?.body?.scrollHeight;
            if (h) iframe.style.height = h + 32 + "px";
          } catch {}
        }, 1000);
      }}
    />
  );
}
