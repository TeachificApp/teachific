/**
 * CmeFormTab.tsx
 * Reusable CME Activity Planning Form tab for product editors.
 *
 * Usage:
 *   <CmeFormTab courseId={courseId} productType="course" orgId={orgId} />
 *
 * Shows a "CME not enabled" message if CME is not enabled for the org.
 * When enabled, shows the full CME Activity Planning Form with AI generation,
 * DOCX/PDF download, and CME provider submission.
 */
import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Sparkles, Download, Send, CheckCircle, Clock, XCircle,
  AlertCircle, Loader2, ChevronDown, ChevronUp, History
} from "lucide-react";

type ProductType = "course" | "webinar" | "workshop" | "download" | "bundle" | "cohort";

interface CmeFormTabProps {
  courseId: number;
  productType?: ProductType;
  orgId?: number;
  productTitle?: string;
  creditHours?: string | null;
}

interface FormData {
  activityTitle?: string;
  activityType?: string;
  proposedDate?: string;
  activityLengthHours?: string;
  cmeCreditsRequested?: string;
  offerMocCredit?: string;
  offeredMoreThanOnce?: string;
  activityStructure?: string;
  targetAudience?: string;
  estimatedLearners?: string;
  practiceGapDescription?: string;
  practiceGapReasons?: string;
  improvementTypes?: string;
  improvementKnowledgeText?: string;
  improvementCompetenceText?: string;
  improvementPerformanceText?: string;
  learnerOutcomes?: string;
  learningObjectives?: string;
  deliveryDescription?: string;
  activityIncludes?: string;
  assessmentMethods?: string;
  facultyJson?: string;
  contentStatus?: string;
  contentAvailableDate?: string;
  marketingChannels?: string;
  marketingMentionsCme?: string;
  registrationFee?: string;
  attestationName?: string;
  attestationDate?: string;
  attestationTitle?: string;
  originalReleaseDate?: string;
  mostRecentReviewDate?: string;
  expirationDate?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  revision_requested: "bg-amber-100 text-amber-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock className="w-3 h-3" />,
  submitted: <Send className="w-3 h-3" />,
  approved: <CheckCircle className="w-3 h-3" />,
  rejected: <XCircle className="w-3 h-3" />,
  revision_requested: <AlertCircle className="w-3 h-3" />,
};

