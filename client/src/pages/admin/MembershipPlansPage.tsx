import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function MembershipPlansPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: "0",
    billingCycle: "monthly" as const,
    trialDays: 0,
    maxMembers: "",
  });

  const plansQuery = trpc.membership.plans.list.useQuery(
    { orgId: orgId || 0 },
    { enabled: !!orgId }
  );

  const createPlanMutation = trpc.membership.plans.create.useMutation({
    onSuccess: () => {
      plansQuery.refetch();
      setNewPlan({
        name: "",
        description: "",
        price: "0",
        billingCycle: "monthly",
        trialDays: 0,
        maxMembers: "",
      });
      setIsCreating(false);
    },
  });

  const deletePlanMutation = trpc.membership.plans.delete.useMutation({
    onSuccess: () => plansQuery.refetch(),
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
          <h1 className="text-3xl font-bold">Membership Plans</h1>
          <p className="text-gray-600">Create and manage membership plans for your organization</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Membership Plan</DialogTitle>
              <DialogDescription>Set up a new membership plan</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Plan Name</label>
                <Input
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="e.g., Premium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  placeholder="Describe what's included in this plan"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Price ($)</label>
                  <Input
                    type="number"
                    value={newPlan.price}
                    onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Billing Cycle</label>
                  <Select
                    value={newPlan.billingCycle}
                    onValueChange={(value: any) =>
                      setNewPlan({ ...newPlan, billingCycle: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Trial Days</label>
                  <Input
                    type="number"
                    value={newPlan.trialDays}
                    onChange={(e) => setNewPlan({ ...newPlan, trialDays: parseInt(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Members (optional)</label>
                  <Input
                    type="number"
                    value={newPlan.maxMembers}
                    onChange={(e) => setNewPlan({ ...newPlan, maxMembers: e.target.value })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              <Button
                onClick={() =>
                  createPlanMutation.mutate({
                    orgId,
                    name: newPlan.name,
                    description: newPlan.description || undefined,
                    price: newPlan.price,
                    billingCycle: newPlan.billingCycle,
                    trialDays: newPlan.trialDays,
                    maxMembers: newPlan.maxMembers ? parseInt(newPlan.maxMembers) : undefined,
                  })
                }
                disabled={!newPlan.name || !newPlan.price || createPlanMutation.isPending}
              >
                {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {plansQuery.data?.map((plan: any) => (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => deletePlanMutation.mutate({ id: plan.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Price</p>
                  <p className="font-semibold">${plan.price}</p>
                </div>
                <div>
                  <p className="text-gray-600">Billing</p>
                  <p className="font-semibold capitalize">{plan.billingCycle}</p>
                </div>
                <div>
                  <p className="text-gray-600">Trial</p>
                  <p className="font-semibold">{plan.trialDays} days</p>
                </div>
                <div>
                  <p className="text-gray-600">Max Members</p>
                  <p className="font-semibold">{plan.maxMembers || "Unlimited"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-semibold">
                    <span className={plan.isActive ? "text-green-600" : "text-gray-600"}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plansQuery.data?.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-600 mb-4">No membership plans yet. Create your first plan.</p>
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
