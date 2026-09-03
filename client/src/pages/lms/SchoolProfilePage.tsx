import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import SchoolMemberLayout from "@/components/SchoolMemberLayout";
import { getSubdomain } from "@/hooks/useSubdomain";
import { getOrgBaseUrl } from "@/lib/orgUrl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { User, Mail, Calendar, LogOut, AlertCircle, Shield } from "lucide-react";

export default function SchoolProfilePage() {
  const params = useParams<{ orgSlug?: string }>();
  const orgSlug = params?.orgSlug ?? getSubdomain() ?? undefined;
  const { user } = useAuth();
  const [leaveOpen, setLeaveOpen] = useState(false);

  const { data: orgBySlug } = trpc.orgs.publicSchoolBySlug.useQuery(
    { slug: orgSlug! },
    { enabled: !!orgSlug }
  );

  const { data: membership } = trpc.lms.members.getMyMembership.useQuery(
    { orgId: orgBySlug?.id! },
    { enabled: !!orgBySlug?.id }
  );

  const leaveOrg = trpc.billing.leaveOrg.useMutation({
    onSuccess: () => {
      toast.success("You have left the school. Redirecting…");
      const base = orgSlug ? getOrgBaseUrl(orgSlug) : "/school";
      setTimeout(() => { window.location.href = base; }, 1500);
    },
    onError: (err) => toast.error(err.message),
  });

  const isAdmin = membership?.role && ["org_super_admin", "org_admin"].includes(membership.role);
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <SchoolMemberLayout orgSlug={orgSlug}>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your account details and membership information for {orgBySlug?.name ?? "this school"}.
          </p>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-lg">{user?.name ?? "—"}</p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {user?.email ?? "—"}
                </div>
              </div>
            </div>
            {membership && (
              <div className="flex items-center gap-2 pt-1">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Role:</span>
                <Badge variant="secondary" className="text-xs capitalize">
                  {membership.role.replace("org_", "").replace("_", " ")}
                </Badge>
                {membership.joinedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                    <Calendar className="h-3 w-3" />
                    Joined {new Date(membership.joinedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Membership Management */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Membership</CardTitle>
            <CardDescription>
              Manage your membership in {orgBySlug?.name ?? "this school"}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground flex items-start gap-2">
                <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  You are an admin of this school. Admins cannot self-remove.
                  Transfer ownership before leaving.
                </span>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Leaving this school will remove your access to all enrolled courses and content.
                  This action cannot be undone.
                </p>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 gap-2"
                  onClick={() => setLeaveOpen(true)}
                  disabled={!membership}
                >
                  <LogOut className="h-4 w-4" />
                  Leave this School
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Separator />

        <p className="text-xs text-muted-foreground text-center">
          Need help? Contact your school administrator or{" "}
          <a href="mailto:support@course360.app" className="text-primary hover:underline">
            Course360 support
          </a>.
        </p>
      </div>

      {/* Leave School Confirmation Dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Leave {orgBySlug?.name ?? "this School"}?
            </DialogTitle>
            <DialogDescription className="pt-1">
              You will immediately lose access to all courses, content, and certificates in this school.
              You can re-enroll later if the school allows it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>
              Stay Enrolled
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (orgBySlug?.id) leaveOrg.mutate({ orgId: orgBySlug.id });
              }}
              disabled={leaveOrg.isPending || !orgBySlug?.id}
            >
              {leaveOrg.isPending ? "Leaving…" : "Yes, Leave School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SchoolMemberLayout>
  );
}
