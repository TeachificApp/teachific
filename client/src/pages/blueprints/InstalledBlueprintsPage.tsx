import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers, CheckCircle, Calendar, Package, Loader2, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

export default function InstalledBlueprintsPage() {
  const [, setLocation] = useLocation();
  const { data: installed, isLoading } = trpc.blueprints.listInstalled.useQuery();

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <h1 className="text-2xl font-bold">Installed Blueprints</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Blueprints that have been installed into your organization.
          </p>
        </div>
        <Button onClick={() => setLocation("/blueprints/marketplace")}>
          Browse Marketplace
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !installed?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No blueprints installed yet</p>
          <p className="text-sm mb-4">Browse the marketplace to find and install blueprints.</p>
          <Button onClick={() => setLocation("/blueprints/marketplace")}>
            Browse Marketplace
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {installed.map((inst) => (
            <Card key={inst.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#24abbc]/10">
                      <Package className="w-5 h-5 text-[#24abbc]" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{inst.blueprintName}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Installed by {inst.installedByName ?? "Admin"} ·{" "}
                        {new Date(inst.installedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={inst.status === "completed" ? "default" : inst.status === "failed" ? "destructive" : "secondary"}
                    className="text-xs shrink-0"
                  >
                    {inst.status === "completed" ? (
                      <><CheckCircle className="w-3 h-3 mr-1" />Installed</>
                    ) : inst.status === "failed" ? (
                      "Failed"
                    ) : (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Installing</>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              {inst.installedResources && (inst.installedResources as any[]).length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(inst.installedResources as any[]).map((res: any) => (
                      <span
                        key={res.newResourceId}
                        className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {res.resourceType}: {res.title ?? res.newResourceId}
                      </span>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
