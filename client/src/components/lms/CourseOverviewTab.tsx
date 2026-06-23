/**
 * CourseOverviewTab — Teachable-style course pre-start page editor
 *
 * Allows instructors to configure:
 * - What You'll Learn (bullet list)
 * - Requirements / Prerequisites (bullet list)
 * - Target Audience (bullet list)
 * - Instructor Bio (rich text)
 * - Enable/disable the pre-start overview page
 *
 * Data is stored as JSON arrays in the course's whatYouLearn, requirements,
 * targetAudience columns, and plain text in instructorBio.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, GraduationCap, ListChecks, Users, User, Eye, EyeOff, Save } from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: number;
  title: string;
  whatYouLearn?: string | null;
  requirements?: string | null;
  targetAudience?: string | null;
  instructorBio?: string | null;
  preStartPageEnabled?: boolean;
  thumbnailUrl?: string | null;
  shortDescription?: string | null;
}

interface SaveData {
  preStartPageEnabled?: boolean;
  whatYouLearn?: string;
  requirements?: string;
  targetAudience?: string;
  instructorBio?: string;
}

interface Props {
  course: Course;
  onSave: (data: SaveData) => void;
}

function parseList(json: string | null | undefined): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function BulletListEditor({
  label,
  icon: Icon,
  description,
  items,
  placeholder,
  onChange,
}: {
  label: string;
  icon: React.ElementType;
  description: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setDraft("");
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 group">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="flex-1 text-sm">{item}</span>
                <button
                  onClick={() => remove(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder={placeholder}
            className="text-sm"
          />
          <Button size="sm" variant="outline" onClick={add} disabled={!draft.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No items yet — type above and press Enter or click +</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function CourseOverviewTab({ course, onSave }: Props) {
  const [enabled, setEnabled] = useState(course.preStartPageEnabled ?? true);
  const [whatYouLearn, setWhatYouLearn] = useState<string[]>(parseList(course.whatYouLearn));
  const [requirements, setRequirements] = useState<string[]>(parseList(course.requirements));
  const [targetAudience, setTargetAudience] = useState<string[]>(parseList(course.targetAudience));
  const [instructorBio, setInstructorBio] = useState(course.instructorBio ?? "");
  const [saving, setSaving] = useState(false);

  // Sync if course prop changes
  useEffect(() => {
    setEnabled(course.preStartPageEnabled ?? true);
    setWhatYouLearn(parseList(course.whatYouLearn));
    setRequirements(parseList(course.requirements));
    setTargetAudience(parseList(course.targetAudience));
    setInstructorBio(course.instructorBio ?? "");
  }, [course.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      onSave({
        preStartPageEnabled: enabled,
        whatYouLearn: JSON.stringify(whatYouLearn),
        requirements: JSON.stringify(requirements),
        targetAudience: JSON.stringify(targetAudience),
        instructorBio,
      });
      toast.success("Overview page saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Course Overview Page</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            This page is shown to students before they start the course — like a Teachable landing page.
            It displays what they'll learn, requirements, and instructor info.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {enabled ? (
            <Badge variant="default" className="gap-1 text-xs">
              <Eye className="h-3 w-3" /> Visible
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-xs">
              <EyeOff className="h-3 w-3" /> Hidden
            </Badge>
          )}
        </div>
      </div>

      {/* Enable toggle */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Show Overview Page</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, students see this overview before accessing course content.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* What You'll Learn */}
      <BulletListEditor
        label="What You'll Learn"
        icon={GraduationCap}
        description="List the key outcomes students will achieve by completing this course."
        items={whatYouLearn}
        placeholder="e.g. Understand the core principles of workplace compliance"
        onChange={setWhatYouLearn}
      />

      {/* Requirements */}
      <BulletListEditor
        label="Requirements / Prerequisites"
        icon={ListChecks}
        description="List any prior knowledge, tools, or skills students need before starting."
        items={requirements}
        placeholder="e.g. Basic anatomy knowledge"
        onChange={setRequirements}
      />

      {/* Target Audience */}
      <BulletListEditor
        label="Who This Course Is For"
        icon={Users}
        description="Describe who will benefit most from this course."
        items={targetAudience}
        placeholder="e.g. Sonographers looking to advance their skills"
        onChange={setTargetAudience}
      />

      {/* Instructor Bio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Instructor Bio
          </CardTitle>
          <CardDescription className="text-xs">
            A short bio shown on the overview page. Helps students connect with the instructor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instructorBio}
            onChange={(e) => setInstructorBio(e.target.value)}
            placeholder="e.g. Lara Williams is a registered educator with 15+ years of clinical experience..."
            rows={5}
            className="text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1.5">{instructorBio.length} characters</p>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Overview"}
        </Button>
      </div>
    </div>
  );
}
