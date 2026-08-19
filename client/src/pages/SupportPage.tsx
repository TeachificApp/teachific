import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  HelpCircle,
  MessageSquare,
  BookOpen,
  Zap,
  Shield,
  CreditCard,
  CheckCircle2,
  Mail,
  Clock,
} from "lucide-react";

const FAQ_CATEGORIES = [
  {
    icon: Zap,
    label: "Getting Started",
    color: "text-amber-500",
    items: [
      {
        q: "How do I upload my first SCORM course?",
        a: "Navigate to your organization's Content Library and click 'Upload Content'. You can upload SCORM 1.2, SCORM 2004, or plain HTML5 packages as a ZIP file. Once uploaded, the system will automatically detect the SCORM version and entry point.",
      },
      {
        q: "What file formats does Teachific support?",
        a: "Teachific supports SCORM 1.2, SCORM 2004 (all editions), xAPI/Tin Can, HTML5 packages, Articulate Storyline exports, iSpring exports, and plain HTML/ZIP bundles. Maximum file size is determined by your subscription plan.",
      },
      {
        q: "How do I invite learners to my organization?",
        a: "Go to your Organization Settings → Members tab and click 'Invite Members'. You can invite by email address individually or upload a CSV for bulk invitations. Learners will receive an email with a link to create their account and join your organization.",
      },
      {
        q: "How do I create a course and enroll learners?",
        a: "From your LMS dashboard, go to Courses → Create Course. Add a title, description, and attach one or more content packages. Then go to the Enrollments tab to enroll individual learners or entire groups.",
      },
    ],
  },
  {
    icon: BookOpen,
    label: "Content & Courses",
    color: "text-blue-500",
    items: [
      {
        q: "Can I update a course without losing learner progress?",
        a: "Yes. When you upload a new version of a content package, existing learner progress is preserved. Learners will see the updated content on their next session. You can also choose to reset progress for specific learners if needed.",
      },
      {
        q: "How does SCORM tracking work?",
        a: "Teachific fully supports SCORM 1.2 and SCORM 2004 data models. Completion status, score, time spent, and suspend data are all captured and stored per learner. You can view detailed reports in the Analytics section.",
      },
      {
        q: "Can I set a passing score for a course?",
        a: "Yes. In the course settings, you can define a minimum passing score. Learners who meet or exceed this score will be marked as 'Passed'. This works with both SCORM-tracked content and Teachific's built-in quiz engine.",
      },
      {
        q: "Is there a limit on how many courses I can create?",
        a: "The number of courses and storage available depends on your subscription plan. Check your Organization Settings → Subscription for your current limits and usage.",
      },
    ],
  },
  {
    icon: Shield,
    label: "Account & Security",
    color: "text-green-500",
    items: [
      {
        q: "How do I reset my password?",
        a: "On the login page, click 'Forgot password?' and enter your email address. You'll receive a reset link within a few minutes.",
      },
      {
        q: "Can I have multiple organizations?",
        a: "Yes. A single Teachific account can be a member of multiple organizations. Use the organization switcher in the top navigation to switch between them. Each organization has its own content library, learners, and settings.",
      },
      {
        q: "How do I manage admin roles?",
        a: "Organization owners can assign roles from the Members tab in Organization Settings. Available roles are: Org Super Admin (full control), Org Admin (manage content and members), Instructor (create and manage courses), and Member (learner access only).",
      },
      {
        q: "Is my data secure?",
        a: "Yes. All data is encrypted in transit (TLS 1.2+) and at rest. Content files are stored in secure S3-compatible object storage. We follow industry-standard security practices and do not share your data with third parties.",
      },
    ],
  },
  {
    icon: CreditCard,
    label: "Billing & Plans",
    color: "text-purple-500",
    items: [
      {
        q: "What plans are available?",
        a: "Teachific offers Free, Starter, Pro, and Enterprise plans. Each plan includes different storage limits, learner seats, and feature access. Visit the Pricing page or contact us for a custom Enterprise quote.",
      },
      {
        q: "Can I upgrade or downgrade my plan?",
        a: "Yes. You can change your plan at any time from Organization Settings → Subscription. Upgrades take effect immediately; downgrades take effect at the end of your current billing period.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) via Stripe. For Enterprise plans, we can also arrange invoice-based billing.",
      },
      {
        q: "Do you offer refunds?",
        a: "We offer a 14-day money-back guarantee for new paid subscriptions. If you're not satisfied, contact support@teachific.net within 14 days of your first payment and we'll issue a full refund.",
      },
    ],
  },
];

