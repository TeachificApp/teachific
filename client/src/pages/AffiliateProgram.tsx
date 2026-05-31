import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, DollarSign, TrendingUp, Users } from "lucide-react";
import { useState } from "react";

export default function AffiliateProgramPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const affiliateStatsQuery = trpc.lms.affiliates.getStats.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user?.id }
  );

  const commissionsQuery = trpc.lms.affiliates.getCommissions.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user?.id }
  );

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p>Please log in to access the affiliate program.</p>
      </div>
    );
  }

  const affiliateLink = `${window.location.origin}?ref=${user.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = affiliateStatsQuery.data || {
    totalReferrals: 0,
    totalConversions: 0,
    totalEarnings: 0,
    conversionRate: 0,
  };

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Affiliate Program</h1>
        <p className="text-gray-600">Earn commissions by referring others to our courses</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Referrals</p>
                <p className="text-3xl font-bold">{stats.totalReferrals}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Conversions</p>
                <p className="text-3xl font-bold">{stats.totalConversions}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Conversion Rate</p>
                <p className="text-3xl font-bold">{stats.conversionRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-3xl font-bold">${stats.totalEarnings.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Affiliate Link */}
      <Card>
        <CardHeader>
          <CardTitle>Your Affiliate Link</CardTitle>
          <CardDescription>Share this link to start earning commissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={affiliateLink} readOnly className="flex-1" />
            <Button onClick={handleCopyLink} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Commission History */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Recent Commissions</h2>
        <Card>
          <CardContent className="pt-6">
            {commissionsQuery.data && commissionsQuery.data.length > 0 ? (
              <div className="space-y-4">
                {commissionsQuery.data.map((commission: any) => (
                  <div
                    key={commission.id}
                    className="flex items-center justify-between border-b pb-4"
                  >
                    <div>
                      <p className="font-semibold">{commission.course?.name}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(commission.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        +${commission.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {commission.commissionRate}% commission
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-600">
                No commissions yet. Start sharing your affiliate link!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
              1
            </div>
            <div>
              <p className="font-semibold">Share Your Link</p>
              <p className="text-sm text-gray-600">
                Copy and share your unique affiliate link with friends and followers
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <div>
              <p className="font-semibold">They Sign Up</p>
              <p className="text-sm text-gray-600">
                When someone clicks your link and enrolls in a course, you earn a commission
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <p className="font-semibold">Get Paid</p>
              <p className="text-sm text-gray-600">
                Earn recurring commissions on every referral. Payments are made monthly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
