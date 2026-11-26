import { useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, FileText, Users, Video } from "lucide-react";
import { COURSE360_PRICES } from "@shared/course360Pricing";
import { formatCourse360Dollars } from "@shared/course360PriceDisplay";

/** Public platform copy only. Never seed this copy into an organization-owned school. */
export function Course360SchoolTrack() {
  return (
    <section id="run-your-school" aria-labelledby="school-track-heading" className="scroll-mt-20 bg-slate-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-2 items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-teal-700 mb-4">LMS · Learning Delivery Platform</p>
          <h2 id="school-track-heading" className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-5">Run Your School</h2>
          <p className="text-lg leading-relaxed text-slate-600 mb-6">
            Your school is more than a collection of course files. Bring your catalog, learners,
            enrollments, sales, and reporting into an organization-owned learning workspace.
          </p>
          <p className="text-base leading-relaxed text-slate-600 mb-8">
            Deliver the content you already own, manage who can learn, and follow their progress.
            Your school's identity stays separate from Course360's public platform branding.
          </p>
          <a href="#pricing" className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
            Compare school plans <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-white p-7 sm:p-9 shadow-sm">
          <h3 className="font-bold text-xl text-slate-900 mb-6">The operating side of online education</h3>
          <ul className="space-y-5">
            {[
              [BookOpen, "Deliver your catalog", "Organize lessons, resources, SCORM, and HTML5 learning in your school."],
              [Users, "Manage and enroll learners", "Invite members, manage groups, and control access to your courses."],
              [CheckCircle2, "Sell access and report progress", "Offer course and membership access, then review completions and quiz results."],
            ].map(([Icon, title, description]) => {
              const TrackIcon = Icon as typeof BookOpen;
              return <li key={String(title)} className="flex items-start gap-4">
                <div className="rounded-lg bg-teal-50 p-2.5"><TrackIcon className="h-5 w-5 text-teal-700" aria-hidden="true" /></div>
                <div><h4 className="font-semibold text-slate-900">{String(title)}</h4><p className="text-sm text-slate-600 leading-relaxed mt-1">{String(description)}</p></div>
              </li>;
            })}
          </ul>
          <p className="text-sm text-slate-600 mt-7 border-t border-slate-100 pt-5">
            Choose Starter, Builder, or Pro for your school. White-label branding is a Pro feature,
            not a Builder feature. Plan limits and feature availability still apply.
          </p>
        </div>
      </div>
    </section>
  );
}

const CONTENT_TOOLS = [
  { key: "creator_web", name: "Course360™ Creator", icon: BookOpen, title: "Interactive authoring", description: "Build structured lessons, interactive learning screens, and reusable course projects. Shape the learning experience before you deliver it.", href: "/creator-pro", cta: "Explore Creator" },
  { key: "studio_web", name: "Course360™ Studio", icon: Video, title: "Capture and edit", description: "Capture screen, camera, or audio in the browser and edit recordings into lesson media. Keep video creation focused on what you want to teach.", href: "/studio-pro", cta: "Explore Studio" },
  { key: "quiz_creator_web", name: "Course360™ Quiz Creator", icon: FileText, title: "Build assessments", description: "Create questions and assessments to check understanding. Use the assessment workflow that fits your content and delivery needs.", href: "/quiz-creator-pro", cta: "Explore Quiz Creator" },
] as const;

export function Course360ContentTrack() {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  return (
    <section id="create-content" aria-labelledby="content-track-heading" className="scroll-mt-20 py-20 bg-[#0b1d35] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-10">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-widest text-cyan-200 mb-4">Content Creator Platform</p>
            <h2 id="content-track-heading" className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5">Create Content</h2>
            <p className="text-lg text-slate-200 leading-relaxed">Start with the learning experience. Author interactive courses with Creator,
              capture and edit lesson media with Studio, and build assessments with Quiz Creator.</p>
          </div>
          <div className="shrink-0">
            <p id="content-billing-label" className="text-sm font-semibold text-slate-200 mb-2">Standalone web plan pricing · USD</p>
            <div role="group" aria-labelledby="content-billing-label" className="inline-flex gap-1 rounded-xl border border-slate-600 p-1">
              {(["monthly", "annual"] as const).map(value => <button key={value} type="button" aria-pressed={interval === value} onClick={() => setInterval(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${interval === value ? "bg-white text-slate-900" : "text-slate-200 hover:bg-white/10"}`}>{value === "monthly" ? "Monthly" : "Annual"}</button>)}
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {CONTENT_TOOLS.map(tool => {
            const Icon = tool.icon;
            return <article key={tool.key} className="rounded-2xl border border-slate-600 bg-white/5 p-7 flex flex-col">
              <Icon className="h-7 w-7 text-cyan-200 mb-6" aria-hidden="true" />
              <p className="text-sm font-semibold text-cyan-200 mb-2">{tool.title}</p>
              <h3 className="text-2xl font-bold mb-4">{tool.name}</h3>
              <p className="text-sm leading-relaxed text-slate-200 mb-6 flex-1">{tool.description}</p>
              <p className="text-2xl font-bold">{formatCourse360Dollars(COURSE360_PRICES[tool.key][interval])}<span className="text-sm font-normal text-slate-200"> / {interval === "annual" ? "year" : "month"}</span></p>
              <p className="text-sm text-slate-200 mt-2 mb-6">{interval === "annual" ? "Billed upfront annually — the full yearly amount is charged at once." : "Billed monthly."}</p>
              <a href={tool.href} className="inline-flex justify-between items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">{tool.cta}<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
            </article>;
          })}
        </div>
        <p className="text-sm text-slate-200 mt-7 max-w-4xl leading-relaxed">
          These are separate standalone web plans, not automatic access to every tool. Explore each product for its existing
          plans and purchase options. Need delivery and interactive authoring together? Compare the school + Creator Web packages below.
          Your school's main content library remains organization-owned; choosing a creation tool does not move or replace it.
        </p>
      </div>
    </section>
  );
}
