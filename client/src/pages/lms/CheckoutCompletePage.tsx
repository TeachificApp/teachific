/**
 * CheckoutCompletePage — post-Stripe-redirect confirmation page.
 * Route: /checkout/complete?session_id=...&content_type=...&slug=...
 *
 * Calls confirmHostedCheckout to verify the session and grant access,
 * then redirects the user to the appropriate destination.
 */
import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function CheckoutCompletePage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [contentType, setContentType] = useState<string>("");
  const [slug, setSlug] = useState<string>("");

  const confirmMutation = trpc.lmsCheckoutLearner.confirmHostedCheckout.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setStatus("success");
        setMessage(data.alreadyGranted ? "You already had access — redirecting…" : "Payment confirmed! Granting access…");
        setContentType(data.contentType ?? "");
        setSlug(data.slug ?? "");
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          const target = data.contentType === "course"
            ? `/courses/${data.slug}/player`
            : data.contentType === "download"
            ? `/downloads`
            : "/dashboard";
          navigate(target);
        }, 2000);
      } else {
        setStatus("error");
        setMessage("Payment not yet confirmed. Please wait a moment and refresh.");
      }
    },
    onError: (e) => {
      setStatus("error");
      setMessage(e.message || "Failed to confirm payment. Please contact support.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const ct = params.get("content_type") ?? "course";
    const s  = params.get("slug") ?? "";

    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session ID. Please contact support.");
      return;
    }

    confirmMutation.mutate({
      sessionId,
      contentType: ct as any,
      slug: s,
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-5 max-w-sm w-full">
        {status === "loading" && (
          <>
            <Loader2 className="w-14 h-14 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Confirming your payment…</h2>
            <p className="text-sm text-muted-foreground">Please wait while we verify your purchase.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Payment Confirmed!</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button
              className="w-full"
              onClick={() => {
                const target = contentType === "course"
                  ? `/courses/${slug}/player`
                  : contentType === "download"
                  ? `/downloads`
                  : "/dashboard";
                navigate(target);
              }}
            >
              Continue
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-14 h-14 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => window.location.reload()}>
                Retry
              </Button>
              <Button className="flex-1" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
