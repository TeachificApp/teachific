import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, Mail, MessageCircle, BookOpen, Video, Layers, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FAQS = [
  {
    category: "Account & Billing",
    items: [
      {
        q: "How do I reset my password?",
        a: "Go to the login page and click \"Forgot password?\". Enter your email address and we'll send you a reset link within a few minutes. Check your spam folder if it doesn't arrive.",
      },
      {
        q: "How do I upgrade or change my subscription plan?",
        a: "Go to Settings → Billing in your dashboard. You can upgrade, downgrade, or cancel your plan at any time. Changes take effect immediately.",
      },
      {
        q: "Where can I find my invoices?",
        a: "All invoices are available under Sales → Invoices in your dashboard. You can download PDF copies for your records.",
      },
      {
        q: "Can I get a refund?",
        a: "Refund requests are handled on a case-by-case basis. Contact us at support@teachific.net with your account email and order details and we'll review your request within 2 business days.",
      },
    ],
  },
  {
    category: "Creative Tools",
    items: [
      {
        q: "What creative tools are included with my subscription?",
        a: "Course360 Studio™ (video recording & editing), Course360 Creator™ (eLearning authoring), and Course360 Quiz Creator™ (quiz builder) are all web-based tools available within your dashboard. Access depends on your plan tier.",
      },
      {
        q: "Which plan do I need for Course360 Studio™?",
        a: "Course360 Studio™ is available on the Builder plan and above. It includes browser-based video/audio recording, AI transcription, caption styling, and clip extraction.",
      },
      {
        q: "Can I use Course360 Creator™ to build interactive eLearning content?",
        a: "Yes! Course360 Creator™ is a full web-based authoring tool for creating interactive slides, SCORM packages, and multimedia lessons. Access it from the Studio dashboard or the Creator section.",
      },
      {
        q: "How do I access QuizMaker™?",
        a: "QuizMaker™ is available from your dashboard under the Quizzes section, or as a standalone tool at /quizzes. You can create quizzes manually, import from SCORM packages, or use AI generation.",
      },
    ],
  },
  {
    category: "Courses & Content",
    items: [
      {
        q: "How do I publish a course?",
        a: "Open your course in the Course Builder, complete all required sections (curriculum, pricing, settings), then click the Publish button in the top-right corner. Published courses are immediately visible to enrolled students.",
      },
      {
        q: "Can students access courses on mobile?",
        a: "Yes. The Course360 learner portal is fully responsive and works on all modern mobile browsers. Students can also access courses through your school's subdomain.",
      },
      {
        q: "How do I issue certificates?",
        a: "Go to Products → Courses → select your course → Settings → Certificate. Enable the certificate toggle, customize the template, and set the completion criteria. Certificates are issued automatically when students meet the requirements.",
      },
      {
        q: "What video formats are supported?",
        a: "Course360 supports MP4, MOV, and WebM video files. We recommend MP4 (H.264) for best compatibility. Videos are processed and streamed optimally after upload.",
      },
    ],
  },
  {
    category: "Technical",
    items: [
      {
        q: "What browsers are supported?",
        a: "Course360 works best on the latest versions of Chrome, Firefox, Edge, and Safari. Internet Explorer is not supported.",
      },
      {
        q: "How do I embed a course or quiz on my website?",
        a: "Go to the course or quiz settings and copy the embed code. Paste it into your website's HTML. The embed is responsive and works on any modern website builder.",
      },
      {
        q: "Is my data secure?",
        a: "Yes. All data is encrypted in transit (TLS) and at rest. We use industry-standard security practices and never share your data with third parties.",
      },
      {
        q: "Do you have an API?",
        a: "Yes. API access is available on select plans. Go to Integrations → API in your dashboard to generate your API key and view the documentation.",
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-primary transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-sm">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [search, setSearch] = useState("");

  const filtered = FAQS.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        !search ||
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-[#0d1b2e] text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Link href="/" className="text-2xl font-bold tracking-tight">
              Course360<span className="text-[#4ad9e0]">™</span>
              <span className="text-xs align-super text-[#4ad9e0] ml-0.5">™</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold mb-3">Help Center</h1>
          <p className="text-slate-300 mb-8">Find answers, troubleshoot issues, and get in touch with our team.</p>
          <Input
            placeholder="Search FAQs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md mx-auto bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:bg-white/20"
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { icon: BookOpen, label: "Courses & Content", href: "#Courses & Content" },
            { icon: Layers, label: "Creative Tools", href: "#Creative Tools" },
            { icon: HelpCircle, label: "Account & Billing", href: "#Account & Billing" },
            { icon: Video, label: "Technical", href: "#Technical" },
          ].map(({ icon: Icon, label, href }) => (
            <a
              key={label}
              href={href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors text-center"
            >
              <Icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium">{label}</span>
            </a>
          ))}
        </div>

        {/* FAQ sections */}
        <div className="space-y-10 mb-16">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No results found for "{search}"</p>
              <p className="text-sm mt-1">Try a different search term or contact us below.</p>
            </div>
          ) : (
            filtered.map((cat) => (
              <div key={cat.category} id={cat.category}>
                <h2 className="text-lg font-semibold mb-2 text-foreground">{cat.category}</h2>
                <div className="rounded-xl border border-border bg-card px-5">
                  {cat.items.map((item) => (
                    <FAQItem key={item.q} q={item.q} a={item.a} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Contact section */}
        <div className="rounded-2xl bg-[#0d1b2e] text-white p-8 text-center">
          <MessageCircle className="w-10 h-10 mx-auto mb-4 text-[#4ad9e0]" />
          <h2 className="text-xl font-bold mb-2">Still need help?</h2>
          <p className="text-slate-300 mb-6 text-sm max-w-md mx-auto">
            Our support team is available Monday–Friday, 9am–5pm EST. We typically respond within one business day.
          </p>
          <Button
            asChild
            className="bg-[#4ad9e0] hover:bg-[#3bc8cf] text-[#0d1b2e] font-semibold"
          >
            <a href="mailto:support@course360.app">
              <Mail className="w-4 h-4 mr-2" />
              Email Support
            </a>
          </Button>
          <p className="text-slate-400 text-xs mt-4">support@course360.app</p>
        </div>
      </div>
    </div>
  );
}
