import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

export default function UnsubscribePage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<number | undefined>(undefined);
  const [canResubscribe, setCanResubscribe] = useState(false);
  const [step, setStep] = useState<"loading" | "confirm" | "done" | "resubscribed" | "error">("loading");
  const [email, setEmail] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status) {
      if (status === "success") {
        setEmail(params.get("email") || "this email address");
        setCanResubscribe(false);
        setStep("done");
      } else {
        setStep("error");
        setErrorMsg(status === "error" ? "We could not process this unsubscribe request. Please try again." : "This unsubscribe link is invalid or has already been used.");
      }
      return;
    }
    const t = params.get("token");
    const c = params.get("campaignId");
    if (t) {
      setToken(t);
      const parsedCampaignId = c ? Number.parseInt(c, 10) : undefined;
      setCampaignId(parsedCampaignId && !Number.isNaN(parsedCampaignId) ? parsedCampaignId : undefined);
      setStep("confirm");
    } else {
      setStep("error");
      setErrorMsg("No unsubscribe token found in the link. Please use the link from the email.");
    }
  }, []);

  const confirmMutation = trpc.emailCampaign.unsubscribe.useMutation({
    onSuccess: (data) => {
      setEmail(data.email || "this email address");
      setCanResubscribe(Boolean(data.canResubscribe));
      setStep("done");
    },
    onError: (err) => {
      setStep("error");
      setErrorMsg(err.message || "This unsubscribe link is invalid or has already been used.");
    },
  });

  const resubscribeMutation = trpc.emailCampaigns.unsubscribe.resubscribe.useMutation({
    onSuccess: () => {
      setStep("resubscribed");
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to re-subscribe. Please try again.");
    },
  });

  const handleUnsubscribe = () => {
    if (token) confirmMutation.mutate({ token, ...(campaignId ? { campaignId } : {}) });
  };

  const handleResubscribe = () => {
    if (token) resubscribeMutation.mutate({ token });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-sm p-8 text-center space-y-6">
        {/* Logo / Brand */}
        <div className="flex items-center justify-center gap-1 text-2xl font-bold mb-2">
          <span className="text-foreground">teach</span>
          <span className="text-[#24abbc]">ific</span>
          <span className="text-foreground text-sm align-super">™</span>
        </div>

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading…</p>
          </div>
        )}

        {step === "confirm" && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Mail className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Unsubscribe from emails</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                You're about to unsubscribe from marketing and campaign emails. You'll still receive
                important transactional emails like receipts, course access, and password resets.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleUnsubscribe}
                disabled={confirmMutation.isPending}
                variant="destructive"
                className="w-full"
              >
                {confirmMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Unsubscribing…</>
                ) : (
                  "Yes, unsubscribe me"
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/")}
              >
                Cancel — keep me subscribed
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">You've been unsubscribed</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                <strong>{email}</strong> has been removed from our marketing email list.
                You'll no longer receive campaign emails.
              </p>
            </div>
            {canResubscribe && <p className="text-xs text-muted-foreground">
              Changed your mind?{" "}
              <button
                onClick={handleResubscribe}
                disabled={resubscribeMutation.isPending}
                className="text-[#24abbc] underline hover:no-underline disabled:opacity-50"
              >
                {resubscribeMutation.isPending ? "Re-subscribing…" : "Re-subscribe"}
              </button>
            </p>}
          </>
        )}

        {step === "resubscribed" && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">You're re-subscribed</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Welcome back! You'll receive campaign emails again.
              </p>
            </div>
          </>
        )}

        {step === "error" && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Invalid link</h1>
              <p className="text-muted-foreground mt-2 text-sm">{errorMsg}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              Go to homepage
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
