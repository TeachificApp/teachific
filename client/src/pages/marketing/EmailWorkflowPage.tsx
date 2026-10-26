import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Mail,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  Trash2,
  Workflow,
  XCircle,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TriggerType =
  | "form_submitted"
  | "lesson_completed"
  | "course_completed"
  | "course_enrolled"
  | "purchase_completed"
  | "campaign_opened"
  | "campaign_clicked";

type ConditionOperator = "equals" | "not_equals" | "contains" | "is_set";

type WorkflowStepDraft = {
  delayMinutes: number;
  subject: string;
  htmlBody: string;
  previewText?: string;
};

type OrganizationWorkflowDraft = {
  id?: number;
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerResourceId?: number;
  conditionField?: string;
  conditionOperator?: ConditionOperator;
  conditionValue?: string;
  isActive: boolean;
  steps: WorkflowStepDraft[];
};

type PlatformWorkflowDraft = {
  id?: number;
  name: string;
  triggerType: TriggerType;
  isActive: boolean;
  steps: WorkflowStepDraft[];
};

const TRIGGERS: Array<{ value: TriggerType; label: string; description: string }> = [
  { value: "form_submitted", label: "Form submitted", description: "A visitor submits an organization form" },
  { value: "course_enrolled", label: "Course enrollment", description: "A learner receives course enrollment" },
  { value: "lesson_completed", label: "Lesson completed", description: "A learner completes a lesson" },
  { value: "course_completed", label: "Course completed", description: "A learner completes an enrolled course" },
  { value: "purchase_completed", label: "Purchase completed", description: "A purchase is successfully fulfilled" },
  { value: "campaign_opened", label: "Campaign opened", description: "A recipient opens a campaign" },
  { value: "campaign_clicked", label: "Campaign link clicked", description: "A recipient clicks a tracked campaign link" },
];

const CONDITION_OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "is_set", label: "Has a value" },
];

function defaultStep(): WorkflowStepDraft {
  return {
    delayMinutes: 0,
    subject: "A quick follow-up from {{org_name}}",
    htmlBody: "<p>Hi {{recipient_name}},</p><p>Thank you for connecting with {{org_name}}.</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>",
    previewText: "A quick follow-up from {{org_name}}",
  };
}

function defaultOrganizationWorkflow(): OrganizationWorkflowDraft {
  return {
    name: "",
    description: "",
    triggerType: "form_submitted",
    isActive: false,
    steps: [defaultStep()],
  };
}

function defaultPlatformWorkflow(): PlatformWorkflowDraft {
  return {
    name: "",
    triggerType: "course_enrolled",
    isActive: false,
    steps: [defaultStep()],
  };
}

function formatDelay(delayMinutes: number) {
  if (!delayMinutes) return "Send immediately";
  if (delayMinutes < 60) return `Wait ${delayMinutes} min`;
  if (delayMinutes % 1440 === 0) return `Wait ${delayMinutes / 1440} day${delayMinutes === 1440 ? "" : "s"}`;
  if (delayMinutes % 60 === 0) return `Wait ${delayMinutes / 60} hr${delayMinutes === 60 ? "" : "s"}`;
  return `Wait ${delayMinutes} min`;
}

function triggerLabel(value: string) {
  return TRIGGERS.find((trigger) => trigger.value === value)?.label ?? value.replaceAll("_", " ");
}

function executionBadge(status: string) {
  const details: Record<string, { label: string; className: string }> = {
    pending: { label: "Sending", className: "bg-amber-100 text-amber-800" },
    scheduled: { label: "Scheduled", className: "bg-sky-100 text-sky-800" },
    sending: { label: "Sending", className: "bg-amber-100 text-amber-800" },
    sent: { label: "Sent", className: "bg-emerald-100 text-emerald-800" },
    skipped: { label: "Suppressed", className: "bg-slate-100 text-slate-700" },
    failed: { label: "Failed", className: "bg-red-100 text-red-800" },
    cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-700" },
  };
  const item = details[status] ?? { label: status, className: "bg-slate-100 text-slate-700" };
  return <Badge variant="secondary" className={item.className}>{item.label}</Badge>;
}

