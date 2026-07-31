import { useState } from "react";
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
import { Link2, ArrowLeft, Info, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function LinkOrganizationPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { orgId, adminOrgs } = useOrgScope();
  const [targetEmail, setTargetEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  // Accept a pending link invite (via token in URL)
  const urlParams = new URLSearchParams(window.location.search);
  const pendingToken = urlParams.get("token") || urlParams.get("link_token");

  const initiateLink = trpc.orgs.link.initiate.useMutation({
    onSuccess: () => {
      setInviteSent(true);
      toast.success("Link invitation sent! The other org admin will receive an email to accept.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send link invitation");
    },
  });

  const acceptLink = trpc.orgs.link.accept.useMutation({
    onSuccess: () => {
      toast.success("Organizations linked successfully! You can now switch between them.");
      setTimeout(() => setLocation("/lms"), 1500);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to accept link invitation");
    },
  });

  const removeLink = trpc.orgs.link.revoke.useMutation({
    onSuccess: () => {
      toast.success("Organization link removed.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove link");
    },
  });

  const utils = trpc.useUtils();

  // Fetch existing links for the current org
  const { data: existingLinks, refetch: refetchLinks } = trpc.orgs.link.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  // Only site owners can link orgs
  if (user?.role !== "site_owner") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only site owners can link organizations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setLocation("/lms")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If there's a pending token in the URL, show the accept flow
  if (pendingToken) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Accept Organization Link</CardTitle>
                <CardDescription>Link your organization to another for easy switching.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                Accepting this link will allow you to switch between your organization and the requesting organization from your dashboard.
                No data is shared between organizations.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Link to organization</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Pending link invitation</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => acceptLink.mutate({ token: pendingToken })}
                disabled={acceptLink.isPending || !orgId}
              >
                {acceptLink.isPending ? "Linking..." : "Accept & Link"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/lms")}
              >
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeOrg = adminOrgs?.find((o: any) => o.id === orgId);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/lms")}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Link Organization</CardTitle>
                <CardDescription>Connect two organizations you own (even with different emails) for easy dashboard switching.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                Linking allows you to switch between organizations from the dashboard sidebar. Organizations remain completely separate — no shared members, courses, or data.
              </AlertDescription>
            </Alert>

            {/* Current org */}
            {activeOrg && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Current Organization</Label>
                <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-muted/30">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{activeOrg.name}</p>
                    {activeOrg.slug && <p className="text-xs text-muted-foreground">{activeOrg.slug}.teachific.app</p>}
                  </div>
                  <Badge variant="secondary" className="ml-auto shrink-0 text-xs">Active</Badge>
                </div>
              </div>
            )}

            {/* Existing links */}
            {existingLinks && existingLinks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Linked Organizations</Label>
                <div className="space-y-2">
                  {existingLinks.map((link: any) => (
                    <div key={link.id} className="flex items-center gap-2.5 p-3 rounded-lg border">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{link.linkedOrg?.name}</p>
                        <p className="text-xs text-muted-foreground">{link.linkedOrg?.slug}.teachific.app</p>
                      </div>
                      <Badge
                        variant={link.status === "accepted" ? "default" : "secondary"}
                        className="shrink-0 text-xs"
                      >
                        {link.status === "accepted" ? "Linked" : "Pending"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-destructive hover:text-destructive h-7 px-2"
                        onClick={() => {
                          removeLink.mutate({ linkId: link.linkId });
                          refetchLinks();
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Send new link invite */}
            {!inviteSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="target-email">Other Organization Admin Email</Label>
                  <Input
                    id="target-email"
                    type="email"
                    placeholder="admin@otherschool.com"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the email address of the admin of the organization you want to link. They'll receive an invitation to accept.
                  </p>
                </div>
                <Button
                  className="w-full"
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
                  {initiateLink.isPending ? "Sending..." : "Send Link Invitation"}
                </Button>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">Invitation sent!</p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    An email has been sent to <strong>{targetEmail}</strong>. Once they accept, both organizations will appear in your org switcher.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto mt-2 text-green-700 dark:text-green-400"
                    onClick={() => { setInviteSent(false); setTargetEmail(""); }}
                  >
                    Send another invitation
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
