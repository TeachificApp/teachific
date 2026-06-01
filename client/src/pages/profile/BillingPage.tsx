import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  CreditCard, Check, Crown, Zap, Rocket, Building2,
  ArrowUpRight, AlertCircle, CheckCircle2, Clock, ExternalLink, Send,
} from "lucide-react";

type PlanTier = "free" | "starter" | "builder" | "pro" | "enterprise";

const PLAN_META: Record<PlanTier, {
  name: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  description: string;
  features: string[];
  highlight?: boolean;
}> = {
  free: {
    name: "Free",
    icon: Zap,
    color: "text-slate-500",
    gradient: "from-slate-100 to-slate-50",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Get started with the basics",
    features: [
      "1 admin, 1 member",
      "1 course",
      "100 MB file storage",
      "Admin is the only instructor",
      "No community",
    ],
  },
  starter: {
    name: "Starter",
    icon: Zap,
    color: "text-blue-500",
    gradient: "from-blue-50 to-blue-50/30",
    monthlyPrice: 39,
    annualPrice: 399,
    description: "Perfect for small teams getting started",
    features: [
      "1 admin, 3 members",
      "5 courses",
      "500 MB file storage",
      "1 instructor role",
      "1 membership tier",
      "3% transaction fee",
    ],
  },
  builder: {
    name: "Builder",
    icon: Rocket,
    color: "text-violet-500",
    gradient: "from-violet-50 to-violet-50/30",
    monthlyPrice: 99,
    annualPrice: 999,
    description: "Scale your learning platform",
    highlight: true,
    features: [
      "1 admin, 500 members",
      "20 courses, 1 community",
      "500 GB file storage",
      "3 instructor roles",
      "White label branding",
      "3 membership tiers",
      "Custom domain",
      "1% transaction fee",
    ],
  },
  pro: {
    name: "Pro",
    icon: Crown,
    color: "text-amber-500",
    gradient: "from-amber-50 to-amber-50/30",
    monthlyPrice: 199,
    annualPrice: 1999,
    description: "For serious learning businesses",
    features: [
      "3 admins, 10,000 members",
      "50 courses, 3 communities",
      "1 TB file storage",
      "10 instructor roles",
      "Email marketing",
      "No transaction fees",
      "Group registrations",
      "10 membership tiers",
      "Affiliate platform",
      "SSO + Revenue Share",
      "Custom CSS + domain",
    ],
  },
  enterprise: {
    name: "Enterprise",
    icon: Building2,
    color: "text-emerald-500",
    gradient: "from-emerald-50 to-emerald-50/30",
    monthlyPrice: null,
    annualPrice: null,
    description: "Unlimited scale, custom pricing",
    features: [
      "Unlimited admins & members",
      "Unlimited courses & communities",
      "5 TB file storage",
      "Unlimited instructor roles",
      "All Pro features included",
      "Custom onboarding team",
      "Dedicated support",
    ],
  },
};

