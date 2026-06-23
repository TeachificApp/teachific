import { useState, useEffect, useCallback } from "react";
import { sanitize, sanitizeCss } from "@/lib/sanitize";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, Users, CheckCircle, Video, Calendar } from "lucide-react";

// ── Countdown Timer ──────────────────────────────────────────────────────────

function useCountdown(targetDate: Date | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = targetDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

function CountdownBlock({ targetDate }: { targetDate: Date }) {
  const { days, hours, minutes, seconds } = useCountdown(targetDate);
  return (
    <div className="flex gap-3 justify-center">
      {[
        { label: "Days", value: days },
        { label: "Hours", value: hours },
        { label: "Minutes", value: minutes },
        { label: "Seconds", value: seconds },
      ].map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col items-center bg-primary text-primary-foreground rounded-lg px-4 py-3 min-w-[64px]"
        >
          <span className="text-3xl font-bold tabular-nums">
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-xs mt-1 opacity-80">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Block Renderer (simplified for public page) ──────────────────────────────

function renderPublicBlock(block: any, webinar: any) {
  switch (block.type) {
    case "banner":
      return (
        <div
          key={block.id}
          className="relative py-20 px-6 text-center"
          style={{
            background: block.bgColor || "var(--primary)",
            color: block.textColor || "#fff",
            backgroundImage: block.bgImage ? `url(${block.bgImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {block.bgImage && block.overlay && (
            <div
              className="absolute inset-0"
              style={{ background: block.overlayColor || "rgba(0,0,0,0.5)" }}
            />
          )}
          <div className="relative z-10 max-w-3xl mx-auto">
            {block.eyebrow && (
              <p className="text-sm font-semibold uppercase tracking-widest mb-3 opacity-80">
                {block.eyebrow}
              </p>
            )}
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{block.headline || webinar.title}</h1>
            {block.subheadline && (
              <p className="text-lg md:text-xl opacity-90 mb-6">{block.subheadline}</p>
            )}
          </div>
        </div>
      );

    case "text":
      return (
        <div key={block.id} className="max-w-3xl mx-auto px-6 py-10">
          {block.heading && <h2 className="text-2xl font-bold mb-4">{block.heading}</h2>}
          {block.content && (
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitize(block.content) }}
            />
          )}
        </div>
      );

    case "video":
      if (!block.videoUrl) return null;
      return (
        <div key={block.id} className="max-w-3xl mx-auto px-6 py-8">
          {block.caption && <p className="text-center text-muted-foreground mb-3">{block.caption}</p>}
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            {block.videoUrl.includes("youtube") || block.videoUrl.includes("youtu.be") ? (
              <iframe
                src={`https://www.youtube.com/embed/${extractYouTubeId(block.videoUrl)}`}
                className="w-full h-full"
                allowFullScreen
              />
            ) : block.videoUrl.includes("vimeo") ? (
              <iframe
                src={`https://player.vimeo.com/video/${extractVimeoId(block.videoUrl)}`}
                className="w-full h-full"
                allowFullScreen
              />
            ) : (
              <video src={block.videoUrl} controls className="w-full h-full" />
            )}
          </div>
        </div>
      );

    case "checklist":
      return (
        <div key={block.id} className="max-w-3xl mx-auto px-6 py-8">
          {block.heading && <h2 className="text-2xl font-bold mb-6">{block.heading}</h2>}
          <ul className="space-y-3">
            {(block.items || []).map((item: any, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <span>{typeof item === "string" ? item : item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "testimonials":
      return (
        <div key={block.id} className="py-12 px-6 bg-muted/40">
          {block.heading && (
            <h2 className="text-2xl font-bold text-center mb-8">{block.heading}</h2>
          )}
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {(block.testimonials || []).map((t: any, i: number) => (
              <div key={i} className="bg-background rounded-xl p-6 shadow-sm">
                <p className="text-muted-foreground italic mb-4">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  {t.avatar && (
                    <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "cta":
      return (
        <div
          key={block.id}
          className="py-16 px-6 text-center"
          style={{ background: block.bgColor || "var(--primary)", color: block.textColor || "#fff" }}
        >
          <h2 className="text-3xl font-bold mb-3">{block.headline || "Register Now"}</h2>
          {block.subheadline && <p className="text-lg opacity-90 mb-6">{block.subheadline}</p>}
        </div>
      );

    default:
      return null;
  }
}

function extractYouTubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : "";
}

function extractVimeoId(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : "";
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function WebinarRegisterPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [registered, setRegistered] = useState(false);
  const [registrationId, setRegistrationId] = useState<number | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  const { data: webinar, isLoading } = trpc.lms.webinars.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  const registerMutation = trpc.lms.webinars.register.useMutation({
    onSuccess: (data) => {
      setRegistered(true);
      setRegistrationId(data.registration?.id ?? null);
      toast.success("You're registered!");
    },
    onError: (e) => toast.error(e.message),
  });

  const scheduledDate = webinar?.scheduledAt ? new Date(webinar.scheduledAt) : null;
  const blocks: any[] = Array.isArray(webinar?.salesPageBlocksJson)
    ? webinar.salesPageBlocksJson
    : [];

  const handleRegister = () => {
    if (!form.email.trim()) { toast.error("Email is required"); return; }
    if (!webinar) return;
    registerMutation.mutate({
      webinarId: webinar.id,
      ...form,
    });
  };

  const handleWatch = () => {
    navigate(`/webinar/${slug}/watch${registrationId ? `?rid=${registrationId}` : ""}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Webinar Not Found</h1>
          <p className="text-muted-foreground">This webinar may have been removed or is not yet published.</p>
        </div>
      </div>
    );
  }

  // Render sales page blocks if any, with registration form injected
  const hasBlocks = blocks.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* If no custom blocks, show default layout */}
      {!hasBlocks && (
        <div
          className="py-20 px-6 text-center text-white"
          style={{ background: "linear-gradient(135deg, #24abbc 0%, #0d7a8a 100%)" }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
              <Video className="w-4 h-4" />
              {webinar.type === "live" ? "Live Webinar" : "On-Demand Webinar"}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{webinar.title}</h1>
            {webinar.description && (
              <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">{webinar.description}</p>
            )}
            {scheduledDate && webinar.type === "live" && (
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 text-white/80 mb-4">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    {scheduledDate.toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <CountdownBlock targetDate={scheduledDate} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render custom blocks */}
      {hasBlocks && blocks.map((block) => renderPublicBlock(block, webinar))}

      {/* Registration Form */}
      <div className="max-w-lg mx-auto px-6 py-12">
        {!registered ? (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold mb-2 text-center">
              {webinar.requireRegistration ? "Register for Free" : "Watch Now"}
            </h2>
            {webinar.type === "live" && scheduledDate && (
              <div className="mb-6">
                <CountdownBlock targetDate={scheduledDate} />
              </div>
            )}
            {webinar.requireRegistration ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="Jane"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone (optional)</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleRegister}
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Registering..." : "Register Now →"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Your information is secure. No spam, ever.
                </p>
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={handleWatch}>
                Watch Now →
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-card border rounded-2xl p-8 shadow-sm text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're Registered!</h2>
            <p className="text-muted-foreground mb-6">
              {webinar.type === "live" && scheduledDate
                ? `The webinar starts on ${scheduledDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}.`
                : "You can watch the webinar now."}
            </p>
            {webinar.type === "live" && scheduledDate && scheduledDate > new Date() ? (
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-3">Starting in:</p>
                <CountdownBlock targetDate={scheduledDate} />
              </div>
            ) : null}
            <Button size="lg" onClick={handleWatch}>
              Watch Webinar →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
