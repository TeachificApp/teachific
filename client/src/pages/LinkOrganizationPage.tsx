import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Link2, ArrowLeft, Info, CheckCircle2, XCircle, Building2, Mail,
  Clock, Trash2, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
}

export default function LinkOrganizationPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { orgId, adminOrgs } = useOrgScope();
  const [targetEmail, setTargetEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const pendingToken = urlParams.get("token") || urlParams.get("link_token");

  const utils = trpc.useUtils();

  const initiateLink = trpc.orgs.link.initiate.useMutation({
    onSuccess: () => {
      setInviteSent(true);
      setTargetEmail("");
      utils.orgs.link.listPending.invalidate();
      utils.orgs.link.list.invalidate();
      toast.success("Link invitation sent!");
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
    if (pendingToken && user && !acceptLink.isPending && !acceptLink.isSuccess && !acceptLink.isError) {
      acceptLink.mutate({ token: pendingToken });
    }
  }, [pendingToken, user]);

  const activeOrg = (adminOrgs as any[])?.find((o: any) => o.id === orgId);

  // ── Accept via token flow ─────────────────────────────────────────────────
  if (pendingToken) {
    return (
      <div className="p-6 max-w-lg space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/lms")} className="-ml-2">
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
                <CardDescription>Link your organization to another for easy switching.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {acceptLink.isPending && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>Processing your link invitation…</AlertDescription>
              </Alert>
            )}
            {acceptLink.isSuccess && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Organizations linked! Redirecting to your dashboard…
                </AlertDescription>
              </Alert>
            )}
            {acceptLink.isError && (
              <Alert className="border-destructive/50 bg-destructive/5">
                <XCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {acceptLink.error?.message || "Invalid or expired link invitation."}
                </AlertDescription>
              </Alert>
            )}
            {!acceptLink.isPending && !acceptLink.isSuccess && !acceptLink.isError && (
              <>
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                    Accepting this link will allow you to switch between your organization and the requesting organization from your dashboard. No data is shared.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => acceptLink.mutate({ token: pendingToken })}
                    disabled={acceptLink.isPending}
                  >
                    Accept &amp; Link
                  </Button>
                  <Button variant="outline" onClick={() => setLocation("/lms")}>
                    Decline
                  </Button>
                </div>
              </>
            )}
            {acceptLink.isSuccess && (
              <Button variant="outline" className="w-full" onClick={() => setLocation("/lms")}>
                Go to Dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Access check ─────────────────────────────────────────────────────────
  if (user && user.role !== "site_owner") {
    return (
      <div className="p-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only site owners can link organizations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setLocation("/lms")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
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
              <span className="ml-1 font-medium text-foreground">Active: {activeOrg.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* Send invitation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {inviteSent ? "Invitation Sent" : "Invite Another Organization"}
          </CardTitle>
          <CardDescription>
            {inviteSent
              ? "The other admin will receive an email with a link to accept."
              : "Enter the email address of the admin for the organization you want to link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!inviteSent ? (
            <div className="space-y-3">
              <Label htmlFor="target-email">
                <Mail className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                Other Organization Admin Email
              </Label>
              <div className="flex gap-2">
                <Input
                  id="target-email"
                  type="email"
                  placeholder="admin@otherschool.com"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && targetEmail.trim() && orgId) {
                      initiateLink.mutate({
                        primaryOrgId: orgId,
                        linkedOrgEmail: targetEmail.trim(),
                        origin: window.location.origin,
                      });
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    if (!targetEmail.trim()) { toast.error("Email is required"); return; }
                    if (!orgId) { toast.error("No active organization selected"); return; }
                    initiateLink.mutate({
                      primaryOrgId: orgId,
                      linkedOrgEmail: targetEmail.trim(),
                      origin: window.location.origin,
                    });
                  }}
                  disabled={initiateLink.isPending || !targetEmail.trim() || !orgId}
                >
                  {initiateLink.isPending ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                  ) : "Send Invite"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The admin of that organization will receive an email invitation. Once they accept, both organizations appear in your org switcher.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">Invitation sent!</p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    An email was sent to the admin. Once they accept, their organization will appear in your sidebar switcher.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setInviteSent(false)}>
                Send Another Invitation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {pendingLinks && pendingLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Invitations
              <Badge variant="secondary" className="ml-1">{pendingLinks.length}</Badge>
            </CardTitle>
            <CardDescription>These invitations are awaiting acceptance by the other admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(pendingLinks as any[]).map((link: any) => (
              <div
                key={link.linkId}
                className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30"
              >
                <Avatar className="h-8 w-8 shrink-0 rounded-md border border-border/40">
                  {link.linkedOrg?.logoUrl ? (
                    <img src={link.linkedOrg.logoUrl} alt={link.linkedOrg.name} className="h-full w-full object-cover rounded-md" />
                  ) : (
                    <AvatarFallback className="rounded-md text-[10px] font-bold bg-amber-100 text-amber-700">
                      {link.linkedOrg ? initials(link.linkedOrg.name) : <Building2 className="h-3 w-3" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{link.linkedOrg?.name ?? "Unknown Organization"}</p>
                  {link.linkedOrg?.slug && (
                    <p className="text-xs text-muted-foreground truncate">{link.linkedOrg.slug}.teachific.app</p>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0 text-xs border-amber-300 text-amber-700 bg-amber-50">
                  Pending
                </Badge>
                <Button
                  variant="ghost" size="sm"
                  className="shrink-0 text-destructive hover:text-destructive h-7 w-7 p-0"
                  title="Cancel invitation"
                  onClick={() => removeLink.mutate({ linkId: link.linkId })}
                  disabled={removeLink.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Accepted / linked orgs */}
      {existingLinks && existingLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Linked Organizations
              <Badge variant="secondary" className="ml-1">{existingLinks.length}</Badge>
            </CardTitle>
            <CardDescription>These organizations appear in your org switcher dropdown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(existingLinks as any[]).map((link: any) => (
              <div key={link.linkId} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Avatar className="h-8 w-8 shrink-0 rounded-md border border-border/40">
                  {link.linkedOrg?.logoUrl ? (
                    <img src={link.linkedOrg.logoUrl} alt={link.linkedOrg.name} className="h-full w-full object-cover rounded-md" />
                  ) : (
                    <AvatarFallback className="rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                      {link.linkedOrg ? initials(link.linkedOrg.name) : <Building2 className="h-3 w-3" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{link.linkedOrg?.name ?? "Unknown Organization"}</p>
                  {link.linkedOrg?.slug && (
                    <p className="text-xs text-muted-foreground truncate">{link.linkedOrg.slug}.teachific.app</p>
                  )}
                </div>
                <Badge variant="default" className="shrink-0 text-xs">Linked</Badge>
                <Button
                  variant="ghost" size="sm"
                  className="shrink-0 text-destructive hover:text-destructive h-7 w-7 p-0"
                  title="Remove link"
                  onClick={() => removeLink.mutate({ linkId: link.linkId })}
                  disabled={removeLink.isPending}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How it works</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground shrink-0">1.</span>
              <span>Enter the email of the admin for the other organization and send an invitation.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground shrink-0">2.</span>
              <span>They receive an email with a secure link to accept the connection.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-foreground shrink-0">3.</span>
              <span>Once accepted, both organizations appear in the org switcher in your sidebar — click the org name to switch between them.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
