import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "wouter";
import { getSubdomain } from "@/hooks/useSubdomain";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldOption {
  value: string;
  label: string;
}
interface FormField {
  id: number;
  type: string;
  label: string;
  placeholder?: string | null;
  helpText?: string | null;
  required: boolean;
  sortOrder: number;
  options: FieldOption[];
  isBranchingSource: boolean;
  isHidden?: boolean;
  memberVarName?: string | null;
  scaleMin?: number | null;
  scaleMax?: number | null;
  scaleMinLabel?: string | null;
  scaleMaxLabel?: string | null;
  richTextContent?: string | null;
  emailRoutingRules?: string | null;
  scoreWeight?: number | null;
}
interface BranchingRule {
  id: number;
  sourceFieldId: number;
  operator: string;
  value?: string | null;
  action: string;
  targetFieldId?: number | null;
}
interface PublicForm {
  id: number;
  title: string;
  description?: string | null;
  slug: string;
  requireLogin: boolean;
  allowMultipleSubmissions: boolean;
  successMessage?: string | null;
  redirectUrl?: string | null;
  // branding
  primaryColor?: string | null;
  buttonColor?: string | null;
  buttonTextColor?: string | null;
  headerBgColor?: string | null;
  headerTextColor?: string | null;
  fontFamily?: string | null;
  headerImageUrl?: string | null;
  useOrgBranding?: boolean;
  customCss?: string | null;
  orgPrimaryColor?: string | null;
  orgFontFamily?: string | null;
  fields: FormField[];
  rules: BranchingRule[];
}

// ── Branching engine ──────────────────────────────────────────────────────────

function evaluateRule(rule: BranchingRule, answers: Record<number, any>): boolean {
  const answer = answers[rule.sourceFieldId];
  const val = Array.isArray(answer) ? answer : [String(answer ?? "")];
  const ruleVal = rule.value ?? "";
  switch (rule.operator) {
    case "equals": return val.some((v) => v === ruleVal);
    case "not_equals": return val.every((v) => v !== ruleVal);
    case "contains": return val.some((v) => v.toLowerCase().includes(ruleVal.toLowerCase()));
    case "not_contains": return val.every((v) => !v.toLowerCase().includes(ruleVal.toLowerCase()));
    case "is_empty": return !answer || (Array.isArray(answer) ? answer.length === 0 : String(answer).trim() === "");
    case "is_not_empty": return !!answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim() !== "");
    default: return false;
  }
}

function computeVisibleFields(
  fields: FormField[],
  rules: BranchingRule[],
  answers: Record<number, any>
): Set<number> {
  const visible = new Set(fields.map((f) => f.id));
  for (const rule of rules) {
    if (!evaluateRule(rule, answers)) continue;
    if (rule.action === "show_field" && rule.targetFieldId) visible.add(rule.targetFieldId);
    else if (rule.action === "hide_field" && rule.targetFieldId) visible.delete(rule.targetFieldId);
  }
  return visible;
}

function shouldAutoSubmit(rules: BranchingRule[], answers: Record<number, any>): boolean {
  return rules.some((r) => r.action === "submit_form" && evaluateRule(r, answers));
}

// ── Field Renderer ────────────────────────────────────────────────────────────