export default function CmeFormTab({ courseId, productType = "course", orgId, productTitle, creditHours }: CmeFormTabProps) {
  const utils = trpc.useUtils();

  // Check if CME is enabled for this org
  const { data: cmeStatus, isLoading: cmeStatusLoading } = trpc.cme.getCmeStatus.useQuery(
    { orgId },
    { retry: false }
  );

  const { data: formData, isLoading: formLoading } = trpc.cme.getCmeActivityForm.useQuery(
    { courseId, productType, orgId },
    { enabled: !!cmeStatus?.enabled }
  );

  const { data: sendHistory = [] } = trpc.cme.getCmeSendHistory.useQuery(
    { courseId, orgId },
    { enabled: !!cmeStatus?.enabled }
  );

  const [form, setForm] = useState<FormData>({});
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendEmailInput, setSendEmailInput] = useState("");
  const [sendEmailList, setSendEmailList] = useState<string[]>([]);

  // Build default email list when send dialog opens
  const openSendDialog = () => {
    if (!showSendDialog) {
      const defaults: string[] = ["don@cardioserv.net", "j.buckland@cardioserv.net"];
      if (cmeStatus?.cmeContactEmail && !defaults.includes(cmeStatus.cmeContactEmail)) {
        defaults.push(cmeStatus.cmeContactEmail);
      }
      setSendEmailList(defaults);
      setSendEmailInput("");
    }
    setShowSendDialog(v => !v);
  };

  const addSendEmail = () => {
    const email = sendEmailInput.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Invalid email address"); return; }
    if (sendEmailList.includes(email)) { toast.error("Email already in list"); return; }
    setSendEmailList(prev => [...prev, email]);
    setSendEmailInput("");
  };

  const removeSendEmail = (email: string) => {
    setSendEmailList(prev => prev.filter(e => e !== email));
  };

  // Populate form when data loads
  useEffect(() => {
    if (formData?.form) {
      const fd = formData.form as any;
      setForm({
        activityTitle: fd.activityTitle ?? productTitle ?? "",
        originalReleaseDate: fd.originalReleaseDate ?? "",
        mostRecentReviewDate: fd.mostRecentReviewDate ?? "",
        expirationDate: fd.expirationDate ?? "",
        activityType: fd.activityType ?? "",
        proposedDate: fd.proposedDate ?? "",
        activityLengthHours: fd.activityLengthHours ?? creditHours ?? "",
        cmeCreditsRequested: fd.cmeCreditsRequested ?? creditHours ?? "",
        offerMocCredit: fd.offerMocCredit ?? "No",
        offeredMoreThanOnce: fd.offeredMoreThanOnce ?? "No",
        activityStructure: fd.activityStructure ?? "Enduring Material",
        targetAudience: fd.targetAudience ?? "",
        estimatedLearners: fd.estimatedLearners ?? "",
        practiceGapDescription: fd.practiceGapDescription ?? "",
        practiceGapReasons: fd.practiceGapReasons ?? "",
        improvementTypes: fd.improvementTypes ?? "Knowledge,Competence,Performance",
        improvementKnowledgeText: fd.improvementKnowledgeText ?? "",
        improvementCompetenceText: fd.improvementCompetenceText ?? "",
        improvementPerformanceText: fd.improvementPerformanceText ?? "",
        learnerOutcomes: fd.learnerOutcomes ?? "",
        learningObjectives: fd.learningObjectives ?? "",
        deliveryDescription: fd.deliveryDescription ?? "",
        activityIncludes: fd.activityIncludes ?? "Online modules, Video lectures, Knowledge assessments",
        assessmentMethods: fd.assessmentMethods ?? "Post-test, Learner evaluation survey",
        facultyJson: fd.facultyJson ?? "",
        contentStatus: fd.contentStatus ?? "Complete",
        contentAvailableDate: fd.contentAvailableDate ?? "",
        marketingChannels: fd.marketingChannels ?? "",
        marketingMentionsCme: fd.marketingMentionsCme ?? "Yes",
        registrationFee: fd.registrationFee ?? "",
        attestationName: fd.attestationName ?? "",
        attestationDate: fd.attestationDate ?? "",
        attestationTitle: fd.attestationTitle ?? "",
      });
    }
  }, [formData, productTitle, creditHours]);

  const saveForm = trpc.cme.saveCmeActivityForm.useMutation({
    onSuccess: () => {
      utils.cme.getCmeActivityForm.invalidate({ courseId, productType, orgId });
      toast.success("CME form saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateContent = trpc.cme.generateCmeFormContent.useMutation({
    onSuccess: (data) => {
      setForm(prev => ({ ...prev, ...data }));
      toast.success("AI content generated — review and save");
    },
    onError: (e) => toast.error(e.message),
  });

  const downloadDocx = trpc.cme.downloadCmeActivityForm.useMutation({
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });

  const downloadPdf = trpc.cme.downloadCmeActivityFormPdf.useMutation({
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendCmeForm = trpc.cme.sendCmeForm.useMutation({
    onSuccess: () => {
      utils.cme.getCmeSendHistory.invalidate({ courseId, orgId });
      utils.cme.getCmeActivityForm.invalidate({ courseId, productType, orgId });
      setShowSendDialog(false);
      toast.success("CME form sent successfully!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    saveForm.mutate({ courseId, productType, orgId, formData: form });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateContent.mutateAsync({
        courseId,
        productType,
        orgId,
        courseTitle: form.activityTitle ?? productTitle ?? "",
        creditHours: form.cmeCreditsRequested ?? creditHours ?? null,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadDocx = () => {
    downloadDocx.mutate({ courseId, productType, orgId, formData: form });
  };

  const handleDownloadPdf = () => {
    downloadPdf.mutate({ courseId, productType, orgId, formData: form });
  };

  const handleSend = () => {
    if (sendEmailList.length === 0) { toast.error("Add at least one recipient email"); return; }
    sendCmeForm.mutate({ courseId, productType, orgId, toEmails: sendEmailList, formData: form });
  };

  const setField = (key: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (cmeStatusLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking CME status...
      </div>
    );
  }

  // ── CME not enabled ────────────────────────────────────────────────────────
  if (!cmeStatus?.enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
          <FileText className="w-7 h-7 text-slate-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 mb-1">CME Not Enabled</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            CME processing is not enabled for your organisation.
            Contact your platform administrator to enable it.
          </p>
        </div>
      </div>
    );
  }

  if (formLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading CME form...
      </div>
    );
  }

  const currentStatus = (formData as any)?.cmeStatus ?? "draft";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">CME Activity Form</h3>
            <p className="text-xs text-muted-foreground">
              {(cmeStatus as any)?.orgName ? `${(cmeStatus as any).orgName} · ` : ""}Activity Planning &amp; Proposal Form
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[currentStatus] ?? STATUS_COLORS.draft}`}>
            {STATUS_ICONS[currentStatus]}
            {currentStatus.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleGenerate}
          disabled={generating || generateContent.isPending}
          className="gap-1.5"
        >
          {generating || generateContent.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[var(--org-primary)]" />}
          AI Generate Content
        </Button>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saveForm.isPending} className="gap-1.5">
          {saveForm.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadDocx} disabled={downloadDocx.isPending} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> DOCX
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={downloadPdf.isPending} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> PDF
        </Button>
        <Button size="sm" onClick={openSendDialog} className="gap-1.5 org-primary-button">
          <Send className="w-3.5 h-3.5" /> Send CME Form
        </Button>
      </div>

      {/* Send dialog */}
      {showSendDialog && (
        <Card className="border-[color:color-mix(in_srgb,var(--org-primary)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-sm font-medium text-[var(--org-primary)]">Send PDF to CME Provider</p>
            <p className="text-xs text-[var(--org-primary)]">Edit the recipient list below. Defaults are pre-filled; remove or add as needed.</p>
            {/* Email chips */}
            <div className="flex flex-wrap gap-1.5">
              {sendEmailList.map(email => (
                <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:color-mix(in_srgb,var(--org-primary)_14%,transparent)] text-[var(--org-primary)] text-xs font-medium border border-[color:color-mix(in_srgb,var(--org-primary)_28%,transparent)]">
                  {email}
                  <button type="button" onClick={() => removeSendEmail(email)} className="ml-0.5 text-[var(--org-primary)] hover:opacity-70 leading-none" aria-label={`Remove ${email}`}>×</button>
                </span>
              ))}
            </div>
            {/* Add email input */}
            <div className="flex gap-2">
              <Input
                value={sendEmailInput}
                onChange={e => setSendEmailInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSendEmail(); } }}
                placeholder="Add email address…"
                className="bg-white text-sm"
              />
              <Button size="sm" variant="outline" onClick={addSendEmail} className="whitespace-nowrap">Add</Button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSend} disabled={sendCmeForm.isPending || sendEmailList.length === 0} className="org-primary-button whitespace-nowrap">
                {sendCmeForm.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Send to ${sendEmailList.length} recipient${sendEmailList.length !== 1 ? 's' : ''}`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Section 1: Activity Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section 1: Activity Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Activity Title</Label>
              <Input value={form.activityTitle ?? ""} onChange={e => setField("activityTitle", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Activity Type</Label>
              <Select value={form.activityType ?? ""} onValueChange={v => setField("activityType", v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enduring Material">Enduring Material</SelectItem>
                  <SelectItem value="Live Activity">Live Activity</SelectItem>
                  <SelectItem value="Internet Live Course">Internet Live Course</SelectItem>
                  <SelectItem value="Journal-Based CME">Journal-Based CME</SelectItem>
                  <SelectItem value="Performance Improvement">Performance Improvement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Proposed Date(s)</Label>
              <Input value={form.proposedDate ?? ""} onChange={e => setField("proposedDate", e.target.value)} placeholder="e.g. Jan 2025 – Dec 2025" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Activity Length (hours)</Label>
              <Input value={form.activityLengthHours ?? ""} onChange={e => setField("activityLengthHours", e.target.value)} placeholder="e.g. 1.5" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CME Credits Requested</Label>
              <Input value={form.cmeCreditsRequested ?? ""} onChange={e => setField("cmeCreditsRequested", e.target.value)} placeholder="e.g. 1.5" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Offer MOC Credit?</Label>
              <Select value={form.offerMocCredit ?? "No"} onValueChange={v => setField("offerMocCredit", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Offered More Than Once?</Label>
              <Select value={form.offeredMoreThanOnce ?? "No"} onValueChange={v => setField("offeredMoreThanOnce", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Activity Structure</Label>
              <Select value={form.activityStructure ?? "Enduring Material"} onValueChange={v => setField("activityStructure", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enduring Material">Enduring Material</SelectItem>
                  <SelectItem value="Live">Live</SelectItem>
                  <SelectItem value="Blended">Blended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target Audience</Label>
              <Input value={form.targetAudience ?? ""} onChange={e => setField("targetAudience", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estimated # of Learners</Label>
              <Input value={form.estimatedLearners ?? ""} onChange={e => setField("estimatedLearners", e.target.value)} placeholder="e.g. 500" className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Original Release Date</Label>
              <Input type="date" value={form.originalReleaseDate ?? ""} onChange={e => setField("originalReleaseDate", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Most Recent Review Date</Label>
              <Input type="date" value={form.mostRecentReviewDate ?? ""} onChange={e => setField("mostRecentReviewDate", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiration Date</Label>
              <Input type="date" value={form.expirationDate ?? ""} onChange={e => setField("expirationDate", e.target.value)} className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Professional Practice Gap */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Section 2: Professional Practice Gap
            <Badge variant="outline" className="text-xs text-[var(--org-primary)] border-[color:color-mix(in_srgb,var(--org-primary)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)]">AI Generated</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Practice Gap Description</Label>
            <Textarea value={form.practiceGapDescription ?? ""} onChange={e => setField("practiceGapDescription", e.target.value)} rows={3} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contributing Reasons</Label>
            <Textarea value={form.practiceGapReasons ?? ""} onChange={e => setField("practiceGapReasons", e.target.value)} rows={3} className="text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Educational Needs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Section 3: Educational Needs
            <Badge variant="outline" className="text-xs text-[var(--org-primary)] border-[color:color-mix(in_srgb,var(--org-primary)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)]">AI Generated</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Knowledge</Label>
            <Textarea value={form.improvementKnowledgeText ?? ""} onChange={e => setField("improvementKnowledgeText", e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Competence</Label>
            <Textarea value={form.improvementCompetenceText ?? ""} onChange={e => setField("improvementCompetenceText", e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Performance</Label>
            <Textarea value={form.improvementPerformanceText ?? ""} onChange={e => setField("improvementPerformanceText", e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Learner Outcomes</Label>
            <Textarea value={form.learnerOutcomes ?? ""} onChange={e => setField("learnerOutcomes", e.target.value)} rows={4} className="text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Learning Objectives */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Section 4: Learning Objectives
            <Badge variant="outline" className="text-xs text-[var(--org-primary)] border-[color:color-mix(in_srgb,var(--org-primary)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--org-primary)_10%,transparent)]">AI Generated</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={form.learningObjectives ?? ""} onChange={e => setField("learningObjectives", e.target.value)} rows={5} className="text-sm" placeholder="• Objective 1&#10;• Objective 2&#10;• Objective 3" />
        </CardContent>
      </Card>

      {/* Section 5: Educational Format */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section 5: Educational Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Delivery Description</Label>
            <Textarea value={form.deliveryDescription ?? ""} onChange={e => setField("deliveryDescription", e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Activity Includes</Label>
            <Input value={form.activityIncludes ?? ""} onChange={e => setField("activityIncludes", e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Assessment Methods</Label>
            <Input value={form.assessmentMethods ?? ""} onChange={e => setField("assessmentMethods", e.target.value)} className="text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Faculty */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section 6: Faculty</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={form.facultyJson ?? ""} onChange={e => setField("facultyJson", e.target.value)} rows={3} className="text-sm font-mono" placeholder='[{"name": "Dr. Jane Smith", "credentials": "MD, FACC", "role": "Faculty"}]' />
          <p className="text-xs text-muted-foreground mt-1">JSON array of faculty members with name, credentials, and role.</p>
        </CardContent>
      </Card>

      {/* Section 7: Content Readiness */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section 7: Content Readiness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Content Status</Label>
              <Select value={form.contentStatus ?? "Complete"} onValueChange={v => setField("contentStatus", v)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Complete">Complete</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Not Started">Not Started</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Draft/Content Available Date</Label>
              <Input value={form.contentAvailableDate ?? ""} onChange={e => setField("contentAvailableDate", e.target.value)} placeholder="e.g. December 2024" className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 8: Marketing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section 8: Marketing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Marketing Channels</Label>
            <Input value={form.marketingChannels ?? ""} onChange={e => setField("marketingChannels", e.target.value)} placeholder="e.g. Email, Social Media, Website" className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Does Marketing Mention CME?</Label>
            <Select value={form.marketingMentionsCme ?? "Yes"} onValueChange={v => setField("marketingMentionsCme", v)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Section 9: Financial */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section 9: Financial</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label className="text-xs">Registration Fee</Label>
            <Input value={form.registrationFee ?? ""} onChange={e => setField("registrationFee", e.target.value)} placeholder="e.g. Free, $49, $149" className="text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Section 10: Attestation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Section 10: Attestation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={form.attestationName ?? ""} onChange={e => setField("attestationName", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title / Credentials</Label>
              <Input value={form.attestationTitle ?? ""} onChange={e => setField("attestationTitle", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.attestationDate ?? ""} onChange={e => setField("attestationDate", e.target.value)} className="text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadPdf.isPending} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Download PDF
        </Button>
        <Button onClick={handleSave} disabled={saveForm.isPending} className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white">
          {saveForm.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Save CME Form
        </Button>
      </div>

      {/* Send History */}
      {sendHistory.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
            onClick={() => setShowHistory(v => !v)}
          >
            <History className="w-4 h-4" />
            Send History ({sendHistory.length})
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {sendHistory.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2 border">
                  <div>
                    <span className="font-medium">{h.recipientEmail}</span>
                    <span className="text-muted-foreground ml-2">{new Date(h.sentAt).toLocaleString()}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{h.status ?? "sent"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
