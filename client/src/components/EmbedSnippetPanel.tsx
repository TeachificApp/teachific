/**
 * EmbedSnippetPanel
 *
 * A reusable panel that renders:
 *  - Direct link (opens the content page)
 *  - Embed URL (bare URL for iframe src)
 *  - Iframe snippet (copy-paste HTML)
 *  - JS loader snippet (dynamic embed via script tag)
 *  - URL parameter builder with placeholder tokens
 *
 * Used on every product admin page (courses, downloads, quizzes,
 * memberships, bundles, workshops, forms) and in OrgSettings.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Code2,
  Link2,
  Settings2,
  Braces,
  CheckCircle2,
} from "lucide-react";

// ─── URL parameter token definitions ─────────────────────────────────────────

export const EMBED_PARAMS = [
  { key: "learner_name",  label: "Learner Name",  placeholder: "{{learner_name}}",  example: "Jane Doe" },
  { key: "learner_email", label: "Learner Email", placeholder: "{{learner_email}}", example: "jane@example.com" },
  { key: "learner_id",    label: "Learner ID",    placeholder: "{{learner_id}}",    example: "usr_123" },
  { key: "group_id",      label: "Group / Cohort",placeholder: "{{group_id}}",      example: "cohort_A" },
  { key: "custom_data",   label: "Custom Data",   placeholder: "{{custom_data}}",   example: "any_string" },
  { key: "utm_source",    label: "UTM Source",    placeholder: "{{utm_source}}",    example: "newsletter" },
  { key: "utm_medium",    label: "UTM Medium",    placeholder: "{{utm_medium}}",    example: "email" },
  { key: "utm_campaign",  label: "UTM Campaign",  placeholder: "{{utm_campaign}}",  example: "spring_launch" },
];

// ─── Copy helper ──────────────────────────────────────────────────────────────

function CopyInput({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex gap-2">
      <Input value={value} readOnly className="text-xs font-mono bg-muted" />
      <Button size="icon" variant="outline" onClick={copy} title={`Copy ${label}`}>
        {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function CopyTextarea({ value, label, rows = 4 }: { value: string; label: string; rows?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative">
      <Textarea value={value} readOnly rows={rows} className="text-xs font-mono bg-muted pr-12 resize-none" />
      <Button
        size="icon"
        variant="outline"
        onClick={copy}
        className="absolute top-2 right-2 h-7 w-7"
        title={`Copy ${label}`}
      >
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface EmbedSnippetPanelProps {
  /** The public-facing URL of the content (e.g. /school/courses/42) */
  contentUrl: string;
  /** Human-readable title used in generated snippets */
  title: string;
  /** Default iframe height in px */
  defaultHeight?: number;
  /** Whether to show the URL parameter builder tab */
  showParamBuilder?: boolean;
}

