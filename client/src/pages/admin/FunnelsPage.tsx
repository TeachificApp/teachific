import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Eye, BarChart3 } from "lucide-react";

export default function FunnelsPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newFunnel, setNewFunnel] = useState({ name: "", description: "" });

  const funnelsQuery = trpc.funnels.list.useQuery(
    { orgId: orgId || 0 },
    { enabled: !!orgId }
  );

  const createFunnelMutation = trpc.funnels.create.useMutation({
    onSuccess: () => {
      funnelsQuery.refetch();
      setNewFunnel({ name: "", description: "" });
      setIsCreating(false);
    },
  });

  const deleteFunnelMutation = trpc.funnels.delete.useMutation({
    onSuccess: () => funnelsQuery.refetch(),
  });

  if (!orgId) {
    return (
      <div className="p-8">
        <p>Loading organization...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Funnels</h1>
          <p className="text-gray-600">Create and manage sales funnels for your products</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Funnel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Funnel</DialogTitle>
              <DialogDescription>Set up a new sales funnel</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Funnel Name</label>
                <Input
                  value={newFunnel.name}
                  onChange={(e) => setNewFunnel({ ...newFunnel, name: e.target.value })}
                  placeholder="e.g., Product Launch Funnel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={newFunnel.description}
                  onChange={(e) => setNewFunnel({ ...newFunnel, description: e.target.value })}
                  placeholder="Describe the purpose of this funnel"
                />
              </div>
              <Button
                onClick={() =>
                  createFunnelMutation.mutate({
                    orgId,
                    name: newFunnel.name,
                    description: newFunnel.description || null,
                  })
                }
                disabled={!newFunnel.name || createFunnelMutation.isPending}
              >
                {createFunnelMutation.isPending ? "Creating..." : "Create Funnel"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {funnelsQuery.data?.map((funnel: any) => (
          <Card key={funnel.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{funnel.name}</CardTitle>
                  <CardDescription>{funnel.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => deleteFunnelMutation.mutate({ id: funnel.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Pages</p>
                  <p className="font-semibold">{funnel.pageCount || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Leads</p>
                  <p className="font-semibold">{funnel.leadCount || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Conversions</p>
                  <p className="font-semibold">{funnel.conversionCount || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Conversion Rate</p>
                  <p className="font-semibold">
                    {funnel.leadCount > 0
                      ? ((funnel.conversionCount / funnel.leadCount) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {funnelsQuery.data?.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-600 mb-4">No funnels yet. Create your first sales funnel.</p>
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Funnel
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
