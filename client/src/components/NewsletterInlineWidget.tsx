/**
 * NewsletterInlineWidget
 * Compact inline newsletter subscribe form for embedding on pages.
 * Org-scoped: pass orgSlug to scope subscriptions to a specific org.
 * Full-page form is at /subscribe.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";

interface Props {
  /** Optional dark background variant (default: light) */
  dark?: boolean;
  /** Source tag for analytics */
  source?: string;
  /** Org slug to scope subscription */
  orgSlug?: string;
  /** Display name for the org (shown in copy) */
  orgName?: string;
}

export default function NewsletterInlineWidget({
  dark = false,
  source = "inline_widget",
  orgSlug,
  orgName = "our community",
}: Props) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const subscribeMutation = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => setSubscribed(true),
    onError: (err) => toast.error(err.message || "Something went wrong. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    subscribeMutation.mutate({
      email: email.trim(),
      firstName: firstName.trim() || undefined,
      source,
      orgSlug,
    });
  };

  if (subscribed) {
    return (
      <div className={`rounded-xl px-6 py-5 flex items-center gap-4 ${dark ? "bg-white/10 text-white" : "bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)] text-[var(--org-primary)]"}`}>
        <CheckCircle2 className="w-7 h-7 flex-shrink-0 text-[var(--org-primary)]" />
        <div>
          <p className="font-semibold text-sm">You're subscribed!</p>
          <p className={`text-xs mt-0.5 ${dark ? "text-white/70" : "text-[var(--org-primary)]"}`}>
            Thank you — you'll receive updates from {orgName}.
          </p>
        </div>
      </div>
    );
  }

  const subscribeUrl = orgSlug ? `/subscribe?org=${orgSlug}` : "/subscribe";

  return (
    <div className={`rounded-xl px-6 py-6 ${dark ? "bg-white/10" : "bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)] border border-[color:color-mix(in_srgb,var(--org-primary)_20%,transparent)]"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-4 h-4 text-[var(--org-primary)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--org-primary)]">
          Newsletter
        </span>
      </div>
      <p className={`text-sm font-semibold mb-1 ${dark ? "text-white" : "text-gray-900"}`}>
        Stay updated with {orgName}
      </p>
      <p className={`text-xs mb-4 ${dark ? "text-white/60" : "text-gray-500"}`}>
        New courses, CME opportunities, clinical tools, and events — delivered to your inbox.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="text"
          placeholder="First name (optional)"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={`sm:w-32 flex-shrink-0 text-sm h-9 ${dark ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[var(--org-primary)]" : "border-gray-300 focus:border-[var(--org-primary)]"}`}
        />
        <Input
          type="email"
          required
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`flex-1 text-sm h-9 ${dark ? "bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-[var(--org-primary)]" : "border-gray-300 focus:border-[var(--org-primary)]"}`}
        />
        <Button
          type="submit"
          disabled={subscribeMutation.isPending}
          className="h-9 px-4 text-sm font-semibold bg-[var(--org-primary)] hover:brightness-90 text-white flex-shrink-0 flex items-center gap-1.5"
        >
          {subscribeMutation.isPending ? "…" : (
            <>Subscribe <ArrowRight className="w-3.5 h-3.5" /></>
          )}
        </Button>
      </form>
      <p className={`text-xs mt-3 ${dark ? "text-white/40" : "text-gray-400"}`}>
        No spam. Unsubscribe at any time.{" "}
        <a
          href={subscribeUrl}
          className={`underline ${dark ? "text-white/60 hover:text-white" : "text-[var(--org-primary)] hover:brightness-90"}`}
        >
          More options →
        </a>
      </p>
    </div>
  );
}
