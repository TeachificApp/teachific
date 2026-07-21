import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Layers, Search, Star, Download, Lock, CheckCircle, Loader2, Package, BookOpen, Video, FileText, Users, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  course: BookOpen,
  webinar: Video,
  download: FileText,
  membership: Users,
  bundle: Package,
  funnel: Zap,
};

const CATEGORY_LABELS: Record<string, string> = {
  course: "Course",
  webinar: "Webinar",
  download: "Digital Download",
  membership: "Membership",
  bundle: "Bundle",
  funnel: "Funnel",
};

export default function BlueprintMarketplacePage() {
  const { user } = useAuth();
  const { data: sub } = trpc.billing.getSubscription.useQuery();
  const planLimits = usePlanLimits();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedBlueprint, setSelectedBlueprint] = useState<number | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);

  const blueprintAccess = (sub?.limits as any)?.blueprintAccess ?? "none";
  const isPlatformAdmin = user?.role === "site_owner" || user?.role === "site_admin";
  const canInstall = isPlatformAdmin || blueprintAccess !== "none";

  const { data: blueprints, isLoading } = trpc.blueprints.listPublished.useQuery({
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  });

  const { data: installed } = trpc.blueprints.listInstalled.useQuery();
  const installedIds = new Set(installed?.map((i) => i.blueprintId) ?? []);

  const installMutation = trpc.blueprints.install.useMutation({
    onSuccess: () => {
      toast.success("Blueprint installed! Your new resources are ready to use.");
      setInstallDialogOpen(false);
      setSelectedBlueprint(null);
      setLocation("/blueprints/installed");
    },
    onError: (err) => {
      toast.error(`Installation failed: ${err.message}`);
    },
  });

  const selectedBp = blueprints?.find((b) => b.id === selectedBlueprint);

  function handleInstallClick(id: number) {
    if (!canInstall) {
      toast.error("Upgrade required: Blueprints are available on Builder plan and above.");
      return;
    }
    setSelectedBlueprint(id);
    setInstallDialogOpen(true);
  }

  return (
    <div className="container py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-6 h-6 text-[#24abbc]" />
            <h1 className="text-2xl font-bold">Blueprint Marketplace</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Install pre-built course systems, funnels, and content blueprints into your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation("/blueprints/installed")}>
            My Installed Blueprints
          </Button>
          {(isPlatformAdmin || blueprintAccess === "create" || blueprintAccess === "marketplace") && (
            <Button onClick={() => setLocation("/blueprints/manage")}>
              Manage Blueprints
            </Button>
          )}
        </div>
      </div>

      {/* Plan gate banner */}
      {!canInstall && (
        <Alert className="mb-6 border-amber-500/30 bg-amber-500/10">
          <Lock className="w-4 h-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Blueprints are available on the <strong>Builder</strong> plan and above.{" "}
            <button
              className="underline font-medium"
              onClick={() => setLocation("/lms/settings?tab=billing")}
            >
              Upgrade your plan
            </button>{" "}
            to install Blueprints.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search blueprints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="course">Course</SelectItem>
            <SelectItem value="webinar">Webinar</SelectItem>
            <SelectItem value="download">Digital Download</SelectItem>
            <SelectItem value="membership">Membership</SelectItem>
            <SelectItem value="bundle">Bundle</SelectItem>
            <SelectItem value="funnel">Funnel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !blueprints?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No blueprints found</p>
          <p className="text-sm">
            {search || categoryFilter !== "all"
              ? "Try adjusting your filters."
              : "No blueprints have been published yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {blueprints.map((bp) => {
            const CategoryIcon = CATEGORY_ICONS[bp.category] ?? Package;
            const isInstalled = installedIds.has(bp.id);
            return (
              <Card key={bp.id} className="flex flex-col hover:shadow-md transition-shadow">
                {bp.previewImageUrl && (
                  <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                    <img
                      src={bp.previewImageUrl}
                      alt={bp.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-[#24abbc]/10">
                        <CategoryIcon className="w-4 h-4 text-[#24abbc]" />
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABELS[bp.category] ?? bp.category}
                      </Badge>
                    </div>
                    {isInstalled && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Installed
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{bp.name}</CardTitle>
                  {bp.description && (
                    <CardDescription className="text-sm line-clamp-2">{bp.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pb-2 flex-1">
                  {bp.resourceSummary && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(bp.resourceSummary as Record<string, number>).map(([type, count]) => (
                        <span
                          key={type}
                          className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {count} {type}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Download className="w-3.5 h-3.5" />
                    <span>{bp.installCount ?? 0} installs</span>
                    {bp.averageRating && (
                      <>
                        <span className="mx-1">·</span>
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{Number(bp.averageRating).toFixed(1)}</span>
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isInstalled ? "outline" : "default"}
                    onClick={() => handleInstallClick(bp.id)}
                    disabled={!canInstall}
                  >
                    {isInstalled ? "Re-install" : canInstall ? "Install" : <><Lock className="w-3 h-3 mr-1" />Upgrade</>}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Install confirmation dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Blueprint</DialogTitle>
            <DialogDescription>
              This will create copies of all resources in this blueprint inside your organization.
              Existing content will not be affected.
            </DialogDescription>
          </DialogHeader>
          {selectedBp && (
            <div className="py-2">
              <p className="font-medium">{selectedBp.name}</p>
              {selectedBp.description && (
                <p className="text-sm text-muted-foreground mt-1">{selectedBp.description}</p>
              )}
              {selectedBp.resourceSummary && (
                <div className="mt-3 p-3 rounded-lg bg-muted text-sm">
                  <p className="font-medium mb-1">Resources that will be created:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selectedBp.resourceSummary as Record<string, number>).map(([type, count]) => (
                      <span key={type} className="px-2 py-0.5 rounded-full bg-background border text-xs">
                        {count} {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedBlueprint) {
                  installMutation.mutate({ blueprintId: selectedBlueprint });
                }
              }}
              disabled={installMutation.isPending}
            >
              {installMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Installing...</>
              ) : (
                "Install Blueprint"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
