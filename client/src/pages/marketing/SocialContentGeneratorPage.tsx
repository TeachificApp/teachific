import { FormEvent, useMemo, useState } from "react";
import { Copy, Lightbulb, Loader2, Megaphone, RefreshCw, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_CONTENT_TYPE = "educational_insight";
const DEFAULT_CATEGORY = "Learning & Development";

type GeneratedDraft = {
  headline: string;
  body: string;
  subtext: string;
  socialCaption: string;
  category: string;
  contentType: string;
  organizationId: number;
  organizationName: string;
};

async function copyDraft(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Unable to copy this draft. Please select and copy the text manually.");
  }
}

export default function SocialContentGeneratorPage() {
  const [contentType, setContentType] = useState(DEFAULT_CONTENT_TYPE);
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("1");
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);

  const optionsQuery = trpc.socialContent.getOptions.useQuery();
  const generateMutation = trpc.socialContent.generateContent.useMutation({
    onSuccess: (result) => {
      setDrafts(result.items as GeneratedDraft[]);
      toast.success(result.items.length === 1 ? "Social draft generated" : `${result.items.length} social drafts generated`);
    },
    onError: (error) => toast.error(error.message),
  });

  const contentTypes = optionsQuery.data?.contentTypes ?? [];
  const categories = optionsQuery.data?.categories ?? [];
  const selectedContentType = contentTypes.some(option => option.value === contentType)
    ? contentType
    : contentTypes[0]?.value ?? DEFAULT_CONTENT_TYPE;
  const selectedCategory = categories.some(option => option.value === category)
    ? category
    : categories[0]?.value ?? DEFAULT_CATEGORY;
  const maxDraftCount = useMemo(() => Math.min(3, Math.max(1, Number.parseInt(count, 10) || 1)), [count]);

  function updateDraft(index: number, field: "headline" | "body" | "subtext" | "socialCaption", value: string) {
    setDrafts(current => current.map((draft, draftIndex) => draftIndex === index ? { ...draft, [field]: value } : draft));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    generateMutation.mutate({
      contentType: selectedContentType as typeof DEFAULT_CONTENT_TYPE,
      category: selectedCategory as typeof DEFAULT_CATEGORY,
      customTopic: topic.trim() || undefined,
      count: maxDraftCount,
    } as any);
  }

  return (
    <div className="min-h-full bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Share2 className="h-5 w-5" />
              <span className="text-sm font-semibold">Marketing tools</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Social Content Generator</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Create editable social drafts for the active organization. Review every draft for accuracy and add your own voice before publishing.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Lightbulb className="h-3.5 w-3.5" /> Organization-scoped drafts
          </div>
        </div>

        {optionsQuery.isError ? (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base">Organization-admin access required</CardTitle>
              <CardDescription>{optionsQuery.error.message}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Create drafts</CardTitle>
                <CardDescription>Content is generated for the organization currently selected in Course360.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={submit}>
                  <div className="space-y-2">
                    <Label htmlFor="social-content-type">Content format</Label>
                    <Select value={selectedContentType} onValueChange={setContentType} disabled={optionsQuery.isLoading}>
                      <SelectTrigger id="social-content-type"><SelectValue placeholder="Choose a format" /></SelectTrigger>
                      <SelectContent>
                        {contentTypes.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social-category">Category</Label>
                    <Select value={selectedCategory} onValueChange={setCategory} disabled={optionsQuery.isLoading}>
                      <SelectTrigger id="social-category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social-topic">Topic or campaign direction <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Textarea
                      id="social-topic"
                      value={topic}
                      onChange={event => setTopic(event.target.value)}
                      maxLength={500}
                      rows={5}
                      placeholder="Example: Welcome new members to our fall learning series and invite them to explore the first lesson."
                    />
                    <p className="text-xs text-muted-foreground">{topic.length}/500 characters</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social-count">Drafts to generate</Label>
                    <Input id="social-count" type="number" min={1} max={3} value={count} onChange={event => setCount(event.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={optionsQuery.isLoading || generateMutation.isPending || contentTypes.length === 0 || categories.length === 0}>
                    {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {generateMutation.isPending ? "Generating drafts…" : "Generate social drafts"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <section aria-live="polite" className="space-y-4">
              {drafts.length === 0 ? (
                <Card className="border-dashed bg-background/70">
                  <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                    <Megaphone className="mb-4 h-10 w-10 text-primary/50" />
                    <h2 className="text-base font-semibold">Your social drafts will appear here</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Choose a format and category, then add a campaign topic if you have one. Generated copy is a starting point, not a publication.</p>
                  </CardContent>
                </Card>
              ) : drafts.map((draft, index) => (
                <Card key={`${draft.headline}-${index}`} className="overflow-hidden">
                  <CardHeader className="border-b bg-primary/5 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Label className="sr-only" htmlFor={`social-headline-${index}`}>Draft headline</Label>
                        <Input
                          id={`social-headline-${index}`}
                          value={draft.headline}
                          onChange={event => updateDraft(index, "headline", event.target.value)}
                          className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                        />
                        <CardDescription className="mt-1">{draft.category} · {draft.contentType.replace(/_/g, " ")}</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => copyDraft([draft.headline, draft.body, draft.subtext].filter(Boolean).join("\n\n"))}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Card copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor={`social-body-${index}`}>Card copy</Label>
                      <Textarea id={`social-body-${index}`} value={draft.body} onChange={event => updateDraft(index, "body", event.target.value)} rows={4} />
                    </div>
                    <div className="space-y-2 border-l-2 border-primary/40 pl-3">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor={`social-subtext-${index}`}>Supporting line</Label>
                      <Textarea id={`social-subtext-${index}`} value={draft.subtext} onChange={event => updateDraft(index, "subtext", event.target.value)} rows={2} />
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editable caption</p>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => copyDraft(draft.socialCaption)}>
                          <Copy className="mr-1 h-3 w-3" /> Copy
                        </Button>
                      </div>
                      <Textarea value={draft.socialCaption} onChange={event => updateDraft(index, "socialCaption", event.target.value)} rows={7} className="bg-background" aria-label="Editable social caption" />
                    </div>
                    <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                      <span>Prepared for {draft.organizationName}</span>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => generateMutation.mutate({ contentType: draft.contentType, category: draft.category, count: 1 } as any)} disabled={generateMutation.isPending}>
                        <RefreshCw className="mr-1 h-3 w-3" /> New version
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
