/**
 * NewsletterSubscribe — Public newsletter subscribe page
 * Org-scoped: reads orgSlug from URL query param, displays org name dynamically.
 * No hardcoded brand names.
 */
import { useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Mail, CheckCircle2 } from "lucide-react";

const PROFESSION_OPTIONS = [
  "Physician / Cardiologist",
  "Sonographer / Ultrasound Technologist",
  "Cardiac Sonographer",
  "Vascular Technologist",
  "Radiologist",
  "Radiology Technologist",
  "Nurse / NP / PA",
  "Medical Student / Resident",
  "Educator / Program Director",
  "Other",
];

const INTEREST_OPTIONS = [
  { value: "courses", label: "New Courses" },
  { value: "cme", label: "CME / Continuing Education" },
  { value: "clinical_tools", label: "Clinical Tools" },
  { value: "accreditation", label: "Lab Accreditation" },
  { value: "events", label: "Webinars & Live Events" },
  { value: "ai_tools", label: "AI & Technology" },
  { value: "news", label: "Industry News" },
  { value: "other", label: "Other" },
];

export default function NewsletterSubscribe() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orgSlug = params.get("org") ?? undefined;

  const { data: orgInfo } = trpc.newsletter.getOrgInfo.useQuery(
    { orgSlug },
    { enabled: !!orgSlug },
  );

  const orgName = orgInfo?.name ?? "Our Community";

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    profession: "",
    interests: [] as string[],
  });
  const [submitted, setSubmitted] = useState(false);

  const subscribeMutation = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(err.message || "Something went wrong. Please try again."),
  });

  const toggleInterest = (value: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(value)
        ? f.interests.filter((i) => i !== value)
        : [...f.interests, value],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) {
      toast.error("Please enter your email address.");
      return;
    }
    subscribeMutation.mutate({
      email: form.email,
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      profession: form.profession || undefined,
      interests: form.interests.length > 0 ? form.interests : undefined,
      source: "subscribe_page",
      orgSlug,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0d4f52] via-[#0f6b70] to-[#189aa1] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-[#189aa1]/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-[#189aa1]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're subscribed!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Thank you for joining the <strong>{orgName}</strong> community.
            You'll receive updates on new courses, CME opportunities, clinical tools, and upcoming events.
          </p>
          <p className="text-xs text-gray-400 mt-6">
            You can unsubscribe at any time by clicking the link in any email we send.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d4f52] via-[#0f6b70] to-[#189aa1] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0d4f52] to-[#189aa1] px-8 py-8 text-white">
          <div className="flex items-center gap-3 mb-5">
            {orgInfo?.logoUrl ? (
              <img src={orgInfo.logoUrl} alt={orgName} className="h-10 w-auto object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <div className="font-bold text-xl leading-tight">{orgName}</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-1">Stay Connected</h1>
          <p className="text-teal-100 text-sm leading-relaxed">
            Get the latest courses, CME opportunities, clinical tools, and education delivered directly to your inbox.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First Name</Label>
              <Input
                id="firstName"
                placeholder="Jane"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Smith"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="jane@example.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="border-gray-300 focus:border-[#189aa1] focus:ring-[#189aa1]"
            />
          </div>

          {/* Profession */}
          <div className="space-y-1.5">
            <Label htmlFor="profession" className="text-sm font-medium text-gray-700">Profession</Label>
            <select
              id="profession"
              value={form.profession}
              onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#189aa1] focus:outline-none focus:ring-1 focus:ring-[#189aa1]"
            >
              <option value="">Select your profession…</option>
              {PROFESSION_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Topics of Interest</Label>
            <div className="grid grid-cols-2 gap-2">
              {INTEREST_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-gray-200 hover:border-[#189aa1] hover:bg-[#189aa1]/5 transition-colors"
                >
                  <Checkbox
                    checked={form.interests.includes(opt.value)}
                    onCheckedChange={() => toggleInterest(opt.value)}
                    className="data-[state=checked]:bg-[#189aa1] data-[state=checked]:border-[#189aa1]"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={subscribeMutation.isPending}
            className="w-full h-11 text-sm font-semibold text-white"
            style={{ background: "#189aa1" }}
          >
            {subscribeMutation.isPending ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Subscribing…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Subscribe to {orgName}
              </span>
            )}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </form>
      </div>
    </div>
  );
}