function WorkflowStepEditor({
  steps,
  onChange,
}: {
  steps: WorkflowStepDraft[];
  onChange: (steps: WorkflowStepDraft[]) => void;
}) {
  const updateStep = (index: number, updates: Partial<WorkflowStepDraft>) => {
    onChange(steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...updates } : step));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="text-sm font-semibold text-slate-800">Email sequence</Label>
          <p className="mt-0.5 text-xs text-slate-500">Each step is sent after the cumulative waits above it. Up to eight steps.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-teal-200 text-teal-800 hover:bg-teal-50"
          disabled={steps.length >= 8}
          onClick={() => onChange([...steps, { ...defaultStep(), delayMinutes: 1440 }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add email
        </Button>
      </div>

      {steps.map((step, index) => (
        <Card key={index} className="border-slate-200 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">{index + 1}</span>
              <div>
                <CardTitle className="text-sm text-slate-800">{index === 0 ? "First email" : `Follow-up ${index}`}</CardTitle>
                <CardDescription className="text-xs">{formatDelay(step.delayMinutes)}</CardDescription>
              </div>
            </div>
            {steps.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove email ${index + 1}`}
                className="h-7 w-7 text-slate-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => onChange(steps.filter((_, stepIndex) => stepIndex !== index))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
              <div>
                <Label className="text-xs text-slate-600">Delay after prior step</Label>
                <Input
                  type="number"
                  min={0}
                  max={525600}
                  value={step.delayMinutes}
                  onChange={(event) => updateStep(index, { delayMinutes: Math.max(0, Math.min(525600, Number(event.target.value) || 0)) })}
                  className="mt-1 h-9"
                />
                <p className="mt-1 text-[11px] text-slate-400">Minutes</p>
              </div>
              <div>
                <Label className="text-xs text-slate-600">Subject line</Label>
                <Input
                  value={step.subject}
                  maxLength={500}
                  onChange={(event) => updateStep(index, { subject: event.target.value })}
                  placeholder="Welcome to {{org_name}}"
                  className="mt-1 h-9"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Preview text <span className="font-normal text-slate-400">(optional)</span></Label>
              <Input
                value={step.previewText ?? ""}
                maxLength={300}
                onChange={(event) => updateStep(index, { previewText: event.target.value || undefined })}
                placeholder="The short text shown beside the subject in an inbox"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Email body</Label>
              <Textarea
                value={step.htmlBody}
                maxLength={250000}
                onChange={(event) => updateStep(index, { htmlBody: event.target.value })}
                placeholder="<p>Hi {{recipient_name}},</p>"
                className="mt-1 min-h-[150px] resize-y font-mono text-xs leading-5"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Available variables: <code>{"{{recipient_name}}"}</code>, <code>{"{{org_name}}"}</code>, and <code>{"{{unsubscribe_url}}"}</code>. Organization branding and unsubscribe controls are added by Course360.
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrganizationWorkflowDialog({
  value,
  forms,
  isSaving,
  onSave,
  onClose,
}: {
  value: OrganizationWorkflowDraft;
  forms: Array<{ id: number; name: string; slug: string }>;
  isSaving: boolean;
  onSave: (value: OrganizationWorkflowDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<OrganizationWorkflowDraft>(value);
  const formTargeted = draft.triggerType === "form_submitted";
  const conditionEnabled = Boolean(draft.conditionField && draft.conditionOperator);

  useEffect(() => setDraft(value), [value]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900"><Workflow className="h-5 w-5 text-teal-600" />{draft.id ? "Edit email automation" : "Create email automation"}</DialogTitle>
          <DialogDescription>
            Define a trusted learner activity, optional condition, and a branded email sequence for this active organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Automation name</Label>
              <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1" placeholder="New learner welcome sequence" autoFocus />
            </div>
            <div className="sm:col-span-2">
              <Label>Description <span className="font-normal text-slate-400">(internal, optional)</span></Label>
              <Input value={draft.description ?? ""} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value || undefined }))} className="mt-1" placeholder="What this automation is intended to do" maxLength={1000} />
            </div>
            <div>
              <Label>When this happens</Label>
              <Select value={draft.triggerType} onValueChange={(triggerType) => setDraft((current) => ({ ...current, triggerType: triggerType as TriggerType, triggerResourceId: triggerType === "form_submitted" ? current.triggerResourceId : undefined }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGERS.map((trigger) => <SelectItem key={trigger.value} value={trigger.value}>{trigger.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="mt-1 text-xs text-slate-500">{TRIGGERS.find((trigger) => trigger.value === draft.triggerType)?.description}</p>
            </div>
            <div className="flex items-end pb-0.5">
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <Switch checked={draft.isActive} onCheckedChange={(isActive) => setDraft((current) => ({ ...current, isActive }))} />
                <div><Label className="cursor-pointer text-sm">Activate automation</Label><p className="text-xs text-slate-500">Inactive automations never send.</p></div>
              </div>
            </div>
          </div>

          {formTargeted && (
            <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
              <Label>Limit to one form <span className="font-normal text-slate-500">(optional)</span></Label>
              <Select value={draft.triggerResourceId ? String(draft.triggerResourceId) : "all-forms"} onValueChange={(selection) => setDraft((current) => ({ ...current, triggerResourceId: selection === "all-forms" ? undefined : Number(selection) }))}>
                <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-forms">Any form in this organization</SelectItem>
                  {forms.map((form) => <SelectItem key={form.id} value={String(form.id)}>{form.name || form.slug}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-slate-500">Only forms belonging to the current organization are listed. The server rechecks the selected form when saving.</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><Label className="text-sm font-semibold">Optional if/then condition</Label><p className="mt-0.5 text-xs text-slate-500">Send only when a trusted event value matches this condition.</p></div>
              <div className="flex items-center gap-2"><Switch checked={conditionEnabled} onCheckedChange={(enabled) => setDraft((current) => enabled ? { ...current, conditionField: current.conditionField || "", conditionOperator: current.conditionOperator || "equals" } : { ...current, conditionField: undefined, conditionOperator: undefined, conditionValue: undefined })} /><span className="text-sm text-slate-700">{conditionEnabled ? "Enabled" : "Disabled"}</span></div>
            </div>
            {conditionEnabled && (
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_1fr]">
                <div><Label className="text-xs text-slate-600">Event field</Label><Input value={draft.conditionField ?? ""} onChange={(event) => setDraft((current) => ({ ...current, conditionField: event.target.value }))} className="mt-1" placeholder="Example: specialty" maxLength={128} /></div>
                <div><Label className="text-xs text-slate-600">Rule</Label><Select value={draft.conditionOperator ?? "equals"} onValueChange={(conditionOperator) => setDraft((current) => ({ ...current, conditionOperator: conditionOperator as ConditionOperator }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{CONDITION_OPERATORS.map((operator) => <SelectItem key={operator.value} value={operator.value}>{operator.label}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs text-slate-600">Value</Label><Input disabled={draft.conditionOperator === "is_set"} value={draft.conditionValue ?? ""} onChange={(event) => setDraft((current) => ({ ...current, conditionValue: event.target.value || undefined }))} className="mt-1" placeholder={draft.conditionOperator === "is_set" ? "Not required" : "Expected value"} maxLength={1000} /></div>
              </div>
            )}
          </div>

          <WorkflowStepEditor steps={draft.steps} onChange={(steps) => setDraft((current) => ({ ...current, steps }))} />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button
            className="bg-teal-600 text-white hover:bg-teal-700"
            disabled={isSaving || !draft.name.trim() || draft.steps.some((step) => !step.subject.trim() || !step.htmlBody.trim()) || (conditionEnabled && !draft.conditionField?.trim())}
            onClick={() => onSave({ ...draft, name: draft.name.trim(), description: draft.description?.trim() || undefined, conditionField: draft.conditionField?.trim() || undefined, conditionValue: draft.conditionValue?.trim() || undefined })}
          >
            {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {draft.id ? "Save automation" : "Create automation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowList({
  workflows,
  onEdit,
  onDelete,
  onViewActivity,
}: {
  workflows: any[];
  onEdit: (workflow: any) => void;
  onDelete: (workflow: any) => void;
  onViewActivity: (workflow: any) => void;
}) {
  if (!workflows.length) {
    return (
      <Card className="border-dashed border-slate-300"><CardContent className="flex flex-col items-center py-14 text-center"><Workflow className="mb-3 h-9 w-9 text-teal-500" /><h2 className="font-semibold text-slate-800">No email automations yet</h2><p className="mt-1 max-w-md text-sm text-slate-500">Create a rule to respond to enrollment, forms, learning progress, purchases, and email engagement.</p></CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {workflows.map((workflow) => (
        <Card key={workflow.id} className="border-slate-200 shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold text-slate-900">{workflow.name}</h2>
                  <Badge className={workflow.isActive ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>{workflow.isActive ? "Active" : "Paused"}</Badge>
                </div>
                {workflow.description && <p className="mt-1 truncate text-sm text-slate-500">{workflow.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-teal-600" />{triggerLabel(workflow.triggerType)}</span>
                  {workflow.triggerResourceId && <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-teal-600" />Specific organization form</span>}
                  {workflow.conditionField && <span className="inline-flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5 text-teal-600" />Condition: {workflow.conditionField}</span>}
                  <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-teal-600" />{workflow.steps?.length ?? 0} email{workflow.steps?.length === 1 ? "" : "s"}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onViewActivity(workflow)}><Activity className="mr-1.5 h-3.5 w-3.5" />Activity</Button>
                <Button variant="outline" size="sm" className="border-teal-200 text-teal-800 hover:bg-teal-50" onClick={() => onEdit(workflow)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(workflow)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ExecutionDialog({ workflow, onClose }: { workflow: any; onClose: () => void }) {
  const { data: executions = [], isLoading } = trpc.emailWorkflow.listExecutions.useQuery({ workflowId: workflow.id, limit: 50 });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-teal-600" />Automation activity</DialogTitle><DialogDescription>{workflow.name} — the last 50 execution records in the active organization.</DialogDescription></DialogHeader>
        {isLoading ? <div className="flex justify-center py-10"><RefreshCw className="h-6 w-6 animate-spin text-teal-600" /></div> : executions.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">No automation events have reached this workflow yet.</div> : <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-3 py-2.5 font-medium">Recipient</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Due</th><th className="px-3 py-2.5 font-medium">Outcome</th></tr></thead><tbody className="divide-y divide-slate-100">{executions.map((execution: any) => <tr key={execution.id}><td className="px-3 py-3"><div className="font-medium text-slate-800">{execution.recipientName || "Recipient"}</div><div className="max-w-[210px] truncate text-xs text-slate-500">{execution.recipientEmail}</div></td><td className="px-3 py-3">{executionBadge(execution.status)}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{execution.dueAt ? new Date(execution.dueAt).toLocaleString() : "—"}</td><td className="max-w-[210px] px-3 py-3 text-xs text-slate-600">{execution.errorMessage || (execution.sentAt ? `Sent ${new Date(execution.sentAt).toLocaleString()}` : "—")}</td></tr>)}</tbody></table></div>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationWorkflowWorkspace() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: availability, isLoading: availabilityLoading } = trpc.emailWorkflow.getAvailability.useQuery();
  const { data: forms = [] } = trpc.emailWorkflow.listForms.useQuery();
  const { data: workflows = [], isLoading } = trpc.emailWorkflow.listWorkflows.useQuery();
  const [draft, setDraft] = useState<OrganizationWorkflowDraft | null>(null);
  const [activityWorkflow, setActivityWorkflow] = useState<any | null>(null);
  const [deleteWorkflow, setDeleteWorkflow] = useState<any | null>(null);
  const saveMutation = trpc.emailWorkflow.saveWorkflow.useMutation({
    onSuccess: () => {
      toast.success("Email automation saved");
      setDraft(null);
      utils.emailWorkflow.listWorkflows.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.emailWorkflow.deleteWorkflow.useMutation({
    onSuccess: () => {
      toast.success("Email automation deleted; scheduled emails were cancelled");
      setDeleteWorkflow(null);
      utils.emailWorkflow.listWorkflows.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const stats = useMemo(() => ({ active: workflows.filter((workflow: any) => workflow.isActive).length, paused: workflows.filter((workflow: any) => !workflow.isActive).length, steps: workflows.reduce((total: number, workflow: any) => total + (workflow.steps?.length ?? 0), 0) }), [workflows]);

  const toDraft = (workflow: any): OrganizationWorkflowDraft => ({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? "",
    triggerType: workflow.triggerType as TriggerType,
    triggerResourceId: workflow.triggerResourceId ?? undefined,
    conditionField: workflow.conditionField ?? undefined,
    conditionOperator: workflow.conditionOperator as ConditionOperator | undefined,
    conditionValue: workflow.conditionValue ?? undefined,
    isActive: Boolean(workflow.isActive),
    steps: (workflow.steps ?? []).map((step: any) => ({ delayMinutes: step.delayMinutes ?? 0, subject: step.subject, htmlBody: step.htmlBody, previewText: step.previewText ?? undefined })),
  });

  if (availabilityLoading || isLoading) return <div className="flex justify-center py-20"><RefreshCw className="h-7 w-7 animate-spin text-teal-600" /></div>;

  return (
    <div className="container max-w-7xl py-8">
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-slate-500"><button onClick={() => navigate("/marketing/email")} className="inline-flex items-center gap-1 hover:text-teal-700"><ChevronLeft className="h-3.5 w-3.5" />Email campaigns</button><ChevronRight className="h-3.5 w-3.5 text-slate-300" /><span className="font-medium text-slate-700">Email automations</span></nav>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white"><Workflow className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold text-slate-900">Email Automations</h1><p className="mt-1 text-sm text-slate-500">Send organization-branded email sequences when trusted learner activity occurs.</p></div></div>
        {availability?.available && <Button className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => setDraft(defaultOrganizationWorkflow())}><Plus className="mr-1.5 h-4 w-4" />New automation</Button>}
      </div>

      {!availability?.available ? <Card className="border-amber-200 bg-amber-50"><CardContent className="flex gap-3 p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="font-semibold text-amber-950">Email Automations requires Pro or Enterprise</h2><p className="mt-1 text-sm text-amber-900">Your organization can view existing settings, but creating, updating, or activating automations requires an active Pro or Enterprise plan. Scheduled sends are also safely paused if entitlement is no longer active.</p></div></CardContent></Card> : <>
        <div className="mb-6 grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active</p><p className="mt-1 text-2xl font-bold text-emerald-700">{stats.active}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paused</p><p className="mt-1 text-2xl font-bold text-slate-700">{stats.paused}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sequence emails</p><p className="mt-1 text-2xl font-bold text-teal-700">{stats.steps}</p></CardContent></Card></div>
        <WorkflowList workflows={workflows} onEdit={(workflow) => setDraft(toDraft(workflow))} onDelete={setDeleteWorkflow} onViewActivity={setActivityWorkflow} />
      </>}

      {draft && <OrganizationWorkflowDialog value={draft} forms={forms} isSaving={saveMutation.isPending} onClose={() => setDraft(null)} onSave={(value) => saveMutation.mutate(value)} />}
      {activityWorkflow && <ExecutionDialog workflow={activityWorkflow} onClose={() => setActivityWorkflow(null)} />}
      <Dialog open={Boolean(deleteWorkflow)} onOpenChange={(open) => !open && setDeleteWorkflow(null)}><DialogContent><DialogHeader><DialogTitle>Delete email automation?</DialogTitle><DialogDescription>This stops the rule and cancels its scheduled email executions. Historical activity remains auditable.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteWorkflow(null)}>Keep automation</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteWorkflow && deleteMutation.mutate({ id: deleteWorkflow.id })}>{deleteMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete automation</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

export default function EmailWorkflowPage() {
  return <DashboardLayout><OrganizationWorkflowWorkspace /></DashboardLayout>;
}

function PlatformWorkflowDialog({ value, scopeName, isSaving, onSave, onClose }: { value: PlatformWorkflowDraft; scopeName: string; isSaving: boolean; onSave: (value: PlatformWorkflowDraft) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<PlatformWorkflowDraft>(value);
  useEffect(() => setDraft(value), [value]);
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldedWorkflowIcon />{draft.id ? "Edit platform-managed automation" : "Create platform-managed automation"}</DialogTitle><DialogDescription>{scopeName}. Organization-branded sending, unsubscribe controls, and recipient suppression stay in force.</DialogDescription></DialogHeader><div className="space-y-5 py-1"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Automation name</Label><Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1" placeholder="Platform enrollment follow-up" autoFocus /></div><div><Label>When this happens</Label><Select value={draft.triggerType} onValueChange={(triggerType) => setDraft((current) => ({ ...current, triggerType: triggerType as TriggerType }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{TRIGGERS.map((trigger) => <SelectItem key={trigger.value} value={trigger.value}>{trigger.label}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-slate-500">{TRIGGERS.find((trigger) => trigger.value === draft.triggerType)?.description}</p></div><div className="flex items-end"><div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"><Switch checked={draft.isActive} onCheckedChange={(isActive) => setDraft((current) => ({ ...current, isActive }))} /><div><Label className="cursor-pointer text-sm">Activate automation</Label><p className="text-xs text-slate-500">Inactive automations never send.</p></div></div></div></div><WorkflowStepEditor steps={draft.steps} onChange={(steps) => setDraft((current) => ({ ...current, steps }))} /></div><DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button><Button className="bg-teal-600 text-white hover:bg-teal-700" disabled={isSaving || !draft.name.trim() || draft.steps.some((step) => !step.subject.trim() || !step.htmlBody.trim())} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>{isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{draft.id ? "Save automation" : "Create automation"}</Button></DialogFooter></DialogContent></Dialog>;
}

function ShieldedWorkflowIcon() { return <Workflow className="h-5 w-5 text-teal-600" />; }

export function PlatformEmailWorkflowManager() {
  const utils = trpc.useUtils();
  const { data: organizations = [], isLoading: organizationsLoading } = trpc.platformEmailWorkflow.listTargetOrganizations.useQuery();
  const [scope, setScope] = useState<"organization" | "platform">("organization");
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PlatformWorkflowDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ workflow: any; platformWide: boolean } | null>(null);
  useEffect(() => { if (!organizationId && organizations[0]?.id) setOrganizationId(organizations[0].id); }, [organizationId, organizations]);
  const { data: organizationWorkflows = [], isLoading: orgLoading } = trpc.platformEmailWorkflow.list.useQuery({ orgId: organizationId ?? 1 }, { enabled: Boolean(organizationId) && scope === "organization" });
  const { data: platformWorkflows = [], isLoading: platformLoading } = trpc.platformEmailWorkflow.listPlatformWide.useQuery(undefined, { enabled: scope === "platform" });
  const saveOrganization = trpc.platformEmailWorkflow.save.useMutation({ onSuccess: () => { toast.success("Platform-managed organization automation saved"); setDraft(null); if (organizationId) utils.platformEmailWorkflow.list.invalidate({ orgId: organizationId }); }, onError: (error) => toast.error(error.message) });
  const savePlatformWide = trpc.platformEmailWorkflow.savePlatformWide.useMutation({ onSuccess: () => { toast.success("Platform-wide automation saved"); setDraft(null); utils.platformEmailWorkflow.listPlatformWide.invalidate(); }, onError: (error) => toast.error(error.message) });
  const deleteOrganization = trpc.platformEmailWorkflow.delete.useMutation({ onSuccess: () => { toast.success("Organization automation deleted"); setDeleteTarget(null); if (organizationId) utils.platformEmailWorkflow.list.invalidate({ orgId: organizationId }); }, onError: (error) => toast.error(error.message) });
  const deletePlatformWide = trpc.platformEmailWorkflow.deletePlatformWide.useMutation({ onSuccess: () => { toast.success("Platform-wide automation deleted"); setDeleteTarget(null); utils.platformEmailWorkflow.listPlatformWide.invalidate(); }, onError: (error) => toast.error(error.message) });
  const workflows = scope === "organization" ? organizationWorkflows : platformWorkflows;
  const loading = organizationsLoading || (scope === "organization" ? orgLoading : platformLoading);
  const selectedOrganization = organizations.find((organization) => organization.id === organizationId);
  const toDraft = (workflow: any): PlatformWorkflowDraft => ({ id: workflow.id, name: workflow.name, triggerType: workflow.triggerType as TriggerType, isActive: Boolean(workflow.isActive), steps: (workflow.steps ?? []).map((step: any) => ({ delayMinutes: step.delayMinutes ?? 0, subject: step.subject, htmlBody: step.htmlBody, previewText: step.previewText ?? undefined })) });

  return <div className="space-y-5"><div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4"><div className="flex gap-3"><Workflow className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" /><div><h2 className="font-semibold text-slate-900">Platform-managed email automations</h2><p className="mt-1 text-sm text-slate-600">Create durable activity-driven sequences for one selected organization or for the same behavior across every active organization. The delivery engine always uses the receiving organization’s identity and suppression rules.</p></div></div></div><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div className="grid gap-3 sm:grid-cols-2"><div><Label className="text-xs text-slate-600">Scope</Label><Select value={scope} onValueChange={(value) => { setScope(value as "organization" | "platform"); setDraft(null); }}><SelectTrigger className="mt-1 w-[240px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="organization">One organization</SelectItem><SelectItem value="platform">All active organizations</SelectItem></SelectContent></Select></div>{scope === "organization" && <div><Label className="text-xs text-slate-600">Target organization</Label><Select value={organizationId ? String(organizationId) : undefined} onValueChange={(value) => setOrganizationId(Number(value))}><SelectTrigger className="mt-1 w-[260px]"><SelectValue placeholder="Select organization" /></SelectTrigger><SelectContent>{organizations.map((organization) => <SelectItem key={organization.id} value={String(organization.id)}>{organization.name}</SelectItem>)}</SelectContent></Select></div>}</div><Button className="bg-teal-600 text-white hover:bg-teal-700" disabled={scope === "organization" && !organizationId} onClick={() => setDraft(defaultPlatformWorkflow())}><Plus className="mr-1.5 h-4 w-4" />New platform automation</Button></div>{scope === "platform" && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"><strong>All active organizations:</strong> each matching event is evaluated inside its originating organization. Organization IDs and recipients are never pooled or shared.</p>}{scope === "organization" && selectedOrganization && <p className="text-xs text-slate-500">Managing rules for <strong className="text-slate-700">{selectedOrganization.name}</strong>. Form events apply to any form in this selected organization; server ownership checks apply to every save, read, and deletion.</p>}{loading ? <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-teal-600" /></div> : <WorkflowList workflows={workflows} onEdit={(workflow) => setDraft(toDraft(workflow))} onDelete={(workflow) => setDeleteTarget({ workflow, platformWide: scope === "platform" })} onViewActivity={(workflow) => toast.message(`Activity for ${workflow.name} is available within the receiving organization’s audit scope.`)} />}{draft && <PlatformWorkflowDialog value={draft} scopeName={scope === "platform" ? "This rule applies only when the same trigger occurs in each active organization." : `This rule applies only to ${selectedOrganization?.name ?? "the selected organization"}.`} isSaving={saveOrganization.isPending || savePlatformWide.isPending} onClose={() => setDraft(null)} onSave={(value) => { if (scope === "platform") savePlatformWide.mutate(value); else if (organizationId) saveOrganization.mutate({ ...value, orgId: organizationId }); }} />}{deleteTarget && <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Delete platform automation?</DialogTitle><DialogDescription>This stops the rule and cancels its scheduled sends. Existing completed activity remains auditable.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Keep automation</Button><Button variant="destructive" disabled={deleteOrganization.isPending || deletePlatformWide.isPending} onClick={() => deleteTarget.platformWide ? deletePlatformWide.mutate({ id: deleteTarget.workflow.id }) : organizationId && deleteOrganization.mutate({ id: deleteTarget.workflow.id, orgId: organizationId })}><Trash2 className="mr-2 h-4 w-4" />Delete automation</Button></DialogFooter></DialogContent></Dialog>}</div>;
}
