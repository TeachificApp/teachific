import { useMemo, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  GraduationCap,
  FileText,
  Send,
  Download,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  Plus,
  RefreshCw,
  History,
  Pencil,
  Lock,
  Info,
  BarChart3,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Status badge ─────────────────────────────────────────────────────────────
function CmeStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status || status === "draft")
    return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">Draft</Badge>;
  if (status === "pending_approval")
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Pending Approval</Badge>;
  if (status === "approved")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Approved</Badge>;
  if (status === "expired")
    return <Badge className="bg-red-100 text-red-600 border-red-200 text-xs">Expired</Badge>;
  return <Badge className="bg-slate-100 text-slate-500 text-xs">{status}</Badge>;
}

// ─── CME Forms List ───────────────────────────────────────────────────────────
function CmeFormsList({ onSelect }: { onSelect: (courseId: number, courseTitle: string) => void }) {
  const { data: forms, isLoading, refetch } = trpc.cme.listCmeActivityForms.useQuery({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading CME-eligible courses…
      </div>
    );
  }

  if (!forms || forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
        <GraduationCap className="w-10 h-10 opacity-30" />
        <div className="text-center">
          <p className="font-medium text-slate-600">No CME-eligible courses found</p>
          <p className="text-sm mt-1">Enable certificates on your courses to make them eligible for CME credit processing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{forms.length} CME-eligible course{forms.length !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-slate-700 font-semibold">Course</TableHead>
              <TableHead className="text-slate-700 font-semibold">Credit Hours</TableHead>
              <TableHead className="text-slate-700 font-semibold">CME Status</TableHead>
              <TableHead className="text-slate-700 font-semibold">Last Sent</TableHead>
              <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forms.map((item: any) => (
              <TableRow key={item.course.id} className="hover:bg-slate-50/50">
                <TableCell>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{item.course.title}</p>
                    <p className="text-xs text-slate-400 font-mono">{item.course.slug}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-slate-600">
                    {item.course.creditHours ? `${item.course.creditHours} hr${Number(item.course.creditHours) !== 1 ? "s" : ""}` : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <CmeStatusBadge status={item.form?.cmeStatus} />
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-500">
                    {item.form?.lastSentAt
                      ? new Date(item.form.lastSentAt).toLocaleDateString()
                      : "Never sent"}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelect(item.course.id, item.course.title)}
                    className="gap-1.5 text-xs h-7 border-[color:color-mix(in_srgb,var(--org-primary)_35%,transparent)] text-[var(--org-primary)] hover:bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]"
                  >
                    <Pencil className="w-3 h-3" />
                    {item.form ? "Edit Form" : "Create Form"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── CME Activity Reporting ───────────────────────────────────────────────────
function CmeActivityReportPanel() {
  const [courseId, setCourseId] = useState<string>("");
  const { data: activities } = trpc.cme.listCmeActivityForms.useQuery({});
  const reportInput = useMemo(() => courseId ? { courseId: Number(courseId), page: 1, pageSize: 50 } : undefined, [courseId]);
  const { data: report, isLoading } = trpc.cme.getCmeActivityReport.useQuery(reportInput!, { enabled: !!reportInput });
  const exportCsv = trpc.cme.exportCmeActivityReportCsv.useMutation({
    onSuccess: ({ csv, filename }) => {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => toast.error(error.message),
  });
  const selectedActivity = activities?.find((activity: any) => activity.id === Number(courseId));

  return (
    <Card className="border-[color:color-mix(in_srgb,var(--org-primary)_18%,transparent)]">
      <CardHeader className="pb-4">
        <CardTitle className="text-base text-slate-800 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[var(--org-primary)]" />CME Activity Reports</CardTitle>
        <CardDescription>Review learner completion, certificates, quiz attempts, and submitted CME survey responses for an activity in this organization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="space-y-1 flex-1">
            <Label className="text-xs text-slate-600">CME Activity</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Select a CME activity" /></SelectTrigger>
              <SelectContent>{(activities ?? []).map((activity: any) => <SelectItem key={activity.id} value={String(activity.id)}>{activity.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button disabled={!courseId || exportCsv.isPending} onClick={() => exportCsv.mutate({ courseId: Number(courseId) })} className="org-primary-button gap-1.5"><Download className="w-3.5 h-3.5" />{exportCsv.isPending ? "Preparing…" : "Export CSV"}</Button>
        </div>
        {!courseId && <p className="text-sm text-slate-500 rounded-lg bg-slate-50 px-3 py-4">Select a CME activity to view organization-scoped learner activity records.</p>}
        {courseId && isLoading && <p className="text-sm text-slate-500 py-6 text-center">Loading report…</p>}
        {report && <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[["Enrollments", report.summary.enrollmentCount], ["Completed", report.summary.completionCount], ["Certificates", report.summary.certificateCount]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-[color:color-mix(in_srgb,var(--org-primary)_7%,white)] border border-[color:color-mix(in_srgb,var(--org-primary)_15%,transparent)] p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-semibold text-[var(--org-primary)]">{value}</p></div>)}
          </div>
          <div className="rounded-xl border border-slate-200 overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-slate-50"><TableHead>Learner</TableHead><TableHead>Progress</TableHead><TableHead>Completed</TableHead><TableHead>Certificate</TableHead><TableHead>Activity</TableHead></TableRow></TableHeader>
            <TableBody>
              {report.learners.map((learner: any, index: number) => <TableRow key={`${learner.learnerEmail}-${index}`}><TableCell><p className="text-sm font-medium text-slate-800">{learner.learnerName || "—"}</p><p className="text-xs text-slate-500">{learner.learnerEmail}</p></TableCell><TableCell className="text-sm text-slate-700">{Number(learner.progressPercent ?? 0).toFixed(2)}%</TableCell><TableCell className="text-xs text-slate-600">{learner.completedAt ? new Date(learner.completedAt).toLocaleDateString() : "—"}</TableCell><TableCell className="text-xs text-slate-600">{learner.certificateIssuedAt ? new Date(learner.certificateIssuedAt).toLocaleDateString() : "—"}</TableCell><TableCell className="text-xs text-slate-600">{learner.quizAttempts.length} attempt{learner.quizAttempts.length === 1 ? "" : "s"}</TableCell></TableRow>)}
              {report.learners.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">No full enrollments are available for this activity.</TableCell></TableRow>}
            </TableBody>
          </Table></div>
          {selectedActivity && <p className="text-xs text-slate-500">Report records are limited to <span className="font-medium text-slate-700">{selectedActivity.title}</span> in the active organization.</p>}
        </div>}
      </CardContent>
    </Card>
  );
}

// ─── CME Form Editor ──────────────────────────────────────────────────────────
function CmeFormEditor({
  courseId,
  courseTitle,
  onBack,
}: {
  courseId: number;
  courseTitle: string;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("activity");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<"draft" | "pending_approval" | "approved" | "expired">("draft");

  const { data: formData, isLoading } = trpc.cme.getCmeActivityForm.useQuery({ courseId });

  // Initialize email defaults when form data loads
  const emailInitialized = useRef(false);
  if (formData && !emailInitialized.current) {
    emailInitialized.current = true;
    const orgName = formData.org?.cmeOrgName ?? formData.org?.name ?? "Our Organization";
    const title = formData.form?.activityTitle ?? courseTitle;
    setEmailSubject(`CME Activity Planning Form — ${title}`);
    setEmailBody(
      `Dear Don and Judith,\n\nPlease find attached the completed CME Activity Planning Form for "${title}" from ${orgName}.\n\nWe are requesting ${formData.form?.cmeCreditsRequested ?? formData.course?.creditHours ?? "1"} AMA PRA Category 1 Credit(s)™ for this activity.\n\nPlease let us know if you need any additional information.\n\nThank you,\n${orgName} CME Team`
    );
  }

  const generateContent = trpc.cme.generateCmeFormContent.useMutation({
    onSuccess: (data) => {
      if (data && formData) {
        setFormFields((prev) => ({ ...prev, ...data }));
        toast.success("AI content generated — review and adjust as needed");
      }
    },
    onError: (e) => toast.error(`AI generation failed: ${e.message}`),
  });

  const saveForm = trpc.cme.saveCmeActivityForm.useMutation({
    onSuccess: () => {
      utils.cme.getCmeActivityForm.invalidate({ courseId });
      utils.cme.listCmeActivityForms.invalidate({});
      toast.success("CME form saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendToCme = trpc.cme.sendToCme.useMutation({
    onSuccess: () => {
      utils.cme.getCmeActivityForm.invalidate({ courseId });
      utils.cme.listCmeActivityForms.invalidate({});
      setSendDialogOpen(false);
      toast.success("CME form sent successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const downloadPdf = trpc.cme.downloadCmeActivityFormPdf.useMutation({
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatus = trpc.cme.updateCmeStatus.useMutation({
    onSuccess: () => {
      utils.cme.getCmeActivityForm.invalidate({ courseId });
      utils.cme.listCmeActivityForms.invalidate({});
      setStatusDialogOpen(false);
      toast.success("CME status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: sendHistory } = trpc.cme.getCmeSendHistory.useQuery({ courseId });

  // Form fields state
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const fieldsInitialized = useRef(false);
  if (formData && !fieldsInitialized.current) {
    fieldsInitialized.current = true;
    const f = formData.form ?? {};
    setFormFields({
      activityTitle: f.activityTitle ?? courseTitle,
      activityType: f.activityType ?? "enduring_material",
      proposedDate: f.proposedDate ?? "",
      activityLengthHours: f.activityLengthHours ?? (formData.course?.creditHours ? String(formData.course.creditHours) : ""),
      cmeCreditsRequested: f.cmeCreditsRequested ?? (formData.course?.creditHours ? String(formData.course.creditHours) : ""),
      offerMocCredit: f.offerMocCredit ?? "no",
      offeredMoreThanOnce: f.offeredMoreThanOnce ?? "yes",
      activityStructure: f.activityStructure ?? "online_module",
      targetAudience: f.targetAudience ?? "physicians",
      estimatedLearners: f.estimatedLearners ?? "",
      practiceGapDescription: f.practiceGapDescription ?? "",
      practiceGapReasons: f.practiceGapReasons ?? "",
      improvementTypes: f.improvementTypes ?? "",
      improvementKnowledgeText: f.improvementKnowledgeText ?? "",
      improvementCompetenceText: f.improvementCompetenceText ?? "",
      improvementPerformanceText: f.improvementPerformanceText ?? "",
      learnerOutcomes: f.learnerOutcomes ?? "",
      learningObjectives: f.learningObjectives ?? "",
      deliveryDescription: f.deliveryDescription ?? "",
      activityIncludes: f.activityIncludes ?? "",
      assessmentMethods: f.assessmentMethods ?? "",
      contentStatus: f.contentStatus ?? "fully_developed",
      contentAvailableDate: f.contentAvailableDate ?? "",
      marketingChannels: f.marketingChannels ?? "",
      marketingMentionsCme: f.marketingMentionsCme ?? "yes",
      registrationFee: f.registrationFee ?? "yes",
      attestationName: f.attestationName ?? "",
      attestationDate: f.attestationDate ?? "",
      attestationTitle: f.attestationTitle ?? "",
    });
  }

  const field = (key: string) => formFields[key] ?? "";
  const setField = (key: string, value: string) => setFormFields((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    saveForm.mutate({ courseId, data: formFields as any });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading CME form…
      </div>
    );
  }

  const isApproved = formData?.form?.cmeStatus === "approved";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-slate-600 -ml-2">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{courseTitle}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <CmeStatusBadge status={formData?.form?.cmeStatus} />
              {formData?.form?.lastSentAt && (
                <span className="text-xs text-slate-400">
                  Last sent {new Date(formData.form.lastSentAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusDialogOpen(true)}
            className="gap-1.5 text-xs border-slate-200 text-slate-600"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Update Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPdf.mutate({ courseId })}
            disabled={downloadPdf.isPending}
            className="gap-1.5 text-xs border-slate-200 text-slate-600"
          >
            <Download className="w-3.5 h-3.5" />
            {downloadPdf.isPending ? "Generating…" : "Download HTML"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saveForm.isPending}
            className="gap-1.5 text-xs border-[color:color-mix(in_srgb,var(--org-primary)_35%,transparent)] text-[var(--org-primary)] hover:bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]"
          >
            {saveForm.isPending ? "Saving…" : "Save Draft"}
          </Button>
          <Button
            size="sm"
            onClick={() => setSendDialogOpen(true)}
            className="org-primary-button gap-1.5 text-xs"
          >
            <Send className="w-3.5 h-3.5" />
            Send CME Form
          </Button>
        </div>
      </div>

      {isApproved && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>This CME activity has been approved.
            {formData?.form?.approvedAt && ` Approved on ${new Date(formData.form.approvedAt).toLocaleDateString()}.`}
          </span>
        </div>
      )}

      {/* AI Generate Banner */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)] border border-[color:color-mix(in_srgb,var(--org-primary)_30%,transparent)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--org-primary)] shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--org-primary)]">AI-Assisted Form Completion</p>
            <p className="text-xs text-[var(--org-primary)]">Generate practice gap, outcomes, and objectives based on the course title and credit hours.</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => generateContent.mutate({
            courseId,
            courseTitle: field("activityTitle") || courseTitle,
            creditHours: field("cmeCreditsRequested") || field("activityLengthHours") || undefined,
          })}
          disabled={generateContent.isPending}
          className="org-primary-button gap-1.5 text-xs shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {generateContent.isPending ? "Generating…" : "Generate Content"}
        </Button>
      </div>

      {/* Form Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="activity" className="text-xs data-[state=active]:bg-white">Activity Info</TabsTrigger>
          <TabsTrigger value="needs" className="text-xs data-[state=active]:bg-white">Needs Assessment</TabsTrigger>
          <TabsTrigger value="outcomes" className="text-xs data-[state=active]:bg-white">Outcomes</TabsTrigger>
          <TabsTrigger value="delivery" className="text-xs data-[state=active]:bg-white">Delivery</TabsTrigger>
          <TabsTrigger value="marketing" className="text-xs data-[state=active]:bg-white">Marketing</TabsTrigger>
          <TabsTrigger value="faculty" className="text-xs data-[state=active]:bg-white">Faculty</TabsTrigger>
          <TabsTrigger value="attestation" className="text-xs data-[state=active]:bg-white">Attestation</TabsTrigger>
          <TabsTrigger value="history" className="text-xs data-[state=active]:bg-white">
            <History className="w-3 h-3 mr-1" />
            Send History
          </TabsTrigger>
        </TabsList>

        {/* Activity Info */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-slate-700 text-xs font-semibold">Activity Title *</Label>
              <Input value={field("activityTitle")} onChange={(e) => setField("activityTitle", e.target.value)} className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Activity Type</Label>
              <Select value={field("activityType")} onValueChange={(v) => setField("activityType", v)}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enduring_material">Enduring Material (Online)</SelectItem>
                  <SelectItem value="live_activity">Live Activity</SelectItem>
                  <SelectItem value="journal_based">Journal-Based CME</SelectItem>
                  <SelectItem value="performance_improvement">Performance Improvement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Proposed Date / Availability</Label>
              <Input value={field("proposedDate")} onChange={(e) => setField("proposedDate", e.target.value)} placeholder="e.g. Available now, Jan 2025" className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Activity Length (hours)</Label>
              <Input value={field("activityLengthHours")} onChange={(e) => setField("activityLengthHours", e.target.value)} placeholder="e.g. 1.0" className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">CME Credits Requested</Label>
              <Input value={field("cmeCreditsRequested")} onChange={(e) => setField("cmeCreditsRequested", e.target.value)} placeholder="e.g. 1.0" className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Activity Structure</Label>
              <Select value={field("activityStructure")} onValueChange={(v) => setField("activityStructure", v)}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online_module">Online Module</SelectItem>
                  <SelectItem value="webinar">Webinar / Live Webcast</SelectItem>
                  <SelectItem value="in_person">In-Person Conference</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="podcast">Podcast / Audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Target Audience</Label>
              <Input value={field("targetAudience")} onChange={(e) => setField("targetAudience", e.target.value)} placeholder="e.g. Cardiologists, Sonographers" className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Estimated Learners</Label>
              <Input value={field("estimatedLearners")} onChange={(e) => setField("estimatedLearners", e.target.value)} placeholder="e.g. 200" className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex-1">
                <Label className="text-slate-700 text-xs font-semibold">Offer MOC Credit?</Label>
                <p className="text-xs text-slate-400 mt-0.5">Maintenance of Certification credit</p>
              </div>
              <Switch checked={field("offerMocCredit") === "yes"} onCheckedChange={(v) => setField("offerMocCredit", v ? "yes" : "no")} />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex-1">
                <Label className="text-slate-700 text-xs font-semibold">Offered More Than Once?</Label>
                <p className="text-xs text-slate-400 mt-0.5">Will this activity repeat?</p>
              </div>
              <Switch checked={field("offeredMoreThanOnce") === "yes"} onCheckedChange={(v) => setField("offeredMoreThanOnce", v ? "yes" : "no")} />
            </div>
          </div>
        </TabsContent>

        {/* Needs Assessment */}
        <TabsContent value="needs" className="space-y-4 mt-4">
          <div className="p-3 rounded-lg bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)] border border-[color:color-mix(in_srgb,var(--org-primary)_30%,transparent)] flex items-start gap-2">
            <Info className="w-4 h-4 text-[var(--org-primary)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--org-primary)]">Use the AI generator above to auto-fill these fields based on the course title and credit hours.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Practice Gap Description *</Label>
            <Textarea value={field("practiceGapDescription")} onChange={(e) => setField("practiceGapDescription", e.target.value)} rows={4} placeholder="Describe the professional practice gap this activity addresses…" className="bg-white border-slate-200 text-slate-900 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Reasons for Practice Gap</Label>
            <Textarea value={field("practiceGapReasons")} onChange={(e) => setField("practiceGapReasons", e.target.value)} rows={3} placeholder="e.g. Knowledge gap, competence gap, performance gap…" className="bg-white border-slate-200 text-slate-900 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Types of Improvement Targeted</Label>
            <Input value={field("improvementTypes")} onChange={(e) => setField("improvementTypes", e.target.value)} placeholder="e.g. knowledge, competence, performance" className="bg-white border-slate-200 text-slate-900" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Knowledge Improvement</Label>
              <Textarea value={field("improvementKnowledgeText")} onChange={(e) => setField("improvementKnowledgeText", e.target.value)} rows={3} className="bg-white border-slate-200 text-slate-900 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Competence Improvement</Label>
              <Textarea value={field("improvementCompetenceText")} onChange={(e) => setField("improvementCompetenceText", e.target.value)} rows={3} className="bg-white border-slate-200 text-slate-900 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Performance Improvement</Label>
              <Textarea value={field("improvementPerformanceText")} onChange={(e) => setField("improvementPerformanceText", e.target.value)} rows={3} className="bg-white border-slate-200 text-slate-900 text-sm" />
            </div>
          </div>
        </TabsContent>

        {/* Outcomes */}
        <TabsContent value="outcomes" className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Desired Learner Outcomes *</Label>
            <Textarea value={field("learnerOutcomes")} onChange={(e) => setField("learnerOutcomes", e.target.value)} rows={4} placeholder="What will learners be able to do after completing this activity?" className="bg-white border-slate-200 text-slate-900 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Learning Objectives *</Label>
            <Textarea value={field("learningObjectives")} onChange={(e) => setField("learningObjectives", e.target.value)} rows={5} placeholder="List specific, measurable learning objectives (one per line)…" className="bg-white border-slate-200 text-slate-900 text-sm" />
          </div>
        </TabsContent>

        {/* Delivery */}
        <TabsContent value="delivery" className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Delivery Description *</Label>
            <Textarea value={field("deliveryDescription")} onChange={(e) => setField("deliveryDescription", e.target.value)} rows={4} placeholder="Describe how the activity will be delivered…" className="bg-white border-slate-200 text-slate-900 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Activity Includes</Label>
            <Input value={field("activityIncludes")} onChange={(e) => setField("activityIncludes", e.target.value)} placeholder="e.g. video lectures, knowledge checks, case studies" className="bg-white border-slate-200 text-slate-900" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Assessment Methods</Label>
            <Input value={field("assessmentMethods")} onChange={(e) => setField("assessmentMethods", e.target.value)} placeholder="e.g. post-test, learner evaluation, performance assessment" className="bg-white border-slate-200 text-slate-900" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Content Status</Label>
              <Select value={field("contentStatus")} onValueChange={(v) => setField("contentStatus", v)}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fully_developed">Fully Developed</SelectItem>
                  <SelectItem value="in_development">In Development</SelectItem>
                  <SelectItem value="outline_only">Outline Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Content Available Date</Label>
              <Input value={field("contentAvailableDate")} onChange={(e) => setField("contentAvailableDate", e.target.value)} placeholder="e.g. Available now, Q1 2025" className="bg-white border-slate-200 text-slate-900" />
            </div>
          </div>
        </TabsContent>

        {/* Marketing */}
        <TabsContent value="marketing" className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-xs font-semibold">Marketing Channels</Label>
            <Input value={field("marketingChannels")} onChange={(e) => setField("marketingChannels", e.target.value)} placeholder="e.g. email, website, social media, conference" className="bg-white border-slate-200 text-slate-900" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex-1">
                <Label className="text-slate-700 text-xs font-semibold">Marketing Mentions CME?</Label>
                <p className="text-xs text-slate-400 mt-0.5">Does promotional material mention CME credit?</p>
              </div>
              <Switch checked={field("marketingMentionsCme") === "yes"} onCheckedChange={(v) => setField("marketingMentionsCme", v ? "yes" : "no")} />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex-1">
                <Label className="text-slate-700 text-xs font-semibold">Registration Fee?</Label>
                <p className="text-xs text-slate-400 mt-0.5">Is there a fee to access this activity?</p>
              </div>
              <Switch checked={field("registrationFee") === "yes"} onCheckedChange={(v) => setField("registrationFee", v ? "yes" : "no")} />
            </div>
          </div>
        </TabsContent>

        {/* Faculty */}
        <TabsContent value="faculty" className="space-y-4 mt-4">
          <FacultyEditor
            value={field("facultyJson")}
            onChange={(v) => setField("facultyJson", v)}
          />
        </TabsContent>

        {/* Attestation */}
        <TabsContent value="attestation" className="space-y-4 mt-4">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">The attestation confirms that all content is free from commercial bias and that faculty have disclosed conflicts of interest.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Signatory Name *</Label>
              <Input value={field("attestationName")} onChange={(e) => setField("attestationName", e.target.value)} placeholder="Full name" className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Title / Credentials</Label>
              <Input value={field("attestationTitle")} onChange={(e) => setField("attestationTitle", e.target.value)} placeholder="e.g. CME Coordinator, MD" className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Date</Label>
              <Input type="date" value={field("attestationDate")} onChange={(e) => setField("attestationDate", e.target.value)} className="bg-white border-slate-200 text-slate-900" />
            </div>
          </div>
        </TabsContent>

        {/* Send History */}
        <TabsContent value="history" className="mt-4">
          {!sendHistory || sendHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
              <History className="w-8 h-8 opacity-30" />
              <p className="text-sm">No submissions yet</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-slate-700 font-semibold">Sent At</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Subject</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Sent By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sendHistory.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(row.sentAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-slate-800">{row.subject}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.sentBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={saveForm.isPending}
          className="gap-1.5 text-xs border-[color:color-mix(in_srgb,var(--org-primary)_35%,transparent)] text-[var(--org-primary)] hover:bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]"
        >
          {saveForm.isPending ? "Saving…" : "Save Draft"}
        </Button>
        <Button
          size="sm"
          onClick={() => setSendDialogOpen(true)}
          className="org-primary-button gap-1.5 text-xs"
        >
          <Send className="w-3.5 h-3.5" />
          Send CME Form
        </Button>
      </div>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[var(--org-primary)]" />
              Send CME Form
            </DialogTitle>
            <DialogDescription>
              This will email the completed CME Activity Planning Form to the CME provider with your org's contact email CC'd.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Email Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="bg-white border-slate-200 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-xs font-semibold">Email Body</Label>
              <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={6} className="bg-white border-slate-200 text-slate-900 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                // Save first, then send
                saveForm.mutate({ courseId, data: formFields as any });
                sendToCme.mutate({ courseId, subject: emailSubject, body: emailBody });
              }}
              disabled={sendToCme.isPending || !emailSubject.trim()}
              className="org-primary-button gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {sendToCme.isPending ? "Sending…" : "Send CME Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update CME Status</DialogTitle>
            <DialogDescription>Update the CME approval status for this activity.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-slate-700 text-xs font-semibold">New Status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as any)}>
              <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => updateStatus.mutate({ courseId, status: newStatus })}
              disabled={updateStatus.isPending}
              className="org-primary-button"
            >
              {updateStatus.isPending ? "Updating…" : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Faculty Editor ───────────────────────────────────────────────────────────
function FacultyEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  let parsed: Array<{ name: string; credentials: string; role: string }> = [];
  try { parsed = JSON.parse(value || "[]"); } catch { parsed = []; }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    parsed = [{ name: "", credentials: "", role: "Planner, Presenter" }];
  }

  const update = (index: number, field: string, val: string) => {
    const updated = parsed.map((f, i) => i === index ? { ...f, [field]: val } : f);
    onChange(JSON.stringify(updated));
  };
  const add = () => onChange(JSON.stringify([...parsed, { name: "", credentials: "", role: "Planner, Presenter" }]));
  const remove = (index: number) => onChange(JSON.stringify(parsed.filter((_, i) => i !== index)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-slate-700 text-xs font-semibold">Faculty / Planners *</Label>
        <Button size="sm" variant="outline" onClick={add} className="gap-1.5 text-xs h-7">
          <Plus className="w-3 h-3" />
          Add Faculty
        </Button>
      </div>
      {parsed.map((f, i) => (
        <div key={i} className="grid grid-cols-3 gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="space-y-1">
            <Label className="text-slate-600 text-xs">Name</Label>
            <Input value={f.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Full name" className="bg-white border-slate-200 text-slate-900 h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-600 text-xs">Credentials</Label>
            <Input value={f.credentials} onChange={(e) => update(i, "credentials", e.target.value)} placeholder="e.g. MD, RDCS" className="bg-white border-slate-200 text-slate-900 h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-600 text-xs">Role</Label>
            <div className="flex gap-1">
              <Input value={f.role} onChange={(e) => update(i, "role", e.target.value)} placeholder="e.g. Planner, Presenter" className="bg-white border-slate-200 text-slate-900 h-8 text-sm flex-1" />
              {parsed.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => remove(i)} className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">×</Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CmeManagementPage() {
  const { user } = useAuth();
  const { orgId } = useOrgScope();
  const [selectedCourse, setSelectedCourse] = useState<{ id: number; title: string } | null>(null);

  // We check CME status via a simple query that will throw FORBIDDEN if not enabled
  const { data: forms, isLoading, error } = trpc.cme.listCmeActivityForms.useQuery(
    {},
    { retry: false }
  );

  const cmeNotEnabled = error?.data?.code === "FORBIDDEN" || (error?.message?.toLowerCase().includes("cme") && error?.message?.toLowerCase().includes("not enabled"));

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-5 h-5 text-[var(--org-primary)]" />
              <h1 className="text-xl font-bold text-slate-900">CME Management</h1>
            </div>
            <p className="text-sm text-slate-500">
              Manage CME Activity Planning Forms for your courses, webinars, and other educational activities.
            </p>
          </div>
        </div>

        {/* CME Not Enabled State */}
        {cmeNotEnabled && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-800">CME Processing Not Enabled</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    CME credit processing has not been enabled for your organization. Please contact the platform administrator to enable this feature.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {!cmeNotEnabled && (
          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--org-primary)]" />
                {selectedCourse ? "CME Activity Planning Form" : "CME-Eligible Courses"}
              </CardTitle>
              {!selectedCourse && (
                <CardDescription className="text-slate-500 text-sm">
                  Courses with certificates enabled are eligible for CME credit processing. Click "Create Form" or "Edit Form" to manage the CME Activity Planning Form for each course.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedCourse ? (
                <CmeFormEditor
                  courseId={selectedCourse.id}
                  courseTitle={selectedCourse.title}
                  onBack={() => setSelectedCourse(null)}
                />
              ) : (
                <div className="space-y-6">
                  <CmeFormsList onSelect={(id, title) => setSelectedCourse({ id, title })} />
                  <CmeActivityReportPanel />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
