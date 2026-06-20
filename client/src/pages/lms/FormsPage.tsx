import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreVertical,
  FileText,
  Copy,
  Trash2,
  ExternalLink,
  BarChart2,
  Edit,
  Globe,
  Lock,
  ClipboardList,
  TrendingUp,
  Sparkles,
  LayoutTemplate,
  Loader2,
  ChevronRight,
  Star,
  Users,
  MessageSquare,
  ClipboardCheck,
  UserPlus,
  Zap,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

// ── Starter Templates ─────────────────────────────────────────────────────────
const STARTER_TEMPLATES = [
  {
    id: "contact",
    label: "Contact Form",
    description: "Name, email, message — the classic contact form",
    icon: MessageSquare,
    color: "text-blue-500",
    fields: [
      { type: "short_answer", label: "Full Name", required: true, placeholder: "Your full name", helpText: "", options: [] },
      { type: "email", label: "Email Address", required: true, placeholder: "you@example.com", helpText: "", options: [] },
      { type: "phone", label: "Phone Number", required: false, placeholder: "+1 (555) 000-0000", helpText: "", options: [] },
      { type: "long_answer", label: "Message", required: true, placeholder: "How can we help you?", helpText: "", options: [] },
    ],
  },
  {
    id: "feedback",
    label: "Customer Feedback",
    description: "Collect satisfaction ratings and open-ended feedback",
    icon: Star,
    color: "text-yellow-500",
    fields: [
      { type: "rating", label: "Overall Satisfaction", required: true, placeholder: "", helpText: "Rate your experience from 1–5", options: [] },
      { type: "radio", label: "How did you hear about us?", required: false, placeholder: "", helpText: "", options: [
        { value: "search", label: "Search engine" },
        { value: "social", label: "Social media" },
        { value: "referral", label: "Referral" },
        { value: "other", label: "Other" },
      ]},
      { type: "long_answer", label: "What did you enjoy most?", required: false, placeholder: "Tell us what went well...", helpText: "", options: [] },
      { type: "long_answer", label: "What could we improve?", required: false, placeholder: "Any suggestions are welcome...", helpText: "", options: [] },
    ],
  },
  {
    id: "survey",
    label: "General Survey",
    description: "Multi-section survey with various question types",
    icon: ClipboardList,
    color: "text-purple-500",
    fields: [
      { type: "section_break", label: "About You", required: false, placeholder: "", helpText: "", options: [] },
      { type: "short_answer", label: "Name", required: true, placeholder: "Your name", helpText: "", options: [] },
      { type: "dropdown", label: "Age Range", required: false, placeholder: "", helpText: "", options: [
        { value: "under_18", label: "Under 18" },
        { value: "18_24", label: "18–24" },
        { value: "25_34", label: "25–34" },
        { value: "35_44", label: "35–44" },
        { value: "45_plus", label: "45+" },
      ]},
      { type: "section_break", label: "Your Opinion", required: false, placeholder: "", helpText: "", options: [] },
      { type: "scale", label: "How satisfied are you overall?", required: true, placeholder: "", helpText: "1 = Very dissatisfied, 5 = Very satisfied", options: [], scaleMin: 1, scaleMax: 5, scaleMinLabel: "Very dissatisfied", scaleMaxLabel: "Very satisfied" },
      { type: "checkbox", label: "Which features do you use?", required: false, placeholder: "", helpText: "", options: [
        { value: "feature_a", label: "Feature A" },
        { value: "feature_b", label: "Feature B" },
        { value: "feature_c", label: "Feature C" },
      ]},
      { type: "long_answer", label: "Any additional comments?", required: false, placeholder: "Share your thoughts...", helpText: "", options: [] },
    ],
  },
  {
    id: "registration",
    label: "Event Registration",
    description: "Collect attendee info for events or workshops",
    icon: UserPlus,
    color: "text-green-500",
    fields: [
      { type: "short_answer", label: "First Name", required: true, placeholder: "First name", helpText: "", options: [] },
      { type: "short_answer", label: "Last Name", required: true, placeholder: "Last name", helpText: "", options: [] },
      { type: "email", label: "Email Address", required: true, placeholder: "you@example.com", helpText: "", options: [] },
      { type: "phone", label: "Phone Number", required: false, placeholder: "+1 (555) 000-0000", helpText: "", options: [] },
      { type: "radio", label: "Attendance Type", required: true, placeholder: "", helpText: "", options: [
        { value: "in_person", label: "In-person" },
        { value: "virtual", label: "Virtual" },
      ]},
      { type: "long_answer", label: "Dietary Requirements / Accessibility Needs", required: false, placeholder: "Let us know if you have any special requirements...", helpText: "", options: [] },
    ],
  },
  {
    id: "quiz",
    label: "Knowledge Quiz",
    description: "Test understanding with scored multiple-choice questions",
    icon: ClipboardCheck,
    color: "text-orange-500",
    fields: [
      { type: "radio", label: "Question 1: What is the capital of France?", required: true, placeholder: "", helpText: "", options: [
        { value: "london", label: "London", scoreValue: 0 },
        { value: "paris", label: "Paris", scoreValue: 10 },
        { value: "berlin", label: "Berlin", scoreValue: 0 },
        { value: "madrid", label: "Madrid", scoreValue: 0 },
      ], scoreWeight: 1 },
      { type: "radio", label: "Question 2: Which planet is closest to the Sun?", required: true, placeholder: "", helpText: "", options: [
        { value: "venus", label: "Venus", scoreValue: 0 },
        { value: "earth", label: "Earth", scoreValue: 0 },
        { value: "mercury", label: "Mercury", scoreValue: 10 },
        { value: "mars", label: "Mars", scoreValue: 0 },
      ], scoreWeight: 1 },
      { type: "radio", label: "Question 3: What is 2 + 2?", required: true, placeholder: "", helpText: "", options: [
        { value: "3", label: "3", scoreValue: 0 },
        { value: "4", label: "4", scoreValue: 10 },
        { value: "5", label: "5", scoreValue: 0 },
        { value: "22", label: "22", scoreValue: 0 },
      ], scoreWeight: 1 },
    ],
  },
  {
    id: "lead",
    label: "Lead Capture",
    description: "Capture leads with name, email, and key qualifying questions",
    icon: Zap,
    color: "text-pink-500",
    fields: [
      { type: "short_answer", label: "Full Name", required: true, placeholder: "Your name", helpText: "", options: [] },
      { type: "email", label: "Email Address", required: true, placeholder: "work@company.com", helpText: "", options: [] },
      { type: "short_answer", label: "Company / Organization", required: false, placeholder: "Where do you work?", helpText: "", options: [] },
      { type: "radio", label: "What best describes your role?", required: false, placeholder: "", helpText: "", options: [
        { value: "individual", label: "Individual / Freelancer" },
        { value: "small_team", label: "Small team (2–10)" },
        { value: "mid_size", label: "Mid-size company (11–200)" },
        { value: "enterprise", label: "Enterprise (200+)" },
      ]},
      { type: "long_answer", label: "What problem are you trying to solve?", required: false, placeholder: "Tell us about your challenge...", helpText: "", options: [] },
    ],
  },
];

