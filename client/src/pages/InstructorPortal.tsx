import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Edit3,
  FileText,
  GraduationCap,
  Loader2,
  Presentation,
  Send,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Building2,
  Wallet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "secondary" },
    pending_review: { label: "Pending Review", variant: "outline" },
    published: { label: "Published", variant: "default" },
    rejected: { label: "Rejected", variant: "destructive" },
    public: { label: "Public", variant: "default" },
    hidden: { label: "Hidden", variant: "secondary" },
    private: { label: "Private", variant: "outline" },
    archived: { label: "Archived", variant: "secondary" },
  };
  const cfg = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Lesson Editor Dialog ─────────────────────────────────────────────────────
function LessonEditorDialog({
  lesson,
  instructorId,
  courseId,
  requiresApproval,
  onClose,
}: {
  lesson: any;
  instructorId: number;
  courseId: number;
  requiresApproval: boolean;
  onClose: () => void;
}) {
  
  const [title, setTitle] = useState(lesson.title ?? "");
  const [content, setContent] = useState(lesson.content ?? "");
  const [embedUrl, setEmbedUrl] = useState(lesson.embedUrl ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateLesson = trpc.instructorDashboard.updateLesson.useMutation();
  const submitForReview = trpc.instructorDashboard.submitLessonForReview.useMutation();
  const utils = trpc.useUtils();

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLesson.mutateAsync({
        lessonId: lesson.id,
        title: title.trim() || undefined,
        content: content || undefined,
        embedUrl: embedUrl || null,
      });
      toast.success("Lesson saved: Your changes have been saved as a draft.");
      utils.instructorDashboard.getCourseSections.invalidate({ courseId });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Save first
      await updateLesson.mutateAsync({
        lessonId: lesson.id,
        title: title.trim() || undefined,
        content: content || undefined,
        embedUrl: embedUrl || null,
      });
      const result = await submitForReview.mutateAsync({
        lessonId: lesson.id,
        courseId,
        instructorId,
        note: note.trim() || undefined,
      });
      if ((result as any).selfPublished) {
        toast.success("Lesson published!: Your lesson is now live.");
      } else {
        toast.success("Submitted for review: An admin will review your lesson shortly.");
      }
      utils.instructorDashboard.getCourseSections.invalidate({ courseId });
      utils.instructorDashboard.getMyLessonSubmissions.invalidate();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Edit Lesson
          </DialogTitle>
          <DialogDescription>
            {requiresApproval
              ? "Submit your changes for admin review before they go live."
              : "You can publish lessons directly without admin approval."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="lesson-title">Lesson Title</Label>
            <Input
              id="lesson-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter lesson title"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="lesson-content">Content</Label>
            <Textarea
              id="lesson-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your lesson content here..."
              rows={8}
              className="mt-1 font-mono text-sm"
            />
          </div>

          <div>
            <Label htmlFor="embed-url">Embed URL (optional)</Label>
            <Input
              id="embed-url"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="https://youtube.com/embed/..."
              className="mt-1"
            />
          </div>

          {requiresApproval && (
            <div>
              <Label htmlFor="review-note">Note to Reviewer (optional)</Label>
              <Textarea
                id="review-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context for the reviewer..."
                rows={2}
                className="mt-1"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Draft
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {requiresApproval ? "Submit for Review" : "Publish Lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Course Management Tab ────────────────────────────────────────────────────
function CourseManagementTab({ instructorId }: { instructorId: number }) {
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null);
  const [editingLesson, setEditingLesson] = useState<{ lesson: any; courseId: number; requiresApproval: boolean; } | null>(null);
  

  const { data: courses, isLoading } = trpc.instructorDashboard.getMyInstructorCourses.useQuery();
  const { data: sections, isLoading: sectionsLoading } = trpc.instructorDashboard.getCourseSections.useQuery(
    { courseId: expandedCourse! },
    { enabled: !!expandedCourse }
  );
  const requestPublish = trpc.instructorDashboard.requestCoursePublish.useMutation();
  const utils = trpc.useUtils();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No courses assigned yet</p>
        <p className="text-sm mt-1">Contact your administrator to be assigned to a course.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {courses.map((course: any) => {
        const isExpanded = expandedCourse === course.courseId;
        return (
          <Card key={course.courseId} className="overflow-hidden">
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => setExpandedCourse(isExpanded ? null : course.courseId)}
            >
              <div className="flex items-center gap-3 min-w-0">
                {course.courseThumbnail ? (
                  <img src={course.courseThumbnail} alt="" className="h-10 w-14 object-cover rounded shrink-0" />
                ) : (
                  <div className="h-10 w-14 bg-primary/10 rounded flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5 text-primary/50" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{course.courseTitle}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={course.courseStatus ?? "draft"} />
                    <span className="text-xs text-muted-foreground capitalize">{course.role} instructor</span>
                    {course.requiresLessonApproval && (
                      <Badge variant="outline" className="text-xs">Approval Required</Badge>
                    )}
                    {course.canSelfPublish && (
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">Self-Publish</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {course.courseStatus === "draft" && !course.canSelfPublish && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await requestPublish.mutateAsync({
                          courseId: course.courseId,
                          instructorId: course.instructorId,
                        });
                        toast.success("Publish request sent: An admin will review your request.");
                        utils.instructorDashboard.getMyInstructorCourses.invalidate();
                      } catch (err: any) {
                        toast.error(err.message);
                      }
                    }}
                    disabled={requestPublish.isPending || course.latestPublishRequest?.status === "pending"}
                  >
                    {course.latestPublishRequest?.status === "pending" ? (
                      <><Clock className="h-3 w-3 mr-1" /> Pending</>
                    ) : (
                      <><Send className="h-3 w-3 mr-1" /> Request Publish</>
                    )}
                  </Button>
                )}
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t bg-muted/20">
                {sectionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !sections || sections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No sections or lessons found for this course.
                  </div>
                ) : (
                  <div className="divide-y">
                    {sections.map((section: any) => (
                      <div key={section.id} className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{section.title}</span>
                          <span className="text-xs text-muted-foreground">({section.lessons?.length ?? 0} lessons)</span>
                        </div>
                        {section.lessons && section.lessons.length > 0 ? (
                          <div className="space-y-1 ml-6">
                            {section.lessons.map((lesson: any) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-background transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                                  <span className="text-sm truncate">{lesson.title}</span>
                                  <StatusBadge status={lesson.lessonStatus ?? "draft"} />
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 shrink-0"
                                  onClick={() => setEditingLesson({
                                    lesson,
                                    courseId: course.courseId,
                                    requiresApproval: course.requiresLessonApproval,
                                  })}
                                >
                                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground ml-6">No lessons in this section.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {editingLesson && (
        <LessonEditorDialog
          lesson={editingLesson.lesson}
          instructorId={instructorId}
          courseId={editingLesson.courseId}
          requiresApproval={editingLesson.requiresApproval}
          onClose={() => setEditingLesson(null)}
        />
      )}
    </div>
  );
}

// ─── Submissions Tab ──────────────────────────────────────────────────────────
function SubmissionsTab() {
  const { data: submissions, isLoading } = trpc.instructorDashboard.getMyLessonSubmissions.useQuery({});

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No submissions yet</p>
        <p className="text-sm mt-1">Lessons you submit for review will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {submissions.map((sub: any) => (
        <Card key={sub.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{sub.lessonTitle ?? `Lesson #${sub.lessonId}`}</span>
                <StatusBadge status={sub.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Course: {sub.courseTitle ?? `#${sub.courseId}`} · Submitted {new Date(sub.submittedAt).toLocaleDateString()}
              </p>
              {sub.reviewNote && (
                <div className={`mt-2 text-xs rounded px-2 py-1.5 ${sub.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"}`}>
                  <strong>Reviewer note:</strong> {sub.reviewNote}
                </div>
              )}
            </div>
            <div className="shrink-0">
              {sub.status === "pending_review" && <Clock className="h-4 w-4 text-amber-500" />}
              {sub.status === "approved" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {sub.status === "rejected" && <XCircle className="h-4 w-4 text-destructive" />}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Payment Setup Tab ────────────────────────────────────────────────────────
function PaymentSetupTab({ instructorId, orgId }: { instructorId: number; orgId: number }) {
  
  const { data: payoutConfig, isLoading: configLoading } = trpc.instructorDashboard.getPayoutConfig.useQuery({ orgId });
  const { data: earnings, isLoading: earningsLoading } = trpc.instructorDashboard.getEarnings.useQuery({ orgId });
  const savePayoutConfig = trpc.instructorDashboard.savePayoutConfig.useMutation();
  const utils = trpc.useUtils();

  const [method, setMethod] = useState<"paypal" | "bank_transfer" | "stripe">("paypal");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankRouting, setBankRouting] = useState("");
  const [bankType, setBankType] = useState<"checking" | "savings">("checking");
  const [bankName, setBankName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (payoutConfig) {
      setMethod((payoutConfig.payoutMethod as any) ?? "paypal");
      const d = payoutConfig.payoutDetails as any ?? {};
      if (payoutConfig.payoutMethod === "paypal") setPaypalEmail(d.paypalEmail ?? "");
      if (payoutConfig.payoutMethod === "bank_transfer") {
        setBankHolder(d.accountHolderName ?? "");
        setBankType(d.accountType ?? "checking");
        setBankName(d.bankName ?? "");
      }
    }
  }, [payoutConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePayoutConfig.mutateAsync({
        orgId,
        payoutMethod: method,
        paypalEmail: method === "paypal" ? paypalEmail : undefined,
        bankAccountHolderName: method === "bank_transfer" ? bankHolder : undefined,
        bankAccountNumber: method === "bank_transfer" ? bankAccount : undefined,
        bankRoutingNumber: method === "bank_transfer" ? bankRouting : undefined,
        bankAccountType: method === "bank_transfer" ? bankType : undefined,
        bankName: method === "bank_transfer" ? bankName : undefined,
      });
      toast.success("Payment details saved");
      utils.instructorDashboard.getPayoutConfig.invalidate({ orgId });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Earnings Summary */}
      {!earningsLoading && earnings && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Commission Rate", value: `${earnings.commissionPercentage ?? 0}%`, icon: TrendingUp },
            { label: "Total Earned", value: `$${(earnings.totalEarned ?? 0).toFixed(2)}`, icon: DollarSign },
            { label: "Total Paid", value: `$${(earnings.totalPaid ?? 0).toFixed(2)}`, icon: Wallet },
            { label: "Pending Payout", value: `$${(earnings.pendingPayout ?? 0).toFixed(2)}`, icon: CreditCard },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-xl font-bold">{value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Payout Method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout Method</CardTitle>
          <CardDescription>Set up how you want to receive your earnings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer (ACH)</SelectItem>
                <SelectItem value="stripe">Stripe Connect</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === "paypal" && (
            <div>
              <Label htmlFor="paypal-email">PayPal Email Address</Label>
              <Input
                id="paypal-email"
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="your@paypal.com"
                className="mt-1"
              />
            </div>
          )}

          {method === "bank_transfer" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="bank-holder">Account Holder Name</Label>
                <Input id="bank-holder" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} placeholder="Full name on account" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bank-account">Account Number</Label>
                  <Input id="bank-account" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="••••••••" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="bank-routing">Routing Number</Label>
                  <Input id="bank-routing" value={bankRouting} onChange={(e) => setBankRouting(e.target.value)} placeholder="9 digits" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Account Type</Label>
                  <Select value={bankType} onValueChange={(v) => setBankType(v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bank-name">Bank Name</Label>
                  <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank of America" className="mt-1" />
                </div>
              </div>
              {payoutConfig?.payoutMethod === "bank_transfer" && (payoutConfig.payoutDetails as any)?.accountNumberMasked && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                  Current account on file: {(payoutConfig.payoutDetails as any).accountNumberMasked}
                </div>
              )}
            </div>
          )}

          {method === "stripe" && (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Stripe Connect setup is managed by your administrator.</p>
              <p className="text-xs mt-1">Contact your org admin to configure Stripe Connect payouts.</p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving || method === "stripe"}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Payment Details
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ orgId }: { orgId: number }) {
  const { data: analytics, isLoading } = trpc.instructorDashboard.getCourseAnalytics.useQuery({ orgId });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!analytics) return (
    <div className="text-center py-12 text-muted-foreground">
      <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p>No analytics data available.</p>
    </div>
  );

  const { permissions, courses, totals, students } = analytics as any;

  return (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {permissions.canSeeEnrollmentCount && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Enrollments</span>
            </div>
            <p className="text-2xl font-bold">{totals.enrollments ?? "—"}</p>
          </Card>
        )}
        {permissions.canSeeCompletionRate && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Completions</span>
            </div>
            <p className="text-2xl font-bold">{totals.completions ?? "—"}</p>
          </Card>
        )}
        {permissions.canSeeRevenue && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <p className="text-2xl font-bold">${(totals.revenue ?? 0).toFixed(2)}</p>
          </Card>
        )}
      </div>

      {/* Per-course breakdown */}
      {courses && courses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {courses.map((c: any) => (
                <div key={c.courseId} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.title}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0 ml-4">
                    {permissions.canSeeEnrollmentCount && (
                      <span><strong className="text-foreground">{c.enrollments ?? "—"}</strong> enrolled</span>
                    )}
                    {permissions.canSeeCompletionRate && c.completionRate !== null && (
                      <span><strong className="text-foreground">{c.completionRate}%</strong> complete</span>
                    )}
                    {permissions.canSeeRevenue && c.revenue !== null && (
                      <span><strong className="text-foreground">${c.revenue.toFixed(2)}</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student list (if permitted) */}
      {permissions.canSeeStudentNames && students && students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {students.slice(0, 20).map((s: any) => (
                <div key={s.userId} className="flex items-center justify-between text-sm">
                  <span>{permissions.canSeeStudentEmails ? `${s.userName} (${s.userEmail})` : s.userName}</span>
                  <span className="text-muted-foreground">{s.courseTitle}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!permissions.canSeeRevenue && !permissions.canSeeEnrollmentCount && !permissions.canSeeCompletionRate && (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Analytics visibility is restricted. Contact your administrator to enable analytics access.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InstructorPortal() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("courses");

  // Check if the user has an instructor profile
  const { data: myCourses, isLoading: coursesLoading } = trpc.instructorDashboard.getMyInstructorCourses.useQuery(
    undefined,
    { enabled: !!user }
  );

  if (loading || coursesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    setLocation("/");
    return null;
  }

  // Derive instructor ID and org ID from the first course assignment
  const firstCourse = myCourses?.[0];
  const instructorId = firstCourse?.instructorId;
  const orgId = firstCourse ? undefined : undefined; // Will be fetched from profile

  // If no instructor profile, show a message
  const hasInstructorProfile = myCourses && myCourses.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Presentation className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Instructor Portal</h1>
                <p className="text-sm text-muted-foreground">Manage your courses, lessons, and earnings</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
              <ChevronRight className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {!hasInstructorProfile ? (
          <Card className="text-center py-16">
            <CardContent>
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-lg font-semibold mb-2">No Instructor Profile Found</h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
                You don't have an instructor profile yet. Contact your organization administrator to be set up as an instructor and assigned to courses.
              </p>
              <Button variant="outline" onClick={() => setLocation("/")}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="courses" className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                My Courses
              </TabsTrigger>
              <TabsTrigger value="submissions" className="flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" />
                Submissions
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="payment" className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4" />
                Payment Setup
              </TabsTrigger>
            </TabsList>

            <TabsContent value="courses">
              <CourseManagementTab instructorId={instructorId!} />
            </TabsContent>

            <TabsContent value="submissions">
              <SubmissionsTab />
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsTab orgId={myCourses[0]?.orgId ?? 0} />
            </TabsContent>

            <TabsContent value="payment">
              <PaymentSetupTab
                instructorId={instructorId!}
                orgId={myCourses[0]?.orgId ?? 0}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
