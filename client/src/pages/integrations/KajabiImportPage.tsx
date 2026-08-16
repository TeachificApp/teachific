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
  Link2,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function KajabiImportPage() {
  const { orgId: activeOrgId } = useOrgScope();
  const orgId = activeOrgId ?? 0;

  const { data: status, refetch: refetchStatus, isLoading: statusLoading } =
    trpc.platformImport.kajabi.getStatus.useQuery(
      { orgId },
      { enabled: orgId > 0 }
    );

  const [apiKey, setApiKey] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);

  const connectMut = trpc.platformImport.kajabi.connect.useMutation({
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

  const disconnectMut = trpc.platformImport.kajabi.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Kajabi integration removed.");
      refetchStatus();
    },
  });

  const syncUsersMut = trpc.platformImport.kajabi.syncUsers.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} new users, ${data.skipped} already existed, ${data.errors} errors.`);
      refetchStatus();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncCoursesMut = trpc.platformImport.kajabi.syncCourses.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} new products/courses, ${data.skipped} already existed, ${data.errors} errors.`);
      refetchStatus();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncMembershipsMut = trpc.platformImport.kajabi.syncMemberships.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.imported} new memberships, ${data.skipped} skipped, ${data.errors} errors.`);
      refetchStatus();
    },
    onError: (err) => toast.error(err.message),
  });

  const isAnySyncing =
    syncUsersMut.isPending || syncCoursesMut.isPending || syncMembershipsMut.isPending;

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
        <h1 className="text-2xl font-bold tracking-tight">Import from Kajabi</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Kajabi site to import members, products, and memberships into Teachific.
        </p>
      </div>

      {/* Connection Status */}
      {status?.connected ? (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <CardTitle className="text-base">Connected to Kajabi</CardTitle>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-300">Active</Badge>
            </div>
            <CardDescription>
              Site: <strong>{status.schoolName ?? "Your Kajabi Site"}</strong>
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
                  <p className="text-xs text-muted-foreground">Members imported</p>
                </div>
                <div className="rounded-lg bg-background/60 p-3">
                  <p className="text-2xl font-bold">{status.stats.courses ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Products imported</p>
                </div>
                <div className="rounded-lg bg-background/60 p-3">
                  <p className="text-2xl font-bold">{status.stats.memberships ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Memberships</p>
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
              Enter your Kajabi API key to connect your site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Kajabi API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="••••••••••••••••"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Find your API key in Kajabi → Settings → Developer → API Keys.
                <a
                  href="https://help.kajabi.com/hc/en-us/articles/360035049474"
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
              Connect Kajabi
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
              Sync your Kajabi data into Teachific. Run in order: Members → Products → Memberships.
              Existing records are skipped (safe to re-run).
            </p>

            <div className="grid gap-3">
              {/* Sync Members */}
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Sync Members</p>
                      <p className="text-xs text-muted-foreground">
                        Import all Kajabi members as Teachific users
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
                      <><RefreshCw className="w-4 h-4 mr-1" /> Sync Members</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Sync Products */}
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Sync Products</p>
                      <p className="text-xs text-muted-foreground">
                        Import all Kajabi products as Teachific courses
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
                      <><RefreshCw className="w-4 h-4 mr-1" /> Sync Products</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Sync Memberships */}
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Sync Memberships</p>
                      <p className="text-xs text-muted-foreground">
                        Link synced members to synced products (run after both above)
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMembershipsMut.mutate({ orgId })}
                    disabled={isAnySyncing}
                  >
                    {syncMembershipsMut.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Syncing...</>
                    ) : (
                      <><RefreshCw className="w-4 h-4 mr-1" /> Sync Memberships</>
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
              <p className="font-medium text-sm">Disconnect Kajabi</p>
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