const STATUS_CONFIG = {
  active: { label: "Active", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  trialing: { label: "Trial", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
  past_due: { label: "Past Due", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  cancelled: { label: "Cancelled", icon: AlertCircle, color: "text-slate-500", bg: "bg-slate-50" },
  incomplete: { label: "Incomplete", icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
};

export default function BillingPage() {
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [enterpriseForm, setEnterpriseForm] = useState({
    teamSize: "",
    message: "",
  });

  const { user } = useAuth();
  const { data: subscription, isLoading } = trpc.billing.getSubscription.useQuery();

  const createCheckout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.info("Redirecting to Stripe checkout...");
      }
    },
    onError: (err) => {
      toast.error(err.message);
      setLoadingPlan(null);
    },
    onSettled: () => setLoadingPlan(null),
  });

  const createPortal = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.info("Opening billing portal...");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const contactEnterprise = trpc.billing.contactEnterprise.useMutation({
    onSuccess: () => {
      toast.success("Inquiry sent! We'll be in touch shortly.");
      setEnterpriseOpen(false);
      setEnterpriseForm({ teamSize: "", message: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpgrade = (plan: "starter" | "builder" | "pro") => {
    setLoadingPlan(plan);
    createCheckout.mutate({
      plan,
      interval: annual ? "annual" : "monthly",
      origin: window.location.origin,
    });
  };

  const handlePortal = () => {
    createPortal.mutate({ origin: window.location.origin });
  };

  const currentPlan = (subscription?.plan ?? "free") as PlanTier;
  const statusInfo = STATUS_CONFIG[subscription?.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active;
  const StatusIcon = statusInfo.icon;

  const plans: PlanTier[] = ["free", "starter", "builder", "pro", "enterprise"];

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your Teachific subscription and payment methods.
            </p>
          </div>
        </div>
        {subscription?.stripeCustomerId && (
          <Button variant="outline" className="gap-2 shrink-0" onClick={handlePortal} disabled={createPortal.isPending}>
            <ExternalLink className="h-4 w-4" />
            {createPortal.isPending ? "Opening..." : "Manage Billing"}
          </Button>
        )}
      </div>

      {/* Current Plan Status */}
      {!isLoading && subscription && (
        <Card className={`border-2 ${currentPlan !== "free" ? "border-primary/30" : "border-border"}`}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {(() => {
                  const meta = PLAN_META[currentPlan];
                  const Icon = meta.icon;
                  return (
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${meta.gradient}`}>
                      <Icon className={`h-6 w-6 ${meta.color}`} />
                    </div>
                  );
                })()}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{PLAN_META[currentPlan].name} Plan</h3>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </div>
                  </div>
                  {subscription.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground">
                      {subscription.cancelAtPeriodEnd
                        ? `Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                        : `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                    </p>
                  )}
                  {currentPlan === "free" && (
                    <p className="text-sm text-muted-foreground">No active subscription — upgrade to unlock more features</p>
                  )}
                </div>
              </div>
              {subscription.stripeSubscriptionId && (
                <Button variant="outline" size="sm" onClick={handlePortal} disabled={createPortal.isPending}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Manage
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-toggle" className={!annual ? "font-semibold" : "text-muted-foreground"}>
          Monthly
        </Label>
        <Switch id="billing-toggle" checked={annual} onCheckedChange={setAnnual} />
        <Label htmlFor="billing-toggle" className={annual ? "font-semibold" : "text-muted-foreground"}>
          Annual
          <Badge variant="secondary" className="ml-2 text-xs text-green-700 bg-green-100">Save ~15%</Badge>
        </Label>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {plans.map((tier) => {
          const meta = PLAN_META[tier];
          const Icon = meta.icon;
          const isCurrent = currentPlan === tier;
          const price = annual ? meta.annualPrice : meta.monthlyPrice;
          const isEnterprise = tier === "enterprise";
          const isDowngrade = plans.indexOf(tier) < plans.indexOf(currentPlan);

          return (
            <Card
              key={tier}
              className={`relative flex flex-col transition-all duration-200 ${
                meta.highlight
                  ? "border-primary shadow-md ring-1 ring-primary/20"
                  : isCurrent
                  ? "border-primary/40 bg-primary/5"
                  : "hover:border-primary/30 hover:shadow-sm"
              }`}
            >
              {meta.highlight && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-xs px-3">Most Popular</Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary" className="text-xs px-3">Current Plan</Badge>
                </div>
              )}
              <CardHeader className="pb-3 pt-6">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center mb-2`}>
                  <Icon className={`h-5 w-5 ${meta.color}`} />
                </div>
                <CardTitle className="text-base">{meta.name}</CardTitle>
                <CardDescription className="text-xs">{meta.description}</CardDescription>
                <div className="pt-1">
                  {price === null ? (
                    <span className="text-xl font-bold">Custom</span>
                  ) : price === 0 ? (
                    <span className="text-xl font-bold">Free</span>
                  ) : (
                    <div>
                      <span className="text-2xl font-bold">${price}</span>
                      <span className="text-xs text-muted-foreground ml-1">/{annual ? "yr" : "mo"}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <ul className="space-y-1.5 flex-1">
                  {meta.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  {isCurrent ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : isEnterprise ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => setEnterpriseOpen(true)}
                    >
                      Contact Sales
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  ) : tier === "free" ? (
                    <Button variant="ghost" size="sm" className="w-full" disabled>
                      Always Free
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={handlePortal}
                      disabled={createPortal.isPending}
                    >
                      Downgrade
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      variant={meta.highlight ? "default" : "outline"}
                      onClick={() => handleUpgrade(tier as "starter" | "builder" | "pro")}
                      disabled={loadingPlan === tier || createCheckout.isPending}
                    >
                      {loadingPlan === tier ? "Loading..." : "Upgrade"}
                      {loadingPlan !== tier && <ArrowUpRight className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Test Mode Notice */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Test Mode Active</p>
              <p className="text-amber-700 mt-0.5">
                Use card <code className="bg-amber-100 px-1 rounded font-mono text-xs">4242 4242 4242 4242</code> with any future expiry and CVC to test payments.
                Live payments require your Stripe live keys to be configured in Settings → Payment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enterprise inquiry dialog */}
      <Dialog open={enterpriseOpen} onOpenChange={setEnterpriseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Enterprise Plan Inquiry
            </DialogTitle>
            <DialogDescription>
              Tell us about your organisation and we'll prepare a custom quote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="teamSize">Team size</Label>
              <Select
                value={enterpriseForm.teamSize}
                onValueChange={(v) => setEnterpriseForm((f) => ({ ...f, teamSize: v }))}
              >
                <SelectTrigger id="teamSize">
                  <SelectValue placeholder="Select team size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10-50">10 – 50 members</SelectItem>
                  <SelectItem value="51-200">51 – 200 members</SelectItem>
                  <SelectItem value="201-1000">201 – 1,000 members</SelectItem>
                  <SelectItem value="1001+">1,000+ members</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enterpriseMsg">Tell us about your needs</Label>
              <Textarea
                id="enterpriseMsg"
                placeholder="Custom integrations, onboarding requirements, SLA needs…"
                rows={4}
                value={enterpriseForm.message}
                onChange={(e) => setEnterpriseForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnterpriseOpen(false)}>Cancel</Button>
            <Button
              onClick={() => contactEnterprise.mutate({
                orgId: subscription?.orgId ?? 0,
                orgName: subscription?.orgName ?? "",
                contactName: user?.name ?? "",
                contactEmail: user?.email ?? "",
                ...enterpriseForm,
              })}
              disabled={contactEnterprise.isPending || !enterpriseForm.teamSize}
            >
              {contactEnterprise.isPending ? "Sending…" : "Send Inquiry"}
              <Send className="ml-2 h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      <div className="text-center text-sm text-muted-foreground">
        All plans include core LMS features. Upgrade to unlock more members, courses, and advanced capabilities.
        {" "}
        <a href="mailto:support@teachific.app" className="text-primary hover:underline">Contact support</a>
      </div>
    </div>
  );
}