function FieldRenderer({
  field,
  value,
  onChange,
  primaryColor,
  error,
}: {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
  primaryColor: string;
  error?: string;
}) {
  if (field.type === "section_break") {
    return (
      <div className="py-4">
        <div className="border-t border-border" />
        {field.label && <h3 className="mt-4 text-base font-semibold">{field.label}</h3>}
        {field.helpText && <p className="text-sm text-muted-foreground mt-1">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === "statement") {
    return (
      <div className="py-2">
        <p className="text-sm leading-relaxed">{field.label}</p>
        {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
      </div>
    );
  }

  if (field.type === "richtext" || field.type === "info") {
    return (
      <div className="py-3">
        {field.label && field.type === "info" && <h4 className="text-sm font-semibold mb-1">{field.label}</h4>}
        {field.richTextContent && (
          <div className="prose prose-sm max-w-none dark:prose-invert text-sm" dangerouslySetInnerHTML={{ __html: field.richTextContent }} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}

      {["short_answer", "email", "number", "date"].includes(field.type) && (
        <Input
          type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          placeholder={field.placeholder ?? ""}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-red-400" : ""}
        />
      )}

      {field.type === "long_answer" && (
        <Textarea
          placeholder={field.placeholder ?? ""}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`min-h-[100px] ${error ? "border-red-400" : ""}`}
        />
      )}

      {field.type === "dropdown" && (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger className={error ? "border-red-400" : ""}>
            <SelectValue placeholder={field.placeholder ?? "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "radio" && (
        <div className="space-y-2">
          {field.options.map((opt) => {
            const checked = value === opt.value;
            return (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors"
                style={checked ? { borderColor: primaryColor, backgroundColor: primaryColor + "10" } : {}}
              >
                <div
                  className="h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{ borderColor: checked ? primaryColor : "hsl(var(--border))" }}
                >
                  {checked && (
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                  )}
                </div>
                <span className="text-sm">{opt.label}</span>
                <input type="radio" className="sr-only" checked={checked} onChange={() => onChange(opt.value)} />
              </label>
            );
          })}
        </div>
      )}

      {field.type === "checkbox" && (
        <div className="space-y-2">
          {field.options.map((opt) => {
            const checked = Array.isArray(value) ? value.includes(opt.value) : false;
            return (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/40 transition-colors"
                style={checked ? { borderColor: primaryColor, backgroundColor: primaryColor + "10" } : {}}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(c ? [...current, opt.value] : current.filter((v: string) => v !== opt.value));
                  }}
                  style={{ accentColor: primaryColor }}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === "scale" && (() => {
        const min = field.scaleMin ?? 1;
        const max = field.scaleMax ?? 5;
        const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-1 justify-center flex-wrap">
              {values.map((v) => {
                const selected = Number(value) === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange(String(v))}
                    className={`w-10 h-10 rounded-lg border-2 text-sm font-medium transition-all ${
                      selected ? "text-white shadow-md scale-110" : "border-border text-foreground hover:border-primary/50"
                    }`}
                    style={selected ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
            {(field.scaleMinLabel || field.scaleMaxLabel) && (
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>{field.scaleMinLabel}</span>
                <span>{field.scaleMaxLabel}</span>
              </div>
            )}
          </div>
        );
      })()}

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUrlParams(): Record<string, string> {
  const params: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((v, k) => { params[k] = v; });
  return params;
}

function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Main FormPlayerPage ───────────────────────────────────────────────────────

export default function FormPlayerPage() {
  const params = useParams<{ slug: string; orgSlug?: string }>();
  const slug = params?.slug ?? "";
  // On subdomain routes (/forms/:slug), orgSlug param is absent — use current subdomain for scoping
  const resolvedOrgSlug = params?.orgSlug ?? getSubdomain() ?? undefined;
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1";

  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const sessionTokenRef = useRef(generateSessionToken());
  const sessionIdRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());

  const { data: form, isLoading, error } = trpc.forms.publicGet.useQuery(
    { slug, orgSlug: resolvedOrgSlug },
    { enabled: !!slug }
  );

  const { data: authUser } = trpc.auth.me.useQuery();

  // Session tracking mutations
  const startSessionMutation = trpc.forms.sessions.start.useMutation({
    onSuccess: (data) => { sessionIdRef.current = data.sessionId; },
  });
  const fieldViewMutation = trpc.forms.sessions.fieldView.useMutation();
  const completeSessionMutation = trpc.forms.sessions.complete.useMutation();

  // Start session when form loads
  useEffect(() => {
    if (!form) return;
    const urlParams = getUrlParams();
    // Build member vars from auth user + URL params
    const memberVars: Record<string, string> = { ...urlParams };
    if (authUser) {
      memberVars.name = authUser.name ?? "";
      memberVars.email = authUser.email ?? "";
      memberVars.userId = String(authUser.id);
    }
    startSessionMutation.mutate({
      formId: form.id,
      sessionToken: sessionTokenRef.current,
      memberVars,
    });
  }, [form?.id]);

  // Auto-populate member variable fields from auth user and URL params
  useEffect(() => {
    if (!form) return;
    const urlParams = getUrlParams();
    const initialAnswers: Record<number, any> = {};
    for (const field of form.fields) {
      if (!field.memberVarName) continue;
      let val = urlParams[field.memberVarName];
      if (!val && authUser) {
        if (field.memberVarName === "name") val = authUser.name ?? "";
        else if (field.memberVarName === "email") val = authUser.email ?? "";
        else if (field.memberVarName === "userId") val = String(authUser.id);
      }
      if (val) initialAnswers[field.id] = val;
    }
    if (Object.keys(initialAnswers).length > 0) {
      setAnswers((prev) => ({ ...initialAnswers, ...prev }));
    }
  }, [form?.id, authUser]);

  const submitMutation = trpc.forms.publicSubmit.useMutation({
    onSuccess: (res) => {
      // End session with completion
      if (sessionIdRef.current) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        completeSessionMutation.mutate({
          formId: form!.id,
          sessionId: sessionIdRef.current,
          durationSeconds: duration,
        });
      }
      setSuccessMsg(res.message ?? "Thank you for your response!");
      setSubmitted(true);
      if (form?.redirectUrl) {
        setTimeout(() => { window.location.href = form.redirectUrl!; }, 2000);
      }
    },
    onError: (e) => {
      setErrors({ 0: e.message });
    },
  });

  // Resolve branding: per-form overrides > org defaults > system defaults
  const branding = useMemo(() => {
    if (!form) return { primary: "#24abbc", button: "#24abbc", buttonText: "#ffffff", headerBg: "", headerText: "#ffffff", font: "Inter", headerImage: null };
    const useOrg = form.useOrgBranding !== false;
    const primary = (!useOrg && form.primaryColor) || form.orgPrimaryColor || "#24abbc";
    const button = (!useOrg && form.buttonColor) || primary;
    const buttonText = (!useOrg && form.buttonTextColor) || "#ffffff";
    const headerBg = (!useOrg && form.headerBgColor) || primary;
    const headerText = (!useOrg && form.headerTextColor) || "#ffffff";
    const font = (!useOrg && form.fontFamily) || form.orgFontFamily || "Inter";
    return { primary, button, buttonText, headerBg, headerText, font, headerImage: form.headerImageUrl ?? null };
  }, [form]);

  // Compute visible fields based on current answers and branching rules
  const visibleFieldIds = useMemo(() => {
    if (!form) return new Set<number>();
    return computeVisibleFields(form.fields, form.rules, answers);
  }, [form, answers]);

  const visibleFields = useMemo(
    () => (form?.fields ?? []).filter((f) => visibleFieldIds.has(f.id) && !f.isHidden),
    [form, visibleFieldIds]
  );

  // Split visible fields into pages using page_break as dividers
  const pages = useMemo(() => {
    const result: typeof visibleFields[] = [];
    let current: typeof visibleFields = [];
    for (const field of visibleFields) {
      if (field.type === "page_break") {
        result.push(current);
        current = [];
      } else {
        current.push(field);
      }
    }
    result.push(current);
    return result.filter((p) => p.length > 0);
  }, [visibleFields]);
  const totalPages = pages.length;
  const currentFields = pages[currentPage] ?? [];

  // Auto-submit if a rule triggers it
  useEffect(() => {
    if (!form || submitted) return;
    if (shouldAutoSubmit(form.rules, answers)) handleSubmit();
  }, [answers]);

  const handleAnswerChange = (fieldId: number, value: any) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[fieldId]; return e; });
    // Track field interaction
    if (sessionIdRef.current) {
      fieldViewMutation.mutate({
        formId: form!.id,
        sessionId: sessionIdRef.current,
        fieldId,
      });
    }
  };

  const validatePage = (fields: typeof visibleFields): boolean => {
    const newErrors: Record<number, string> = {};
    for (const field of fields) {
      if (!field.required) continue;
      if (["section_break", "statement", "page_break", "richtext", "info"].includes(field.type)) continue;
      const val = answers[field.id];
      if (!val || (Array.isArray(val) && val.length === 0) || String(val).trim() === "") {
        newErrors[field.id] = "This field is required.";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validate = (): boolean => {
    const newErrors: Record<number, string> = {};
    for (const field of visibleFields) {
      if (!field.required) continue;
      if (["section_break", "statement", "page_break", "richtext", "info"].includes(field.type)) continue;
      const val = answers[field.id];
      if (!val || (Array.isArray(val) && val.length === 0) || String(val).trim() === "") {
        newErrors[field.id] = "This field is required.";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextPage = () => {
    if (!validatePage(currentFields)) return;
    setErrors({});
    setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrevPage = () => {
    setErrors({});
    setCurrentPage((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = () => {
    if (!form || !validate()) return;

    // Include hidden field answers (member vars)
    const hiddenFields = (form.fields ?? []).filter((f) => f.isHidden);
    const allAnswers = { ...answers };
    for (const hf of hiddenFields) {
      if (allAnswers[hf.id] === undefined && hf.memberVarName) {
        const urlParams = getUrlParams();
        const val = urlParams[hf.memberVarName] ?? (authUser && hf.memberVarName === "email" ? authUser.email : "");
        if (val) allAnswers[hf.id] = val;
      }
    }

    const emailField = form.fields.find((f) => f.type === "email");
    const respondentEmail = emailField ? allAnswers[emailField.id] : undefined;

    const stringAnswers: Record<string, any> = {};
    for (const [k, v] of Object.entries(allAnswers)) {
      stringAnswers[k] = Array.isArray(v) ? v : String(v ?? "");
    }

    submitMutation.mutate({ formId: form.id, answers: stringAnswers, respondentEmail });
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={`${isEmbed ? "" : "min-h-screen bg-background"} flex items-center justify-center p-8`}>
        <div className="w-full max-w-xl space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!form || error) {
    return (
      <div className={`${isEmbed ? "" : "min-h-screen bg-background"} flex items-center justify-center p-8`}>
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">Form not found</h2>
          <p className="text-sm text-muted-foreground">This form may have been closed or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className={`${isEmbed ? "" : "min-h-screen"} flex items-center justify-center p-8`}
        style={{ fontFamily: branding.font, background: isEmbed ? undefined : `linear-gradient(135deg, ${branding.primary}08 0%, transparent 60%)` }}
      >
        <div className="text-center space-y-4 max-w-sm">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: branding.primary + "20" }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: branding.primary }} />
          </div>
          <h2 className="text-xl font-bold">Submitted!</h2>
          <p className="text-sm text-muted-foreground">{successMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${isEmbed ? "" : "min-h-screen bg-background"} pb-10 tf-form`}
      style={{ fontFamily: branding.font, background: isEmbed ? undefined : `linear-gradient(135deg, ${branding.primary}08 0%, transparent 60%)` }}
    >
      {/* Inject custom CSS */}
      {form.customCss && (
        <style dangerouslySetInnerHTML={{ __html: form.customCss }} />
      )}
      {/* Header image */}
      {branding.headerImage && (
        <div className="w-full h-48 overflow-hidden">
          <img src={branding.headerImage} alt="Form header" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Colored header bar */}
      {!branding.headerImage && (
        <div
          className="w-full py-8 px-4"
          style={{ backgroundColor: branding.headerBg, color: branding.headerText }}
        >
          <div className="max-w-xl mx-auto">
            <h1 className="text-2xl font-bold" style={{ color: branding.headerText }}>{form.title}</h1>
            {form.description && (
              <p className="text-sm mt-2 opacity-80" style={{ color: branding.headerText }}>{form.description}</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 pt-8">
        {/* Title below header image */}
        {branding.headerImage && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold">{form.title}</h1>
            {form.description && <p className="text-sm text-muted-foreground mt-2">{form.description}</p>}
          </div>
        )}

        {/* Multi-page progress bar */}
        {totalPages > 1 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Step {currentPage + 1} of {totalPages}</span>
              <span>{Math.round(((currentPage + 1) / totalPages) * 100)}% complete</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${((currentPage + 1) / totalPages) * 100}%`, backgroundColor: branding.primary }}
              />
            </div>
          </div>
        )}

        {/* Fields for current page */}
        <div className="space-y-6">
          {currentFields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={answers[field.id]}
              onChange={(v) => handleAnswerChange(field.id, v)}
              primaryColor={branding.primary}
              error={errors[field.id]}
            />
          ))}
        </div>

        {/* Global error */}
        {errors[0] && (
          <p className="mt-4 text-sm text-red-500 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            {errors[0]}
          </p>
        )}

        {/* Navigation / Submit */}
        <div className="mt-8 flex gap-3">
          {totalPages > 1 && currentPage > 0 && (
            <Button
              variant="outline"
              onClick={handlePrevPage}
              className="flex-1 h-11 text-base"
            >
              ← Back
            </Button>
          )}
          {totalPages > 1 && currentPage < totalPages - 1 ? (
            <Button
              onClick={handleNextPage}
              className="flex-1 h-11 text-base font-semibold"
              style={{ backgroundColor: branding.button, color: branding.buttonText }}
            >
              Next →
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="flex-1 h-11 text-base font-semibold"
              style={{ backgroundColor: branding.button, color: branding.buttonText }}
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {submitMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          )}
        </div>

        {/* Powered by */}
        {!isEmbed && (
          <p className="text-center text-xs text-muted-foreground/50 mt-6">
            Powered by{" "}
            <span className="font-semibold">
              <span className="text-foreground/60">teach</span>
              <span style={{ color: branding.primary }}>ific</span>
              <span className="text-foreground/60">™</span>
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