export function EmbedSnippetPanel({
  contentUrl,
  title,
  defaultHeight = 600,
  showParamBuilder = true,
}: EmbedSnippetPanelProps) {
  const origin = window.location.origin;
  const fullUrl = contentUrl.startsWith("http") ? contentUrl : `${origin}${contentUrl}`;

  // Param builder state
  const [enabledParams, setEnabledParams] = useState<Record<string, boolean>>({});
  const [iframeHeight, setIframeHeight] = useState(defaultHeight);
  const [iframeWidth, setIframeWidth] = useState("100%");
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");

  // Build embed URL with enabled params as placeholders
  const buildEmbedUrl = (usePlaceholders: boolean) => {
    const params = new URLSearchParams();
    params.set("embed", "1");
    if (theme !== "auto") params.set("theme", theme);
    if (usePlaceholders) {
      EMBED_PARAMS.forEach((p) => {
        if (enabledParams[p.key]) params.set(p.key, p.placeholder);
      });
    }
    return `${fullUrl}?${params.toString()}`;
  };

  const embedUrl = buildEmbedUrl(true);
  const iframeSnippet = `<iframe\n  src="${embedUrl}"\n  width="${iframeWidth}"\n  height="${iframeHeight}"\n  frameborder="0"\n  allowfullscreen\n  loading="lazy"\n  title="${title.replace(/"/g, "&quot;")}"\n></iframe>`;

  const jsSnippet = `<!-- Learning Content Embed Loader -->
<div id="learning-content-embed-${Math.abs(fullUrl.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0))}"></div>
<script>
(function() {
  var container = document.currentScript.previousElementSibling;
  var iframe = document.createElement('iframe');
  // Replace {{placeholder}} tokens with your LMS/CRM dynamic values
  var src = "${embedUrl}";
${EMBED_PARAMS.filter((p) => enabledParams[p.key]).map((p) => `  src = src.replace('${p.placeholder}', encodeURIComponent(/* your_${p.key} */ ''));`).join("\n")}
  iframe.src = src;
  iframe.width = '${iframeWidth}';
  iframe.height = '${iframeHeight}';
  iframe.frameBorder = '0';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  iframe.title = "${title.replace(/"/g, '\\"')}";
  container.appendChild(iframe);
})();
</script>`;

  const toggleParam = (key: string) =>
    setEnabledParams((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Tabs defaultValue="links" className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-4">
        {[
          { value: "links",   label: "Links",       icon: <Link2 className="w-3.5 h-3.5" /> },
          { value: "iframe",  label: "iFrame",      icon: <Code2 className="w-3.5 h-3.5" /> },
          { value: "js",      label: "JS Loader",   icon: <Braces className="w-3.5 h-3.5" /> },
          ...(showParamBuilder ? [{ value: "params", label: "URL Params", icon: <Settings2 className="w-3.5 h-3.5" /> }] : []),
        ].map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--org-primary)] data-[state=active]:text-[var(--org-primary)] px-3 py-2 text-sm font-medium bg-transparent hover:text-[var(--org-primary)] gap-1.5"
          >
            {t.icon}{t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ── Links tab ── */}
      <TabsContent value="links" className="space-y-4 mt-0">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Direct Link</Label>
          <p className="text-xs text-muted-foreground">Opens the content page in the browser.</p>
          <div className="flex gap-2">
            <CopyInput value={fullUrl} label="Direct link" />
            <Button size="icon" variant="outline" asChild>
              <a href={fullUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Embed URL</Label>
          <p className="text-xs text-muted-foreground">Use as the <code className="text-xs bg-muted px-1 rounded">src</code> in an iframe — renders inline, no navigation chrome.</p>
          <CopyInput value={buildEmbedUrl(false)} label="Embed URL" />
        </div>
      </TabsContent>

      {/* ── iFrame tab ── */}
      <TabsContent value="iframe" className="space-y-4 mt-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Width</Label>
            <Input
              value={iframeWidth}
              onChange={(e) => setIframeWidth(e.target.value)}
              placeholder="100% or 800"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Height (px)</Label>
            <Input
              type="number"
              value={iframeHeight}
              onChange={(e) => setIframeHeight(Number(e.target.value))}
              className="text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Theme</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as any)}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (follows host page)</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Embed Code</Label>
          <CopyTextarea value={iframeSnippet} label="iFrame snippet" rows={6} />
          <p className="text-xs text-muted-foreground">
            Paste this HTML into any webpage. Works cross-origin — no third-party cookies required.
          </p>
        </div>
      </TabsContent>

      {/* ── JS Loader tab ── */}
      <TabsContent value="js" className="space-y-4 mt-0">
        <p className="text-sm text-muted-foreground">
          The JS loader dynamically injects the iframe and lets you substitute learner data at runtime.
          Replace the empty strings with your LMS or CRM variables before deploying.
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">JS Snippet</Label>
          <CopyTextarea value={jsSnippet} label="JS loader snippet" rows={10} />
        </div>
        <p className="text-xs text-muted-foreground">
          Enable URL parameters in the <strong>URL Params</strong> tab to include them in the generated snippet.
        </p>
      </TabsContent>

      {/* ── URL Params tab ── */}
      {showParamBuilder && (
        <TabsContent value="params" className="space-y-4 mt-0">
          <p className="text-sm text-muted-foreground">
            Enable parameters to include them as placeholder tokens in the embed URL and JS snippet.
            Your host site replaces each <code className="text-xs bg-muted px-1 rounded">{"{{token}}"}</code> with the learner's actual value before rendering the iframe.
          </p>
          <div className="space-y-2">
            {EMBED_PARAMS.map((p) => (
              <div key={p.key} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.placeholder}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {enabledParams[p.key] && (
                    <Badge variant="secondary" className="text-xs font-mono">{p.example}</Badge>
                  )}
                  <Switch
                    checked={!!enabledParams[p.key]}
                    onCheckedChange={() => toggleParam(p.key)}
                  />
                </div>
              </div>
            ))}
          </div>
          {Object.values(enabledParams).some(Boolean) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Generated Embed URL</Label>
              <CopyInput value={embedUrl} label="Parameterised embed URL" />
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}
