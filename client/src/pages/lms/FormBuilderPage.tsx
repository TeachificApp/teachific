import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronLeft,
  Settings,
  Eye,
  Share2,
  GitBranch,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Code2,
  AlignLeft,
  AlignJustify,
  ChevronDown,
  Circle,
  CheckSquare,
  AtSign,
  Hash,
  Calendar,
  Minus,
  MessageSquare,
  Columns,
  Loader2,
  Globe,
  Lock,
  X,
  Palette,
  Link2,
  User,
  Upload,
  BookOpen,
  FileText,
  LayoutTemplate,
  Eye as EyeIcon,
  EyeOff,
  Search,
  Download,
  BarChart2,
  Filter,
  Table,
  Tag,
  Clock,
  Edit,
  Save,
  Code,
  Sparkles,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { useEffect as useEffectCM, useRef as useRefCM } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "@codemirror/basic-setup";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";
import RichTextEditor from "@/components/RichTextEditor";
// ── Types ─────────────────────────────────────────────────────────────────────

type FieldType =
  | "short_answer"
  | "long_answer"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "email"
  | "number"
  | "date"
  | "time"
  | "scale"
  | "richtext"
  | "info"
  | "section_break"
  | "statement"
  | "page_break";

interface FieldOption {
  value: string;
  label: string;
  scoreValue?: number;
}

interface FormField {
  id: number | string; // string = temp id for new fields
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  sortOrder: number;
  options: FieldOption[];
  minLength?: number;
  maxLength?: number;
  isBranchingSource: boolean;
  isHidden?: boolean;
  memberVarName?: string;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  richTextContent?: string;
  emailRoutingRules?: string;
  scoreWeight?: number;
}

interface BranchingRule {
  id?: number;
  sourceFieldId: number | string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "is_empty" | "is_not_empty";
  value?: string;
  action: "show_field" | "hide_field" | "jump_to_field" | "submit_form";
  targetFieldId?: number | string;
  sortOrder: number;
}

// ── Field type metadata ───────────────────────────────────────────────────────

const FIELD_TYPES: Array<{ type: FieldType; label: string; icon: React.ReactNode; group: string }> = [
  { type: "short_answer", label: "Short Answer", icon: <AlignLeft className="h-4 w-4" />, group: "Text" },
  { type: "long_answer", label: "Long Answer", icon: <AlignJustify className="h-4 w-4" />, group: "Text" },
  { type: "email", label: "Email", icon: <AtSign className="h-4 w-4" />, group: "Text" },
  { type: "number", label: "Number", icon: <Hash className="h-4 w-4" />, group: "Text" },
  { type: "date", label: "Date", icon: <Calendar className="h-4 w-4" />, group: "Text" },
  { type: "time", label: "Time", icon: <Clock className="h-4 w-4" />, group: "Text" },
  { type: "dropdown", label: "Dropdown", icon: <ChevronDown className="h-4 w-4" />, group: "Choice" },
  { type: "radio", label: "Multiple Choice", icon: <Circle className="h-4 w-4" />, group: "Choice" },
  { type: "checkbox", label: "Checkboxes", icon: <CheckSquare className="h-4 w-4" />, group: "Choice" },
  { type: "scale", label: "Scale / Rating", icon: <BarChart2 className="h-4 w-4" />, group: "Choice" },
  { type: "richtext", label: "Rich Text", icon: <Code className="h-4 w-4" />, group: "Layout" },
  { type: "info", label: "Info Text", icon: <FileText className="h-4 w-4" />, group: "Layout" },
  { type: "section_break", label: "Section Break", icon: <Minus className="h-4 w-4" />, group: "Layout" },
  { type: "statement", label: "Statement", icon: <MessageSquare className="h-4 w-4" />, group: "Layout" },
  { type: "page_break", label: "Page Break", icon: <Columns className="h-4 w-4" />, group: "Layout" },
];

const CHOICE_TYPES: FieldType[] = ["dropdown", "radio", "checkbox"];
const NON_INPUT_TYPES: FieldType[] = ["section_break", "statement", "page_break", "richtext", "info"];
const BRANCHABLE_TYPES: FieldType[] = ["dropdown", "radio", "checkbox", "short_answer", "email", "scale"];

let tempIdCounter = -1;
function newTempId() {
  return `temp_${tempIdCounter--}`;
}

// ── Sortable Field Row ────────────────────────────────────────────────────────

