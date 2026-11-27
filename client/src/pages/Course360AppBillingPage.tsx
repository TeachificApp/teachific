import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Course360AppBillingRecovery } from "@/components/Course360AppBillingRecovery";
import { Course360AppSkuSelector } from "@/components/Course360AppSkuSelector";
import type { Course360PurchaseApp } from "@shared/course360AppPurchaseIntent";

export default function Course360AppBillingPage({ app }: { app: Course360PurchaseApp }) {
  const { user, loading } = useAuth();
  useEffect(() => { if (!loading && !user) window.location.assign(getLoginUrl(window.location.pathname + window.location.search)); }, [loading, user]);
  const label = app === "quiz_creator" ? "Quiz Creator" : app === "studio" ? "Studio" : "Creator";
  const dashboard = app === "quiz_creator" ? "/quiz-creator-app" : `/${app}`;
  if (loading || !user) return <div className="min-h-screen bg-[#0b1d35] text-white p-8" role="status">Loading app billing…</div>;
  return <div className="min-h-screen bg-[#0b1d35] text-white px-6 py-10">
    <main className="max-w-5xl mx-auto space-y-6">
      <a className="text-teal-300 underline" href={dashboard}>Back to {label}</a>
      <h1 className="text-3xl font-bold">Course360™ {label} billing</h1>
      <p>This page manages your selected school’s {label} app subscription. Your main Course360™ school subscription and Media Library remain separate.</p>
      <Course360AppBillingRecovery app={app} />
      <Course360AppSkuSelector app={app} />
      <p><a href="/billing" className="text-teal-300 underline">Manage main Course360™ school billing separately</a></p>
    </main>
    <footer className="max-w-5xl mx-auto mt-10"><a href="https://www.soundmedianow.com" target="_blank" rel="noreferrer" className="text-sm text-white/70">Designed by SoundMedia, Inc.</a></footer>
  </div>;
}