type CreateMode = "blank" | "template" | "ai";

export default function FormsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("blank");

  // Blank mode state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // AI mode state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPreview, setAiPreview] = useState<{ title: string; description: string; fields: any[] } | null>(null);
  const [aiTitle, setAiTitle] = useState("");

  const { data: orgCtx } = trpc.orgs.myContext.useQuery();
  const orgId = orgCtx?.org?.id;
  const orgSlug = orgCtx?.org?.slug;

  const { data: forms, isLoading, refetch } = trpc.forms.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const createMutation = trpc.forms.create.useMutation({
    onSuccess: (form) => {
      closeDialog();
      setLocation(`/lms/forms/${form.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const generateMutation = trpc.forms.generateFromPrompt.useMutation({
    onSuccess: (data) => {
      setAiPreview(data);
      setAiTitle(data.title);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.forms.delete.useMutation({
    onSuccess: () => { toast.success("Form deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const duplicateMutation = trpc.forms.duplicate.useMutation({
    onSuccess: (form) => {
      toast.success("Form duplicated");
      setLocation(`/lms/forms/${form.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (forms ?? []).filter((f) =>
    !search || f.title.toLowerCase().includes(search.toLowerCase())
  );

  const closeDialog = () => {
    setCreateOpen(false);
    setCreateMode("blank");
    setNewTitle("");
    setNewDesc("");
    setAiPrompt("");
    setAiPreview(null);
    setAiTitle("");
  };

  const handleCreateBlank = () => {
    if (!newTitle.trim() || !orgId) return;
    createMutation.mutate({ orgId, title: newTitle.trim(), description: newDesc.trim() || undefined });
  };

  const handleCreateFromTemplate = (tpl: typeof STARTER_TEMPLATES[0]) => {
    if (!orgId) return;
    // Create form with pre-populated fields via the create procedure
    // We pass the template fields as initialFields
    createMutation.mutate({
      orgId,
      title: tpl.label,
      description: tpl.description,
      initialFields: tpl.fields as any,
    });
  };

  const handleApplyAiForm = () => {
    if (!aiPreview || !orgId || !aiTitle.trim()) return;
    createMutation.mutate({
      orgId,
      title: aiTitle.trim(),
      description: aiPreview.description,
      initialFields: aiPreview.fields as any,
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Forms
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create surveys, quizzes, and data-collection forms
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Form
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search forms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{search ? "No forms match your search" : "No forms yet"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {!search && "Create your first form to start collecting responses."}
            </p>
          </div>
          {!search && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Form
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((form) => (
            <Card key={form.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {form.title}
                    </h3>
                    {form.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.description}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocation(`/lms/forms/${form.id}`)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateMutation.mutate({ id: form.id })}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      {form.status === "published" && (
                        <DropdownMenuItem onClick={() => window.open(orgSlug ? `${getOrgBaseUrl(orgSlug)}/forms/${form.slug}` : `/forms/${form.slug}`, "_blank")}>
                          <ExternalLink className="h-4 w-4 mr-2" /> View Live
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${form.title}"? This cannot be undone.`)) {
                            deleteMutation.mutate({ id: form.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge className={`text-xs px-2 py-0.5 font-medium border-0 ${STATUS_COLORS[form.status]}`}>
                    {form.status === "published" ? (
                      <Globe className="h-3 w-3 mr-1 inline" />
                    ) : form.status === "closed" ? (
                      <Lock className="h-3 w-3 mr-1 inline" />
                    ) : null}
                    {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BarChart2 className="h-3 w-3" />
                    {form.submissionCount} response{form.submissionCount !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    onClick={() => setLocation(`/lms/forms/${form.id}`)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    onClick={() => setLocation(`/lms/forms/${form.id}/responses`)}
                  >
                    <BarChart2 className="h-3 w-3 mr-1" />
                    Responses
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    onClick={() => setLocation(`/lms/forms/${form.id}/analytics`)}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog — 3 modes */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setCreateOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
          </DialogHeader>

          {/* Mode tabs */}
          <div className="flex gap-1 border border-border rounded-lg p-1 bg-muted/40 mb-4">
            {([
              { id: "blank" as CreateMode, label: "Blank Form", icon: FileText },
              { id: "template" as CreateMode, label: "From Template", icon: LayoutTemplate },
              { id: "ai" as CreateMode, label: "AI Generate", icon: Sparkles },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCreateMode(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  createMode === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Blank mode ── */}
          {createMode === "blank" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Form Title *</label>
                <Input
                  placeholder="e.g. Customer Feedback Survey"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateBlank()}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Description (optional)</label>
                <Input
                  placeholder="Brief description of this form"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button
                  onClick={handleCreateBlank}
                  disabled={!newTitle.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Creating...</> : "Create & Edit"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Template mode ── */}
          {createMode === "template" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose a starter template — you can customise every field after creation.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STARTER_TEMPLATES.map((tpl) => {
                  const Icon = tpl.icon;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => handleCreateFromTemplate(tpl)}
                      disabled={createMutation.isPending}
                      className="flex items-start gap-3 p-3.5 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                    >
                      <div className={`mt-0.5 shrink-0 ${tpl.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold group-hover:text-primary transition-colors">{tpl.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{tpl.fields.length} fields</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ── AI Generate mode ── */}
          {createMode === "ai" && (
            <div className="space-y-4">
              {!aiPreview ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Describe your form *</label>
                    <Textarea
                      placeholder="e.g. A post-workshop feedback form for a 3-day leadership training. Collect overall satisfaction, which sessions were most valuable, what could be improved, and whether attendees would recommend the program."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Be specific about the purpose, audience, and types of questions you need.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                    <Button
                      onClick={() => generateMutation.mutate({ prompt: aiPrompt })}
                      disabled={aiPrompt.trim().length < 10 || generateMutation.isPending}
                      className="gap-1.5"
                    >
                      {generateMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" />Generate Form</>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Form Title</label>
                    <Input
                      value={aiTitle}
                      onChange={(e) => setAiTitle(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {aiPreview.description && (
                    <p className="text-xs text-muted-foreground italic">{aiPreview.description}</p>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {aiPreview.fields.length} field{aiPreview.fields.length !== 1 ? "s" : ""} generated
                    </p>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {aiPreview.fields.map((f: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-muted rounded px-2.5 py-1.5">
                          <span className="font-mono text-muted-foreground w-20 shrink-0">{f.type}</span>
                          <span className="font-medium truncate">{f.label}</span>
                          {f.required && <span className="ml-auto text-red-500 shrink-0">required</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAiPreview(null); setAiTitle(""); }}
                      className="flex-1"
                    >
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApplyAiForm}
                      disabled={!aiTitle.trim() || createMutation.isPending}
                      className="flex-1 gap-1.5"
                    >
                      {createMutation.isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Creating...</>
                      ) : (
                        <>Create Form <ChevronRight className="h-3.5 w-3.5" /></>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