function SortableFieldRow({
  field,
  isSelected,
  onSelect,
  onDelete,
}: {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(field.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = FIELD_TYPES.find((t) => t.type === field.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing p-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="text-muted-foreground shrink-0">{meta?.icon}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {field.label || <span className="text-muted-foreground italic">Untitled {meta?.label}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{meta?.label}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {field.required && (
          <span className="text-xs text-red-500 font-medium">*</span>
        )}
        {field.isBranchingSource && (
          <GitBranch className="h-3 w-3 text-purple-500" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Field Editor Panel ────────────────────────────────────────────────────────

function FieldEditor({
  field,
  onChange,
}: {
  field: FormField;
  onChange: (updated: Partial<FormField>) => void;
}) {
  const isChoice = CHOICE_TYPES.includes(field.type);
  const isBranchable = BRANCHABLE_TYPES.includes(field.type);
  const isNonInput = NON_INPUT_TYPES.includes(field.type);

  const addOption = () => {
    const idx = field.options.length + 1;
    onChange({ options: [...field.options, { value: `option_${idx}`, label: `Option ${idx}`, scoreValue: 0 }] });
  };

  const updateOption = (i: number, patch: Partial<FieldOption>) => {
    const opts = [...field.options];
    const updated = { ...opts[i], ...patch };
    if (patch.label !== undefined) {
      updated.value = patch.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    }
    opts[i] = updated;
    onChange({ options: opts });
  };

  const removeOption = (i: number) => {
    onChange({ options: field.options.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{field.type === "info" ? "Info Text" : field.type === "richtext" ? "Rich Text Label" : "Label *"}</Label>
        <Input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={field.type === "info" ? "Informational text" : field.type === "richtext" ? "Rich text label" : "Question or field label"}
        />
      </div>

      {!isNonInput && field.type !== "scale" && (
        <div className="space-y-1.5">
          <Label>Placeholder</Label>
          <Input
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Hint text shown inside the field"
          />
        </div>
      )}

      {!isNonInput && (
        <div className="space-y-1.5">
          <Label>Help Text</Label>
          <Input
            value={field.helpText ?? ""}
            onChange={(e) => onChange({ helpText: e.target.value })}
            placeholder="Additional guidance shown below the field"
          />
        </div>
      )}

      {/* Scale settings */}
      {field.type === "scale" && (
        <div className="space-y-3 p-3 bg-muted/40 rounded-lg">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scale Settings</Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Min Value</Label>
              <Input type="number" value={field.scaleMin ?? 1} onChange={(e) => onChange({ scaleMin: parseInt(e.target.value) || 1 })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Max Value</Label>
              <Input type="number" value={field.scaleMax ?? 5} onChange={(e) => onChange({ scaleMax: parseInt(e.target.value) || 5 })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Min Label</Label>
              <Input placeholder="e.g. Poor" value={field.scaleMinLabel ?? ""} onChange={(e) => onChange({ scaleMinLabel: e.target.value })} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Max Label</Label>
              <Input placeholder="e.g. Excellent" value={field.scaleMaxLabel ?? ""} onChange={(e) => onChange({ scaleMaxLabel: e.target.value })} className="h-8 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Rich text / Info content editor */}
      {(field.type === "richtext" || field.type === "info") && (
        <div className="space-y-1.5">
          <Label>{field.type === "info" ? "Info Block Content" : "Rich Text Content"}</Label>
          <RichTextEditor
            value={field.richTextContent ?? ""}
            onChange={(v) => onChange({ richTextContent: v })}
            placeholder={field.type === "info" ? "Enter informational content…" : "Enter rich text content…"}
            minHeight={150}
          />
        </div>
      )}

      {/* Choice options with score values */}
      {isChoice && (
        <div className="space-y-2">
          <Label>Options</Label>
          {field.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
              <Input
                value={opt.label}
                onChange={(e) => updateOption(i, { label: e.target.value })}
                placeholder={`Option ${i + 1}`}
                className="flex-1 h-8 text-sm"
              />
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-muted-foreground">Score:</span>
                <Input
                  type="number" min={0} max={100}
                  value={opt.scoreValue ?? 0}
                  onChange={(e) => updateOption(i, { scoreValue: parseInt(e.target.value) || 0 })}
                  className="h-8 text-xs w-14"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeOption(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addOption} className="w-full gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Option
          </Button>
          {field.options.length > 0 && (
            <p className="text-xs text-muted-foreground">Score (0–100): contribution to quality score when this option is selected.</p>
          )}
        </div>
      )}

      {/* Email routing rules */}
      {field.type === "email" && (
        <div className="space-y-1.5 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email Routing Rules (JSON)
          </Label>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Define routing rules as a JSON array. Each rule specifies which email to route to based on a condition.
          </p>
          <textarea
            className="w-full min-h-[80px] font-mono text-xs border border-blue-200 dark:border-blue-700 rounded-lg p-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-blue-950/50"
            placeholder={`[\n  {\n    "label": "Route to reviewer",\n    "conditionFieldId": 5,\n    "conditionValue": "yes",\n    "routeTo": "reviewer@example.com"\n  }\n]`}
            value={field.emailRoutingRules ?? ""}
            onChange={(e) => onChange({ emailRoutingRules: e.target.value })}
          />
        </div>
      )}

      <Separator />

      {/* Required + Score Weight (for non-layout fields) */}
      {!isNonInput && (
        <div className="flex items-center justify-between">
          <div>
            <Label>Required</Label>
            <p className="text-xs text-muted-foreground">Respondents must answer this field</p>
          </div>
          <Switch
            checked={field.required}
            onCheckedChange={(v) => onChange({ required: v })}
          />
        </div>
      )}

      {!isNonInput && (
        <div className="flex items-center justify-between">
          <div>
            <Label>Score Weight</Label>
            <p className="text-xs text-muted-foreground">Relative importance (0–10)</p>
          </div>
          <Input
            type="number" min={0} max={10}
            value={field.scoreWeight ?? 0}
            onChange={(e) => onChange({ scoreWeight: parseInt(e.target.value) || 0 })}
            className="h-8 w-16 text-sm"
          />
        </div>
      )}

      {isBranchable && (
        <div className="flex items-center justify-between">
          <div>
            <Label className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-purple-500" />
              Enable Branching
            </Label>
            <p className="text-xs text-muted-foreground">Use this field's answer to show/hide other fields</p>
          </div>
          <Switch
            checked={field.isBranchingSource}
            onCheckedChange={(v) => onChange({ isBranchingSource: v })}
          />
        </div>
      )}
    </div>
  );
}

// ── Branching Rules Editor ────────────────────────────────────────────────────

function BranchingRulesEditor({
  fields,
  rules,
  onChange,
}: {
  fields: FormField[];
  rules: BranchingRule[];
  onChange: (rules: BranchingRule[]) => void;
}) {
  const sourceFields = fields.filter((f) => f.isBranchingSource);

  const addRule = () => {
    if (sourceFields.length === 0) return;
    onChange([
      ...rules,
      {
        sourceFieldId: sourceFields[0].id,
        operator: "equals",
        value: "",
        action: "show_field",
        targetFieldId: undefined,
        sortOrder: rules.length,
      },
    ]);
  };

  const updateRule = (i: number, patch: Partial<BranchingRule>) => {
    const updated = [...rules];
    updated[i] = { ...updated[i], ...patch };
    onChange(updated);
  };

  const removeRule = (i: number) => {
    onChange(rules.filter((_, idx) => idx !== i));
  };

  const getFieldLabel = (id: number | string | undefined) => {
    if (!id) return "—";
    return fields.find((f) => String(f.id) === String(id))?.label || `Field #${id}`;
  };

  const getOptionsForField = (id: number | string | undefined) => {
    if (!id) return [];
    return fields.find((f) => String(f.id) === String(id))?.options ?? [];
  };

  if (sourceFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <GitBranch className="h-6 w-6 text-purple-500" />
        </div>
        <div>
          <p className="font-medium text-sm">No branching sources yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Enable "Enable Branching" on a Dropdown, Multiple Choice, Checkbox, Short Answer, or Email field to create conditional logic rules.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Conditional Logic Rules</p>
          <p className="text-xs text-muted-foreground">Rules are evaluated in order. First matching rule wins.</p>
        </div>
        <Button size="sm" onClick={addRule} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
          No rules yet. Click "Add Rule" to create your first conditional logic rule.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, i) => {
            const srcField = fields.find((f) => String(f.id) === String(rule.sourceFieldId));
            const srcOptions = getOptionsForField(rule.sourceFieldId);
            const needsValue = !["is_empty", "is_not_empty"].includes(rule.operator);
            const needsTarget = rule.action !== "submit_form";

            return (
              <Card key={i} className="border-purple-200 dark:border-purple-900/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                      Rule {i + 1}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRule(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* IF row */}
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                    <span className="text-xs font-semibold text-muted-foreground w-6">IF</span>
                    <Select
                      value={String(rule.sourceFieldId)}
                      onValueChange={(v) => updateRule(i, { sourceFieldId: v, value: "" })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceFields.map((f) => (
                          <SelectItem key={String(f.id)} value={String(f.id)}>
                            {f.label || `Field #${f.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={rule.operator}
                      onValueChange={(v) => updateRule(i, { operator: v as BranchingRule["operator"] })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">equals</SelectItem>
                        <SelectItem value="not_equals">does not equal</SelectItem>
                        <SelectItem value="contains">contains</SelectItem>
                        <SelectItem value="not_contains">does not contain</SelectItem>
                        <SelectItem value="is_empty">is empty</SelectItem>
                        <SelectItem value="is_not_empty">is not empty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Value row */}
                  {needsValue && (
                    <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                      <span className="text-xs font-semibold text-muted-foreground w-6" />
                      {srcOptions.length > 0 ? (
                        <Select
                          value={rule.value ?? ""}
                          onValueChange={(v) => updateRule(i, { value: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {srcOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="h-8 text-xs"
                          placeholder="Value to match"
                          value={rule.value ?? ""}
                          onChange={(e) => updateRule(i, { value: e.target.value })}
                        />
                      )}
                    </div>
                  )}

                  {/* THEN row */}
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                    <span className="text-xs font-semibold text-muted-foreground w-6">THEN</span>
                    <Select
                      value={rule.action}
                      onValueChange={(v) => updateRule(i, { action: v as BranchingRule["action"] })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="show_field">Show field</SelectItem>
                        <SelectItem value="hide_field">Hide field</SelectItem>
                        <SelectItem value="jump_to_field">Jump to field</SelectItem>
                        <SelectItem value="submit_form">Submit form</SelectItem>
                      </SelectContent>
                    </Select>
                    {needsTarget && (
                      <Select
                        value={rule.targetFieldId ? String(rule.targetFieldId) : ""}
                        onValueChange={(v) => updateRule(i, { targetFieldId: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Target field" />
                        </SelectTrigger>
                        <SelectContent>
                          {fields
                            .filter((f) => String(f.id) !== String(rule.sourceFieldId))
                            .map((f) => (
                              <SelectItem key={String(f.id)} value={String(f.id)}>
                                {f.label || `Field #${f.id}`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Email Routing Panel ───────────────────────────────────────────────────────

function EmailRoutingPanel({
  form,
  fields,
  hasEmailAccess,
  onUpdate,
}: {
  form: any;
  fields: FormField[];
  hasEmailAccess: boolean;
  onUpdate: (patch: any) => void;
}) {
  const [emailInput, setEmailInput] = useState("");
  const notifyEmails: string[] = form.notifyEmails ? JSON.parse(form.notifyEmails) : [];
  const emailFields = fields.filter((f) => f.type === "email" || f.type === "short_answer");

  const addEmail = () => {
    const email = emailInput.trim();
    if (!email || notifyEmails.includes(email)) return;
    onUpdate({ notifyEmails: [...notifyEmails, email] });
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    onUpdate({ notifyEmails: notifyEmails.filter((e) => e !== email) });
  };

  if (!hasEmailAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Mail className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <p className="font-medium text-sm">Email Routing — Pro Feature</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Automatically notify team members and send confirmation emails to respondents. Available on Pro and Enterprise plans.
          </p>
        </div>
        <Badge variant="outline" className="text-amber-600 border-amber-300">Upgrade to unlock</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Org admin notification */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Notifications</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose who receives an email when a new response is submitted.
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Notify Organization Admin</p>
              <p className="text-xs text-muted-foreground">Send to the organization's admin account email</p>
            </div>
            <Switch
              checked={form.notifyOrgAdmin ?? false}
              onCheckedChange={(v) => onUpdate({ notifyOrgAdmin: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Notify Respondent</p>
              <p className="text-xs text-muted-foreground">Send a copy of their answers to the respondent</p>
            </div>
            <Switch
              checked={form.notifyRespondent ?? false}
              onCheckedChange={(v) => onUpdate({ notifyRespondent: v })}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Custom notification emails */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Additional Email Addresses</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Also notify these specific addresses on every submission.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="team@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            className="flex-1"
          />
          <Button variant="outline" onClick={addEmail} disabled={!emailInput.trim()}>
            Add
          </Button>
        </div>
        {notifyEmails.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {notifyEmails.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1.5 pr-1.5">
                <Mail className="h-3 w-3" />
                {email}
                <button onClick={() => removeEmail(email)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Respondent confirmation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-semibold">Confirmation Email to Respondent</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send a confirmation email to the person who submitted the form.
            </p>
          </div>
          <Switch
            checked={form.sendConfirmation ?? false}
            onCheckedChange={(v) => onUpdate({ sendConfirmation: v })}
          />
        </div>

        {form.sendConfirmation && (
          <div className="space-y-3 pl-0 border-l-2 border-primary/20 pl-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Email Field</Label>
              <Select
                value={form.confirmationEmailField ?? ""}
                onValueChange={(v) => onUpdate({ confirmationEmailField: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Which field contains the email?" />
                </SelectTrigger>
                <SelectContent>
                  {emailFields.map((f) => (
                    <SelectItem key={String(f.id)} value={String(f.id)}>
                      {f.label || `Field #${f.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input
                className="text-xs"
                placeholder="Thanks for your submission!"
                value={form.confirmationSubject ?? ""}
                onChange={(e) => onUpdate({ confirmationSubject: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body</Label>
              <Textarea
                className="text-xs min-h-[80px]"
                placeholder="We've received your response and will be in touch shortly."
                value={form.confirmationBody ?? ""}
                onChange={(e) => onUpdate({ confirmationBody: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Share Panel ───────────────────────────────────────────────────────────────

function SharePanel({ form, activeTab = "links", orgSlug, onSlugSaved }: { form: any; activeTab?: string; orgSlug?: string; onSlugSaved?: (slug: string) => void }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [slugError, setSlugError] = useState("");

  const updateMut = trpc.forms.update.useMutation({
    onSuccess: () => {
      toast.success("URL updated");
      setEditingSlug(false);
      onSlugSaved?.(slugDraft);
    },
    onError: (e: { message: string }) => { setSlugError(e.message); },
  });

  const formSlug = form.slug ?? "";
  const formUrl = orgSlug
    ? `${getOrgBaseUrl(orgSlug)}/forms/${formSlug}`
    : `${window.location.origin}/forms/${formSlug}`;
  const embedCode = `<iframe src="${formUrl}?embed=1" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px"></iframe>`;

  const copyUrl = () => { navigator.clipboard.writeText(formUrl); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); };
  const copyEmbed = () => { navigator.clipboard.writeText(embedCode); setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); };

  const startEditSlug = () => { setSlugDraft(formSlug); setSlugError(""); setEditingSlug(true); };
  const saveSlug = () => {
    if (!slugDraft.trim()) return;
    if (!/^[a-z0-9-]+$/.test(slugDraft)) { setSlugError("Only lowercase letters, numbers, and hyphens allowed"); return; }
    updateMut.mutate({ id: form.id, slug: slugDraft });
  };

  const draftFormUrl = orgSlug
    ? `${getOrgBaseUrl(orgSlug)}/forms/${slugDraft}`
    : `${window.location.origin}/forms/${slugDraft}`;

  const statusBanner = form.status !== "published" ? (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
      <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-700">
        This form is currently <strong>{form.status}</strong>. Publish it to make the URL and embed code active.
      </p>
    </div>
  ) : null;

  if (activeTab === "links") {
    return (
      <div className="space-y-6">
        {statusBanner}
        {/* Direct URL */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Globe className="h-4 w-4" /> Direct URL
          </Label>
          <p className="text-xs text-muted-foreground">Share this link with respondents to open the form in a new page.</p>
          <div className="flex gap-2">
            <Input value={formUrl} readOnly className="flex-1 text-xs font-mono bg-muted" />
            <Button variant="outline" size="sm" onClick={copyUrl} className="gap-1.5 shrink-0">
              {copiedUrl ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedUrl ? "Copied!" : "Copy"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(formUrl, "_blank")} className="shrink-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Separator />
        {/* Editable slug */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Link2 className="h-4 w-4" /> Custom URL Slug
          </Label>
          <p className="text-xs text-muted-foreground">
            Customize the last part of the form URL. Only lowercase letters, numbers, and hyphens.
          </p>
          {editingSlug ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded-md">
                <span className="text-muted-foreground/60">{orgSlug ? getOrgBaseUrl(orgSlug) + "/forms/" : window.location.origin + "/forms/"}</span>
                <Input
                  value={slugDraft}
                  onChange={e => { setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugError(""); }}
                  className="h-7 text-xs font-mono border-primary flex-1 min-w-0"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") saveSlug(); if (e.key === "Escape") setEditingSlug(false); }}
                />
              </div>
              {slugDraft && <p className="text-xs text-muted-foreground font-mono">{draftFormUrl}</p>}
              {slugError && <p className="text-xs text-red-500">{slugError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={saveSlug} disabled={updateMut.isPending} className="gap-1.5 h-8">
                  <Save className="h-3.5 w-3.5" /> {updateMut.isPending ? "Saving..." : "Save URL"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingSlug(false)} className="h-8">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-3 py-2 rounded-md font-mono flex-1 truncate">{formUrl}</code>
              <Button size="sm" variant="outline" onClick={startEditSlug} className="gap-1.5 h-8 shrink-0">
                <Edit className="h-3.5 w-3.5" /> Edit URL
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "preview") {
    return (
      <div className="space-y-4">
        {statusBanner}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Eye className="h-4 w-4" /> Form Preview
          </Label>
          <p className="text-xs text-muted-foreground">See how your form looks to respondents.</p>
        </div>
        <div className="rounded-lg border border-border overflow-hidden" style={{ height: "600px" }}>
          <iframe
            src={`${formUrl}?embed=1&preview=1`}
            className="w-full h-full border-none"
            title="Form Preview"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open(formUrl, "_blank")} className="gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
        </Button>
      </div>
    );
  }

  if (activeTab === "embed-code") {
    return (
      <div className="space-y-6">
        {statusBanner}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Code2 className="h-4 w-4" /> Embed Code
          </Label>
          <p className="text-xs text-muted-foreground">Paste this HTML snippet into any webpage to embed the form inline.</p>
          <div className="relative">
            <Textarea value={embedCode} readOnly className="text-xs font-mono bg-muted min-h-[80px] pr-20 resize-none" />
            <Button variant="outline" size="sm" onClick={copyEmbed} className="absolute top-2 right-2 gap-1.5 h-7 text-xs">
              {copiedEmbed ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copiedEmbed ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Popup Embed</Label>
          <p className="text-xs text-muted-foreground">Add a button that opens the form in a popup overlay.</p>
          <div className="relative">
            <Textarea
              value={`<button onclick="document.getElementById('tf-popup').style.display='flex'" style="padding:10px 20px;background:#24abbc;color:#fff;border:none;border-radius:6px;cursor:pointer">Open Form</button>\n<div id="tf-popup" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;align-items:center;justify-content:center" onclick="if(event.target===this)this.style.display='none'">\n  <div style="background:#fff;border-radius:12px;width:90%;max-width:640px;height:80vh;overflow:hidden">\n    <iframe src="${formUrl}?embed=1" style="width:100%;height:100%;border:none"></iframe>\n  </div>\n</div>`}
              readOnly
              className="text-xs font-mono bg-muted min-h-[120px] resize-none"
            />
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "qr-code") {
    return (
      <div className="space-y-6">
        {statusBanner}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm font-semibold">
            <Globe className="h-4 w-4" /> QR Code
          </Label>
          <p className="text-xs text-muted-foreground">Scan to open the form on a mobile device. Download and print for physical distribution.</p>
        </div>
        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl border border-border">
          <QRCodeSVG value={formUrl} size={220} level="H" includeMargin />
          <p className="text-xs text-muted-foreground font-mono text-center break-all max-w-xs">{formUrl}</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const svg = document.querySelector("svg") as SVGElement | null;
              if (!svg) return;
              const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${formSlug}-qr.svg`;
              a.click();
            }}
          >
            <Download className="h-3.5 w-3.5" /> Download SVG
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Branding Panel ───────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Poppins", "Montserrat", "Nunito", "Raleway",
];

// ── CSS Code Editor ─────────────────────────────────────────────────────────
function CssCodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRefCM<HTMLDivElement>(null);
  const viewRef = useRefCM<EditorView | null>(null);

  useEffectCM(() => {
    if (!containerRef.current) return;
    const state = EditorState.create({
      doc: value ?? "",
      extensions: [
        basicSetup,
        css(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { fontSize: "12px", maxHeight: "300px", borderRadius: "6px", overflow: "hidden" },
          ".cm-scroller": { overflow: "auto", maxHeight: "300px" },
        }),
      ],
    });
    const view = new EditorView({ state, parent: containerRef.current! });
    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. when form loads)
  useEffectCM(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== (value ?? "")) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value ?? "" },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="rounded-md border border-border overflow-hidden" />;
}

function BrandingPanel({
  formId,
  orgId,
  formSettings,
  onUpdate,
}: {
  formId: number;
  orgId: number;
  formSettings: any;
  onUpdate: (patch: any) => void;
}) {
  const { data: orgDefaults } = trpc.forms.branding.orgDefaults.useQuery(
    { orgId },
    { enabled: !!orgId }
  );
  const uploadMutation = trpc.forms.branding.uploadHeaderImage.useMutation({
    onSuccess: (data) => { onUpdate({ headerImageUrl: data.url }); toast.success("Header image uploaded"); },
    onError: (e) => toast.error(e.message),
  });

  const useOrgBranding = formSettings.useOrgBranding ?? true;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      uploadMutation.mutate({ formId, base64, mimeType: file.type, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Palette className="h-4 w-4" /> Form Branding
        </Label>
        <p className="text-xs text-muted-foreground">Customize how this form looks. Defaults inherit from your org settings.</p>
      </div>

      {/* Use org branding toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Use Org Defaults</p>
          <p className="text-xs text-muted-foreground">Inherit colors and fonts from your org theme</p>
        </div>
        <Switch
          checked={useOrgBranding}
          onCheckedChange={(v) => onUpdate({ useOrgBranding: v })}
        />
      </div>

      {!useOrgBranding && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Colors</Label>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["primaryColor", "Primary"],
                ["buttonColor", "Button"],
                ["buttonTextColor", "Button Text"],
                ["headerBgColor", "Header BG"],
                ["headerTextColor", "Header Text"],
              ] as [string, string][]).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formSettings[key] ?? (orgDefaults?.primaryColor ?? "#24abbc")}
                      onChange={(e) => onUpdate({ [key]: e.target.value })}
                      className="h-8 w-8 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={formSettings[key] ?? ""}
                      onChange={(e) => onUpdate({ [key]: e.target.value })}
                      placeholder={orgDefaults?.primaryColor ?? "#24abbc"}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Font</Label>
            <Select
              value={formSettings.fontFamily ?? orgDefaults?.fontFamily ?? "Inter"}
              onValueChange={(v) => onUpdate({ fontFamily: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <Separator />
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Upload className="h-4 w-4" /> Header Image
        </Label>
        <p className="text-xs text-muted-foreground">Shown as a full-width banner above the form title.</p>
        {formSettings.headerImageUrl && (
          <div className="relative">
            <img
              src={formSettings.headerImageUrl}
              alt="Header"
              className="w-full h-24 object-cover rounded border border-border"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => onUpdate({ headerImageUrl: null })}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={uploadMutation.isPending}
            asChild
          >
            <span>
              {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadMutation.isPending ? "Uploading..." : "Upload Image"}
            </span>
          </Button>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>
      </div>

      <Separator />
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Code className="h-4 w-4" /> Custom CSS
        </Label>
        <p className="text-xs text-muted-foreground">
          Write custom CSS to override form styles. Use <code className="bg-muted px-1 rounded text-xs">.tf-form</code> as the root selector.
        </p>
        <CssCodeEditor
          value={formSettings.customCss ?? ""}
          onChange={(v) => onUpdate({ customCss: v || null })}
        />
        <p className="text-xs text-muted-foreground">
          Example: <code className="bg-muted px-1 rounded text-xs">.tf-form button &#123; border-radius: 0; &#125;</code>
        </p>
      </div>
    </div>
  );
}

// ── Member Variables Panel ────────────────────────────────────────────────────

const MEMBER_VARS = [
  { key: "name", label: "Full Name", description: "Respondent's full name" },
  { key: "email", label: "Email Address", description: "Respondent's email" },
  { key: "userId", label: "User ID", description: "Internal user identifier" },
  { key: "orgName", label: "Organization Name", description: "Org the member belongs to" },
  { key: "custom1", label: "Custom Variable 1", description: "Passed via URL param ?custom1=" },
  { key: "custom2", label: "Custom Variable 2", description: "Passed via URL param ?custom2=" },
];

function MemberVarsPanel({
  fields,
  onFieldChange,
}: {
  fields: FormField[];
  onFieldChange: (id: string | number, patch: Partial<FormField>) => void;
}) {
  const inputFields = fields.filter(
    (f) => !NON_INPUT_TYPES.includes(f.type as FieldType)
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <User className="h-4 w-4" /> Member Variables
        </Label>
        <p className="text-xs text-muted-foreground">
          Map form fields to member data so they auto-populate when a logged-in user or URL params are present.
          Hidden fields are submitted silently without being shown to the respondent.
        </p>
      </div>

      {inputFields.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Add fields to the form first.</p>
      ) : (
        <div className="space-y-3">
          {inputFields.map((field) => (
            <div key={String(field.id)} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium truncate max-w-[160px]">{field.label || `(${field.type})`}</p>
                <button
                  type="button"
                  onClick={() => onFieldChange(field.id, { isHidden: !field.isHidden })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={field.isHidden ? "Show field" : "Hide field"}
                >
                  {field.isHidden
                    ? <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                    : <EyeIcon className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Select
                value={field.memberVarName ?? ""}
                onValueChange={(v) => onFieldChange(field.id, { memberVarName: v || undefined })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="No variable mapping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No mapping</SelectItem>
                  {MEMBER_VARS.map((v) => (
                    <SelectItem key={v.key} value={v.key} className="text-xs">
                      <span className="font-mono">{`{{${v.key}}}`}</span> — {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.memberVarName && (
                <p className="text-xs text-muted-foreground">
                  Auto-filled from <code className="bg-muted px-1 rounded">{`{{${field.memberVarName}}}`}</code>
                  {field.isHidden && <span className="text-amber-600 ml-1">(hidden)</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Separator />
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">URL Parameter Reference</Label>
        <div className="bg-muted rounded p-2 space-y-1">
          {MEMBER_VARS.map((v) => (
            <div key={v.key} className="flex items-center gap-2 text-xs">
              <code className="text-[var(--org-primary)] font-mono">{`?${v.key}=value`}</code>
              <span className="text-muted-foreground">→ {v.description}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Append these to your form URL to pre-populate fields from your LMS, CRM, or email platform.</p>
      </div>
    </div>
  );
}

// ── Integrations Panel ────────────────────────────────────────────────────────

function IntegrationsPanel({ formId, orgId }: { formId: number; orgId: number }) {
  const { data: integrations = [], refetch } = trpc.forms.integrations.list.useQuery(
    { formId },
    { enabled: !!formId }
  );
  const { data: courses = [] } = trpc.lms.courses.list.useQuery(
    { orgId },
    { enabled: !!orgId }
  );
  const upsertMutation = trpc.forms.integrations.upsert.useMutation({
    onSuccess: () => { refetch(); toast.success("Integrations saved"); },
    onError: (e) => toast.error(e.message),
  });

  const [localIntegrations, setLocalIntegrations] = useState<any[]>([]);
  useEffect(() => { setLocalIntegrations(integrations); }, [integrations]);

  const addIntegration = () => {
    setLocalIntegrations((prev) => [
      ...prev,
      { type: "course", action: "enroll", triggerOn: "on_submit", sortOrder: prev.length },
    ]);
  };

  const removeIntegration = (idx: number) => {
    setLocalIntegrations((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateIntegration = (idx: number, patch: any) => {
    setLocalIntegrations((prev) => prev.map((ig, i) => i === idx ? { ...ig, ...patch } : ig));
  };

  const save = () => {
    upsertMutation.mutate({ formId, integrations: localIntegrations });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Link2 className="h-4 w-4" /> Integrations
        </Label>
        <p className="text-xs text-muted-foreground">
          Connect this form to courses, custom pages, or landing pages. Actions trigger automatically on submission.
        </p>
      </div>

      <div className="space-y-3">
        {localIntegrations.map((ig, idx) => (
          <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Integration {idx + 1}</p>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeIntegration(idx)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={ig.type} onValueChange={(v) => updateIntegration(idx, { type: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course"><BookOpen className="h-3.5 w-3.5 inline mr-1" />Course</SelectItem>
                    <SelectItem value="custom_page"><FileText className="h-3.5 w-3.5 inline mr-1" />Custom Page</SelectItem>
                    <SelectItem value="landing_page"><LayoutTemplate className="h-3.5 w-3.5 inline mr-1" />Landing Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Action</Label>
                <Select value={ig.action} onValueChange={(v) => updateIntegration(idx, { action: v })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enroll">Enroll</SelectItem>
                    <SelectItem value="redirect">Redirect</SelectItem>
                    <SelectItem value="tag">Tag Member</SelectItem>
                    <SelectItem value="embed">Embed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trigger</Label>
              <Select value={ig.triggerOn} onValueChange={(v) => updateIntegration(idx, { triggerOn: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_submit">On Submit</SelectItem>
                  <SelectItem value="on_completion">On Completion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ig.type === "course" && (
              <div className="space-y-1">
                <Label className="text-xs">Course</Label>
                <Select
                  value={ig.targetId ? String(ig.targetId) : ""}
                  onValueChange={(v) => updateIntegration(idx, { targetId: parseInt(v) })}
                >
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    {(courses as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)} className="text-xs">{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(ig.type === "custom_page" || ig.type === "landing_page") && (
              <div className="space-y-1">
                <Label className="text-xs">Target URL</Label>
                <Input
                  value={ig.targetUrl ?? ""}
                  onChange={(e) => updateIntegration(idx, { targetUrl: e.target.value })}
                  placeholder="https://..."
                  className="h-7 text-xs"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Label (optional)</Label>
              <Input
                value={ig.label ?? ""}
                onChange={(e) => updateIntegration(idx, { label: e.target.value })}
                placeholder="e.g. Enroll in Intro Course"
                className="h-7 text-xs"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1" onClick={addIntegration}>
          <Plus className="h-3.5 w-3.5" /> Add Integration
        </Button>
        <Button size="sm" className="gap-1.5 text-xs" onClick={save} disabled={upsertMutation.isPending}>
          {upsertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Results sub-panel components ────────────────────────────────────────────

const STATUS_COLORS_INLINE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function FormResultsTable({ formId, fields }: { formId: number; fields: FormField[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [activeFilterId, setActiveFilterId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const pageSize = 50;

  const { data: rawSubmissions, isLoading, refetch } = trpc.forms.submissions.list.useQuery(
    { formId },
    { enabled: !!formId }
  );
  const { data: savedFilters = [] } = trpc.forms.filters.list.useQuery({ formId }, { enabled: !!formId });
  const deleteMutation = trpc.forms.submissions.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Response deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const updateStatusMutation = trpc.forms.updateSubmissionStatus.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const hasScoring = fields.some((f) => (f as any).scoreWeight > 0);
  const allSubmissions: any[] = (rawSubmissions as any[]) ?? [];
  const filtered = allSubmissions.filter((s: any) => {
    if (statusFilter !== "all" && (s.status ?? "pending") !== statusFilter) return false;
    if (!searchTerm) return true;
    const answers = s.answers ? JSON.parse(s.answers) : {};
    return Object.values(answers).some((v) => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const submissions = filtered.slice((page - 1) * pageSize, page * pageSize);
  const inputFields = fields.filter((f) => !NON_INPUT_TYPES.includes(f.type as FieldType));

  const exportCsv = () => {
    const headers = ["#", "Submitted At", ...inputFields.map((f) => f.label || f.type)];
    const rows = submissions.map((s: any, i: number) => {
      const answers = s.answers ? JSON.parse(s.answers) : {};
      return [String(i + 1 + (page - 1) * pageSize), new Date(s.createdAt).toLocaleString(),
        ...inputFields.map((f) => String(answers[String(f.id)] ?? ""))];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `form-${formId}-results.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search responses..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select
          value={activeFilterId ? String(activeFilterId) : "none"}
          onValueChange={(v) => { setActiveFilterId(v === "none" ? null : parseInt(v)); setPage(1); }}
        >
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="No Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Filter</SelectItem>
            {(savedFilters as any[]).map((f: any) => (
              <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        <span className="text-xs text-muted-foreground">{total} result{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No responses yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-8"></th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Ref #</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Submitted</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-24">Status</th>
                {hasScoring && <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-20">Score</th>}
                {inputFields.slice(0, 4).map((f) => (
                  <th key={f.id} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground max-w-[150px]">
                    <span className="truncate block">{f.label || f.type}</span>
                  </th>
                ))}
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {submissions.map((s: any, i: number) => {
                const answers = s.answers ? JSON.parse(s.answers) : {};
                return (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <input type="checkbox" className="rounded" />
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.createdAt ?? s.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={s.status ?? "pending"}
                        onValueChange={(v) => updateStatusMutation.mutate({ submissionId: s.id, status: v as any })}
                      >
                        <SelectTrigger className={`h-6 text-xs border-0 px-2 rounded-full font-medium ${STATUS_COLORS_INLINE[s.status ?? "pending"] ?? ""}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {hasScoring && (
                      <td className="px-3 py-2 text-xs">
                        {s.scoreMax > 0 ? (
                          <span className="font-medium">{s.scoreTotal ?? 0}/{s.scoreMax} ({Math.round(((s.scoreTotal ?? 0) / s.scoreMax) * 100)}%)</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    )}
                    {inputFields.slice(0, 4).map((f) => (
                      <td key={f.id} className="px-3 py-2 text-xs max-w-[150px]">
                        <span className="truncate block">{String(answers[String(f.id)] ?? "")}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: s.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-border flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function FormAnalyticsEmbed({ formId }: { formId: number }) {
  const { data: summaryData, isLoading } = trpc.forms.analytics.summary.useQuery({ formId }, { enabled: !!formId });
  const { data: dropoffData } = trpc.forms.analytics.fieldDropoff.useQuery({ formId }, { enabled: !!formId });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!summaryData) return <p className="text-sm text-muted-foreground">No analytics data yet.</p>;
  const d = summaryData as any;
  const dropoff = (dropoffData as any) ?? [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[{label: "Total Starts", value: d.totalStarts ?? 0}, {label: "Completions", value: d.completions ?? 0}, {label: "Completion Rate", value: `${d.completionRate ?? 0}%`}].map((s) => (
          <div key={s.label} className="border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      {dropoff && dropoff.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-3">Drop-off by Question</p>
          <div className="space-y-2">
            {(dropoff as any[]).map((f: any) => (
              <div key={f.fieldId} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-32 truncate">{f.label}</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${f.viewRate ?? 0}%` }} />
                </div>
                <span className="text-xs w-10 text-right">{f.viewRate ?? 0}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FormFiltersManager({ formId, fields }: { formId: number; fields: FormField[] }) {
  const { data: filters = [], refetch } = trpc.forms.filters.list.useQuery({ formId }, { enabled: !!formId });
  const upsertMutation = trpc.forms.filters.save.useMutation({ onSuccess: () => { refetch(); toast.success("Filter saved"); } });
  const deleteMutation = trpc.forms.filters.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Filter deleted"); } });
  const [newName, setNewName] = useState("");
  const [newField, setNewField] = useState("");
  const [newOp, setNewOp] = useState("equals");
  const [newVal, setNewVal] = useState("");
  const inputFields = fields.filter((f) => !NON_INPUT_TYPES.includes(f.type as FieldType));

  const addFilter = () => {
    if (!newName.trim() || !newField) return;
    upsertMutation.mutate({ formId, name: newName, conditions: JSON.stringify([{ fieldId: newField, operator: newOp, value: newVal }]) } as any);
    setNewName(""); setNewField(""); setNewVal("");
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">New Results Filter</p>
        <Input placeholder="Filter name (e.g. Sales, Compliance, IT)" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <Select value={newField} onValueChange={setNewField}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
            <SelectContent>{inputFields.map((f) => <SelectItem key={String(f.id)} value={String(f.id)} className="text-xs">{f.label || f.type}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={newOp} onValueChange={setNewOp}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["equals","not_equals","contains","not_contains","starts_with","ends_with","is_empty","is_not_empty"].map((o) => <SelectItem key={o} value={o} className="text-xs">{o.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Value" value={newVal} onChange={(e) => setNewVal(e.target.value)} className="text-xs" />
        </div>
        <Button size="sm" onClick={addFilter} disabled={!newName.trim() || !newField} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Filter
        </Button>
      </div>
      <div className="space-y-2">
        {(filters as any[]).map((f: any) => (
          <div key={f.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
            <span className="text-sm font-medium">{f.name}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate({ id: f.id })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormViewsManager({ formId, fields }: { formId: number; fields: FormField[] }) {
  const { data: views = [], refetch } = trpc.forms.views.list.useQuery({ formId }, { enabled: !!formId });
  const upsertMutation = trpc.forms.views.save.useMutation({ onSuccess: () => { refetch(); toast.success("View saved"); } });
  const deleteMutation = trpc.forms.views.delete.useMutation({ onSuccess: () => { refetch(); toast.success("View deleted"); } });
  const [newName, setNewName] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const inputFields = fields.filter((f) => !NON_INPUT_TYPES.includes(f.type as FieldType));

  const toggleField = (id: string) => setSelectedFields((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const saveView = () => {
    if (!newName.trim()) return;
    upsertMutation.mutate({ formId, name: newName, visibleFieldIds: JSON.stringify(selectedFields) } as any);
    setNewName(""); setSelectedFields([]);
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">New Results View</p>
        <Input placeholder="View name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Select columns to show:</p>
          <div className="grid grid-cols-2 gap-1">
            {inputFields.map((f) => (
              <label key={String(f.id)} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={selectedFields.includes(String(f.id))} onChange={() => toggleField(String(f.id))} className="rounded" />
                <span className="truncate">{f.label || f.type}</span>
              </label>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={saveView} disabled={!newName.trim()} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Save View
        </Button>
      </div>
      <div className="space-y-2">
        {(views as any[]).map((v: any) => (
          <div key={v.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
            <span className="text-sm font-medium">{v.name}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate({ id: v.id })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormLabelsManager({ formId, fields }: { formId: number; fields: FormField[] }) {
  const { data: labels = [], refetch } = trpc.forms.labels.list.useQuery({ formId }, { enabled: !!formId });
  const upsertMutation = trpc.forms.labels.save.useMutation({ onSuccess: () => { refetch(); toast.success("Labels saved"); } });
  const [localLabels, setLocalLabels] = useState<Record<string, string>>({});
  const inputFields = fields.filter((f) => !NON_INPUT_TYPES.includes(f.type as FieldType));

  useEffect(() => {
    const map: Record<string, string> = {};
    (labels as any[]).forEach((l: any) => { map[String(l.fieldId)] = l.label; });
    setLocalLabels(map);
  }, [labels]);

  const save = () => {
    const entries = Object.entries(localLabels).filter(([, v]) => v.trim());
    upsertMutation.mutate({ formId, labels: entries.map(([fieldId, label]) => ({ fieldId: parseInt(fieldId), customLabel: label })) } as any);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {inputFields.map((f) => (
          <div key={String(f.id)} className="space-y-1">
            <Label className="text-xs text-muted-foreground">Original: {f.label || f.type}</Label>
            <Input
              placeholder={f.label || f.type}
              value={localLabels[String(f.id)] ?? ""}
              onChange={(e) => setLocalLabels((prev) => ({ ...prev, [String(f.id)]: e.target.value }))}
              className="text-sm"
            />
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={upsertMutation.isPending} className="gap-1.5">
        {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save Labels
      </Button>
    </div>
  );
}

function FormDocsManager({ formId, fields }: { formId: number; fields: FormField[] }) {
  const { data: docs = [], refetch } = trpc.forms.docs.list.useQuery({ formId }, { enabled: !!formId });
  const createMutation = trpc.forms.docs.save.useMutation({ onSuccess: () => { refetch(); toast.success("Doc template saved"); } });
  const deleteMutation = trpc.forms.docs.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Doc deleted"); } });
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const inputFields = fields.filter((f) => !NON_INPUT_TYPES.includes(f.type as FieldType));

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">New Results Doc</p>
        <Input placeholder="Document name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <div className="space-y-1">
          <Label className="text-xs">Template (use merge tags like <code className="bg-muted px-1 rounded">{'{{fieldLabel}}'}</code>)</Label>
          <Textarea
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
            placeholder="Dear {{First Name}},\n\nThank you for submitting the form..."
            className="min-h-[120px] text-sm font-mono"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Available merge tags:</p>
          <div className="flex flex-wrap gap-1">
            {inputFields.map((f) => (
              <Badge key={String(f.id)} variant="outline" className="text-xs cursor-pointer hover:bg-muted"
                onClick={() => setNewTemplate((t) => t + `{{${f.label || f.type}}}`)}
              >
                {`{{${f.label || f.type}}}`}
              </Badge>
            ))}
          </div>
        </div>
        <Button size="sm" onClick={() => { createMutation.mutate({ formId, name: newName, template: newTemplate } as any); setNewName(""); setNewTemplate(""); }} disabled={!newName.trim()} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Save Doc Template
        </Button>
      </div>
      <div className="space-y-2">
        {(docs as any[]).map((d: any) => (
          <div key={d.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">Type: {d.docType ?? "PDF"}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate({ id: d.id })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormReportsPanel({ formId, fields }: { formId: number; fields: FormField[] }) {
  const { data, isLoading } = trpc.forms.analytics.summary.useQuery({ formId }, { enabled: !!formId });
  const choiceFields = fields.filter((f) => ["dropdown", "radio", "checkbox"].includes(f.type));
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data || choiceFields.length === 0) return <p className="text-sm text-muted-foreground">No choice fields to report on yet.</p>;
  const d = data as any;
  const fieldStats: Record<string, Record<string, number>> = d.fieldStats ?? {};
  return (
    <div className="space-y-8">
      {choiceFields.map((f) => {
        const stats = fieldStats[String(f.id)] ?? {};
        const total = Object.values(stats).reduce((a: number, b) => a + (b as number), 0);
        const opts: string[] = (f.options ?? []).map((o: any) => typeof o === "string" ? o : o.label ?? String(o));
        return (
          <div key={String(f.id)} className="space-y-3">
            <p className="text-sm font-semibold">{f.label || f.type}</p>
            <div className="space-y-2">
              {opts.map((opt) => {
                const count = stats[opt] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={opt} className="flex items-center gap-3">
                    <span className="text-xs w-32 truncate">{opt}</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div className="bg-primary h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormExportPanel({ formId, fields }: { formId: number; fields: FormField[] }) {
  const [format, setFormat] = useState("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [delivery, setDelivery] = useState("wait");
  const [deliveryEmail, setDeliveryEmail] = useState("");

  const exportNow = () => {
    const params = new URLSearchParams({ formId: String(formId), format });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    window.open(`/api/forms/export?${params}`, "_blank");
    toast.success("Export started");
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Results format</Label>
        <div className="flex gap-4">
          {[{v:"csv",l:"CSV"},{v:"json",l:"JSON"}].map(({v,l}) => (
            <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="format" value={v} checked={format===v} onChange={() => setFormat(v)} />
              {l}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Restrict by date <span className="text-xs text-muted-foreground">(optional)</span></Label>
        <div className="flex gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-sm" />
          <span className="flex items-center text-muted-foreground text-sm">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-sm" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Data delivery</Label>
        <div className="flex gap-4">
          {[{v:"wait",l:"I'll wait"},{v:"email",l:"Email me at"}].map(({v,l}) => (
            <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="delivery" value={v} checked={delivery===v} onChange={() => setDelivery(v)} />
              {l}
            </label>
          ))}
          {delivery === "email" && (
            <Input
              type="email"
              placeholder="admin@example.com"
              value={deliveryEmail}
              onChange={(e) => setDeliveryEmail(e.target.value)}
              className="text-sm h-7 w-48"
            />
          )}
        </div>
      </div>
      <Button onClick={exportNow} className="gap-1.5">
        <Download className="h-4 w-4" /> Export Results
      </Button>
    </div>
  );
}

function FormScheduledExportsPanel({ formId }: { formId: number }) {
  const { data: exports = [], refetch } = trpc.forms.scheduledExports.list.useQuery({ formId }, { enabled: !!formId });
  const createMutation = trpc.forms.scheduledExports.save.useMutation({ onSuccess: () => { refetch(); toast.success("Scheduled export created"); } });
  const deleteMutation = trpc.forms.scheduledExports.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Deleted"); } });
  const [freq, setFreq] = useState("daily");
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium">New Scheduled Export</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Frequency</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Deliver to email</Label>
            <Input type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="text-xs" />
          </div>
        </div>
        <Button size="sm" onClick={() => createMutation.mutate({ formId, frequency: freq, deliveryEmail: email } as any)} disabled={!email.trim()} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Schedule Export
        </Button>
      </div>
      <div className="space-y-2">
        {(exports as any[]).map((e: any) => (
          <div key={e.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium">{e.frequency} export</p>
              <p className="text-xs text-muted-foreground">{e.deliveryEmail}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate({ id: e.id })}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormImportPanel({ formId, fields }: { formId: number; fields: FormField[] }) {
  const [csvText, setCsvText] = useState("");
  const importMutation = trpc.forms.importResults.useMutation({
    onSuccess: (d: any) => toast.success(`Imported ${d.count ?? 0} responses`),
    onError: (e: any) => toast.error(e.message),
  });
  const inputFields = fields.filter((f) => !NON_INPUT_TYPES.includes(f.type as FieldType));

  const handleImport = () => {
    if (!csvText.trim()) return;
    importMutation.mutate({ formId, csv: csvText } as any);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Expected CSV columns (in order):</p>
        <div className="bg-muted rounded p-2 text-xs font-mono">
          {inputFields.map((f) => f.label || f.type).join(", ")}
        </div>
      </div>
      <Textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder={`${inputFields.map((f) => f.label || f.type).join(",")}\nJohn Doe,john@example.com,...`}
        className="min-h-[200px] text-xs font-mono"
      />
      <Button onClick={handleImport} disabled={!csvText.trim() || importMutation.isPending} className="gap-1.5">
        {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Import Responses
      </Button>
    </div>
  );
}

function FormDeleteResultsPanel({ formId, onDeleted }: { formId: number; onDeleted: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const deleteMutation = trpc.forms.submissions.delete.useMutation({
    onSuccess: () => { toast.success("All responses deleted"); onDeleted(); setConfirmed(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-destructive">Delete All Results</p>
            <p className="text-sm text-muted-foreground mt-1">
              This will permanently delete all responses for this form. This action cannot be undone.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="rounded" />
          I understand this action is permanent and cannot be undone
        </label>
        <Button
          variant="destructive"
          onClick={() => deleteMutation.mutate({ id: -1, formId } as any)}
          disabled={!confirmed || deleteMutation.isPending}
          className="gap-1.5"
        >
          {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete All Results
        </Button>
      </div>
    </div>
  );
}

// ── Main FormBuilderPage ──────────────────────────────────────────────────────

export default function FormBuilderPage() {
  const params = useParams<{ id: string }>();
  const formId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const [fields, setFields] = useState<FormField[]>([]);
  const [rules, setRules] = useState<BranchingRule[]>([]);
  const [formSettings, setFormSettings] = useState<any>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | number | null>(null);
  // Top-level tabs: form-editor | form-settings | share | results
  const [activeTopTab, setActiveTopTab] = useState("form-editor");
  // Sub-tabs within each top-level tab
  const [editorSubTab, setEditorSubTab] = useState("build");
  const [settingsSubTab, setSettingsSubTab] = useState("description");
  const [shareSubTab, setShareSubTab] = useState("links");
  const [resultsSubTab, setResultsSubTab] = useState("results-table");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [importUrlOpen, setImportUrlOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importPreview, setImportPreview] = useState<{ title: string; description: string; fields: any[] } | null>(null);

  // AI Generate state
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPreview, setAiPreview] = useState<{ title: string; description: string; fields: any[] } | null>(null);

  const generateFromPromptMutation = trpc.forms.generateFromPrompt.useMutation({
    onSuccess: (data) => { setAiPreview(data); },
    onError: (e) => toast.error(e.message),
  });

  const handleApplyAiGenerate = () => {
    if (!aiPreview) return;
    if (!formSettings?.title || formSettings.title === "Untitled Form") {
      setFormSettings((s: any) => ({ ...s, title: aiPreview.title, description: aiPreview.description }));
    }
    const newFields = aiPreview.fields.map((f: any, i: number) => ({
      id: newTempId(),
      type: f.type as FieldType,
      label: f.label,
      placeholder: f.placeholder ?? "",
      required: f.required,
      sortOrder: fields.length + i,
      options: f.options ?? [],
      isBranchingSource: false,
    }));
    setFields((prev) => [...prev, ...newFields]);
    markDirty();
    setAiGenerateOpen(false);
    setAiPreview(null);
    setAiPrompt("");
    toast.success(`Added ${newFields.length} AI-generated field${newFields.length !== 1 ? "s" : ""} to form`);
  };

  const importFromUrlMutation = trpc.forms.importFromUrl.useMutation({
    onSuccess: (data) => {
      setImportPreview(data);
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const handleApplyImport = () => {
    if (!importPreview) return;
    // Optionally update form title/description if they are empty
    if (!formSettings?.title || formSettings.title === "Untitled Form") {
      setFormSettings((s: any) => ({ ...s, title: importPreview.title, description: importPreview.description }));
    }
    // Append imported fields to existing fields
    const newFields = importPreview.fields.map((f: any) => ({
      id: newTempId(),
      type: f.type as FieldType,
      label: f.label,
      placeholder: f.placeholder ?? "",
      required: f.required,
      sortOrder: fields.length + f.sortOrder,
      options: f.options ?? [],
      isBranchingSource: false,
    }));
    setFields((prev) => [...prev, ...newFields]);
    markDirty();
    setImportUrlOpen(false);
    setImportPreview(null);
    setImportUrl("");
    toast.success(`Imported ${newFields.length} field${newFields.length !== 1 ? "s" : ""} from URL`);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: formData, isLoading, refetch } = trpc.forms.get.useQuery(
    { id: formId },
    { enabled: !!formId }
  );

  const { data: orgCtx } = trpc.orgs.myContext.useQuery();
  const orgId = orgCtx?.org?.id;

  const { data: emailAccess } = trpc.forms.emailAccessCheck.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const updateMutation = trpc.forms.update.useMutation();
  const upsertFieldsMutation = trpc.forms.fields.upsert.useMutation();
  const upsertRulesMutation = trpc.forms.rules.upsert.useMutation();

  // Populate local state from server data
  useEffect(() => {
    if (!formData) return;
    setFormSettings({
      title: formData.title,
      description: formData.description,
      status: formData.status,
      notifyEmails: formData.notifyEmails,
      notifyOrgAdmin: formData.notifyOrgAdmin,
      notifyRespondent: formData.notifyRespondent,
      sendConfirmation: formData.sendConfirmation,
      confirmationEmailField: formData.confirmationEmailField,
      confirmationSubject: formData.confirmationSubject,
      confirmationBody: formData.confirmationBody,
      successMessage: formData.successMessage,
      redirectUrl: formData.redirectUrl,
      requireLogin: formData.requireLogin,
      allowMultipleSubmissions: formData.allowMultipleSubmissions,
      primaryColor: formData.primaryColor,
    });
    setFields(
      (formData.fields ?? []).map((f: any) => ({
        ...f,
        options: f.options ?? [],
      }))
    );
    setRules((formData.rules ?? []).map((r: any) => ({
      ...r,
      operator: r.operator as BranchingRule["operator"],
      action: r.action as BranchingRule["action"],
    })));
    setIsDirty(false);
  }, [formData]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleFieldChange = (id: string | number, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f) => (String(f.id) === String(id) ? { ...f, ...patch } : f)));
    markDirty();
  };

  const handleAddField = (type: FieldType) => {
    const newField: FormField = {
      id: newTempId(),
      type,
      label: type === "info" ? "Information" : type === "richtext" ? "Rich Text Block" : type === "scale" ? "Rating" : "",
      required: false,
      sortOrder: fields.length,
      options: CHOICE_TYPES.includes(type)
        ? [
            { value: "option_1", label: "Option 1", scoreValue: 0 },
            { value: "option_2", label: "Option 2", scoreValue: 0 },
          ]
        : [],
      isBranchingSource: false,
      ...(type === "scale" ? { scaleMin: 1, scaleMax: 5, scaleMinLabel: "", scaleMaxLabel: "" } : {}),
      ...(type === "richtext" || type === "info" ? { richTextContent: "" } : {}),
      scoreWeight: 0,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    markDirty();
  };

  const handleDeleteField = (id: string | number) => {
    setFields((prev) => prev.filter((f) => String(f.id) !== String(id)));
    setRules((prev) =>
      prev.filter(
        (r) => String(r.sourceFieldId) !== String(id) && String(r.targetFieldId) !== String(id)
      )
    );
    if (String(selectedFieldId) === String(id)) setSelectedFieldId(null);
    markDirty();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => String(f.id) === String(active.id));
      const newIndex = prev.findIndex((f) => String(f.id) === String(over.id));
      return arrayMove(prev, oldIndex, newIndex).map((f, i) => ({ ...f, sortOrder: i }));
    });
    markDirty();
  };

  const handleSave = async () => {
    if (!formId) return;
    setIsSaving(true);
    try {
      // Save form settings
      const { notifyEmails, notifyOrgAdmin, notifyRespondent, ...rest } = formSettings;
      const emails = notifyEmails ? JSON.parse(notifyEmails) : [];
      await updateMutation.mutateAsync({ id: formId, ...rest, notifyEmails: emails, notifyOrgAdmin, notifyRespondent });

      // Save fields
      const fieldPayload = fields.map((f, i) => ({
        id: typeof f.id === "number" && f.id > 0 ? f.id : undefined,
        type: f.type,
        label: f.label || "Untitled",
        placeholder: f.placeholder,
        helpText: f.helpText,
        required: f.required,
        sortOrder: i,
        options: f.options,
        minLength: f.minLength,
        maxLength: f.maxLength,
        isBranchingSource: f.isBranchingSource,
        scaleMin: f.scaleMin,
        scaleMax: f.scaleMax,
        scaleMinLabel: f.scaleMinLabel,
        scaleMaxLabel: f.scaleMaxLabel,
        richTextContent: f.richTextContent,
        emailRoutingRules: f.emailRoutingRules,
        scoreWeight: f.scoreWeight,
      }));
      await upsertFieldsMutation.mutateAsync({ formId, fields: fieldPayload });

      // Refetch to get real IDs for new fields, then save rules
      const refreshed = await refetch();
      const savedFields = refreshed.data?.fields ?? [];
      const fieldIdMap: Record<string, number> = {};
      savedFields.forEach((sf: any, i: number) => {
        const orig = fields[i];
        if (orig) fieldIdMap[String(orig.id)] = sf.id;
      });

      const rulePayload = rules.map((r, i) => ({
        id: typeof r.id === "number" ? r.id : undefined,
        sourceFieldId: fieldIdMap[String(r.sourceFieldId)] ?? (typeof r.sourceFieldId === "number" ? r.sourceFieldId : 0),
        operator: r.operator,
        value: r.value,
        action: r.action,
        targetFieldId: r.targetFieldId
          ? (fieldIdMap[String(r.targetFieldId)] ?? (typeof r.targetFieldId === "number" ? r.targetFieldId : undefined))
          : undefined,
        sortOrder: i,
      })).filter((r) => r.sourceFieldId > 0);

      await upsertRulesMutation.mutateAsync({ formId, rules: rulePayload });

      setIsDirty(false);
      toast.success("Form saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedField = fields.find((f) => String(f.id) === String(selectedFieldId));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Form not found.</p>
        <Button onClick={() => setLocation("/lms/forms")}>Back to Forms</Button>
      </div>
    );
  }

  // Helper to update form settings
  const updateFormSettings = (patch: any) => {
    setFormSettings((s: any) => {
      const updated = { ...s };
      if ("notifyEmails" in patch && Array.isArray(patch.notifyEmails)) {
        updated.notifyEmails = JSON.stringify(patch.notifyEmails);
      } else {
        Object.assign(updated, patch);
      }
      return updated;
    });
    markDirty();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── FormSite-style top navigation ── */}
      <header className="border-b border-border bg-background z-30 shrink-0">
        {/* Row 1: form name + status + actions */}
        <div className="px-4 h-12 flex items-center gap-3">
          {/* Form name with back link */}
          <button
            onClick={() => setLocation("/lms/forms")}
            className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary transition-colors min-w-0 max-w-xs"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">{formSettings?.title || "Untitled Form"}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>

          <div className="flex-1" />

          {/* Status selector */}
          {formSettings && (
            <Select
              value={formSettings.status}
              onValueChange={(v) => { setFormSettings((s: any) => ({ ...s, status: v })); markDirty(); }}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Save button */}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            variant={isDirty ? "default" : "outline"}
            className="gap-1.5 h-7 text-xs"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {isSaving ? "Saving..." : isDirty ? "Save" : "Saved"}
          </Button>

          {/* AI Generate */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAiGenerateOpen(true); setAiPreview(null); setAiPrompt(""); }}
            className="gap-1.5 h-7 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Generate
          </Button>

          {/* Import from URL */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setImportUrlOpen(true); setImportPreview(null); setImportUrl(""); }}
            className="gap-1.5 h-7 text-xs"
          >
            <Link2 className="h-3.5 w-3.5" />
            Import from URL
          </Button>

          {/* View Form */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const orgSlug = orgCtx?.org?.slug;
              const url = orgSlug ? `${getOrgBaseUrl(orgSlug)}/forms/${formData.slug}` : `/forms/${formData.slug}`;
              window.open(url, "_blank");
            }}
            className="gap-1.5 h-7 text-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            View Form
          </Button>
        </div>

        {/* Row 2: top-level tabs */}
        <div className="px-4 flex items-end gap-0 border-t border-border">
          {([
            { id: "form-editor", label: "Form Editor" },
            { id: "form-settings", label: "Form Settings" },
            { id: "share", label: "Share" },
            { id: "results", label: "Results" },
          ] as { id: string; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTopTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTopTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Form Editor tab ── */}
      {activeTopTab === "form-editor" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Field Palette + sub-tabs */}
          <aside className="w-56 border-r border-border bg-muted/20 flex flex-col shrink-0">
            {/* Build / Style / Rules sub-tabs */}
            <div className="flex border-b border-border">
              {(["Build", "Style", "Rules"] as const).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setEditorSubTab(sub.toLowerCase())}
                  className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                    editorSubTab === sub.toLowerCase()
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {editorSubTab === "build" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Add Field</p>
                {["Text", "Choice", "Layout"].map((group) => (
                  <div key={group} className="space-y-1">
                    <p className="text-xs text-muted-foreground px-1">{group}</p>
                    {FIELD_TYPES.filter((t) => t.group === group).map((ft) => (
                      <button
                        key={ft.type}
                        onClick={() => handleAddField(ft.type)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-primary/10 hover:text-primary transition-colors text-left"
                      >
                        <span className="text-muted-foreground">{ft.icon}</span>
                        {ft.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {editorSubTab === "style" && (
              <div className="flex-1 overflow-y-auto p-3">
                {formSettings && (
                  <BrandingPanel
                    formId={formId}
                    orgId={orgId!}
                    formSettings={formSettings}
                    onUpdate={updateFormSettings}
                  />
                )}
              </div>
            )}

            {editorSubTab === "rules" && (
              <div className="flex-1 overflow-y-auto p-3">
                <BranchingRulesEditor
                  fields={fields}
                  rules={rules}
                  onChange={(r) => { setRules(r); markDirty(); }}
                />
              </div>
            )}
          </aside>

          {/* Center: Form Canvas */}
          <main className="flex-1 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto space-y-2">
              {/* Form header preview */}
              {formSettings?.headerImageUrl && (
                <div className="mb-2 rounded-xl overflow-hidden border border-border">
                  <img src={formSettings.headerImageUrl} alt="Header" className="w-full h-32 object-cover" />
                </div>
              )}
              <div className="mb-6 p-4 rounded-xl border border-border bg-card">
                <h2 className="text-lg font-bold">{formSettings?.title || "Untitled Form"}</h2>
                {formSettings?.description && (
                  <p className="text-sm text-muted-foreground mt-1">{formSettings.description}</p>
                )}
              </div>

              {fields.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Click a field type in the left panel to add your first question.
                  </p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={fields.map((f) => String(f.id))} strategy={verticalListSortingStrategy}>
                    {fields.map((field) => (
                      <SortableFieldRow
                        key={String(field.id)}
                        field={field}
                        isSelected={String(selectedFieldId) === String(field.id)}
                        onSelect={() => setSelectedFieldId(field.id)}
                        onDelete={() => handleDeleteField(field.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </main>

          {/* Right: Field editor panel (only when a field is selected) */}
          {selectedField && (
            <aside className="w-72 border-l border-border bg-background overflow-y-auto shrink-0 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Field Properties</p>
                <button onClick={() => setSelectedFieldId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <FieldEditor
                field={selectedField}
                onChange={(patch) => handleFieldChange(selectedField.id, patch)}
              />
            </aside>
          )}
        </div>
      )}

      {/* ── Form Settings tab ── */}
      {activeTopTab === "form-settings" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <aside className="w-56 border-r border-border bg-muted/20 overflow-y-auto shrink-0 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Form Settings</p>
            <nav className="space-y-0.5">
              {([
                { id: "description", label: "Description", parent: "General" },
                { id: "open-close", label: "Open / Close", parent: "General" },
                { id: "security", label: "Security", parent: "General" },
                { id: "notifications", label: "Notifications", parent: null },
                { id: "success-pages", label: "Success Pages", parent: null },
                { id: "custom-text", label: "Custom Text", parent: null },
                { id: "member-variables", label: "Member Variables", parent: null },
                { id: "integrations", label: "Integrations", parent: null },
              ] as { id: string; label: string; parent: string | null }[]).map((item, idx, arr) => {
                const prevParent = idx > 0 ? arr[idx - 1].parent : null;
                return (
                  <div key={item.id}>
                    {item.parent && item.parent !== prevParent && (
                      <p className="text-xs text-muted-foreground px-2 pt-3 pb-1 font-medium">{item.parent}</p>
                    )}
                    <button
                      onClick={() => setSettingsSubTab(item.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                        settingsSubTab === item.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {item.label}
                    </button>
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* Right: content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl">
              {settingsSubTab === "description" && formSettings && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Description</h2>
                    <p className="text-sm text-muted-foreground">Form name and description.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Form name</Label>
                    <Input
                      value={formSettings.title ?? ""}
                      onChange={(e) => updateFormSettings({ title: e.target.value })}
                      placeholder="My Form"
                    />
                  </div>
                   <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      value={formSettings.description ?? ""}
                      onChange={(e) => updateFormSettings({ description: e.target.value })}
                      placeholder="Describe what this form is for..."
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custom URL Slug</Label>
                    <p className="text-xs text-muted-foreground">Customize the public URL for this form. Only lowercase letters, numbers, and hyphens.</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">/f/</span>
                      <Input
                        value={formSettings.slug ?? ""}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                          updateFormSettings({ slug: val });
                        }}
                        placeholder="my-form-slug"
                        className="font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Current URL: <span className="font-mono text-foreground">{window.location.origin}/f/{formSettings.slug}</span></p>
                  </div>
                </div>
              )}
              {settingsSubTab === "open-close" && formSettings && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Open / Close</h2>
                    <p className="text-sm text-muted-foreground">Control when this form accepts responses.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={formSettings.status}
                      onValueChange={(v) => updateFormSettings({ status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft — not visible to respondents</SelectItem>
                        <SelectItem value="published">Published — accepting responses</SelectItem>
                        <SelectItem value="closed">Closed — no longer accepting responses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {settingsSubTab === "security" && formSettings && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Security</h2>
                    <p className="text-sm text-muted-foreground">Control who can submit this form.</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="font-medium">Require Login</p>
                      <p className="text-sm text-muted-foreground">Only logged-in members can submit</p>
                    </div>
                    <Switch
                      checked={formSettings.requireLogin ?? false}
                      onCheckedChange={(v) => updateFormSettings({ requireLogin: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="font-medium">Allow Multiple Submissions</p>
                      <p className="text-sm text-muted-foreground">Same person can submit more than once</p>
                    </div>
                    <Switch
                      checked={formSettings.allowMultipleSubmissions ?? true}
                      onCheckedChange={(v) => updateFormSettings({ allowMultipleSubmissions: v })}
                    />
                  </div>
                </div>
              )}

              {settingsSubTab === "notifications" && formSettings && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Notifications</h2>
                    <p className="text-sm text-muted-foreground">Configure who receives emails when a response is submitted.</p>
                  </div>
                  <EmailRoutingPanel
                    form={formSettings}
                    fields={fields}
                    hasEmailAccess={emailAccess?.hasAccess ?? false}
                    onUpdate={updateFormSettings}
                  />
                </div>
              )}

              {settingsSubTab === "success-pages" && formSettings && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Success Pages</h2>
                    <p className="text-sm text-muted-foreground">What happens after a respondent submits the form.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Success Message</Label>
                    <Textarea
                      value={formSettings.successMessage ?? ""}
                      onChange={(e) => updateFormSettings({ successMessage: e.target.value })}
                      placeholder="Thank you for your response!"
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Redirect URL <span className="text-muted-foreground text-xs">(optional — overrides success message)</span></Label>
                    <Input
                      value={formSettings.redirectUrl ?? ""}
                      onChange={(e) => updateFormSettings({ redirectUrl: e.target.value })}
                      placeholder="https://example.com/thank-you"
                    />
                  </div>
                </div>
              )}

              {settingsSubTab === "custom-text" && formSettings && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Custom Text</h2>
                    <p className="text-sm text-muted-foreground">Customize button labels and other text shown to respondents.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Submit Button Label</Label>
                    <Input placeholder="Submit" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Next Button Label</Label>
                    <Input placeholder="Next" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Previous Button Label</Label>
                    <Input placeholder="Previous" />
                  </div>
                </div>
              )}

              {settingsSubTab === "member-variables" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Member Variables</h2>
                    <p className="text-sm text-muted-foreground">Map fields to member data for auto-population.</p>
                  </div>
                  <MemberVarsPanel
                    fields={fields}
                    onFieldChange={(id, patch) => { handleFieldChange(id, patch); }}
                  />
                </div>
              )}

              {settingsSubTab === "integrations" && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Integrations</h2>
                    <p className="text-sm text-muted-foreground">Connect this form to courses, pages, and other platform features.</p>
                  </div>
                  <IntegrationsPanel formId={formId} orgId={orgId!} />
                </div>
              )}

              {/* Save button at bottom of settings */}
              <div className="mt-8 pt-4 border-t border-border">
                <Button onClick={handleSave} disabled={isSaving || !isDirty} className="gap-1.5">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ── Share tab ── */}
      {activeTopTab === "share" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <aside className="w-56 border-r border-border bg-muted/20 overflow-y-auto shrink-0 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Share</p>
            <nav className="space-y-0.5">
              {([
                { id: "links", label: "Links" },
                { id: "preview", label: "Preview" },
                { id: "embed-code", label: "Embed Code" },
                { id: "qr-code", label: "QR Code" },
              ] as { id: string; label: string }[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setShareSubTab(item.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    shareSubTab === item.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Right: content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl">
              {formSettings && <SharePanel form={{ ...formData, ...formSettings }} activeTab={shareSubTab} orgSlug={orgCtx?.org?.slug} onSlugSaved={(newSlug: string) => { setFormSettings((s: any) => ({ ...s, slug: newSlug })); }} />}
            </div>
          </main>
        </div>
      )}

      {/* ── Results tab ── */}
      {activeTopTab === "results" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <aside className="w-56 border-r border-border bg-muted/20 overflow-y-auto shrink-0 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Results</p>
            <nav className="space-y-0.5">
              {([
                { id: "results-table", label: "Results Table" },
                { id: "analytics", label: "Analytics" },
                { id: "results-filters", label: "Results Filters" },
                { id: "results-views", label: "Results Views" },
                { id: "results-labels", label: "Results Labels" },
                { id: "results-docs", label: "Results Docs" },
                { id: "results-reports", label: "Results Reports" },
                { id: "export", label: "Export" },
                { id: "scheduled-exports", label: "Scheduled Exports" },
                { id: "import", label: "Import" },
                { id: "delete-results", label: "Delete Results" },
              ] as { id: string; label: string }[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setResultsSubTab(item.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    resultsSubTab === item.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Right: content */}
          <main className="flex-1 overflow-y-auto">
            {resultsSubTab === "results-table" && (
              <FormResultsTable formId={formId} fields={fields} />
            )}
            {resultsSubTab === "analytics" && (
              <div className="p-6">
                <div className="max-w-4xl">
                  <h2 className="text-lg font-semibold mb-1">Analytics</h2>
                  <p className="text-sm text-muted-foreground mb-6">Completion rates, drop-off, and response trends.</p>
                  <FormAnalyticsEmbed formId={formId} />
                </div>
              </div>
            )}
            {resultsSubTab === "results-filters" && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-1">Results Filters</h2>
                  <p className="text-sm text-muted-foreground mb-6">Apply a search when viewing results.</p>
                  <FormFiltersManager formId={formId} fields={fields} />
                </div>
              </div>
            )}
            {resultsSubTab === "results-views" && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-1">Results Views</h2>
                  <p className="text-sm text-muted-foreground mb-6">Save column visibility configurations.</p>
                  <FormViewsManager formId={formId} fields={fields} />
                </div>
              </div>
            )}
            {resultsSubTab === "results-labels" && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-1">Results Labels</h2>
                  <p className="text-sm text-muted-foreground mb-6">Customize display labels for field headers in the results table.</p>
                  <FormLabelsManager formId={formId} fields={fields} />
                </div>
              </div>
            )}
            {resultsSubTab === "results-docs" && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-1">Results Docs</h2>
                  <p className="text-sm text-muted-foreground mb-6">Format results into PDF or DOCX files using merge tags.</p>
                  <FormDocsManager formId={formId} fields={fields} />
                </div>
              </div>
            )}
            {resultsSubTab === "results-reports" && (
              <div className="p-6">
                <div className="max-w-4xl">
                  <h2 className="text-lg font-semibold mb-1">Results Reports</h2>
                  <p className="text-sm text-muted-foreground mb-6">Aggregate charts per question.</p>
                  <FormReportsPanel formId={formId} fields={fields} />
                </div>
              </div>
            )}
            {resultsSubTab === "export" && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-1">Export</h2>
                  <p className="text-sm text-muted-foreground mb-6">Export results to save them outside of your account.</p>
                  <FormExportPanel formId={formId} fields={fields} />
                </div>
              </div>
            )}
            {resultsSubTab === "scheduled-exports" && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-1">Scheduled Exports</h2>
                  <p className="text-sm text-muted-foreground mb-6">Set up recurring automatic exports.</p>
                  <FormScheduledExportsPanel formId={formId} />
                </div>
              </div>
            )}
            {resultsSubTab === "import" && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-1">Import</h2>
                  <p className="text-sm text-muted-foreground mb-6">Bulk import submissions from a CSV file.</p>
                  <FormImportPanel formId={formId} fields={fields} />
                </div>
              </div>
            )}
            {resultsSubTab === "delete-results" && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <h2 className="text-lg font-semibold mb-1">Delete Results</h2>
                  <p className="text-sm text-muted-foreground mb-6">Permanently remove submissions from this form.</p>
                  <FormDeleteResultsPanel formId={formId} onDeleted={() => { refetch(); }} />
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ── AI Generate Dialog ── */}
      <Dialog open={aiGenerateOpen} onOpenChange={(o) => { setAiGenerateOpen(o); if (!o) { setAiPreview(null); setAiPrompt(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Generate Fields
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!aiPreview ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Describe the form you want to build. AI will generate appropriate fields that you can add to your form.
                </p>
                <Textarea
                  placeholder="e.g. A post-event feedback form asking about session quality, speaker effectiveness, venue, and what attendees would improve next time."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAiGenerateOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => generateFromPromptMutation.mutate({ prompt: aiPrompt })}
                    disabled={aiPrompt.trim().length < 10 || generateFromPromptMutation.isPending}
                    className="gap-1.5"
                  >
                    {generateFromPromptMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Generating...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" />Generate</>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Generated form</p>
                    <p className="font-semibold text-sm">{aiPreview.title}</p>
                    {aiPreview.description && <p className="text-xs text-muted-foreground mt-0.5">{aiPreview.description}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{aiPreview.fields.length} field{aiPreview.fields.length !== 1 ? "s" : ""} generated</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {aiPreview.fields.map((f: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-muted rounded px-2.5 py-1.5">
                          <span className="font-mono text-muted-foreground w-20 shrink-0">{f.type}</span>
                          <span className="font-medium truncate">{f.label}</span>
                          {f.required && <span className="ml-auto text-red-500 shrink-0">required</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setAiPreview(null); }} className="flex-1">
                    Regenerate
                  </Button>
                  <Button size="sm" onClick={handleApplyAiGenerate} className="flex-1 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Add {aiPreview.fields.length} Field{aiPreview.fields.length !== 1 ? "s" : ""} to Form
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import from URL Dialog ── */}
      <Dialog open={importUrlOpen} onOpenChange={(o) => { setImportUrlOpen(o); if (!o) { setImportPreview(null); setImportUrl(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Import Form from URL
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste the URL of any web page containing a form. Teachific will extract the fields automatically using AI.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/contact"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && importUrl && !importFromUrlMutation.isPending) importFromUrlMutation.mutate({ url: importUrl }); }}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <Button
                onClick={() => importFromUrlMutation.mutate({ url: importUrl })}
                disabled={!importUrl || importFromUrlMutation.isPending}
                className="shrink-0"
              >
                {importFromUrlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Extract"}
              </Button>
            </div>

            {importPreview && (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Detected form</p>
                  <p className="font-semibold text-sm">{importPreview.title}</p>
                  {importPreview.description && <p className="text-xs text-muted-foreground mt-0.5">{importPreview.description}</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{importPreview.fields.length} field{importPreview.fields.length !== 1 ? "s" : ""} found</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {importPreview.fields.map((f: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted rounded px-2.5 py-1.5">
                        <span className="font-mono text-muted-foreground w-16 shrink-0">{f.type}</span>
                        <span className="font-medium truncate">{f.label}</span>
                        {f.required && <span className="ml-auto text-red-500 shrink-0">required</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setImportPreview(null); setImportUrl(""); }} className="flex-1">
                    Try Another URL
                  </Button>
                  <Button size="sm" onClick={handleApplyImport} className="flex-1">
                    Add {importPreview.fields.length} Field{importPreview.fields.length !== 1 ? "s" : ""} to Form
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
