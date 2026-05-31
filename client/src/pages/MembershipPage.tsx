import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

export default function MembershipPage() {
  const { user } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const plansQuery = trpc.membership.plans.list.useQuery(
    { orgId: user?.orgId || 0 },
    { enabled: !!user?.orgId }
  );

  const subscriptionsQuery = trpc.membership.subscriptions.list.useQuery(
    { orgId: user?.orgId || 0, userId: user?.id || 0 },
    { enabled: !!user?.id && !!user?.orgId }
  );

  const subscribeMutation = trpc.membership.subscriptions.create.useMutation({
    onSuccess: () => {
      subscriptionsQuery.refetch();
      setSelectedPlanId(null);
    },
  });

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p>Please log in to view membership options.</p>
      </div>
    );
  }

  const currentSubscription = subscriptionsQuery.data?.[0];

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Membership Plans</h1>
        <p className="text-gray-600">Choose the perfect plan for your learning journey</p>
      </div>

      {/* Current Subscription */}
      {currentSubscription && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Current Plan</CardTitle>
                <CardDescription>
                  {currentSubscription.plan?.name} - {currentSubscription.status}
                </CardDescription>
              </div>
              <Badge className="bg-green-600">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Price</p>
                <p className="font-semibold">${currentSubscription.plan?.price}</p>
              </div>
              <div>
                <p className="text-gray-600">Billing Cycle</p>
                <p className="font-semibold capitalize">{currentSubscription.plan?.billingCycle}</p>
              </div>
              <div>
                <p className="text-gray-600">Renews On</p>
                <p className="font-semibold">
                  {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button variant="outline" className="mt-4">
              Manage Subscription
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plansQuery.data?.map((plan: any) => (
            <Card
              key={plan.id}
              className={
                currentSubscription?.planId === plan.id
                  ? "border-blue-500 border-2"
                  : ""
              }
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-gray-600 ml-2">/ {plan.billingCycle}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {plan.trialDays > 0 && (
                  <div className="bg-blue-50 p-3 rounded text-sm">
                    <p className="font-semibold">{plan.trialDays} day free trial</p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Full course access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Community support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Certificate of completion</span>
                  </div>
                  {plan.maxMembers && (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span>Up to {plan.maxMembers} members</span>
                    </div>
                  )}
                </div>

                {currentSubscription?.planId === plan.id ? (
                  <Button disabled className="w-full">
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      subscribeMutation.mutate({
                        orgId: user.orgId,
                        userId: user.id,
                        planId: plan.id,
                      })
                    }
                    disabled={subscribeMutation.isPending}
                    className="w-full"
                  >
                    {subscribeMutation.isPending ? "Subscribing..." : "Subscribe"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {plansQuery.data?.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-600">No membership plans available at this time.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
