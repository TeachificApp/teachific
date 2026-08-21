import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useOrgScope } from "@/hooks/useOrgScope";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Unplug,
  Users,
  BookOpen,
  GraduationCap,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function TeachableImportPage() {
  const { orgId: activeOrgId } = useOrgScope();
  const orgId = activeOrgId ?? 0;

  const { data: status, refetch: refetchStatus, isLoading: statusLoading } =
    trpc.platformImport.teachable.getStatus.useQuery(
      { orgId },
      { enabled: orgId > 0 }
    );

  const [apiKey, setApiKey] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);

  const connectMut = trpc.platformImport.teachable.connect.useMutation({
    onSuccess: (data) => {
      toast.success(`Successfully connected to ${data.schoolName}.`);
      setApiKey("");
      setConnectError(null);
      refetchStatus();
    },
    onError: (err) => {
      setConnectError(err.message);
    },
  });

  const disconnectMut = trpc.platformImport.teachable.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Teachable integration removed.");
      refetchStatus();
    },
  });

  const syncUsersMut = trpc.platformImport.teachable.syncUsers.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} new users, ${data.skipped} already existed, ${data.errors} errors.`);
      refetchStatus();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncCoursesMut = trpc.platformImport.teachable.syncCourses.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} new courses, ${data.skipped} already existed, ${data.errors} errors.`);
      refetchStatus();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncEnrollmentsMut = trpc.platformImport.teachable.syncEnrollments.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} new enrollments, ${data.skipped} skipped, ${data.errors} errors.`);
      refetchStatus();
    },
    onError: (err) => toast.error(err.message),
  });

  const isAnySyncing =
    syncUsersMut.isPending || syncCoursesMut.isPending || syncEnrollmentsMut.isPending;

  if (statusLoading || orgId === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import from Teachable</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Teachable school to import users, courses, and enrollments into Teachific.
        </p>
      </div>

      {/* Connection Status */}
      {status?.connected ? (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <CardTitle className="text-base">Connected to Teachable</CardTitle>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-300">Active</Badge>
            </div>
            <CardDescription>
              School: <strong>{status.schoolName ?? "Your Teachable School"}</strong>
              {status.lastSyncAt && (
                <span className="ml-3 text-xs text-muted-foreground">
                  Last sync: {new Date(status.lastSyncAt).toLocaleString()}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          {status.stats && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-background/60 p-3">
                  <p className="text-2xl font-bold">{status.stats.users ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Users imported</p>
                </div>
                <div className="rounded-lg bg-background/60 p-3">
                  <p className="text-2xl font-bold">{status.stats.courses ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Courses imported</p>
                </div>
                <div className="rounded-lg bg-background/60 p-3">
                  <p className="text-2xl font-bold">{status.stats.enrollments ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Enrollments</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-5 h-5 text-muted-foreground" />
              Not Connected
            </CardTitle>
            <CardDescription>
              Enter your Teachable API key to connect your school.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Teachable API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="••••••••••••••••"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Find your API key in Teachable → Settings → Integrations → API Key.
                <a
                  href="https://support.teachable.com/hc/en-us/articles/219914147"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Learn more <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            {connectError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{connectError}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={() => connectMut.mutate({ orgId, apiKey: apiKey.trim() })}
              disabled={!apiKey.trim() || connectMut.isPending}
            >
              {connectMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Connect Teachable
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sync Actions (only when connected) */}
      {status?.connected && (
        <>
          <Separator />
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Sync Data</h2>
            <p className="text-sm text-muted-foreground">
              Sync your Teachable data into Teachific. Run in order: Users → Courses → Enrollments.
              Existing records are skipped (safe to re-run).
            </p>

            <div className="grid gap-3">
              {/* Sync Users */}
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Sync Users</p>
                      <p className="text-xs text-muted-foreground">
                        Import all Teachable users as Teachific members
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncUsersMut.mutate({ orgId })}
                    disabled={isAnySyncing}
                  >
                    {syncUsersMut.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-1" /> Sync Users</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Sync Courses */}
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-[var(--org-primary)]" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Sync Courses</p>
                      <p className="text-xs text-muted-foreground">
                        Import all Teachable courses with sections and lectures
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncCoursesMut.mutate({ orgId })}
                    disabled={isAnySyncing}
                  >
                    {syncCoursesMut.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-1" /> Sync Courses</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Sync Enrollments */}
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Sync Enrollments</p>
                      <p className="text-xs text-muted-foreground">
                        Link synced users to synced courses (run after both above)
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncEnrollmentsMut.mutate({ orgId })}
                    disabled={isAnySyncing}
                  >
                    {syncEnrollmentsMut.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-1" /> Sync Enrollments</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Disconnect */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Disconnect Teachable</p>
              <p className="text-xs text-muted-foreground">
                Removes the API credentials. Already-imported data is kept.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => disconnectMut.mutate({ orgId })}
              disabled={disconnectMut.isPending}
            >
              {disconnectMut.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Unplug className="w-4 h-4 mr-1" />
              )}
              Disconnect
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
