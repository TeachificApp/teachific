import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Save,
  FileText,
  Package,
  Users,
  Zap,
  DollarSign,
  Plus,
  Trash2,
  UserPlus,
  BookOpen,
  Download,
  MessageSquare,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Globe } from "lucide-react";
import CheckoutPageEditor from "@/components/CheckoutPageEditor";

type TabId = "details" | "content" | "members" | "rules" | "pricing" | "checkout_page";

const tabs = [
  { id: "details" as const, label: "Details", icon: FileText },
  { id: "content" as const, label: "Content", icon: Package },
  { id: "members" as const, label: "Members", icon: Users },
  { id: "rules" as const, label: "Rules", icon: Zap },
  { id: "pricing" as const, label: "Pricing", icon: DollarSign },
  { id: "checkout_page" as const, label: "Checkout Page", icon: Globe },
];

const CONTENT_TYPE_ICONS: Record<string, any> = {
  course: BookOpen,
  digital_product: Download,
  community: MessageSquare,
  webinar: Video,
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  course: "Course",
  digital_product: "Digital Product",
  community: "Community",
  webinar: "Webinar",
};

export default function MembershipEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const membershipId = Number(id);
  const [activeTab, setActiveTab] = useState<TabId>("details");

  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery();
  const orgId = myOrgs?.[0]?.id;

  const { data: membership, refetch } = trpc.lms.memberships.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const currentMembership = membership?.find((m: any) => m.id === membershipId);

  // Content data
  const { data: contentItems, refetch: refetchContent } = trpc.lms.memberships.getContent.useQuery(
    { membershipId },
    { enabled: !!membershipId }
  );

  // Members data
  const { data: members, refetch: refetchMembers } = trpc.lms.memberships.getMembers.useQuery(
    { membershipId },
    { enabled: !!membershipId }
  );

  // Rules data
  const { data: rules, refetch: refetchRules } = trpc.lms.memberships.getRules.useQuery(
    { membershipId },
    { enabled: !!membershipId }
  );

  // Available content to add
  const { data: courses } = trpc.lms.courses.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );
  const { data: products } = trpc.lms.downloads.listProducts.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );
  const { data: webinars } = trpc.lms.webinars.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  // Org members for adding to membership
  const { data: orgMembersList } = trpc.orgs.members.list.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 0,
    billingInterval: "monthly" as "monthly" | "yearly" | "one_time",
    trialDays: 0,
    isActive: true,
  });

  useEffect(() => {
    if (currentMembership) {
      setForm({
        name: currentMembership.name ?? "",
        description: currentMembership.description ?? "",
        price: currentMembership.price ?? 0,
        billingInterval: (currentMembership.billingInterval as "monthly" | "yearly" | "one_time") ?? "monthly",
        trialDays: currentMembership.trialDays ?? 0,
        isActive: currentMembership.isActive ?? true,
      });
    }
  }, [currentMembership]);

  const updateMutation = trpc.lms.memberships.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const addContentMutation = trpc.lms.memberships.addContent.useMutation({
    onSuccess: () => { refetchContent(); toast.success("Content added"); },
    onError: (e) => toast.error(e.message),
  });

  const removeContentMutation = trpc.lms.memberships.removeContent.useMutation({
    onSuccess: () => { refetchContent(); toast.success("Content removed"); },
    onError: (e) => toast.error(e.message),
  });

  const addMemberMutation = trpc.lms.memberships.addMember.useMutation({
    onSuccess: () => { refetchMembers(); toast.success("Member added"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMemberMutation = trpc.lms.memberships.updateMember.useMutation({
    onSuccess: () => { refetchMembers(); toast.success("Member updated"); },
    onError: (e) => toast.error(e.message),
  });

  const removeMemberMutation = trpc.lms.memberships.removeMember.useMutation({
    onSuccess: () => { refetchMembers(); toast.success("Member removed"); },
    onError: (e) => toast.error(e.message),
  });

  const addRuleMutation = trpc.lms.memberships.addRule.useMutation({
    onSuccess: () => { refetchRules(); toast.success("Rule added"); },
    onError: (e) => toast.error(e.message),
  });

  const removeRuleMutation = trpc.lms.memberships.removeRule.useMutation({
    onSuccess: () => { refetchRules(); toast.success("Rule removed"); },
    onError: (e) => toast.error(e.message),
  });

  const updateRuleMutation = trpc.lms.memberships.updateRule.useMutation({
    onSuccess: () => { refetchRules(); toast.success("Rule updated"); },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    updateMutation.mutate({ id: membershipId, ...form });
  };

  // Add content state
  const [addContentType, setAddContentType] = useState<"course" | "digital_product" | "community" | "webinar">("course");
  const [addContentId, setAddContentId] = useState<number | null>(null);

  // Add member state
  const [addMemberUserId, setAddMemberUserId] = useState<number | null>(null);

  // Add rule state
  const [newRuleTrigger, setNewRuleTrigger] = useState<"course_purchase" | "product_purchase" | "webinar_registration" | "tag_added" | "manual">("course_purchase");
  const [newRuleEntityId, setNewRuleEntityId] = useState<number | null>(null);
  const [newRuleTag, setNewRuleTag] = useState("");

  const getContentOptions = () => {
    switch (addContentType) {
      case "course":
        return (courses ?? []).map((c: any) => ({ id: c.id, name: c.title }));
      case "digital_product":
        return (products ?? []).map((p: any) => ({ id: p.id, name: p.name }));
      case "webinar":
        return (webinars ?? []).map((w: any) => ({ id: w.id, name: w.title }));
      case "community":
        return []; // Communities would be loaded separately
      default:
        return [];
    }
  };

  const getRuleEntityOptions = () => {
    switch (newRuleTrigger) {
      case "course_purchase":
        return (courses ?? []).map((c: any) => ({ id: c.id, name: c.title }));
      case "product_purchase":
        return (products ?? []).map((p: any) => ({ id: p.id, name: p.name }));
      case "webinar_registration":
        return (webinars ?? []).map((w: any) => ({ id: w.id, name: w.title }));
      default:
        return [];
    }
  };

  if (!currentMembership) {
    return (
      <div className="flex flex-col h-full p-6 gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/products/memberships")}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold leading-tight">{form.name || "Membership"}</h1>
              <Badge
                variant="outline"
                className={
                  form.isActive
                    ? "text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
                    : "text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20"
                }
              >
                {form.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline" className="capitalize text-xs">
                {form.billingInterval === "one_time" ? "One-time" : form.billingInterval}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateMutation.mutate({ id: membershipId, isActive: !form.isActive })}
            className="gap-1.5"
          >
            {form.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-2 sm:px-6 border-b border-border bg-background overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "details" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Membership Details</h3>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Pro Membership"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="What's included in this membership?"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "content" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="font-semibold">Included Content</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose which courses, digital products, communities, and webinars are included in this membership.
              </p>
            </div>

            {/* Add content form */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Add Content</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select
                  value={addContentType}
                  onValueChange={(v) => {
                    setAddContentType(v as any);
                    setAddContentId(null);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">Course</SelectItem>
                    <SelectItem value="digital_product">Digital Product</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={addContentId?.toString() ?? ""}
                  onValueChange={(v) => setAddContentId(Number(v))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getContentOptions().map((opt: { id: number; name: string }) => (
                      <SelectItem key={opt.id} value={opt.id.toString()}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (addContentId) {
                      addContentMutation.mutate({
                        membershipId,
                        contentType: addContentType,
                        contentId: addContentId,
                      });
                      setAddContentId(null);
                    }
                  }}
                  disabled={!addContentId || addContentMutation.isPending}
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>

            {/* Content list */}
            <div className="space-y-2">
              {(!contentItems || contentItems.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No content added yet. Add courses, products, or communities above.</p>
                </div>
              )}
              {contentItems?.map((item: any) => {
                const Icon = CONTENT_TYPE_ICONS[item.contentType] ?? Package;
                return (
                  <div key={item.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {CONTENT_TYPE_LABELS[item.contentType]} #{item.contentId}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{item.contentType.replace("_", " ")}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-8 w-8"
                      onClick={() => removeContentMutation.mutate({ id: item.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="font-semibold">Members</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Manage who has access to this membership. Add members manually or let auto-enrollment rules handle it.
              </p>
            </div>

            {/* Add member */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Add Member Manually</p>
              <div className="flex gap-3">
                <Select
                  value={addMemberUserId?.toString() ?? ""}
                  onValueChange={(v) => setAddMemberUserId(Number(v))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orgMembersList?.map((m: any) => (
                      <SelectItem key={m.userId} value={m.userId.toString()}>
                        {m.user?.name ?? m.user?.email ?? `User #${m.userId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (addMemberUserId) {
                      addMemberMutation.mutate({ membershipId, userId: addMemberUserId });
                      setAddMemberUserId(null);
                    }
                  }}
                  disabled={!addMemberUserId || addMemberMutation.isPending}
                  size="sm"
                  className="gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>

            {/* Members list */}
            <div className="space-y-2">
              {(!members || members.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No members yet. Add members manually or set up auto-enrollment rules.</p>
                </div>
              )}
              {members?.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">User #{member.userId}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.status}
                      onValueChange={(v) =>
                        updateMemberMutation.mutate({ id: member.id, status: v as any })
                      }
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-8 w-8"
                      onClick={() => removeMemberMutation.mutate({ id: member.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "rules" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="font-semibold">Auto-Enrollment Rules</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Automatically add or remove users from this membership when certain events occur.
                For example: "When someone purchases Course X, add them to this membership."
              </p>
            </div>

            {/* Add rule */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Add Rule</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">When this happens...</Label>
                  <Select
                    value={newRuleTrigger}
                    onValueChange={(v) => {
                      setNewRuleTrigger(v as any);
                      setNewRuleEntityId(null);
                      setNewRuleTag("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="course_purchase">Course Purchased</SelectItem>
                      <SelectItem value="product_purchase">Product Purchased</SelectItem>
                      <SelectItem value="webinar_registration">Webinar Registration</SelectItem>
                      <SelectItem value="tag_added">Tag Added</SelectItem>
                      <SelectItem value="manual">Manual Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newRuleTrigger !== "tag_added" && newRuleTrigger !== "manual" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Specific item</Label>
                    <Select
                      value={newRuleEntityId?.toString() ?? ""}
                      onValueChange={(v) => setNewRuleEntityId(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getRuleEntityOptions().map((opt: { id: number; name: string }) => (
                          <SelectItem key={opt.id} value={opt.id.toString()}>
                            {opt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {newRuleTrigger === "tag_added" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tag name</Label>
                    <Input
                      value={newRuleTag}
                      onChange={(e) => setNewRuleTag(e.target.value)}
                      placeholder="e.g., vip"
                    />
                  </div>
                )}
              </div>
              <Button
                onClick={() => {
                  addRuleMutation.mutate({
                    membershipId,
                    triggerType: newRuleTrigger,
                    triggerEntityId: newRuleEntityId ?? undefined,
                    triggerTag: newRuleTag || undefined,
                    action: "add_to_membership",
                  });
                }}
                disabled={addRuleMutation.isPending}
                size="sm"
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Rule
              </Button>
            </div>

            {/* Rules list */}
            <div className="space-y-2">
              {(!rules || rules.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No rules configured. Add rules to auto-enroll users based on actions.</p>
                </div>
              )}
              {rules?.map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Zap className={`h-4 w-4 ${rule.isActive ? "text-amber-500" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-sm font-medium">
                        {rule.triggerType === "course_purchase" && `When Course #${rule.triggerEntityId} is purchased`}
                        {rule.triggerType === "product_purchase" && `When Product #${rule.triggerEntityId} is purchased`}
                        {rule.triggerType === "webinar_registration" && `When user registers for Webinar #${rule.triggerEntityId}`}
                        {rule.triggerType === "tag_added" && `When tag "${rule.triggerTag}" is added`}
                        {rule.triggerType === "manual" && "Manual enrollment only"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Action: {rule.action === "add_to_membership" ? "Add to membership" : "Remove from membership"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(v) =>
                        updateRuleMutation.mutate({ id: rule.id, isActive: v })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-8 w-8"
                      onClick={() => removeRuleMutation.mutate({ id: rule.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "pricing" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 className="font-semibold">Pricing</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Set the price and billing interval for this membership.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Price</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                      className="pl-9"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Interval</Label>
                  <Select
                    value={form.billingInterval}
                    onValueChange={(v) => setForm((f) => ({ ...f, billingInterval: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="one_time">One-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Trial Days</Label>
                <Input
                  type="number"
                  value={form.trialDays}
                  onChange={(e) => setForm((f) => ({ ...f, trialDays: Number(e.target.value) }))}
                  placeholder="0 = no trial"
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 for no trial period. Members will have full access during the trial.
                </p>
              </div>
              {form.price > 0 && (
                <div className="bg-muted/50 border rounded-lg p-4">
                  <p className="text-sm font-medium">Pricing Summary</p>
                  <p className="text-2xl font-bold mt-1">
                    ${form.price.toFixed(2)}
                    {form.billingInterval !== "one_time" && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /{form.billingInterval === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                  </p>
                  {form.trialDays > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {form.trialDays}-day free trial included
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === "checkout_page" && currentMembership && (
          <div className="max-w-3xl mx-auto">
            <CheckoutPageEditor
              contentType="membership"
              contentId={currentMembership.id}
              orgId={currentMembership.orgId ?? orgId ?? 1}
              contentSlug={String(currentMembership.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
