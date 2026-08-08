/**
 * CmeDisclosureForm.tsx
 * Public electronic Financial Disclosure Form for CME faculty.
 * Accessible at /cme-disclosure/:token (no login required).
 * Matches CardioServ ACCME format with joint provider statement.
 * Org-generic: uses orgName from the disclosure record.
 */
import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, FileText, Plus, Trash2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Relationship {
  company: string;
  relationship: string;
  ended: boolean;
}

const ROLES = [
  "Teacher / Instructor / Faculty",
  "Planner",
  "Reviewer / Evaluator",
  "Author / Developer",
  "Committee Member",
  "Other",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CmeDisclosureForm() {
  const { token: routeToken } = useParams<{ token: string }>();
  const token = routeToken ?? "";

  const { data, isLoading, error } = trpc.cmeDisclosure.getDisclosureByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [hasRelationships, setHasRelationships] = useState<"yes" | "no">("yes");
  const [relationships, setRelationships] = useState<Relationship[]>([
    { company: "", relationship: "", ended: false },
  ]);
  const [attestationName, setAttestationName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.cmeDisclosure.submitDisclosure.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(err.message || "Submission failed. Please try again."),
  });

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const addRelationship = () => {
    setRelationships(prev => [...prev, { company: "", relationship: "", ended: false }]);
  };

  const updateRelationship = (idx: number, field: keyof Relationship, value: string | boolean) => {
    setRelationships(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeRelationship = (idx: number) => {
    setRelationships(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (selectedRoles.length === 0) {
      toast.error("Please select at least one role.");
      return;
    }
    if (!attestationName.trim()) {
      toast.error("Please enter your full name for attestation.");
      return;
    }
    submitMutation.mutate({
      token,
      roles: selectedRoles,
      hasRelationships,
      relationships: hasRelationships === "yes" ? relationships.filter(r => r.company.trim()) : [],
      attestationName: attestationName.trim(),
      attestationDate: new Date().toLocaleDateString("en-US"),
    });
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-800">Link Not Found</h1>
          <p className="text-slate-600">
            {error?.message || "This disclosure form link is invalid or has expired. Please contact the course administrator for a new link."}
          </p>
        </div>
      </div>
    );
  }

  // ── Already submitted ──
  if (data.status === "submitted" || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-teal-500 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-800">Disclosure Submitted</h1>
          <p className="text-slate-600">
            Thank you, <strong>{data.facultyName}</strong>. Your financial disclosure for <strong>{data.courseTitle}</strong> has been received.
          </p>
          <p className="text-sm text-slate-500">A PDF copy has been generated and sent to the course administrator. You may close this window.</p>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-teal-600 rounded-t-xl px-6 py-5">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-white" />
            <div>
              <h1 className="text-xl font-bold text-white">Financial Disclosure Form</h1>
              <p className="text-teal-100 text-sm">{data.orgName} · CME Joint Provider with CardioServ, LLC</p>
            </div>
          </div>
        </div>

        {/* Pre-filled info */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-5 py-4 space-y-1">
          <div className="flex gap-2 text-sm"><span className="font-semibold text-teal-700 w-16">Faculty:</span><span className="text-slate-800">{data.facultyName}</span></div>
          <div className="flex gap-2 text-sm"><span className="font-semibold text-teal-700 w-16">Course:</span><span className="text-slate-800">{data.courseTitle}</span></div>
          <div className="flex gap-2 text-sm"><span className="font-semibold text-teal-700 w-16">Email:</span><span className="text-slate-800">{data.facultyEmail}</span></div>
        </div>

        {/* Intro */}
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 space-y-3 text-sm text-slate-700">
          <p>As a prospective planner or faculty member, we would like to ask for your help in protecting our learning environment from industry influence. Please complete the form below.</p>
          <p>The ACCME Standards for Integrity and Independence require that individuals who refuse to disclose relevant financial relationships be disqualified from involvement in the planning and implementation of accredited continuing education.</p>
        </div>

        {/* Section A: Role */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-teal-600 px-5 py-2.5">
            <h2 className="text-sm font-semibold text-white">A. Your Role in This Activity</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(role => (
              <label key={role} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 hover:text-teal-700">
                <Checkbox
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                  className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                />
                {role}
              </label>
            ))}
          </div>
        </div>

        {/* Section B: Financial Relationships */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-teal-600 px-5 py-2.5">
            <h2 className="text-sm font-semibold text-white">B. Financial Relationships with Ineligible Companies (past 24 months)</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            <p className="text-xs text-slate-600">Please disclose all financial relationships with ineligible companies in the past 24 months. There is no minimum threshold — disclose all relationships regardless of amount.</p>

            {/* No relationships checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <Checkbox
                checked={hasRelationships === "no"}
                onCheckedChange={(checked) => setHasRelationships(checked ? "no" : "yes")}
                className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
              />
              In the past 24 months, I have <strong className="mx-1">not</strong> had any financial relationships with any ineligible companies.
            </label>

            {hasRelationships === "yes" && (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 px-1">
                  <div className="col-span-4">Company Name</div>
                  <div className="col-span-5">Nature of Relationship</div>
                  <div className="col-span-2 text-center">Ended?</div>
                  <div className="col-span-1"></div>
                </div>
                {relationships.map((rel, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Input
                        value={rel.company}
                        onChange={e => updateRelationship(idx, "company", e.target.value)}
                        placeholder="Company name"
                        className="text-sm h-8"
                      />
                    </div>
                    <div className="col-span-5">
                      <Input
                        value={rel.relationship}
                        onChange={e => updateRelationship(idx, "relationship", e.target.value)}
                        placeholder="e.g. Speaker, Consultant"
                        className="text-sm h-8"
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Checkbox
                        checked={rel.ended}
                        onCheckedChange={(checked) => updateRelationship(idx, "ended", !!checked)}
                        className="data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button type="button" onClick={() => removeRelationship(idx)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={addRelationship} className="gap-1.5 text-xs h-7">
                  <Plus className="w-3 h-3" /> Add Row
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Attestation */}
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Attestation</h2>
          <p className="text-xs text-slate-600">I attest that the above information is correct as of this date of submission.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Full Name (Signature)</Label>
              <Input
                value={attestationName}
                onChange={e => setAttestationName(e.target.value)}
                placeholder="Type your full name"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input value={new Date().toLocaleDateString("en-US")} readOnly className="text-sm bg-slate-50" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pb-8">
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="bg-teal-600 hover:bg-teal-700 text-white px-8 gap-2"
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Submit Disclosure
          </Button>
        </div>
      </div>
    </div>
  );
}
