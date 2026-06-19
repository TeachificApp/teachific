import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Users, CheckCircle, AlertCircle } from "lucide-react";

export default function JoinGroupPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "joining" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  const joinMut = trpc.lms.groups.joinByInvite.useMutation({
    onSuccess: (res) => {
      setGroupName(res.groupName ?? "the group");
      setStatus("success");
    },
    onError: (e) => {
      setErrorMsg(e.message);
      setStatus("error");
    },
  });

  useEffect(() => {
    if (!authLoading && user && token && status === "idle") {
      setStatus("joining");
      joinMut.mutate({ token });
    }
  }, [authLoading, user, token, status]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-sm w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>You've been invited to join a group</CardTitle>
            <CardDescription>Sign in or create an account to accept this invitation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => {
                const returnPath = `/join-group?token=${token}`;
                window.location.href = getLoginUrl(returnPath);
              }}
            >
              Sign In to Accept Invitation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "joining" || status === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Joining group...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-sm w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>You've joined {groupName}!</CardTitle>
            <CardDescription>You now have access to all courses and resources assigned to this group.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" onClick={() => setLocation("/my-courses")}>
              Go to My Courses
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-sm w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle>Invitation Error</CardTitle>
          <CardDescription>{errorMsg || "This invitation link is invalid or has expired."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
