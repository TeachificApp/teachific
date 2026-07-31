import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Link2, ArrowLeft, CheckCircle2, Building2, Mail,
  Clock, Trash2, RefreshCw, Search, ChevronRight, MailCheck
} from "lucide-react";
import { toast } from "sonner";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();
}

export default function LinkOrganizationPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { orgId, adminOrgs } = useOrgScope();

  // Multi-step state: "email" → "pick-org" → "sent"
  const [step, setStep] = useState<"email" | "pick-org" | "sent">("email");
  const [targetEmail, setTargetEmail] = useState("");
  const [lookedUpEmail, setLookedUpEmail] = useState("");
  const [selectedTargetOrgId, setSelectedTargetOrgId] = useState<number | null>(null);
  const [sentOrgName, setSentOrgName] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  const pendingToken = urlParams.get("token") || urlParams.get("link_token");
  const utils = trpc.useUtils();

  // Lookup orgs for the entered email
  const {
    data: targetOrgs,
    isFetching: isLookingUp,
    error: lookupError,
  } = trpc.orgs.link.lookupOrgs.useQuery(
    { email: lookedUpEmail },
    {
      enabled: !!lookedUpEmail && !!user,
      retry: false,
    }
  );

  // When lookup completes, advance to pick-org step
  useEffect(() => {
    if (!lookedUpEmail || isLookingUp || targetOrgs === undefined) return;
    if (targetOrgs.length === 0) {
      toast.error("No organizations found for that email address");
      setLookedUpEmail("");
      return;
    }
    // Pre-select if only one org
    if (targetOrgs.length === 1) {
      setSelectedTargetOrgId(targetOrgs[0].id);
    }
    setStep("pick-org");
  }, [targetOrgs, isLookingUp, lookedUpEmail]);

  const initiateLink = trpc.orgs.link.initiate.useMutation({
    onSuccess: (data: any) => {
      setSentOrgName(data?.linkedOrgName ?? "");
      setStep("sent");
      utils.orgs.link.listPending.invalidate();
      utils.orgs.link.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to send link invitation"),
  });

  const acceptLink = trpc.orgs.link.accept.useMutation({
    onSuccess: () => {
      toast.success("Organizations linked! Redirecting…");
      utils.orgs.link.list.invalidate();
      utils.orgs.link.listPending.invalidate();
      setTimeout(() => setLocation("/lms"), 1500);
    },
    onError: (err) => toast.error(err.message || "Failed to accept link invitation"),
  });

  const removeLink = trpc.orgs.link.revoke.useMutation({
    onSuccess: () => {
      toast.success("Organization link removed.");
      utils.orgs.link.list.invalidate();
      utils.orgs.link.listPending.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to remove link"),
  });

  const { data: existingLinks } = trpc.orgs.link.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );
  const { data: pendingLinks } = trpc.orgs.link.listPending.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId && user?.role === "site_owner" }
  );

  // Auto-accept when arriving via email link
  useEffect(() => {
    if (
      pendingToken &&
      user &&
      !acceptLink.isPending &&
      !acceptLink.isSuccess &&
      !acceptLink.isError
    ) {
      acceptLink.mutate({ token: pendingToken });
    }
  }, [pendingToken, user]);

  const activeOrg = (adminOrgs as any[])?.find((o: any) => o.id === orgId);

  // ── Accept via token flow ─────────────────────────────────────────────────
  if (pendingToken) {
    return (
      <div className="p-6 max-w-lg space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/lms")}
          className="-ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Accept Organization Link</CardTitle>
                <CardDescription>
                  Link your organization to another for easy switching.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {acceptLink.isPending && (
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm">Accepting link invitation…</p>
              </div>
            )}
            {acceptLink.isSuccess && (
              <div className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Organizations linked successfully! Redirecting to dashboard…
                </p>
              </div>
            )}
            {acceptLink.isError && (
              <div className="space-y-3">
                <p className="text-sm text-destructive">
                  {acceptLink.error?.message || "Failed to accept invitation."}
                </p>
                <Button variant="outline" onClick={() => setLocation("/lms")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Link2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Link Organization</h1>
          <p className="text-sm text-muted-foreground">
            Connect another organization so you can switch between them from the sidebar.
            {activeOrg && (
              <span className="ml-1 font-medium text-foreground">
                Active: {activeOrg.name}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Step 1: Enter email */}
      {step === "email" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Link Another Organization</CardTitle>
            <CardDescription>
              Enter the email address of the admin for the organization you want to link.
              You can enter your own email to link one of your other organizations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label htmlFor="target-email">
                <Mail className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                Organization Admin Email
              </Label>
              <div className="flex gap-2">
                <Input
                  id="target-email"
                  type="email"
                  placeholder="admin@otherschool.com (or your own email)"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && targetEmail.trim()) {
                      setLookedUpEmail(targetEmail.trim());
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    if (!targetEmail.trim()) {
                      toast.error("Email is required");
                      return;
                    }
                    setLookedUpEmail(targetEmail.trim());
                  }}
                  disabled={isLookingUp || !targetEmail.trim()}
                >
                  {isLookingUp ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Looking up…
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Look Up
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A verification email will be sent to the admin. They must click the link
                to confirm and complete the link — even if it's your own email.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Pick which org to link */}
      {step === "pick-org" && targetOrgs && targetOrgs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Select Organization to Link</CardTitle>
                <CardDescription>
                  Found {targetOrgs.length} organization
                  {targetOrgs.length > 1 ? "s" : ""} for{" "}
                  <strong>{lookedUpEmail}</strong>.{" "}
                  {targetOrgs.length === 1
                    ? "Click Link to send a verification email."
                    : "Choose which one to link."}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("email");
                  setLookedUpEmail("");
                  setSelectedTargetOrgId(null);
                }}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {targetOrgs.map((org: any) => (
              <div
                key={org.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTargetOrgId === org.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setSelectedTargetOrgId(org.id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    {org.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {initials(org.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {org.isPrimary && (
                    <Badge variant="secondary" className="text-xs">
                      Primary
                    </Badge>
                  )}
                  {selectedTargetOrgId === org.id && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Button
                className="w-full"
                disabled={!selectedTargetOrgId || initiateLink.isPending || !orgId}
                onClick={() => {
                  if (!selectedTargetOrgId || !orgId) return;
                  initiateLink.mutate({
                    primaryOrgId: orgId,
                    linkedOrgEmail: lookedUpEmail,
                    targetOrgId: selectedTargetOrgId,
                    origin: window.location.origin,
                  });
                }}
              >
                {initiateLink.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sending verification…
                  </>
                ) : (
                  <>
                    <MailCheck className="mr-2 h-4 w-4" />
                    Send Verification Email
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Email sent — waiting for verification */}
      {step === "sent" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
              <MailCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Verification email sent!
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  An email was sent to <strong>{lookedUpEmail}</strong>. The admin of{" "}
                  <strong>{sentOrgName}</strong> must click the link in the email to
                  confirm and complete the link. Once accepted, the organization will
                  appear in your sidebar switcher.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("email");
                  setTargetEmail("");
                  setLookedUpEmail("");
                  setSelectedTargetOrgId(null);
                  setSentOrgName("");
                }}
              >
                Link Another
              </Button>
              <Button size="sm" onClick={() => setLocation("/lms")}>
                <ChevronRight className="mr-1 h-4 w-4" /> Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending invitations */}
      {pendingLinks && pendingLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Invitations
              <Badge variant="secondary" className="ml-1">
                {pendingLinks.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              These organizations have been invited but haven't verified yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(pendingLinks as any[]).map((link: any) => (
              <div
                key={link.linkId}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {link.linkedOrg?.logoUrl ? (
                      <img
                        src={link.linkedOrg.logoUrl}
                        alt={link.linkedOrg.name}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                        {initials(link.linkedOrg?.name ?? "?")}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{link.linkedOrg?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Awaiting verification · Expires{" "}
                      {link.inviteTokenExpiry
                        ? new Date(link.inviteTokenExpiry).toLocaleDateString()
                        : "soon"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeLink.mutate({ linkId: link.linkId })}
                  disabled={removeLink.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Accepted links */}
      {existingLinks && existingLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-500" />
              Linked Organizations
              <Badge variant="secondary" className="ml-1">
                {existingLinks.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              These organizations are linked and appear in your sidebar switcher.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(existingLinks as any[]).map((link: any) => (
              <div
                key={link.linkId}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {link.linkedOrg?.logoUrl ? (
                      <img
                        src={link.linkedOrg.logoUrl}
                        alt={link.linkedOrg.name}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <AvatarFallback className="text-xs bg-green-100 text-green-700">
                        {initials(link.linkedOrg?.name ?? "?")}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{link.linkedOrg?.name}</p>
                    <p className="text-xs text-muted-foreground">{link.linkedOrg?.slug}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeLink.mutate({ linkId: link.linkId })}
                  disabled={removeLink.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {(!existingLinks || existingLinks.length === 0) && step !== "sent" && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No linked organizations yet.</p>
          <p className="text-xs mt-1">
            Link an organization above to switch between them from the sidebar.
          </p>
        </div>
      )}
    </div>
  );
}