const RESPONSE_TIME_INFO = [
  { label: "General Inquiries", time: "Within 24 hours", icon: Clock },
  { label: "Technical Issues", time: "Within 12 hours", icon: Zap },
  { label: "Billing Questions", time: "Within 4 hours", icon: CreditCard },
];

export default function SupportPage() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    subject: "",
    category: "general" as "general" | "billing" | "technical" | "account" | "other",
    message: "",
  });

  const submitTicket = trpc.support.submitTicket.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Your ticket has been submitted! We'll get back to you soon.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit ticket. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    submitTicket.mutate(form);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-6">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">How can we help?</h1>
          <p className="text-teal-100 text-lg max-w-2xl mx-auto">
            Browse our frequently asked questions or submit a support ticket and our team will get back to you promptly.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">
        {/* Response time cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {RESPONSE_TIME_INFO.map(({ label, time, icon: Icon }) => (
            <Card key={label} className="text-center border-border/50">
              <CardContent className="pt-6 pb-4">
                <Icon className="w-6 h-6 text-teal-600 mx-auto mb-2" />
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-1">{time}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
              <p className="text-muted-foreground text-sm">Find quick answers to common questions</p>
            </div>
          </div>

          <div className="space-y-6">
            {FAQ_CATEGORIES.map(({ icon: Icon, label, color, items }) => (
              <div key={label}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{label}</h3>
                </div>
                <Accordion type="single" collapsible className="border rounded-xl overflow-hidden">
                  {items.map((item, i) => (
                    <AccordionItem key={i} value={`${label}-${i}`} className="border-b last:border-b-0 px-1">
                      <AccordionTrigger className="text-left text-sm font-medium hover:no-underline py-4 px-3">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground px-3 pb-4 leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section id="contact">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Submit a Support Ticket</h2>
              <p className="text-muted-foreground text-sm">
                Can't find your answer? Our team is here to help.
              </p>
            </div>
          </div>

          {submitted ? (
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">
                  Ticket Submitted!
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                  Thank you for reaching out. We've received your ticket and sent a confirmation to{" "}
                  <strong>{form.email}</strong>. Our support team will respond as soon as possible.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>Replies go to support@teachific.net</span>
                </div>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ name: user?.name ?? "", email: user?.email ?? "", subject: "", category: "general", message: "" });
                  }}
                >
                  Submit Another Ticket
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Support</CardTitle>
                <CardDescription>
                  Fill in the details below and we'll get back to you at{" "}
                  <a href="mailto:support@teachific.net" className="text-teal-600 hover:underline">
                    support@teachific.net
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="support-name">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="support-name"
                        placeholder="Your name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="support-email">
                        Email Address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="support-email"
                        type="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="support-category">Category</Label>
                      <Select
                        value={form.category}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, category: v as typeof form.category }))
                        }
                      >
                        <SelectTrigger id="support-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General Inquiry</SelectItem>
                          <SelectItem value="technical">Technical Issue</SelectItem>
                          <SelectItem value="billing">Billing & Payments</SelectItem>
                          <SelectItem value="account">Account & Access</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="support-subject">
                        Subject <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="support-subject"
                        placeholder="Brief description of your issue"
                        value={form.subject}
                        onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="support-message">
                      Message <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="support-message"
                      placeholder="Please describe your issue in as much detail as possible. Include any error messages, steps to reproduce, and your browser/device if relevant."
                      rows={6}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      required
                      minLength={10}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {form.message.length}/5000
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs font-normal">
                        <Mail className="w-3 h-3 mr-1" />
                        support@teachific.net
                      </Badge>
                    </div>
                    <Button
                      type="submit"
                      disabled={submitTicket.isPending}
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      {submitTicket.isPending ? "Submitting..." : "Submit Ticket"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
