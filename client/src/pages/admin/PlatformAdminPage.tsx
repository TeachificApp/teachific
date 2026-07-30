import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { CANONICAL_FEATURE_KEYS } from "../../../../shared/tierLimits";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageBuilder, Block } from "@/components/PageBuilder";
import { toast } from "sonner";
import {
  Shield,
  Users,
  Building2,
  Settings,
  CreditCard,
  MoreHorizontal,
  UserPlus,
  Upload,
  Trash2,
  Edit,
  Crown,
  Lock,
  Globe,
  AlertTriangle,
  CheckCircle,
  Download,
  BarChart3,
  BookOpen,
  GraduationCap,
  Activity,
  Copy,
  Plus,
  Search,
  Zap,
  Webhook,
  Code2,
  FileText,
  Layout,
  ClipboardList,
  UserCheck,
  LogIn,
  Palette,
  Video,
  X,
  Check,
  Pencil,
  PenTool,
  FileQuestion,
  DollarSign,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Map,
  Laptop,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  MessageSquare,
  Send,
  Flag,
  Clock,
  Filter,
  ChevronLeft,
  FileSearch,
} from "lucide-react"
import { cn } from "@/lib/utils";

// ─── Sitemap ────────────────────────────────────────────────────────────────
const BASE = "https://teachific.app";
type SitemapEntry = { label: string; path: string; description?: string };
type SitemapSection = { title: string; icon: React.ReactNode; entries: SitemapEntry[] };

const SITEMAP_SECTIONS: SitemapSection[] = [
  {
    title: "Public / Marketing",
    icon: <Globe className="w-4 h-4" />,
    entries: [
      { label: "Home", path: "/", description: "Landing page" },
      { label: "Pricing", path: "/#pricing" },
      { label: "Features", path: "/#features" },
      { label: "Policies", path: "/policies", description: "Terms & Privacy" },
    ],
  },
  {
    title: "Auth",
    icon: <LogIn className="w-4 h-4" />,
    entries: [
      { label: "Login", path: "/login" },
      { label: "Register", path: "/register" },
      { label: "Forgot Password", path: "/forgot-password" },
      { label: "Reset Password", path: "/reset-password" },
      { label: "Verify Email", path: "/verify-email" },
    ],
  },
  {
    title: "LMS Management",
    icon: <GraduationCap className="w-4 h-4" />,
    entries: [
      { label: "LMS Management", path: "/lms/manage" },
      { label: "My Courses", path: "/lms/my-courses" },
      { label: "Branding", path: "/lms/branding" },
      { label: "Settings", path: "/lms/settings" },
    ],
  },
  {
    title: "Courses",
    icon: <BookOpen className="w-4 h-4" />,
    entries: [
      { label: "All Courses", path: "/lms/courses" },
      { label: "New Course", path: "/lms/courses/new" },
      { label: "Course Builder", path: "/lms/courses/:id", description: "Dynamic — requires course ID" },
      { label: "Webinars", path: "/lms/webinars" },
      { label: "Forms", path: "/lms/forms" },
    ],
  },
  {
    title: "Members",
    icon: <Users className="w-4 h-4" />,
    entries: [
      { label: "Users", path: "/members/users" },
      { label: "Groups", path: "/members/groups" },
      { label: "Group Manager Portal", path: "/members/group-manager" },
      { label: "Certificates", path: "/members/certificates" },
      { label: "Discussions", path: "/members/discussions" },
      { label: "Assignments", path: "/members/assignments" },
    ],
  },
  {
    title: "Products",
    icon: <Zap className="w-4 h-4" />,
    entries: [
      { label: "Memberships", path: "/products/memberships" },
      { label: "Bundles", path: "/products/bundles" },
      { label: "Community", path: "/products/community" },
      { label: "Categories", path: "/products/categories" },
      { label: "Digital Downloads", path: "/admin/downloads" },
    ],
  },
  {
    title: "Marketing",
    icon: <BarChart3 className="w-4 h-4" />,
    entries: [
      { label: "Website", path: "/marketing/website" },
      { label: "Email Campaigns", path: "/marketing/email" },
      { label: "Funnels", path: "/marketing/funnels" },
      { label: "Affiliates", path: "/marketing/affiliates" },
      { label: "Custom Pages", path: "/lms/custom-pages" },
      { label: "Page Builder", path: "/lms/page-builder/:pageId", description: "Dynamic — requires page ID" },
    ],
  },
  {
    title: "Sales",
    icon: <DollarSign className="w-4 h-4" />,
    entries: [
      { label: "Orders", path: "/sales/orders" },
      { label: "Subscriptions", path: "/sales/subscriptions" },
      { label: "Group Orders", path: "/sales/group-orders" },
      { label: "Coupons", path: "/sales/coupons" },
      { label: "Invoices", path: "/sales/invoices" },
      { label: "Revenue Partners", path: "/sales/revenue-partners" },
    ],
  },
  {
    title: "Analytics",
    icon: <Activity className="w-4 h-4" />,
    entries: [
      { label: "Revenue Analytics", path: "/analytics/revenue" },
      { label: "Engagement Analytics", path: "/analytics/engagement" },
      { label: "Marketing Analytics", path: "/analytics/marketing" },
      { label: "Custom Reports", path: "/analytics/custom-reports" },
      { label: "Student Activity Log", path: "/lms/activity" },
    ],
  },
  {
    title: "Integrations",
    icon: <Webhook className="w-4 h-4" />,
    entries: [
      { label: "Integrations Hub", path: "/integrations" },
      { label: "API", path: "/integrations/api" },
      { label: "Webhooks", path: "/integrations/webhooks" },
    ],
  },
  {
    title: "Media & Files",
    icon: <FileText className="w-4 h-4" />,
    entries: [
      { label: "Media Library", path: "/media-library" },
      { label: "Quizzes", path: "/media-library#quizzes" },
    ],
  },
  {
    title: "Profile & Billing",
    icon: <CreditCard className="w-4 h-4" />,
    entries: [
      { label: "Profile", path: "/profile" },
      { label: "Billing", path: "/billing" },
    ],
  },
  {
    title: "Platform Admin",
    icon: <Shield className="w-4 h-4" />,
    entries: [
      { label: "Platform Admin", path: "/platform-admin" },
      { label: "Admin — Orgs", path: "/admin/orgs" },
      { label: "Admin — Users", path: "/admin/users" },
      { label: "Admin — Permissions", path: "/admin/permissions" },
      { label: "Admin — Settings", path: "/admin/settings" },
    ],
  },
  {
    title: "Creative Tools",
    icon: <Laptop className="w-4 h-4" />,
    entries: [
      { label: "TeachificCreator™ Dashboard", path: "/creator" },
      { label: "TeachificCreator™ Download (legacy)", path: "/creator/download" },
      { label: "TeachificCreator™ Pro (Marketing)", path: "/creator-pro" },
      { label: "Teachific Studio™ Dashboard", path: "/studio" },
      { label: "Teachific Studio™ Download (legacy)", path: "/studio/download" },
      { label: "Teachific Studio™ Pro (Marketing)", path: "/studio-pro" },
      { label: "Teachific QuizMaker™ Dashboard", path: "/quiz-creator-app" },
      { label: "Teachific QuizMaker™ Download (legacy)", path: "/quiz-creator-app/download" },
      { label: "Teachific QuizMaker™ Pro (Marketing)", path: "/quiz-creator-pro" },
    ],
  },
  {
    title: "Learner / Student Portals",
    icon: <GraduationCap className="w-4 h-4" />,
    entries: [
      { label: "Course Player", path: "/learn/:courseId", description: "Dynamic — requires course ID" },
      { label: "Community Hub", path: "/community/:hubId", description: "Dynamic — requires hub ID" },
      { label: "Quiz Player", path: "/quizzes/:id/play", description: "Dynamic — requires quiz ID" },
      { label: "Quiz Results", path: "/quizzes/:id/results/:attemptId", description: "Dynamic" },
    ],
  },
];

function SitemapTab() {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return SITEMAP_SECTIONS;
    return SITEMAP_SECTIONS
      .map((sec) => ({
        ...sec,
        entries: sec.entries.filter(
          (e) =>
            e.label.toLowerCase().includes(q) ||
            e.path.toLowerCase().includes(q) ||
            (e.description ?? "").toLowerCase().includes(q)
        ),
      }))
      .filter((sec) => sec.entries.length > 0 || sec.title.toLowerCase().includes(q));
  }, [q]);
  const totalPages = SITEMAP_SECTIONS.reduce((n, s) => n + s.entries.length, 0);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Platform Sitemap</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalPages} pages across {SITEMAP_SECTIONS.length} sections — live links to teachific.app
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 focus:border-teal-400"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((section) => (
          <div key={section.title} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-teal-600">{section.icon}</span>
              <span className="font-semibold text-slate-800 text-sm">{section.title}</span>
              <span className="ml-auto text-xs text-slate-400">{section.entries.length}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {section.entries.map((entry) => {
                const isDynamic = entry.path.includes(":");
                return (
                  <li key={entry.path}>
                    {isDynamic ? (
                      <div className="flex items-start gap-2 px-4 py-2.5">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-500 font-medium">{entry.label}</p>
                          <p className="text-xs text-slate-400 font-mono truncate">{entry.path}</p>
                          {entry.description && <p className="text-xs text-slate-400 italic">{entry.description}</p>}
                        </div>
                      </div>
                    ) : (
                      <a
                        href={`${BASE}${entry.path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 px-4 py-2.5 hover:bg-teal-50 transition-colors group"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-slate-800 font-medium group-hover:text-teal-700 truncate">{entry.label}</p>
                          <p className="text-xs text-slate-400 font-mono truncate">{entry.path}</p>
                          {entry.description && <p className="text-xs text-slate-400 italic">{entry.description}</p>}
                        </div>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Map className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No pages match "{search}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Plan badge ──────────────────────────────────────────────────────────────
const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-500/20 text-slate-800 border-slate-500/30",
  starter: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  builder: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  pro: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  enterprise: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};
function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${PLAN_COLORS[plan] ?? PLAN_COLORS.free}`}>
      {plan === "enterprise" && <Crown className="w-3 h-3 mr-1" />}
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}

// ─── Platform Settings Tab ───────────────────────────────────────────────────
function SettingsTab() {
  const { data: settings, refetch } = trpc.platformAdmin.getSettings.useQuery();
  const update = trpc.platformAdmin.updateSettings.useMutation({
    onSuccess: () => { refetch(); toast.success("Settings saved"); },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState<{
    allowPublicRegistration?: boolean;
    maintenanceMode?: boolean;
    platformName?: string;
    supportEmail?: string;
    maxUploadSizeMb?: number;
    enterpriseMaxUploadSizeMb?: number;
  }>({});

  const merged = { ...settings, ...form };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-teal-400" />
            Registration & Access
          </CardTitle>
          <CardDescription className="text-slate-700">
            Control who can create new accounts on this platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50/50 border border-gray-200">
            <div>
              <p className="text-sm font-medium text-slate-900">Public Registration</p>
              <p className="text-xs text-slate-700 mt-0.5">
                When off, only manually added users can log in. New OAuth logins are blocked.
              </p>
            </div>
            <Switch
              checked={merged.allowPublicRegistration ?? false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, allowPublicRegistration: v }))}
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50/50 border border-gray-200">
            <div>
              <p className="text-sm font-medium text-slate-900">Maintenance Mode</p>
              <p className="text-xs text-slate-700 mt-0.5">
                Shows a maintenance page to all non-admin users.
              </p>
            </div>
            <Switch
              checked={merged.maintenanceMode ?? false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, maintenanceMode: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-400" />
            Platform Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-800">Platform Name</Label>
              <Input
                value={merged.platformName ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, platformName: e.target.value }))}
                placeholder="Teachific"
                className="bg-gray-50 border-gray-300 text-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-800">Support Email</Label>
              <Input
                value={merged.supportEmail ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
                placeholder="support@example.com"
                className="bg-gray-50 border-gray-300 text-slate-900"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-800">Standard Max Upload Size (MB)</Label>
              <Input
                type="number"
                value={merged.maxUploadSizeMb ?? 100}
                onChange={(e) => setForm((f) => ({ ...f, maxUploadSizeMb: parseInt(e.target.value) || 100 }))}
                className="bg-gray-50 border-gray-300 text-slate-900"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-800">Enterprise Max Upload Size (MB)</Label>
              <Input
                type="number"
                value={merged.enterpriseMaxUploadSizeMb ?? 2000}
                onChange={(e) => setForm((f) => ({ ...f, enterpriseMaxUploadSizeMb: parseInt(e.target.value) || 2000 }))}
                className="bg-gray-50 border-gray-300 text-slate-900"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => update.mutate(form)}
          disabled={update.isPending || Object.keys(form).length === 0}
          className=""
        >
          {update.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Organizations Tab ───────────────────────────────────────────────────────
function OrgsTab() {
  const { data: orgs = [], refetch } = trpc.platformAdmin.listOrgs.useQuery();
  const [editOrg, setEditOrg] = useState<typeof orgs[0] | null>(null);
  const [editForm, setEditForm] = useState<{
    name?: string;
    slug?: string;
    description?: string;
    domain?: string;
    plan?: "free" | "starter" | "builder" | "pro" | "enterprise";
    planStatus?: "active" | "trialing" | "past_due" | "cancelled" | "unpaid";
    customPriceUsd?: number;
    customPriceLabel?: string;
    adminNotes?: string;
  }>({});

  const { data: editOrgSub } = trpc.platformAdmin.getOrgSubscription.useQuery(
    { orgId: editOrg?.id ?? 0 },
    { enabled: !!editOrg }
  );

  const impersonateOrg = trpc.platformAdmin.impersonateOrg.useMutation({
    onSuccess: (data) => {
      toast.success(`Now viewing as ${data.impersonatedUser.name || data.impersonatedUser.email}`);
      setTimeout(() => { window.location.href = "/lms/manage"; }, 800);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateOrg = trpc.platformAdmin.updateOrg.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const setOrgPlan = trpc.platformAdmin.setOrgPlan.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const deleteOrg = trpc.platformAdmin.deleteOrg.useMutation({
    onSuccess: () => { refetch(); setDeleteConfirmOrg(null); toast.success("Organization deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [deleteConfirmOrg, setDeleteConfirmOrg] = useState<typeof orgs[0] | null>(null);
  const [showLimitsPanel, setShowLimitsPanel] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const { data: orgLimitsRaw = [], refetch: refetchLimits } = trpc.platformAdmin.getOrgLimitsEnriched.useQuery(
    { orgId: editOrg?.id ?? 0 },
    { enabled: !!editOrg && activeTab === "limits" }
  );
  const orgLimitsData = orgLimitsRaw;
  const upsertOrgLimit = trpc.platformAdmin.upsertOrgLimitOverride.useMutation({
    onSuccess: () => { refetchLimits(); toast.success("Override saved"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteOrgLimit = trpc.platformAdmin.deleteOrgLimitOverride.useMutation({
    onSuccess: () => { refetchLimits(); toast.success("Override removed"); },
    onError: (e) => toast.error(e.message),
  });
  const [editingLimit, setEditingLimit] = useState<{ featureKey: string; value: string } | null>(null);

  // Users tab state
  const { data: orgMembersData = [], refetch: refetchMembers } = trpc.platformAdmin.getOrgMembers.useQuery(
    { orgId: editOrg?.id ?? 0 },
    { enabled: !!editOrg && activeTab === "users" }
  );
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberRole, setAddMemberRole] = useState<"org_super_admin" | "org_admin" | "user">("user");
  const [addMemberName, setAddMemberName] = useState("");
  const [addMemberPassword, setAddMemberPassword] = useState("");
  const [addMemberMode, setAddMemberMode] = useState<"existing" | "new">("existing");
  const addUserToOrgByEmail = trpc.platformAdmin.addUserToOrgByEmail.useMutation({
    onSuccess: () => {
      refetchMembers();
      setAddMemberEmail(""); setAddMemberName(""); setAddMemberPassword(""); setAddMemberMode("existing");
      toast.success("User added to org");
    },
    onError: (e) => {
      if (e.message?.includes("No user found")) {
        setAddMemberMode("new");
        toast.info("No existing account found — fill in name and password to create one");
      } else {
        toast.error(e.message);
      }
    },
  });
  const createAndAddMember = trpc.orgs.members.createAndAdd.useMutation({
    onSuccess: () => {
      refetchMembers();
      setAddMemberEmail(""); setAddMemberName(""); setAddMemberPassword(""); setAddMemberMode("existing");
      toast.success("New user created and added to org");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeOrgMemberMut = trpc.platformAdmin.removeOrgMember.useMutation({
    onSuccess: () => { refetchMembers(); refetch(); toast.success("Member removed"); },
    onError: (e) => toast.error(e.message),
  });
  const updateOrgMemberRoleMut = trpc.platformAdmin.updateOrgMemberRole.useMutation({
    onSuccess: () => { refetchMembers(); toast.success("Role updated"); },
    onError: (e) => toast.error(e.message),
  });

  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [createOrgForm, setCreateOrgForm] = useState({ orgName: "", orgSlug: "", adminName: "", adminEmail: "", plan: "free" as "free"|"starter"|"builder"|"pro"|"enterprise" });
  const createOrgWithAdmin = trpc.platformAdmin.createOrgWithAdmin.useMutation({
    onSuccess: () => { refetch(); setCreateOrgOpen(false); setCreateOrgForm({ orgName: "", orgSlug: "", adminName: "", adminEmail: "", plan: "free" }); toast.success("Organization created"); },
    onError: (e) => toast.error(e.message),
  });
  const handleOpenEdit = (org: typeof orgs[0]) => {
    setEditOrg(org);
    setEditForm({
      name: org.name,
      slug: org.slug,
      description: org.description ?? "",
      domain: (org as any).customDomain ?? "",
      plan: ((org.plan as string) ?? "free") as typeof editForm.plan,
      planStatus: ((org as any).subStatus ?? "active") as typeof editForm.planStatus,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-700">{orgs.length} organizations</p>
        <Button size="sm" className="gap-1.5 hover:" onClick={() => setCreateOrgOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> New Organization
        </Button>
      </div>
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-slate-700">Organization</TableHead>
              <TableHead className="text-slate-700">Super Admin</TableHead>
              <TableHead className="text-slate-700">Subdomain</TableHead>
              <TableHead className="text-slate-700">Domain</TableHead>
              <TableHead className="text-slate-700">Members</TableHead>
              <TableHead className="text-slate-700">Plan</TableHead>
              <TableHead className="text-slate-700 w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.map((org) => (
              <TableRow key={org.id} className={`border-gray-200 hover:bg-gray-50 transition-colors ${org.name === "Teachific" ? "bg-teal-50/30" : ""}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-teal-400 font-semibold">{org.name}</span>
                    {org.name === "Teachific" && <Badge variant="outline" className="text-xs border-teal-500/40 text-teal-600 bg-teal-50">Platform</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-slate-700 text-xs">
                  {(org as any).ownerName || (org as any).ownerEmail ? (
                    <div>
                      <p className="font-medium text-slate-800">{(org as any).ownerName || "—"}</p>
                      <p className="text-slate-500">{(org as any).ownerEmail || ""}</p>
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-slate-700 font-mono text-xs">{org.slug}</TableCell>
                <TableCell className="text-slate-700 text-xs">{(org as any).customDomain || "—"}</TableCell>
                <TableCell className="text-slate-700 text-xs">
                  <span className="font-semibold text-teal-600">{(org as any).memberCount ?? 0}</span>
                  <span className="text-slate-400 ml-1">members</span>
                </TableCell>
                <TableCell>
                  <PlanBadge plan={(org.plan as string) ?? "free"} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:text-teal-400">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-gray-200">
                      <DropdownMenuItem
                        className="text-teal-400 hover:text-teal-300 focus:text-teal-300 focus:bg-gray-100"
                        onClick={() => handleOpenEdit(org)}
                      >
                        <Edit className="w-3.5 h-3.5 mr-2" /> Edit Organization
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-100" />
                      <DropdownMenuItem
                        className="text-amber-400 hover:text-amber-300 focus:text-amber-300 focus:bg-amber-50"
                        onClick={() => impersonateOrg.mutate({ orgId: org.id })}
                        disabled={impersonateOrg.isPending}
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-2" /> Login as Customer
                      </DropdownMenuItem>
                      {org.name !== "Teachific" && (
                        <>
                          <DropdownMenuSeparator className="bg-gray-100" />
                          <DropdownMenuItem
                            className="text-red-500 hover:text-red-400 focus:text-red-400 focus:bg-red-50"
                            onClick={() => setDeleteConfirmOrg(org)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Organization
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Consolidated Edit + Plan Dialog */}
      <Dialog open={!!editOrg} onOpenChange={(o) => !o && setEditOrg(null)}>
        <DialogContent className="bg-gray-50 border-gray-200 text-slate-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-400" />
              Edit Organization
            </DialogTitle>
            <DialogDescription className="text-slate-700">Update organization details and subscription plan.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100 border border-gray-200 w-full">
              <TabsTrigger value="details" className="flex-1 text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900">Details</TabsTrigger>
              <TabsTrigger value="subscription" className="flex-1 text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900">Subscription</TabsTrigger>
              <TabsTrigger value="limits" className="flex-1 text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900">Limit Overrides</TabsTrigger>
              <TabsTrigger value="users" className="flex-1 text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900">Users</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-slate-800">Name</Label>
                  <Input value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="bg-white border-gray-300 text-slate-900" autoCorrect="off" autoCapitalize="words" spellCheck={false} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-800">Subdomain</Label>
                  <Input value={editForm.slug ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))} className="bg-white border-gray-300 text-slate-900 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-800">Custom Domain</Label>
                  <Input value={editForm.domain ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))} placeholder="app.example.com" className="bg-white border-gray-300 text-slate-900" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-800">Description</Label>
                <Textarea value={editForm.description ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="bg-white border-gray-300 text-slate-900" rows={2} />
              </div>
            </TabsContent>

            {/* Subscription Tab */}
            <TabsContent value="subscription" className="space-y-4 mt-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Subscription Plan
                </p>
                {editOrgSub && (
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    Current saved plan: <PlanBadge plan={editOrgSub.plan} />
                    {editOrgSub.customPriceLabel && <span>({editOrgSub.customPriceLabel})</span>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-800 text-xs">Plan</Label>
                    <Select
                      value={editForm.plan ?? "free"}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, plan: v as typeof editForm.plan }))}
                    >
                      <SelectTrigger className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {["free", "starter", "builder", "pro", "enterprise"].map((p) => (
                          <SelectItem key={p} value={p} className="text-slate-900 focus:bg-gray-100 text-xs">
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-800 text-xs">Status</Label>
                    <Select
                      value={editForm.planStatus ?? "active"}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, planStatus: v as typeof editForm.planStatus }))}
                    >
                      <SelectTrigger className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
                        {["active", "trialing", "past_due", "cancelled", "unpaid"].map((s) => (
                          <SelectItem key={s} value={s} className="text-slate-900 focus:bg-gray-100 text-xs">
                            {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editForm.plan === "enterprise" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-slate-800 text-xs">Custom Price (USD cents)</Label>
                      <Input type="number" value={editForm.customPriceUsd ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, customPriceUsd: parseInt(e.target.value) || undefined }))} placeholder="e.g. 49900" className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-800 text-xs">Price Label</Label>
                      <Input value={editForm.customPriceLabel ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, customPriceLabel: e.target.value }))} placeholder="e.g. $499/mo" className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs" />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-slate-800 text-xs">Admin Notes (internal)</Label>
                  <Textarea value={editForm.adminNotes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, adminNotes: e.target.value }))} placeholder="Notes about this org..." className="bg-gray-50 border-gray-300 text-slate-900 text-xs" rows={2} />
                </div>
              </div>
            </TabsContent>

            {/* Limit Overrides Tab */}
            <TabsContent value="limits" className="mt-4 space-y-3">
              {/* Subscription plan quick-change within Limits tab */}
              <div className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Subscription Plan Override
                </p>
                <p className="text-xs text-slate-500">Change the plan to update the default limits below. Existing per-org overrides are preserved.</p>
                <div className="flex items-center gap-2">
                  <Select
                    value={editForm.plan ?? "free"}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, plan: v as typeof editForm.plan }))}
                  >
                    <SelectTrigger className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      {["free", "starter", "builder", "pro", "enterprise"].map((p) => (
                        <SelectItem key={p} value={p} className="text-slate-900 focus:bg-gray-100 text-xs">
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    disabled={setOrgPlan.isPending}
                    onClick={async () => {
                      if (!editOrg) return;
                      await setOrgPlan.mutateAsync({
                        orgId: editOrg.id,
                        plan: editForm.plan ?? "free",
                        status: editForm.planStatus ?? "active",
                        customPriceUsd: editForm.customPriceUsd ?? null,
                        customPriceLabel: editForm.customPriceLabel ?? null,
                        adminNotes: editForm.adminNotes ?? null,
                      });
                      await refetchLimits();
                      toast.success("Plan updated — limits refreshed");
                    }}
                  >
                    {setOrgPlan.isPending ? "Saving..." : "Apply Plan"}
                  </Button>
                </div>
              </div>
              <OrgLimitsInlinePanel
                orgId={editOrg?.id ?? 0}
                orgLimitsData={orgLimitsData}
                editingLimit={editingLimit}
                setEditingLimit={setEditingLimit}
                upsertOrgLimit={upsertOrgLimit}
                deleteOrgLimit={deleteOrgLimit}
              />
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="mt-4 space-y-3">
              {/* Add user by email */}
              <div className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-teal-500" /> Add User to Org
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="User email address"
                    value={addMemberEmail}
                    onChange={(e) => { setAddMemberEmail(e.target.value); setAddMemberMode("existing"); }}
                    className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs flex-1"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <Select value={addMemberRole} onValueChange={(v) => setAddMemberRole(v as "org_super_admin" | "org_admin" | "user")}>
                    <SelectTrigger className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <SelectItem value="org_super_admin" className="text-slate-900 text-xs">Super Admin</SelectItem>
                      <SelectItem value="org_admin" className="text-slate-900 text-xs">Org Admin</SelectItem>
                      <SelectItem value="user" className="text-slate-900 text-xs">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    disabled={addUserToOrgByEmail.isPending || createAndAddMember.isPending || !addMemberEmail.trim()}
                    onClick={() => {
                      if (!editOrg || !addMemberEmail.trim()) return;
                      if (addMemberMode === "new") {
                        createAndAddMember.mutate({ orgId: editOrg.id, email: addMemberEmail.trim(), name: addMemberName.trim(), password: addMemberPassword, role: addMemberRole });
                      } else {
                        addUserToOrgByEmail.mutate({ orgId: editOrg.id, email: addMemberEmail.trim(), role: addMemberRole });
                      }
                    }}
                  >
                    {(addUserToOrgByEmail.isPending || createAndAddMember.isPending) ? "Adding..." : (addMemberMode === "new" ? "Create & Add" : "Add")}
                  </Button>
                </div>
                {addMemberMode === "new" && (
                  <div className="space-y-2 pt-1 border-t border-gray-100">
                    <p className="text-xs text-amber-600 font-medium">No existing account found — create a new user:</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Full name"
                        value={addMemberName}
                        onChange={(e) => setAddMemberName(e.target.value)}
                        className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs flex-1"
                      />
                      <Input
                        placeholder="Password"
                        type="password"
                        value={addMemberPassword}
                        onChange={(e) => setAddMemberPassword(e.target.value)}
                        className="bg-gray-50 border-gray-300 text-slate-900 h-8 text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-slate-500"
                        onClick={() => setAddMemberMode("existing")}
                      >Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
              {/* Members list */}
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-transparent bg-gray-50">
                      <TableHead className="text-slate-700 text-xs py-2">Name</TableHead>
                      <TableHead className="text-slate-700 text-xs py-2">Email</TableHead>
                      <TableHead className="text-slate-700 text-xs py-2">Role</TableHead>
                      <TableHead className="text-slate-700 text-xs py-2">Joined</TableHead>
                      <TableHead className="text-slate-700 text-xs py-2 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgMembersData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 text-xs py-6">No members yet</TableCell>
                      </TableRow>
                    ) : (
                      orgMembersData.map((m) => (
                        <TableRow key={m.id} className="border-gray-200 hover:bg-gray-50">
                          <TableCell className="text-slate-900 text-xs py-2 font-medium">{m.user?.name ?? "—"}</TableCell>
                          <TableCell className="text-slate-600 text-xs py-2">{m.user?.email ?? "—"}</TableCell>
                          <TableCell className="text-xs py-2">
                            <Select
                              value={m.role}
                              onValueChange={(v) => {
                                if (!editOrg) return;
                                updateOrgMemberRoleMut.mutate({ orgId: editOrg.id, userId: m.userId, role: v as "org_super_admin" | "org_admin" | "member" | "user" });
                              }}
                            >
                              <SelectTrigger className="bg-gray-50 border-gray-300 text-slate-900 h-7 text-xs w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200">
                                <SelectItem value="org_super_admin" className="text-slate-900 text-xs">Super Admin</SelectItem>
                                <SelectItem value="org_admin" className="text-slate-900 text-xs">Org Admin</SelectItem>
                                <SelectItem value="member" className="text-slate-900 text-xs">Member</SelectItem>
                                <SelectItem value="user" className="text-slate-900 text-xs">User</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs py-2">{new Date(m.joinedAt).toLocaleDateString()}</TableCell>
                          <TableCell className="py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                              disabled={removeOrgMemberMut.isPending}
                              onClick={() => {
                                if (!editOrg) return;
                                removeOrgMemberMut.mutate({ orgId: editOrg.id, userId: m.userId });
                              }}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="gap-2 flex-wrap mt-2">
            <Button variant="outline" onClick={() => setEditOrg(null)} className="border-gray-300 text-slate-800">Cancel</Button>
            <Button
              onClick={async () => {
                if (!editOrg) return;
                try {
                  await updateOrg.mutateAsync({ orgId: editOrg.id, name: editForm.name, slug: editForm.slug, description: editForm.description, domain: editForm.domain });
                  // Always upsert subscription — even if plan is "free" to ensure row exists
                  await setOrgPlan.mutateAsync({
                    orgId: editOrg.id,
                    plan: editForm.plan ?? "free",
                    status: editForm.planStatus ?? "active",
                    customPriceUsd: editForm.customPriceUsd ?? null,
                    customPriceLabel: editForm.customPriceLabel ?? null,
                    adminNotes: editForm.adminNotes ?? null,
                  });
                  await refetch();
                  setEditOrg(null);
                  toast.success("Organization saved");
                } catch {
                  // errors handled by mutation onError
                }
              }}
              disabled={updateOrg.isPending || setOrgPlan.isPending}
              className=""
            >
              {(updateOrg.isPending || setOrgPlan.isPending) ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Create Org Dialog */}
      <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Create New Organization</DialogTitle>
            <DialogDescription className="text-slate-600">Create a new organization and assign a Super Admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm">Organization Name *</Label>
                <Input value={createOrgForm.orgName} onChange={e => { const v = e.target.value; setCreateOrgForm(f => ({ ...f, orgName: v, orgSlug: v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })); }} placeholder="Acme Corp" className="bg-white border-gray-300 text-slate-900" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm">Subdomain *</Label>
                <Input value={createOrgForm.orgSlug} onChange={e => setCreateOrgForm(f => ({ ...f, orgSlug: e.target.value }))} placeholder="acme-corp" className="bg-white border-gray-300 text-slate-900 font-mono text-sm" />
              </div>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Super Admin</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm">Admin Name *</Label>
                  <Input value={createOrgForm.adminName} onChange={e => setCreateOrgForm(f => ({ ...f, adminName: e.target.value }))} placeholder="Jane Smith" className="bg-white border-gray-300 text-slate-900" autoCorrect="off" autoCapitalize="words" spellCheck={false} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 text-sm">Admin Email *</Label>
                  <Input type="email" value={createOrgForm.adminEmail} onChange={e => setCreateOrgForm(f => ({ ...f, adminEmail: e.target.value }))} placeholder="jane@acme.com" className="bg-white border-gray-300 text-slate-900" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Subscription Plan</Label>
              <Select value={createOrgForm.plan} onValueChange={v => setCreateOrgForm(f => ({ ...f, plan: v as any }))}>
                <SelectTrigger className="bg-white border-gray-300 text-slate-900"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["free","starter","builder","pro","enterprise"].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOrgOpen(false)} className="text-slate-700">Cancel</Button>
            <Button onClick={() => createOrgWithAdmin.mutate(createOrgForm)} disabled={createOrgWithAdmin.isPending || !createOrgForm.orgName || !createOrgForm.orgSlug || !createOrgForm.adminName || !createOrgForm.adminEmail} className=" hover:">
              {createOrgWithAdmin.isPending ? "Creating..." : "Create Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Org Confirm Dialog */}
      <Dialog open={!!deleteConfirmOrg} onOpenChange={(o) => !o && setDeleteConfirmOrg(null)}>
        <DialogContent className="bg-white border-gray-200 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" /> Delete Organization
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              This will permanently delete <strong>{deleteConfirmOrg?.name}</strong> and all its data including courses, members, and subscriptions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOrg(null)} className="text-slate-700">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmOrg && deleteOrg.mutate({ orgId: deleteConfirmOrg.id })}
              disabled={deleteOrg.isPending}
            >
              {deleteOrg.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Org Limits Override Sheet */}
      <Sheet open={showLimitsPanel} onOpenChange={setShowLimitsPanel}>
        <SheetContent className="w-[480px] sm:max-w-[480px] bg-white overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-teal-500" /> Limit Overrides — {editOrg?.name}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">Override plan defaults for this specific organization. Use -1 for unlimited, or remove an override to revert to plan defaults.</p>
            <div className="space-y-2">
              {["courses","lessons_per_course","members","groups","storage_gb","forms","communities","webinars","digital_products","email_campaigns","custom_pages","bundles","memberships","affiliates","certificates"].map(key => {
                const override = (orgLimitsData as any[]).find((o: any) => o.featureKey === key);
                const isEditing = editingLimit?.featureKey === key;
                return (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-slate-800 capitalize">{key.replace(/_/g, " ")}</p>
                      {override && <p className="text-xs text-teal-600 mt-0.5">Override: {override.limitValue === -1 ? "Unlimited" : override.limitValue}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Input
                            type="number"
                            value={editingLimit.value}
                            onChange={e => setEditingLimit(el => el ? { ...el, value: e.target.value } : null)}
                            className="w-20 h-7 text-xs"
                            autoFocus
                          />
                          <Button size="icon" className="h-7 w-7 hover:" onClick={() => {
                            if (!editOrg) return;
                            upsertOrgLimit.mutate({ orgId: editOrg.id, featureKey: key, limitValue: parseInt(editingLimit.value) || 0 });
                            setEditingLimit(null);
                          }}>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingLimit(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingLimit({ featureKey: key, value: String(override?.limitValue ?? 0) })}>
                            <Edit className="w-3 h-3 mr-1" /> {override ? "Edit" : "Set Override"}
                          </Button>
                          {override && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => editOrg && deleteOrgLimit.mutate({ orgId: editOrg.id, featureKey: key })}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Org Limits Inline Panel ─────────────────────────────────────────────────
function OrgLimitsInlinePanel({
  orgId,
  orgLimitsData,
  editingLimit,
  setEditingLimit,
  upsertOrgLimit,
  deleteOrgLimit,
}: {
  orgId: number;
  orgLimitsData: Array<{ featureKey: string; featureLabel: string; limitValue: number; planDefault: number; isOverride: boolean; plan: string }>;
  editingLimit: { featureKey: string; value: string } | null;
  setEditingLimit: (v: { featureKey: string; value: string } | null) => void;
  upsertOrgLimit: ReturnType<typeof trpc.platformAdmin.upsertOrgLimitOverride.useMutation>;
  deleteOrgLimit: ReturnType<typeof trpc.platformAdmin.deleteOrgLimitOverride.useMutation>;
}) {
  if (!orgId) return <p className="text-sm text-slate-500 py-4 text-center">Select an organization to view limits.</p>;
  const plan = orgLimitsData[0]?.plan ?? null;
  if (orgLimitsData.length === 0) return (
    <div className="py-6 text-center text-sm text-slate-500">
      <p>No limit data available for this plan.</p>
      <p className="text-xs mt-1">Assign a plan in the Subscription tab first.</p>
    </div>
  );
  const overrideCount = orgLimitsData.filter(r => r.isOverride).length;
  return (
    <div className="space-y-2">
      {/* Plan summary banner */}
      <div className="flex items-center justify-between rounded-md bg-teal-50 border border-teal-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Crown className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-xs font-semibold text-teal-800 capitalize">{plan} plan defaults</span>
        </div>
        {overrideCount > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{overrideCount} override{overrideCount !== 1 ? "s" : ""} active</span>
        )}
      </div>
      <p className="text-xs text-slate-500">Set per-org overrides below. Amber values supersede the plan default. Remove an override to revert to the plan default.</p>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {orgLimitsData.map((row) => (
          <div key={row.featureKey} className={`flex items-center gap-2 rounded-md border px-3 py-2 ${row.isOverride ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-800 truncate">{row.featureLabel}</p>
              <p className="text-xs text-slate-400 font-mono">plan default: {row.planDefault === -1 ? "∞" : row.planDefault}</p>
            </div>
            {editingLimit?.featureKey === row.featureKey ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  value={editingLimit.value}
                  onChange={(e) => setEditingLimit({ featureKey: row.featureKey, value: e.target.value })}
                  className="w-20 h-7 text-xs bg-white border-gray-300 text-slate-900"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      upsertOrgLimit.mutate({ orgId, featureKey: row.featureKey, limitValue: parseInt(editingLimit.value) || 0 });
                      setEditingLimit(null);
                    }
                    if (e.key === "Escape") setEditingLimit(null);
                  }}
                  autoFocus
                />
                <Button size="icon" className="h-7 w-7 hover:" onClick={() => {
                  upsertOrgLimit.mutate({ orgId, featureKey: row.featureKey, limitValue: parseInt(editingLimit.value) || 0 });
                  setEditingLimit(null);
                }}><Check className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500" onClick={() => setEditingLimit(null)}><X className="w-3 h-3" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${row.isOverride ? "bg-amber-200 text-amber-800" : "bg-gray-100 text-slate-600"}`}>
                  {row.limitValue === -1 ? "∞" : row.limitValue}
                </span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-slate-700" onClick={() => setEditingLimit({ featureKey: row.featureKey, value: String(row.limitValue) })}>
                  <Pencil className="w-3 h-3" />
                </Button>
                {row.isOverride && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" title="Reset to plan default" onClick={() => deleteOrgLimit.mutate({ orgId, featureKey: row.featureKey })}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────
function UsersTab() {
  const { data: users = [], refetch } = trpc.platformAdmin.listUsers.useQuery();
  const { data: orgs = [] } = trpc.platformAdmin.listOrgs.useQuery();
  const [editUser, setEditUser] = useState<typeof users[0] | null>(null);
  const [editForm, setEditForm] = useState<{ name?: string; email?: string; role?: "site_owner" | "site_admin" | "org_super_admin" | "org_admin" | "member" }>({});
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkOrgId, setBulkOrgId] = useState<number | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");

  const updateUser = trpc.platformAdmin.updateUser.useMutation({
    onSuccess: () => { refetch(); setEditUser(null); setNewPassword(""); setConfirmPassword(""); toast.success("User updated"); },
    onError: (e) => toast.error(e.message),
  });
  const resetPasswordMutation = trpc.users.resetPassword.useMutation({
    onSuccess: () => { setNewPassword(""); setConfirmPassword(""); toast.success("Password reset successfully"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteUser = trpc.platformAdmin.deleteUser.useMutation({
    onSuccess: () => { refetch(); toast.success("User deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const bulkAdd = trpc.platformAdmin.bulkAddUsers.useMutation({
    onSuccess: (results) => {
      refetch();
      setBulkOpen(false);
      setBulkText("");
      const created = results.filter((r) => r.status === "created").length;
      const added = results.filter((r) => r.status === "added_existing").length;
      const errors = results.filter((r) => r.status.startsWith("error")).length;
      toast.success(`Bulk import: ${created} created, ${added} added, ${errors} errors`);
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = users.filter((u) =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  function parseBulkUsers() {
    return bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        const rawRole = parts[2]?.trim();
        const role = (["org_super_admin", "org_admin", "member"].includes(rawRole ?? "") ? rawRole : "member") as "org_super_admin" | "org_admin" | "member";
        return { email: parts[0], name: parts[1] ?? undefined, role };
      })
      .filter((u) => u.email.includes("@"));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="bg-white border-gray-300 text-slate-900 max-w-xs"
        />
        <Button
          onClick={() => setBulkOpen(true)}
          variant="outline"
          className="border-gray-300 text-slate-800 hover:text-slate-900 ml-auto"
        >
          <Upload className="w-3.5 h-3.5 mr-2" />
          Bulk Add Users
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-slate-700">Name</TableHead>
              <TableHead className="text-slate-700">Email</TableHead>
              <TableHead className="text-slate-700">Role</TableHead>
              <TableHead className="text-slate-700">Joined</TableHead>
              <TableHead className="text-slate-700 w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id} className="border-gray-200 hover:bg-gray-50">
                <TableCell className="text-slate-900 font-semibold">{u.name ?? "—"}</TableCell>
                <TableCell className="text-slate-700 text-sm">{u.email ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      u.role === "site_owner" ? "border-amber-500/50 text-amber-300" :
                      u.role === "site_admin" ? "border-violet-500/50 text-violet-300" :
                      u.role === "org_admin" ? "border-teal-500/50 text-teal-300" :
                      "border-gray-300 text-slate-700"
                    }
                  >
                    {u.role === "site_owner" && <Crown className="w-3 h-3 mr-1" />}
                    {u.role?.replace("_", " ") ?? "user"}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-700 text-xs">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-700 hover:text-slate-900">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-gray-200">
                      <DropdownMenuItem
                        className="text-slate-800 hover:text-slate-900 focus:text-slate-900"
                        onClick={() => { setEditUser(u); setEditForm({ name: u.name ?? "", email: u.email ?? "", role: (u.role as typeof editForm.role) ?? "member" }); }}
                      >
                        <Edit className="w-3.5 h-3.5 mr-2" /> Edit Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-gray-100" />
                      <DropdownMenuItem
                        className="text-red-400 hover:text-red-300 focus:text-red-300"
                        onClick={() => {
                          if (confirm(`Delete ${u.name ?? u.email}? This cannot be undone.`)) {
                            deleteUser.mutate({ userId: u.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) { setEditUser(null); setNewPassword(""); setConfirmPassword(""); } }}>
        <DialogContent className="bg-gray-50 border-gray-200 text-slate-900">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription className="text-slate-700">Update user profile and role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-slate-800">Name</Label>
              <Input value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="bg-white border-gray-300 text-slate-900" autoCorrect="off" autoCapitalize="words" spellCheck={false} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-800">Email</Label>
              <Input value={editForm.email ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="bg-white border-gray-300 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-800">Platform Role</Label>
              <Select value={editForm.role ?? "member"} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as typeof editForm.role }))}>
                <SelectTrigger className="bg-white border-gray-300 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="member" className="text-slate-900 focus:bg-gray-100">Org Member</SelectItem>
                  <SelectItem value="org_admin" className="text-slate-900 focus:bg-gray-100">Org Admin</SelectItem>
                  <SelectItem value="org_super_admin" className="text-slate-900 focus:bg-gray-100">Org Super Admin</SelectItem>
                  <SelectItem value="site_admin" className="text-slate-900 focus:bg-gray-100">Platform Admin</SelectItem>
                  <SelectItem value="site_owner" className="text-slate-900 focus:bg-gray-100">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Password Reset Section */}
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reset Password</p>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-slate-800">New Password <span className="text-slate-400 font-normal">(leave blank to keep current)</span></Label>
                  <Input
                    type="password"
                    placeholder="Enter new password…"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-white border-gray-300 text-slate-900"
                    autoComplete="new-password"
                  />
                </div>
                {newPassword && (
                  <div className="space-y-1.5">
                    <Label className="text-slate-800">Confirm New Password</Label>
                    <Input
                      type="password"
                      placeholder="Confirm new password…"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`bg-white border-gray-300 text-slate-900 ${newPassword && confirmPassword && newPassword !== confirmPassword ? "border-red-400" : ""}`}
                      autoComplete="new-password"
                    />
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500">Passwords do not match</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditUser(null); setNewPassword(""); setConfirmPassword(""); }} className="border-gray-300 text-slate-800">Cancel</Button>
            <Button
              onClick={async () => {
                if (!editUser) return;
                if (newPassword) {
                  if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
                  if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
                  await resetPasswordMutation.mutateAsync({ userId: editUser.id, newPassword });
                }
                updateUser.mutate({ userId: editUser.id, ...editForm });
              }}
              disabled={updateUser.isPending || resetPasswordMutation.isPending || (!!newPassword && newPassword !== confirmPassword)}
              className=""
            >
              {(updateUser.isPending || resetPasswordMutation.isPending) ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Users Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="bg-gray-50 border-gray-200 text-slate-900 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-teal-400" />
              Bulk Add Users
            </DialogTitle>
            <DialogDescription className="text-slate-700">
              Paste one user per line: <code className="text-teal-400">email, name (optional), role (optional)</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-slate-800">Target Organization</Label>
              <Select value={bulkOrgId?.toString() ?? ""} onValueChange={(v) => setBulkOrgId(parseInt(v))}>
                <SelectTrigger className="bg-white border-gray-300 text-slate-900">
                  <SelectValue placeholder="Select organization..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id.toString()} className="text-slate-900 focus:bg-gray-100">
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-800">User List</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"alice@example.com, Alice Smith, user\nbob@example.com, Bob Jones, org_admin"}
                className="bg-white border-gray-300 text-slate-900 font-mono text-xs"
                rows={8}
              />
              <p className="text-xs text-slate-500">{parseBulkUsers().length} valid users detected</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} className="border-gray-300 text-slate-800">Cancel</Button>
            <Button
              onClick={() => {
                if (!bulkOrgId) { toast.error("Select an organization first"); return; }
                bulkAdd.mutate({ orgId: bulkOrgId, users: parseBulkUsers() });
              }}
              disabled={bulkAdd.isPending || parseBulkUsers().length === 0 || !bulkOrgId}
              className=""
            >
              {bulkAdd.isPending ? "Importing..." : `Import ${parseBulkUsers().length} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: stats, isLoading } = trpc.platformAdmin.platformStats.useQuery();
  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Organizations", value: stats?.totalOrgs ?? 0, icon: Building2, color: "text-teal-400", bg: "bg-gray-500/10" },
    { label: "Total Courses", value: stats?.totalCourses ?? 0, icon: BookOpen, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Total Enrollments", value: stats?.totalEnrollments ?? 0, icon: GraduationCap, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Content Plays", value: (stats?.analytics as any)?.totalPlays ?? 0, icon: Activity, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Completions", value: (stats?.analytics as any)?.totalCompletions ?? 0, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Downloads", value: (stats?.analytics as any)?.totalDownloads ?? 0, icon: Download, color: "text-pink-400", bg: "bg-pink-500/10" },
    { label: "Revenue (USD)", value: stats ? `$${((stats.totalRevenue ?? 0) / 100).toFixed(2)}` : "$0.00", icon: CreditCard, color: "text-orange-400", bg: "bg-orange-500/10" },
  ];
  const planBreakdown = (stats?.planBreakdown ?? {}) as Record<string, number>;
  const planOrder = ["enterprise", "pro", "builder", "starter", "free"];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              {isLoading ? <div className="h-12 w-full rounded bg-gray-100 animate-pulse" /> : (
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", s.bg)}><s.icon className={cn("w-4 h-4", s.color)} /></div>
                  <div><p className="text-xl font-bold text-slate-900">{s.value}</p><p className="text-xs text-slate-700">{s.label}</p></div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="pb-3"><CardTitle className="text-slate-900 text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-teal-400" /> Subscription Plan Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? Array.from({length:4}).map((_,i)=><div key={i} className="h-8 w-full rounded bg-gray-100 animate-pulse mb-1"/>) : planOrder.map((plan) => {
              const count = planBreakdown[plan] ?? 0;
              const total = Object.values(planBreakdown).reduce((a,b)=>a+b,0)||1;
              const pct = Math.round((count/total)*100);
              return (
                <div key={plan} className="flex items-center gap-3">
                  <PlanBadge plan={plan} />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-500 rounded-full" style={{width:`${pct}%`}} />
                  </div>
                  <span className="text-xs text-slate-800 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="pb-3"><CardTitle className="text-slate-900 text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-teal-400" /> Recently Created Organizations</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(stats?.recentOrgs??[]).map((org)=>(
                <div key={org.id} className="flex items-center justify-between py-1.5 border-b border-gray-200 last:border-0">
                  <div><p className="text-sm text-slate-900 font-semibold">{org.name}</p><p className="text-xs text-slate-700 font-mono">{org.slug}</p></div>
                  <span className="text-xs text-slate-500">{org.createdAt ? new Date(org.createdAt as unknown as string).toLocaleDateString() : "—"}</span>
                </div>
              ))}
              {(stats?.recentOrgs??[]).length===0 && <p className="text-sm text-slate-500 text-center py-4">No organizations yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader className="pb-3"><CardTitle className="text-slate-900 text-sm flex items-center gap-2"><Users className="w-4 h-4 text-teal-400" /> Recently Joined Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 hover:bg-transparent">
                <TableHead className="text-slate-700">Name</TableHead><TableHead className="text-slate-700">Email</TableHead><TableHead className="text-slate-700">Role</TableHead><TableHead className="text-slate-700">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stats?.recentUsers??[]).map((u)=>(
                <TableRow key={u.id} className="border-gray-200 hover:bg-gray-100/30">
                  <TableCell className="text-slate-900 font-semibold">{u.name||"—"}</TableCell>
                  <TableCell className="text-slate-800">{u.email||"—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize border-gray-300 text-slate-800">{u.role?.replace("_"," ")}</Badge></TableCell>
                  <TableCell className="text-slate-700 text-xs">{u.createdAt ? new Date(u.createdAt as unknown as string).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
              {(stats?.recentUsers??[]).length===0 && (
                <TableRow className="border-gray-200"><TableCell colSpan={4} className="text-center text-slate-500 py-6">No users yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page Creator Tab ─────────────────────────────────────────────────────────
function PageCreatorTab() {
  const [, navigate] = useLocation();
  const { data: orgs = [] } = trpc.platformAdmin.listOrgs.useQuery();
  const [selectedOrgId, setSelectedOrgId] = useState<number|null>(null);
  const { data: pages = [], refetch } = trpc.lms.pages.list.useQuery({orgId:selectedOrgId??0},{enabled:!!selectedOrgId});
  const [createOpen, setCreateOpen] = useState(false);
  const [newPage, setNewPage] = useState({title:"",slug:"",isPublished:false});
  const [editingPage, setEditingPage] = useState<any>(null);
  const createPage = trpc.lms.pages.create.useMutation({onSuccess:()=>{refetch();setCreateOpen(false);setNewPage({title:"",slug:"",isPublished:false});toast.success("Page created");},onError:(e)=>toast.error(e.message)});
  const updatePage = trpc.lms.pages.update.useMutation({onSuccess:()=>{refetch();toast.success("Page saved");},onError:(e)=>toast.error(e.message)});
  const deletePage = trpc.lms.pages.delete.useMutation({onSuccess:()=>{refetch();toast.success("Page deleted");},onError:(e)=>toast.error(e.message)});
  const handleSavePage = () => {
    if (!editingPage?.id) return;
    updatePage.mutate({
      id: editingPage.id,
      title: editingPage.title,
      slug: editingPage.slug,
      blocksJson: editingPage.blocksJson,
      isPublished: editingPage.isPublished,
      showHeader: editingPage.showHeader,
      showFooter: editingPage.showFooter,
      metaTitle: editingPage.metaTitle ?? "",
      metaDescription: editingPage.metaDescription ?? "",
      customCss: editingPage.customCss ?? "",
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedOrgId?.toString()??""} onValueChange={(v)=>setSelectedOrgId(parseInt(v))}>
          <SelectTrigger className="w-64 bg-white border-gray-300 text-slate-900"><SelectValue placeholder="Select organization..."/></SelectTrigger>
          <SelectContent className="bg-white border-gray-200">{orgs.map(o=><SelectItem key={o.id} value={o.id.toString()} className="text-slate-900 focus:bg-gray-100">{o.name}</SelectItem>)}</SelectContent>
        </Select>
        {selectedOrgId && <Button size="sm" className="gap-1.5 hover: ml-auto" onClick={()=>setCreateOpen(true)}><Plus className="w-3.5 h-3.5"/> New Page</Button>}
      </div>
      {!selectedOrgId ? (
        <Card className="bg-gray-50 border-gray-200"><CardContent className="py-12 text-center"><Layout className="w-8 h-8 text-slate-500 mx-auto mb-3"/><p className="text-slate-700">Select an organization to manage its pages</p></CardContent></Card>
      ) : (
        <Card className="bg-gray-50 border-gray-200">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 hover:bg-transparent">
                <TableHead className="text-slate-700">Title</TableHead><TableHead className="text-slate-700">Slug</TableHead><TableHead className="text-slate-700">Status</TableHead><TableHead className="text-slate-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page)=>(
                <TableRow key={page.id} className="border-gray-200 hover:bg-gray-100/30">
                  <TableCell className="text-slate-900 font-semibold">{page.title}</TableCell>
                  <TableCell className="text-slate-700 font-mono text-xs">/{page.slug}</TableCell>
                  <TableCell><Badge variant="outline" className={page.isPublished?"border-green-500/40 text-green-300":"border-gray-300 text-slate-700"}>{page.isPublished?"Published":"Draft"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-teal-600 hover:text-teal-700" onClick={()=>navigate(`/lms/page-builder/${page.id}`)} title="Edit page in full-screen builder"><Edit className="w-3.5 h-3.5"/></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={()=>{if(confirm("Delete this page?"))deletePage.mutate({id:page.id});}}><Trash2 className="w-3.5 h-3.5"/></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pages.length===0&&<TableRow className="border-gray-200"><TableCell colSpan={4} className="text-center text-slate-500 py-8">No pages yet — create one above</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}
      {/* Edit Page Sheet removed — now navigates to full-screen page builder */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-gray-50 border-gray-200 text-slate-900">
          <DialogHeader><DialogTitle>Create New Page</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-slate-800">Page Title</Label><Input value={newPage.title} onChange={(e)=>setNewPage(p=>({...p,title:e.target.value,slug:e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}))} placeholder="About Us" className="bg-white border-gray-300 text-slate-900"/></div>
            <div className="space-y-1.5"><Label className="text-slate-800">URL Slug</Label><Input value={newPage.slug} onChange={(e)=>setNewPage(p=>({...p,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))} placeholder="about-us" className="bg-white border-gray-300 text-slate-900 font-mono"/></div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-200"><Label className="text-slate-800">Publish immediately</Label><Switch checked={newPage.isPublished} onCheckedChange={(v)=>setNewPage(p=>({...p,isPublished:v}))}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setCreateOpen(false)} className="border-gray-300 text-slate-800">Cancel</Button>
            <Button onClick={()=>selectedOrgId&&createPage.mutate({orgId:selectedOrgId,title:newPage.title,slug:newPage.slug})} disabled={createPage.isPending||!newPage.title||!newPage.slug} className=" hover:">{createPage.isPending?"Creating...":"Create Page"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────
function IntegrationsTab() {
  const { data: stripeStatus, isLoading: stripeLoading, refetch: refetchStripe } = trpc.billing.getStripeStatus.useQuery();

  return (
    <div className="space-y-4">
      {/* Stripe Integration Card */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900 text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-violet-400" /> Stripe
            </CardTitle>
            <div className="flex items-center gap-2">
              {stripeStatus?.isConfigured ? (
                <Badge variant="outline" className="border-green-500/40 text-green-600 text-xs">Active</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-xs">Not configured</Badge>
              )}
              <Button size="icon" variant="ghost" className="w-7 h-7 text-slate-500" onClick={() => refetchStripe()}>
                <RefreshCw className={cn("w-3.5 h-3.5", stripeLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
          <CardDescription className="text-slate-700">Payment processing for platform subscriptions and course sales</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stripeLoading ? (
            <div className="text-slate-500 text-sm py-2">Loading Stripe status...</div>
          ) : stripeStatus ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Mode</p>
                  <div className="flex items-center gap-1.5">
                    {stripeStatus.isTestMode ? (
                      <><AlertCircle className="w-3.5 h-3.5 text-amber-500" /><span className="text-sm font-semibold text-amber-600">Test Mode</span></>
                    ) : (
                      <><CheckCircle className="w-3.5 h-3.5 text-green-500" /><span className="text-sm font-semibold text-green-600">Live Mode</span></>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Publishable Key</p>
                  <p className="text-sm font-mono text-slate-800">{stripeStatus.publishableKeyPrefix ?? <span className="text-slate-400 italic">Not set</span>}</p>
                </div>
                <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Webhook Secret</p>
                  <div className="flex items-center gap-1.5">
                    {stripeStatus.hasWebhookSecret ? (
                      <><CheckCircle className="w-3.5 h-3.5 text-green-500" /><span className="text-sm text-green-600">Configured</span></>
                    ) : (
                      <><AlertCircle className="w-3.5 h-3.5 text-amber-500" /><span className="text-sm text-amber-600">Not set</span></>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white border border-gray-200 space-y-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Price IDs Loaded</p>
                  <p className="text-sm font-semibold text-slate-800">{stripeStatus.priceCount} plan prices</p>
                </div>
              </div>
              {stripeStatus.isTestMode && stripeStatus.claimUrl && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">Stripe sandbox not yet claimed</p>
                    <p className="text-xs text-amber-700 mt-0.5">Claim your sandbox to activate test payments. Expires June 3, 2026. Once claimed, enter live keys in Settings → Payment when ready to go live.</p>
                    <a
                      href={stripeStatus.claimUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                    >
                      Claim Stripe Sandbox <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
              {stripeStatus.priceIds.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 select-none">Show {stripeStatus.priceIds.length} loaded price IDs</summary>
                  <div className="mt-2 grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                    {stripeStatus.priceIds.map(({ key, id }) => (
                      <div key={key} className="flex items-center justify-between px-2 py-1 rounded bg-white border border-gray-100 text-xs">
                        <span className="text-slate-600 font-medium">{key}</span>
                        <span className="font-mono text-slate-400 truncate ml-2">{id}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle className="w-4 h-4" /> Unable to load Stripe status
            </div>
          )}
        </CardContent>
      </Card>

      {/* SendGrid Card */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" /> SendGrid
            </CardTitle>
            <Badge variant="outline" className="border-green-500/40 text-green-600 text-xs">Active</Badge>
          </div>
          <CardDescription className="text-slate-700">Transactional and marketing email delivery — configured via platform environment</CardDescription>
        </CardHeader>
      </Card>

      {/* Other integrations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { name: "Zapier", desc: "Automate workflows with 5,000+ apps", icon: Zap, color: "text-orange-400" },
          { name: "Webhooks", desc: "Send real-time event data to external services", icon: Webhook, color: "text-teal-400" },
          { name: "REST API", desc: "Programmatic access to your platform data", icon: Code2, color: "text-green-400" },
        ].map((intg) => (
          <Card key={intg.name} className="bg-gray-50 border-gray-200">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-gray-100/50 shrink-0"><intg.icon className={cn("w-5 h-5", intg.color)} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-semibold text-sm">{intg.name}</p>
                <p className="text-xs text-slate-700 mt-0.5">{intg.desc}</p>
              </div>
              <Button size="sm" variant="outline" className="border-gray-300 text-slate-800 hover:text-slate-900 shrink-0" onClick={() => toast.info("Coming soon")}>Configure</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PlatformAdminPage() {
  const { user } = useAuth();

  if (!user || (user.role !== "site_owner" && user.role !== "site_admin")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Lock className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-700 font-medium">Platform Admin Access Required</p>
          <p className="text-sm text-slate-500">This area is restricted to site owners and site admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-600/20 border border-teal-500/30">
          <Shield className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Admin</h1>
          <p className="text-sm text-slate-700">
            Manage all organizations, users, subscriptions, and platform settings.
            {user.role === "site_owner" && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-400">
                <Crown className="w-3 h-3" /> Site Owner
              </span>
            )}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-white border border-gray-200 flex flex-wrap h-auto gap-0.5 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="orgs" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Organizations
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Users className="w-3.5 h-3.5" /> Users
          </TabsTrigger>
          <TabsTrigger value="pages" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Layout className="w-3.5 h-3.5" /> Page Creator
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Integrations
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Settings className="w-3.5 h-3.5" /> System Settings
          </TabsTrigger>
          <TabsTrigger value="branding" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Branding
          </TabsTrigger>
          <TabsTrigger value="forms" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Platform Forms
          </TabsTrigger>
          <TabsTrigger value="plans" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Subscription Plans
          </TabsTrigger>
          <TabsTrigger value="creator" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <PenTool className="w-3.5 h-3.5" /> Creator
          </TabsTrigger>
          <TabsTrigger value="studio" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Video className="w-3.5 h-3.5" /> Studio
          </TabsTrigger>
          <TabsTrigger value="quizcreator" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <FileQuestion className="w-3.5 h-3.5" /> QuizMaker
          </TabsTrigger>
          <TabsTrigger value="teachificpay" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> TeachificPay
          </TabsTrigger>
          <TabsTrigger value="policies" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Policies
          </TabsTrigger>
          <TabsTrigger value="appversions" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Download className="w-3.5 h-3.5" /> App Versions
          </TabsTrigger>
          <TabsTrigger value="sitemap" className="data-[state=active]:bg-teal-600 data-[state=active]:text-slate-900 text-slate-700 gap-1.5">
            <Map className="w-3.5 h-3.5" /> Sitemap
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="orgs">
          <OrgsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="pages">
          <PageCreatorTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab />
        </TabsContent>
        <TabsContent value="forms">
          <PlatformFormsTab />
        </TabsContent>
        <TabsContent value="plans">
          <SubscriptionPlansTab />
        </TabsContent>
        <TabsContent value="creator">
          <CreatorAdminTab />
        </TabsContent>
        <TabsContent value="studio">
          <StudioAdminTab />
        </TabsContent>
        <TabsContent value="quizcreator">
          <QuizCreatorAdminTab />
        </TabsContent>
        <TabsContent value="teachificpay">
          <TeachificPayAdminTab />
        </TabsContent>
        <TabsContent value="policies">
          <PlatformPoliciesTab />
        </TabsContent>
        <TabsContent value="appversions">
          <AppVersionsTab />
        </TabsContent>
        <TabsContent value="sitemap">
          <SitemapTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Platform Forms Tab ──────────────────────────────────────────────────────
function BrandingTab() {
  const { data: branding, refetch } = trpc.platformAdmin.getBranding.useQuery();
  const updateBranding = trpc.platformAdmin.updateBranding.useMutation({
    onSuccess: () => { refetch(); toast.success("Branding saved"); },
    onError: (e) => toast.error(e.message),
  });
  const uploadPlatformLogo = trpc.platformAdmin.uploadPlatformLogo.useMutation();
  const [form, setForm] = useState<{
    platformName?: string;
    tagline?: string | null;
    headingFont?: string;
    bodyFont?: string;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    primaryColor?: string;
    accentColor?: string;
    buttonColor?: string | null;
    buttonTextColor?: string | null;
    sidebarBgColor?: string | null;
    sidebarTextColor?: string | null;
    sidebarActiveColor?: string | null;
    pageBgColor?: string | null;
    watermarkImageUrl?: string | null;
    watermarkOpacity?: number;
    watermarkPosition?: string;
    watermarkSize?: number;
  }>({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const merged = { ...branding, ...form };

  const FONT_OPTIONS = [
    "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
    "Source Sans Pro", "Nunito", "Raleway", "Merriweather", "Playfair Display",
    "DM Sans", "Work Sans", "Outfit", "Plus Jakarta Sans",
  ];

  const handleLogoUpload = async (file: File, field: "logoUrl" | "faviconUrl") => {
    const setter = field === "logoUrl" ? setLogoUploading : setFaviconUploading;
    setter(true);
    try {
      const { uploadUrl, fileUrl } = await uploadPlatformLogo.mutateAsync({ fileName: file.name, contentType: file.type });
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setForm(f => ({ ...f, [field]: fileUrl }));
      toast.success(field === "logoUrl" ? "Logo uploaded" : "Favicon uploaded");
    } catch (e: any) {
      toast.error("Upload failed: " + e.message);
    } finally {
      setter(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-teal-400" />
            Platform Identity
          </CardTitle>
          <CardDescription className="text-slate-700">Configure the platform name, tagline, logo, and brand colors.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Platform Name</Label>
              <Input value={merged.platformName ?? "Teachific"} onChange={e => setForm(f => ({ ...f, platformName: e.target.value }))} className="bg-white border-gray-300 text-slate-900" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Tagline</Label>
              <Input value={merged.tagline ?? ""} onChange={e => setForm(f => ({ ...f, tagline: e.target.value || null }))} placeholder="e.g. Empowering teams through learning" className="bg-white border-gray-300 text-slate-900" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Platform Logo</Label>
              <div className="flex items-start gap-3">
                {merged.logoUrl && <img src={merged.logoUrl} alt="Logo" className="h-12 rounded border border-gray-200 object-contain bg-white p-1" />}
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={merged.logoUrl ?? ""}
                    onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value || null }))}
                    placeholder="https://... or upload below"
                    className="bg-white border-gray-300 text-slate-900 text-sm"
                  />
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, "logoUrl"); }} />
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className="gap-1.5 text-xs border-gray-300 text-slate-700">
                    <Upload className="w-3.5 h-3.5" /> {logoUploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Favicon</Label>
              <div className="flex items-start gap-3">
                {merged.faviconUrl && <img src={merged.faviconUrl} alt="Favicon" className="h-8 rounded border border-gray-200 object-contain bg-white p-1" />}
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={merged.faviconUrl ?? ""}
                    onChange={e => setForm(f => ({ ...f, faviconUrl: e.target.value || null }))}
                    placeholder="https://... or upload below"
                    className="bg-white border-gray-300 text-slate-900 text-sm"
                  />
                  <input ref={faviconInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f, "faviconUrl"); }} />
                  <Button variant="outline" size="sm" onClick={() => faviconInputRef.current?.click()} disabled={faviconUploading} className="gap-1.5 text-xs border-gray-300 text-slate-700">
                    <Upload className="w-3.5 h-3.5" /> {faviconUploading ? "Uploading..." : "Upload Favicon"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={merged.primaryColor ?? "#24abbc"} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
                <Input value={merged.primaryColor ?? "#24abbc"} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="bg-white border-gray-300 text-slate-900 font-mono text-sm flex-1" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Accent Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={merged.accentColor ?? "#4ad9e0"} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
                <Input value={merged.accentColor ?? "#4ad9e0"} onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))} className="bg-white border-gray-300 text-slate-900 font-mono text-sm flex-1" />
              </div>
            </div>
          </div>
          {/* UI Color Controls */}
          <div className="pt-2 border-t border-gray-200">
            <p className="text-sm font-semibold text-slate-700 mb-3">UI Color Controls</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm">Button Color <span className="text-xs text-slate-400">(default: primary)</span></Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={merged.buttonColor ?? merged.primaryColor ?? "#24abbc"} onChange={e => setForm(f => ({ ...f, buttonColor: e.target.value }))} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
                  <Input value={merged.buttonColor ?? ""} onChange={e => setForm(f => ({ ...f, buttonColor: e.target.value || null }))} placeholder="inherit from primary" className="bg-white border-gray-300 text-slate-900 font-mono text-sm flex-1" />
                  {merged.buttonColor && <button type="button" onClick={() => setForm(f => ({ ...f, buttonColor: null }))} className="text-xs text-slate-400 hover:text-red-500">✕</button>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm">Button Text Color <span className="text-xs text-slate-400">(default: white)</span></Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={merged.buttonTextColor ?? "#ffffff"} onChange={e => setForm(f => ({ ...f, buttonTextColor: e.target.value }))} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
                  <Input value={merged.buttonTextColor ?? ""} onChange={e => setForm(f => ({ ...f, buttonTextColor: e.target.value || null }))} placeholder="#ffffff" className="bg-white border-gray-300 text-slate-900 font-mono text-sm flex-1" />
                  {merged.buttonTextColor && <button type="button" onClick={() => setForm(f => ({ ...f, buttonTextColor: null }))} className="text-xs text-slate-400 hover:text-red-500">✕</button>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm">Sidebar Background <span className="text-xs text-slate-400">(default: dark)</span></Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={merged.sidebarBgColor ?? "#0f172a"} onChange={e => setForm(f => ({ ...f, sidebarBgColor: e.target.value }))} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
                  <Input value={merged.sidebarBgColor ?? ""} onChange={e => setForm(f => ({ ...f, sidebarBgColor: e.target.value || null }))} placeholder="inherit from theme" className="bg-white border-gray-300 text-slate-900 font-mono text-sm flex-1" />
                  {merged.sidebarBgColor && <button type="button" onClick={() => setForm(f => ({ ...f, sidebarBgColor: null }))} className="text-xs text-slate-400 hover:text-red-500">✕</button>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm">Sidebar Text Color <span className="text-xs text-slate-400">(default: light)</span></Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={merged.sidebarTextColor ?? "#e2e8f0"} onChange={e => setForm(f => ({ ...f, sidebarTextColor: e.target.value }))} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
                  <Input value={merged.sidebarTextColor ?? ""} onChange={e => setForm(f => ({ ...f, sidebarTextColor: e.target.value || null }))} placeholder="inherit from theme" className="bg-white border-gray-300 text-slate-900 font-mono text-sm flex-1" />
                  {merged.sidebarTextColor && <button type="button" onClick={() => setForm(f => ({ ...f, sidebarTextColor: null }))} className="text-xs text-slate-400 hover:text-red-500">✕</button>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm">Sidebar Active Item Color <span className="text-xs text-slate-400">(default: primary)</span></Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={merged.sidebarActiveColor ?? merged.primaryColor ?? "#24abbc"} onChange={e => setForm(f => ({ ...f, sidebarActiveColor: e.target.value }))} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
                  <Input value={merged.sidebarActiveColor ?? ""} onChange={e => setForm(f => ({ ...f, sidebarActiveColor: e.target.value || null }))} placeholder="inherit from primary" className="bg-white border-gray-300 text-slate-900 font-mono text-sm flex-1" />
                  {merged.sidebarActiveColor && <button type="button" onClick={() => setForm(f => ({ ...f, sidebarActiveColor: null }))} className="text-xs text-slate-400 hover:text-red-500">✕</button>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-sm">Page Background Color <span className="text-xs text-slate-400">(default: white)</span></Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={merged.pageBgColor ?? "#f8fafc"} onChange={e => setForm(f => ({ ...f, pageBgColor: e.target.value }))} className="h-9 w-14 rounded border border-gray-300 cursor-pointer" />
                  <Input value={merged.pageBgColor ?? ""} onChange={e => setForm(f => ({ ...f, pageBgColor: e.target.value || null }))} placeholder="inherit from theme" className="bg-white border-gray-300 text-slate-900 font-mono text-sm flex-1" />
                  {merged.pageBgColor && <button type="button" onClick={() => setForm(f => ({ ...f, pageBgColor: null }))} className="text-xs text-slate-400 hover:text-red-500">✕</button>}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Heading Font</Label>
              <Select value={merged.headingFont ?? "Inter"} onValueChange={v => setForm(f => ({ ...f, headingFont: v }))}>
                <SelectTrigger className="bg-white border-gray-300 text-slate-900"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(font => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Body Font</Label>
              <Select value={merged.bodyFont ?? "Inter"} onValueChange={v => setForm(f => ({ ...f, bodyFont: v }))}>
                <SelectTrigger className="bg-white border-gray-300 text-slate-900"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(font => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Video className="w-4 h-4 text-teal-400" />
            Video Watermark
          </CardTitle>
          <CardDescription className="text-slate-700">Apply a watermark to all videos across the platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-700 text-sm">Watermark Image URL</Label>
            <Input value={merged.watermarkImageUrl ?? ""} onChange={e => setForm(f => ({ ...f, watermarkImageUrl: e.target.value || null }))} placeholder="https://..." className="bg-white border-gray-300 text-slate-900" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Opacity ({merged.watermarkOpacity ?? 30}%)</Label>
              <input type="range" min={0} max={100} value={merged.watermarkOpacity ?? 30} onChange={e => setForm(f => ({ ...f, watermarkOpacity: Number(e.target.value) }))} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Position</Label>
              <Select value={merged.watermarkPosition ?? "bottom-left"} onValueChange={v => setForm(f => ({ ...f, watermarkPosition: v }))}>
                <SelectTrigger className="bg-white border-gray-300 text-slate-900 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["top-left","top-right","bottom-left","bottom-right","center"].map(p => <SelectItem key={p} value={p}>{p.replace("-"," ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Size (px)</Label>
              <Input type="number" value={merged.watermarkSize ?? 120} onChange={e => setForm(f => ({ ...f, watermarkSize: Number(e.target.value) }))} className="bg-white border-gray-300 text-slate-900" min={20} max={400} />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => updateBranding.mutate(form)} disabled={updateBranding.isPending || Object.keys(form).length === 0} className=" hover:">
          {updateBranding.isPending ? "Saving..." : "Save Branding"}
        </Button>
      </div>
    </div>
  );
}
function PlatformFormsTab() {
  const { data: orgs = [] } = trpc.platformAdmin.listOrgs.useQuery();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [newFormTitle, setNewFormTitle] = useState("");
  const createForm = trpc.forms.create.useMutation({
    onSuccess: () => { void refetchForms(); setCreateFormOpen(false); setNewFormTitle(""); toast.success("Form created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: forms = [], isLoading, refetch: refetchForms } = trpc.forms.list.useQuery(
    { orgId: selectedOrgId ?? 0 },
    { enabled: !!selectedOrgId }
  );

  const FORM_LIMITS: Record<string, number> = {
    free: 0, starter: 3, builder: 10, pro: 50, enterprise: 200,
  };

  const filteredForms = (forms as any[]).filter((f: any) =>
    !search || f.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-teal-400" />
            Platform Forms Overview
          </CardTitle>
          <CardDescription className="text-slate-700">
            View and manage forms across all organizations. Form limits are enforced per subscription tier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Form limits reference */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {Object.entries(FORM_LIMITS).map(([plan, limit]) => (
              <div key={plan} className="rounded-lg bg-gray-50/60 border border-gray-200 p-3 text-center">
                <PlanBadge plan={plan} />
                <p className="text-lg font-bold text-slate-900 mt-2">{limit}</p>
                <p className="text-xs text-slate-700">forms</p>
              </div>
            ))}
          </div>

          {/* Org selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={selectedOrgId ? String(selectedOrgId) : ""}
              onValueChange={(v) => setSelectedOrgId(Number(v))}
            >
              <SelectTrigger className="w-64 bg-gray-50 border-gray-300 text-slate-900">
                <SelectValue placeholder="Select an organization..." />
              </SelectTrigger>
              <SelectContent>
                {(orgs as any[]).map((org: any) => (
                  <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOrgId && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-700" />
                  <Input
                    placeholder="Search forms..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 bg-gray-50 border-gray-300 text-slate-900 w-56"
                  />
                </div>
                <Button size="sm" className="gap-1.5 hover: ml-auto" onClick={() => setCreateFormOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> New Form
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Forms table */}
      {selectedOrgId && (
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader>
            <CardTitle className="text-slate-900 text-base">
              Forms for {(orgs as any[]).find((o: any) => o.id === selectedOrgId)?.name ?? "Organization"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400" />
              </div>
            ) : filteredForms.length === 0 ? (
              <div className="text-center py-12 text-slate-700">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No forms found for this organization.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-transparent">
                      <TableHead className="text-slate-700">Form Title</TableHead>
                      <TableHead className="text-slate-700">Status</TableHead>
                      <TableHead className="text-slate-700">Slug</TableHead>
                      <TableHead className="text-slate-700">Submissions</TableHead>
                      <TableHead className="text-slate-700">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredForms.map((form: any) => (
                      <TableRow key={form.id} className="border-gray-200 hover:bg-gray-50">
                        <TableCell className="text-slate-900 font-semibold">{form.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              form.status === "published"
                                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                : "border-slate-500/40 text-slate-700 bg-slate-500/10"
                            }
                          >
                            {form.status ?? "draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-700 font-mono text-xs">{form.slug}</TableCell>
                        <TableCell className="text-slate-800 text-sm">—</TableCell>
                        <TableCell className="text-slate-700 text-xs">
                          {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Form Dialog */}
      <Dialog open={createFormOpen} onOpenChange={setCreateFormOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">New Form</DialogTitle>
            <DialogDescription className="text-slate-600">Create a new form for {(orgs as any[]).find((o: any) => o.id === selectedOrgId)?.name ?? "this organization"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-700 text-sm">Form Title *</Label>
              <Input value={newFormTitle} onChange={e => setNewFormTitle(e.target.value)} placeholder="e.g. Contact Us" className="bg-white border-gray-300 text-slate-900" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFormOpen(false)} className="text-slate-700">Cancel</Button>
            <Button onClick={() => selectedOrgId && createForm.mutate({ orgId: selectedOrgId, title: newFormTitle })} disabled={createForm.isPending || !newFormTitle.trim() || !selectedOrgId} className=" hover:">
              {createForm.isPending ? "Creating..." : "Create Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Subscription Plans Tab ──────────────────────────────────────────────────
// Use the shared canonical feature keys as the single source of truth
const FEATURE_KEYS = CANONICAL_FEATURE_KEYS as readonly { key: string; label: string }[];

const PLANS = ["free", "starter", "builder", "pro", "enterprise"] as const;

function SubscriptionPlansTab() {
  const { data: rawLimits = [], refetch } = trpc.platformAdmin.getPlanLimits.useQuery();
  const upsert = trpc.platformAdmin.upsertPlanLimit.useMutation({
    onSuccess: () => { refetch(); toast.success("Limit saved"); },
    onError: (e) => toast.error(e.message),
  });

  // Build a lookup: featureKey → plan → limitValue
  const limitsMap: Record<string, Record<string, number>> = {};
  for (const row of rawLimits as any[]) {
    if (!limitsMap[row.featureKey]) limitsMap[row.featureKey] = {};
    limitsMap[row.featureKey][row.plan] = row.limitValue;
  }

  const [editing, setEditing] = useState<{ featureKey: string; plan: string; value: string } | null>(null);

  const handleSave = () => {
    if (!editing) return;
    const feature = FEATURE_KEYS.find(f => f.key === editing.featureKey);
    if (!feature) return;
    upsert.mutate({
      plan: editing.plan as any,
      featureKey: editing.featureKey,
      featureLabel: feature.label,
      limitValue: parseInt(editing.value) || 0,
    });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Subscription Plan Limits</h2>
          <p className="text-sm text-slate-600 mt-0.5">Set default feature limits per plan tier. Use -1 for unlimited.</p>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200 bg-gray-50">
              <TableHead className="text-slate-700 font-semibold w-48">Feature</TableHead>
              {PLANS.map(p => (
                <TableHead key={p} className="text-slate-700 font-semibold text-center">
                  <PlanBadge plan={p} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {FEATURE_KEYS.map(feature => (
              <TableRow key={feature.key} className="border-gray-200 hover:bg-gray-50">
                <TableCell className="font-medium text-slate-800 text-sm">{feature.label}</TableCell>
                {PLANS.map(plan => {
                  const val = limitsMap[feature.key]?.[plan] ?? "—";
                  const isEditing = editing?.featureKey === feature.key && editing?.plan === plan;
                  return (
                    <TableCell key={plan} className="text-center">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Input
                            type="number"
                            value={editing.value}
                            onChange={e => setEditing(ed => ed ? { ...ed, value: e.target.value } : null)}
                            className="w-20 h-7 text-xs text-center"
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(null); }}
                          />
                          <Button size="icon" className="h-7 w-7 hover:" onClick={handleSave} disabled={upsert.isPending}>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-sm font-mono text-slate-700 hover:text-teal-600 hover:underline cursor-pointer px-2 py-1 rounded hover:bg-teal-50 transition-colors"
                          onClick={() => setEditing({ featureKey: feature.key, plan, value: String((val as unknown) === "\u2014" || val === undefined ? 0 : val) })}
                          title="Click to edit"
                        >
                          {val === -1 ? "∞" : val}
                        </button>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-slate-500">Click any cell to edit. Use -1 for unlimited. Press Enter or click ✓ to save.</p>
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────
const ROLE_BADGE: Record<string, string> = {
  none: "bg-slate-100 text-slate-600 border-slate-200",
  starter: "bg-blue-100 text-blue-700 border-blue-200",
  lite: "bg-blue-100 text-blue-700 border-blue-200",
  creator: "bg-violet-100 text-violet-700 border-violet-200",
  pro: "bg-amber-100 text-amber-700 border-amber-200",
  premium: "bg-amber-100 text-amber-700 border-amber-200",
  team: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${ROLE_BADGE[role] ?? ROLE_BADGE.none}`}>
      {role === "none" ? "No Access" : role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}
function TrialBadge({ trialEndsAt }: { trialEndsAt: Date | null | undefined }) {
  if (!trialEndsAt) return null;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const expired = end < now;
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ml-1 ${
      expired ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"
    }`}>
      {expired ? "Trial expired" : `Trial: ${daysLeft}d left`}
    </span>
  );
}

// ─── TeachificCreator Admin Tab ──────────────────────────────────────────────
function CreatorAdminTab() {
  const { data: users = [], refetch } = trpc.billing.adminListCreatorUsers.useQuery();
  const setRole = trpc.billing.adminSetCreatorRole.useMutation({
    onSuccess: () => { refetch(); toast.success("Creator role updated"); },
    onError: (e) => toast.error(e.message),
  });
  const [search, setSearch] = useState("");
  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <PenTool className="w-4 h-4 text-teal-500" />
            Teachific™ Creator — User Management
          </CardTitle>
          <CardDescription className="text-slate-600">
            View and manage all users with a Teachific™ Creator subscription or trial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-gray-300 text-slate-900"
              />
            </div>
            <Badge variant="outline" className="text-slate-600">{filtered.length} users</Badge>
          </div>
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50">
                  <TableHead className="text-slate-700 font-semibold">User</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Email</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Creator Role</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Trial</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Joined</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No users found</TableCell></TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow key={u.id} className="border-gray-200 hover:bg-gray-50">
                    <TableCell className="font-medium text-slate-900">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{u.email}</TableCell>
                    <TableCell><RoleBadge role={u.creatorAccess} /></TableCell>
                    <TableCell><TrialBadge trialEndsAt={u.creatorTrialEndsAt} /></TableCell>
                    <TableCell className="text-slate-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={u.creatorAccess}
                        onValueChange={(role) => setRole.mutate({ userId: u.id, role: role as "none" | "web" | "desktop" | "bundle" })}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs bg-white border-gray-300 text-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["none", "web", "desktop", "bundle"].map((r) => (
                            <SelectItem key={r} value={r} className="text-slate-900 text-xs">{r === "none" ? "No Access" : r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Teachific Studio Admin Tab ──────────────────────────────────────────────
function StudioAdminTab() {
  const { data: users = [], refetch } = trpc.billing.adminListStudioUsers.useQuery();
  const setRole = trpc.billing.adminSetStudioRole.useMutation({
    onSuccess: () => { refetch(); toast.success("Studio role updated"); },
    onError: (e) => toast.error(e.message),
  });
  const [search, setSearch] = useState("");
  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Video className="w-4 h-4 text-teal-500" />
            Teachific™ Studio — User Management
          </CardTitle>
          <CardDescription className="text-slate-600">
            View and manage all users with a Teachific™ Studio subscription or trial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-gray-300 text-slate-900"
              />
            </div>
            <Badge variant="outline" className="text-slate-600">{filtered.length} users</Badge>
          </div>
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50">
                  <TableHead className="text-slate-700 font-semibold">User</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Email</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Studio Role</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Trial</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Joined</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No users found</TableCell></TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow key={u.id} className="border-gray-200 hover:bg-gray-50">
                    <TableCell className="font-medium text-slate-900">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{u.email}</TableCell>
                    <TableCell><RoleBadge role={u.studioAccess} /></TableCell>
                    <TableCell><TrialBadge trialEndsAt={u.studioTrialEndsAt} /></TableCell>
                    <TableCell className="text-slate-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={u.studioAccess}
                        onValueChange={(role) => setRole.mutate({ userId: u.id, role: role as "none" | "web" | "desktop" | "bundle" })}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs bg-white border-gray-300 text-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["none", "web", "desktop", "bundle"].map((r) => (
                            <SelectItem key={r} value={r} className="text-slate-900 text-xs">{r === "none" ? "No Access" : r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Teachific QuizMaker Admin Tab ─────────────────────────────────────────
function QuizCreatorAdminTab() {
  const { data: users = [], refetch } = trpc.billing.adminListQuizCreatorUsers.useQuery();
  const setRole = trpc.billing.adminSetQuizCreatorRole.useMutation({
    onSuccess: () => { refetch(); toast.success("QuizMaker role updated"); },
    onError: (e) => toast.error(e.message),
  });
  const [search, setSearch] = useState("");
  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <FileQuestion className="w-4 h-4 text-teal-500" />
            Teachific™ QuizMaker — User Management
          </CardTitle>
          <CardDescription className="text-slate-600">
            View and manage all users with a Teachific™ QuizMaker subscription or trial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-gray-300 text-slate-900"
              />
            </div>
            <Badge variant="outline" className="text-slate-600">{filtered.length} users</Badge>
          </div>
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50">
                  <TableHead className="text-slate-700 font-semibold">User</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Email</TableHead>
                  <TableHead className="text-slate-700 font-semibold">QuizMaker Role</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Trial</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Joined</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No users found</TableCell></TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow key={u.id} className="border-gray-200 hover:bg-gray-50">
                    <TableCell className="font-medium text-slate-900">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{u.email}</TableCell>
                    <TableCell><RoleBadge role={u.quizCreatorAccess} /></TableCell>
                    <TableCell><TrialBadge trialEndsAt={u.quizCreatorTrialEndsAt} /></TableCell>
                    <TableCell className="text-slate-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={u.quizCreatorAccess}
                        onValueChange={(role) => setRole.mutate({ userId: u.id, role: role as "none" | "web" | "desktop" | "bundle" })}
                      >
                        <SelectTrigger className="w-28 h-7 text-xs bg-white border-gray-300 text-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["none", "web", "desktop", "bundle"].map((r) => (
                             <SelectItem key={r} value={r} className="text-slate-900 text-xs">{r === "none" ? "No Access" : r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
// ─── TeachificPay Admin Tab ──────────────────────────────────────────────────
function TeachificPayAdminTab() {
  const [payTab, setPayTab] = useState<"schools" | "disputes" | "charges">("schools");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {(["schools", "disputes", "charges"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setPayTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors capitalize",
              payTab === t
                ? "border-teal-500 text-teal-700 bg-teal-50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-gray-50"
            )}
          >
            {t === "schools" ? "Schools & Revenue" : t === "disputes" ? "Disputes" : "Charge History"}
          </button>
        ))}
      </div>
      {payTab === "schools" && <TeachificPaySchoolsPanel />}
      {payTab === "disputes" && <TeachificPayDisputesPanel />}
      {payTab === "charges" && <TeachificPayChargesPanel />}
    </div>
  );
}

function TeachificPaySchoolsPanel() {
  const utils = trpc.useUtils();
  const { data: accounts = [] } = trpc.teachificPay.adminListAccounts.useQuery();
  const { data: revenue } = trpc.teachificPay.adminGetPlatformRevenue.useQuery();
  const setGateway = trpc.teachificPay.adminSetOrgGateway.useMutation({
    onSuccess: () => {
      toast.success("Gateway updated");
      utils.teachificPay.adminListAccounts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const [search, setSearch] = useState("");
  const filtered = accounts.filter((a) =>
    a.name?.toLowerCase().includes(search.toLowerCase())
  );
  const statusColor: Record<string, string> = {
    not_connected: "bg-slate-100 text-slate-600 border-slate-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    active: "bg-green-100 text-green-700 border-green-200",
    restricted: "bg-red-100 text-red-700 border-red-200",
  };
  const fmt = (cents: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  return (
    <div className="space-y-4">
      {revenue && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="pt-5">
              <p className="text-xs text-slate-500 mb-1">Total Fees Collected</p>
              <p className="text-2xl font-bold text-teal-600">{fmt(revenue.totalFeesCollected)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="pt-5">
              <p className="text-xs text-slate-500 mb-1">Fees Refunded</p>
              <p className="text-2xl font-bold text-red-500">{fmt(revenue.totalFeesRefunded)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="pt-5">
              <p className="text-xs text-slate-500 mb-1">Net Platform Revenue</p>
              <p className="text-2xl font-bold text-slate-900">{fmt(revenue.netFees)}</p>
            </CardContent>
          </Card>
        </div>
      )}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-teal-500" />
            TeachificPay™ — Connected Schools
          </CardTitle>
          <CardDescription className="text-slate-600">
            All organizations and their Stripe Connect status, payment gateway, and platform fee settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search schools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-gray-300 text-slate-900"
              />
            </div>
            <Badge variant="outline" className="text-slate-600">{filtered.length} schools</Badge>
          </div>
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50">
                  <TableHead className="text-slate-700 font-semibold">School</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Connect Status</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Gateway</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Stripe Account ID</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Created</TableHead>
                  <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No schools found</TableCell></TableRow>
                )}
                {filtered.map((a) => (
                  <TableRow key={a.id} className="border-gray-200 hover:bg-gray-50">
                    <TableCell className="font-medium text-slate-900">{a.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${statusColor[a.stripeConnectStatus ?? "not_connected"] ?? statusColor.not_connected}`}>
                        {a.stripeConnectStatus ?? "not_connected"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${a.paymentGateway === "own_gateway" ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-teal-100 text-teal-700 border-teal-200"}`}>
                        {a.paymentGateway === "own_gateway" ? "Own Gateway" : "TeachificPay"}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs font-mono">{a.stripeConnectAccountId ?? "—"}</TableCell>
                    <TableCell className="text-slate-500 text-xs">{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={a.paymentGateway ?? "teachific_pay"}
                        onValueChange={(gw) => setGateway.mutate({ orgId: a.id, gateway: gw as "teachific_pay" | "own_gateway" })}
                      >
                        <SelectTrigger className="w-36 h-7 text-xs bg-white border-gray-300 text-slate-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="teachific_pay" className="text-slate-900 text-xs">TeachificPay</SelectItem>
                          <SelectItem value="own_gateway" className="text-slate-900 text-xs">Own Gateway</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {revenue && revenue.recentFees.length > 0 && (
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader>
            <CardTitle className="text-slate-900 text-base">Recent Platform Fee Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gray-200 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 bg-gray-50">
                    <TableHead className="text-slate-700 font-semibold">Fee ID</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Amount</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Refunded</TableHead>
                    <TableHead className="text-slate-700 font-semibold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.recentFees.map((fee) => (
                    <TableRow key={fee.id} className="border-gray-200 hover:bg-gray-50">
                      <TableCell className="text-slate-500 text-xs font-mono">{fee.id}</TableCell>
                      <TableCell className="text-slate-900 font-medium">{fmt(fee.amount, fee.currency)}</TableCell>
                      <TableCell className="text-red-500 text-sm">{fee.amountRefunded > 0 ? fmt(fee.amountRefunded, fee.currency) : "—"}</TableCell>
                      <TableCell className="text-slate-500 text-xs">{new Date(fee.createdAt * 1000).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Disputes Panel ──────────────────────────────────────────────────────────
const DISPUTE_STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  needs_response:           { label: "Needs Response",    color: "bg-red-100 text-red-700 border-red-200",       icon: <ShieldAlert className="w-3 h-3" /> },
  warning_needs_response:   { label: "Warning — Respond", color: "bg-orange-100 text-orange-700 border-orange-200", icon: <ShieldAlert className="w-3 h-3" /> },
  under_review:             { label: "Under Review",      color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <Clock className="w-3 h-3" /> },
  warning_under_review:     { label: "Warning — Review",  color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <Clock className="w-3 h-3" /> },
  won:                      { label: "Won",               color: "bg-green-100 text-green-700 border-green-200",   icon: <ShieldCheck className="w-3 h-3" /> },
  lost:                     { label: "Lost",              color: "bg-slate-100 text-slate-600 border-slate-200",  icon: <ShieldX className="w-3 h-3" /> },
  charge_refunded:          { label: "Charge Refunded",   color: "bg-blue-100 text-blue-700 border-blue-200",    icon: <CheckCircle className="w-3 h-3" /> },
  warning_closed:           { label: "Warning Closed",    color: "bg-slate-100 text-slate-600 border-slate-200",  icon: <ShieldX className="w-3 h-3" /> },
};

function TeachificPayDisputesPanel() {
  const fmt = (cents: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const [selectedDispute, setSelectedDispute] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [evidenceForm, setEvidenceForm] = useState({ email: "", description: "", notes: "" });
  const [showEvidence, setShowEvidence] = useState(false);

  const { data: stats } = trpc.teachificPay.adminDisputeStats.useQuery();
  const { data: listData, refetch } = trpc.teachificPay.adminListAllDisputes.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
  });

  const disputes = listData?.disputes ?? [];
  const total = listData?.total ?? 0;

  const addNote = trpc.teachificPay.adminAddDisputeNote.useMutation({
    onSuccess: () => { toast.success("Note added"); setNoteText(""); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const escalate = trpc.teachificPay.adminEscalateDispute.useMutation({
    onSuccess: () => { toast.success("Dispute escalated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const submitEvidence = trpc.teachificPay.adminSubmitDisputeEvidence.useMutation({
    onSuccess: () => { toast.success("Evidence submitted to Stripe"); setShowEvidence(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const selected = disputes.find((d) => d.id === selectedDispute);

  const daysUntilDue = (dueBy: number | null | undefined) => {
    if (!dueBy) return null;
    const diff = Math.floor((dueBy - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div className="space-y-4">
      {/* Stats header */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <p className="text-xs text-red-600 font-medium">Open Disputes</p>
              </div>
              <p className="text-2xl font-bold text-red-700 mt-1">{stats.open}</p>
              <p className="text-xs text-red-500">{fmt(stats.openAmount)} at risk</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <p className="text-xs text-green-600 font-medium">Won</p>
              </div>
              <p className="text-2xl font-bold text-green-700 mt-1">{stats.won}</p>
              <p className="text-xs text-green-500">{fmt(stats.wonAmount)} recovered</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <ShieldX className="w-4 h-4 text-slate-500" />
                <p className="text-xs text-slate-600 font-medium">Lost</p>
              </div>
              <p className="text-2xl font-bold text-slate-700 mt-1">{stats.lost}</p>
              <p className="text-xs text-slate-500">{fmt(stats.lostAmount)} lost</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <p className="text-xs text-slate-500 font-medium">All Time</p>
              </div>
              <p className="text-2xl font-bold text-slate-700 mt-1">{stats.total}</p>
              <p className="text-xs text-slate-400">{fmt(stats.totalAmount)} total</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        {/* Dispute list */}
        <div className="flex-1 min-w-0">
          <Card className="bg-gray-50 border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-slate-900 text-base flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  Dispute Management
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      placeholder="Search email or ID..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                      className="pl-8 h-8 text-xs w-52 bg-white border-gray-300 text-slate-900"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                    <SelectTrigger className="h-8 text-xs w-44 bg-white border-gray-300 text-slate-900">
                      <Filter className="w-3 h-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                      <SelectItem value="needs_response" className="text-xs">Needs Response</SelectItem>
                      <SelectItem value="warning_needs_response" className="text-xs">Warning — Respond</SelectItem>
                      <SelectItem value="under_review" className="text-xs">Under Review</SelectItem>
                      <SelectItem value="won" className="text-xs">Won</SelectItem>
                      <SelectItem value="lost" className="text-xs">Lost</SelectItem>
                      <SelectItem value="charge_refunded" className="text-xs">Charge Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 bg-gray-100">
                      <TableHead className="text-slate-700 font-semibold text-xs pl-4">School</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-xs">Learner</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-xs">Amount</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-xs">Status</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-xs">Due</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-xs">Date</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <FileSearch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">No disputes found</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {disputes.map((d) => {
                      const statusMeta = DISPUTE_STATUS_LABELS[d.status] ?? { label: d.status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: null };
                      const days = daysUntilDue(d.evidenceDueBy);
                      const isUrgent = days !== null && days <= 3 && days >= 0;
                      return (
                        <TableRow
                          key={d.id}
                          className={cn(
                            "border-gray-200 cursor-pointer transition-colors",
                            selectedDispute === d.id ? "bg-teal-50" : "hover:bg-gray-50",
                            d.escalated ? "border-l-2 border-l-orange-400" : ""
                          )}
                          onClick={() => setSelectedDispute(selectedDispute === d.id ? null : d.id)}
                        >
                          <TableCell className="pl-4">
                            <div className="font-medium text-slate-900 text-xs">{d.orgName ?? `Org #${d.orgId}`}</div>
                            {d.escalated && <span className="inline-flex items-center gap-1 text-orange-600 text-xs font-semibold"><Flag className="w-3 h-3" /> Escalated</span>}
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">{d.learnerEmail ?? "—"}</TableCell>
                          <TableCell className="text-slate-900 text-xs font-medium">{fmt(d.amount, d.currency)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${statusMeta.color}`}>
                              {statusMeta.icon}{statusMeta.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            {days !== null ? (
                              <span className={cn("text-xs font-medium", isUrgent ? "text-red-600" : days <= 7 ? "text-orange-500" : "text-slate-500")}>
                                {days < 0 ? "Overdue" : days === 0 ? "Today" : `${days}d`}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-slate-400 text-xs">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {!d.escalated && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs text-orange-600 hover:bg-orange-50"
                                  onClick={(e) => { e.stopPropagation(); escalate.mutate({ disputeId: d.id }); }}
                                >
                                  <Flag className="w-3 h-3 mr-1" />Escalate
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs text-teal-600 hover:bg-teal-50"
                                onClick={(e) => { e.stopPropagation(); setSelectedDispute(d.id); setShowEvidence(true); }}
                              >
                                <Send className="w-3 h-3 mr-1" />Evidence
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <p className="text-xs text-slate-500">{total} total disputes</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-3 h-3" />
                    </Button>
                    <span className="text-xs text-slate-600">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-full md:w-80 shrink-0">
            <Card className="bg-white border-gray-200 sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-slate-900 text-sm">Dispute Detail</CardTitle>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSelectedDispute(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-slate-400">School</p><p className="font-medium text-slate-900">{selected.orgName ?? `#${selected.orgId}`}</p></div>
                  <div><p className="text-slate-400">Amount</p><p className="font-medium text-slate-900">{new Intl.NumberFormat("en-US", { style: "currency", currency: (selected.currency ?? "usd").toUpperCase() }).format(selected.amount / 100)}</p></div>
                  <div><p className="text-slate-400">Reason</p><p className="font-medium text-slate-900 capitalize">{(selected.reason ?? "—").replace(/_/g, " ")}</p></div>
                  <div><p className="text-slate-400">Evidence Due</p><p className={cn("font-medium", daysUntilDue(selected.evidenceDueBy) !== null && (daysUntilDue(selected.evidenceDueBy) ?? 99) <= 3 ? "text-red-600" : "text-slate-900")}>{selected.evidenceDueBy ? new Date(selected.evidenceDueBy).toLocaleDateString() : "—"}</p></div>
                  <div><p className="text-slate-400">Evidence Submitted</p><p className={cn("font-medium", selected.evidenceSubmitted ? "text-green-600" : "text-slate-400")}>{selected.evidenceSubmitted ? "Yes" : "No"}</p></div>
                  <div><p className="text-slate-400">Access Revoked</p><p className={cn("font-medium", selected.accessRevoked ? "text-red-600" : "text-green-600")}>{selected.accessRevoked ? "Yes" : "No"}</p></div>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Stripe Dispute ID</p>
                  <p className="font-mono text-slate-700 break-all">{selected.stripeDisputeId}</p>
                </div>
                {selected.adminNotes && (
                  <div>
                    <p className="text-slate-400 mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Admin Notes</p>
                    <pre className="text-slate-700 whitespace-pre-wrap text-xs bg-slate-50 rounded p-2 border border-slate-200 max-h-40 overflow-y-auto">{selected.adminNotes}</pre>
                  </div>
                )}
                {/* Add note */}
                <div className="pt-1">
                  <p className="text-slate-500 font-medium mb-1">Add Note</p>
                  <Textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Internal note (not visible to school owner)..."
                    className="text-xs min-h-[60px] bg-white border-gray-300 text-slate-900"
                  />
                  <Button
                    size="sm"
                    className="mt-2 h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={!noteText.trim() || addNote.isPending}
                    onClick={() => addNote.mutate({ disputeId: selected.id, note: noteText })}
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {addNote.isPending ? "Saving..." : "Save Note"}
                  </Button>
                </div>
                {/* Evidence form */}
                {showEvidence && (
                  <div className="pt-1 border-t border-gray-200">
                    <p className="text-slate-500 font-medium mb-2">Submit Evidence to Stripe</p>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-slate-500">Customer Email</Label>
                        <Input value={evidenceForm.email} onChange={(e) => setEvidenceForm(f => ({ ...f, email: e.target.value }))} className="h-7 text-xs bg-white border-gray-300 text-slate-900" placeholder="learner@example.com" />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Product Description</Label>
                        <Input value={evidenceForm.description} onChange={(e) => setEvidenceForm(f => ({ ...f, description: e.target.value }))} className="h-7 text-xs bg-white border-gray-300 text-slate-900" placeholder="Online course: Introduction to..." />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Additional Notes</Label>
                        <Textarea value={evidenceForm.notes} onChange={(e) => setEvidenceForm(f => ({ ...f, notes: e.target.value }))} className="text-xs min-h-[50px] bg-white border-gray-300 text-slate-900" placeholder="Learner accessed 8 of 10 modules..." />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white flex-1"
                          disabled={submitEvidence.isPending}
                          onClick={() => submitEvidence.mutate({
                            disputeId: selected.id,
                            stripeDisputeId: selected.stripeDisputeId,
                            customerEmailAddress: evidenceForm.email || undefined,
                            productDescription: evidenceForm.description || undefined,
                            uncategorizedText: evidenceForm.notes || undefined,
                          })}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          {submitEvidence.isPending ? "Submitting..." : "Submit to Stripe"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowEvidence(false)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Charge History Panel ────────────────────────────────────────────────────
function TeachificPayChargesPanel() {
  const fmt = (cents: number, currency = "usd") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const { data: listData } = trpc.teachificPay.adminListAllCharges.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: search || undefined,
  });

  const charges = listData?.charges ?? [];
  const total = listData?.total ?? 0;

  const refundMut = trpc.teachificPay.adminRefundCharge.useMutation({
    onSuccess: () => toast.success("Refund issued"),
    onError: (e) => toast.error(e.message),
  });

  const STATUS_COLORS: Record<string, string> = {
    succeeded: "bg-green-100 text-green-700 border-green-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    refunded: "bg-blue-100 text-blue-700 border-blue-200",
    partially_refunded: "bg-violet-100 text-violet-700 border-violet-200",
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-slate-900 text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-teal-500" />
              All Charges
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Search email or charge ID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-8 h-8 text-xs w-56 bg-white border-gray-300 text-slate-900"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="h-8 text-xs w-44 bg-white border-gray-300 text-slate-900">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  <SelectItem value="succeeded" className="text-xs">Succeeded</SelectItem>
                  <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                  <SelectItem value="failed" className="text-xs">Failed</SelectItem>
                  <SelectItem value="refunded" className="text-xs">Refunded</SelectItem>
                  <SelectItem value="partially_refunded" className="text-xs">Partially Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-100">
                  <TableHead className="text-slate-700 font-semibold text-xs pl-4">School</TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">Learner</TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">Amount</TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">Platform Fee</TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">Status</TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">Date</TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">No charges found</p>
                    </TableCell>
                  </TableRow>
                )}
                {charges.map((c) => (
                  <TableRow key={c.id} className="border-gray-200 hover:bg-gray-50">
                    <TableCell className="pl-4 font-medium text-slate-900 text-xs">{c.orgName ?? `Org #${c.orgId}`}</TableCell>
                    <TableCell className="text-slate-500 text-xs">{c.learnerEmail ?? "—"}</TableCell>
                    <TableCell className="text-slate-900 text-xs font-medium">
                      {fmt(c.amount, c.currency)}
                      {c.amountRefunded > 0 && <span className="text-red-500 ml-1">(-{fmt(c.amountRefunded, c.currency)})</span>}
                    </TableCell>
                    <TableCell className="text-teal-600 text-xs font-medium">{fmt(c.platformFee, c.currency)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {c.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">{new Date(c.chargedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {c.status === "succeeded" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-red-600 hover:bg-red-50"
                          disabled={refundMut.isPending}
                          onClick={() => {
                            if (confirm(`Refund ${fmt(c.amount, c.currency)} to learner?`)) {
                              refundMut.mutate({ chargeId: c.stripeChargeId, reason: "requested_by_customer" });
                            }
                          }}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />Refund
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-xs text-slate-500">{total} total charges</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="text-xs text-slate-600">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Platform Policies Tab ───────────────────────────────────────────────────
function PlatformPoliciesTab() {
  const { data: policies, refetch } = trpc.platformAdmin.getPolicies.useQuery();
  const updatePolicies = trpc.platformAdmin.updatePolicies.useMutation({
    onSuccess: () => { refetch(); toast.success("Policies saved"); },
    onError: (e) => toast.error(e.message),
  });

  const [termsHtml, setTermsHtml] = useState<string>("");
  const [privacyHtml, setPrivacyHtml] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  // Initialise form once data loads
  if (policies && !initialized) {
    setTermsHtml(policies.termsOfService ?? "");
    setPrivacyHtml(policies.privacyPolicy ?? "");
    setInitialized(true);
  }

  const publicUrl = `${window.location.origin}/policies`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-500" />
            Platform Legal Policies
          </CardTitle>
          <CardDescription className="text-slate-600">
            These are Teachific's platform-wide Terms of Service and Privacy Policy — completely
            independent of any org or school. They are publicly accessible at{" "}
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 underline underline-offset-2 hover:text-teal-700 font-medium"
            >
              {publicUrl}
            </a>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Terms of Service */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-teal-500" />
            Terms of Service
          </CardTitle>
          <CardDescription className="text-slate-600 text-xs">
            Paste HTML or plain text. This will be rendered on the public policies page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={termsHtml}
            onChange={(e) => setTermsHtml(e.target.value)}
            placeholder="<h2>Terms of Service</h2><p>By using Teachific...</p>"
            className="bg-white border-gray-300 text-slate-900 font-mono text-xs min-h-[320px] resize-y"
          />
        </CardContent>
      </Card>

      {/* Privacy Policy */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-teal-500" />
            Privacy Policy
          </CardTitle>
          <CardDescription className="text-slate-600 text-xs">
            Paste HTML or plain text. This will be rendered on the public policies page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={privacyHtml}
            onChange={(e) => setPrivacyHtml(e.target.value)}
            placeholder="<h2>Privacy Policy</h2><p>We collect the following information...</p>"
            className="bg-white border-gray-300 text-slate-900 font-mono text-xs min-h-[320px] resize-y"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Changes are saved immediately and reflected at the public URL.
        </p>
        <Button
          onClick={() => updatePolicies.mutate({ termsOfService: termsHtml, privacyPolicy: privacyHtml })}
          disabled={updatePolicies.isPending}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          {updatePolicies.isPending ? "Saving..." : <><Check className="w-4 h-4 mr-1.5" /> Save Policies</>}
        </Button>
      </div>
    </div>
  );
}

// ─── App Versions Tab ────────────────────────────────────────────────────────
function AppVersionsTab() {
  const { data: versions = [], refetch } = trpc.platformAdmin.getAllAppVersions.useQuery();
  const upsert = trpc.platformAdmin.upsertAppVersion.useMutation({
    onSuccess: () => { refetch(); setShowDialog(false); toast.success("Version saved"); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.platformAdmin.deleteAppVersion.useMutation({
    onSuccess: () => { refetch(); toast.success("Version deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<typeof versions[0] | null>(null);
  const [form, setForm] = useState({
    product: "creator" as "creator" | "studio" | "quizcreator",
    version: "",
    releaseNotes: "",
    windowsUrl: "",
    macUrl: "",
    isLatest: true,
  });

  function openNew() {
    setEditing(null);
    setForm({ product: "creator", version: "", releaseNotes: "", windowsUrl: "", macUrl: "", isLatest: true });
    setShowDialog(true);
  }

  function openEdit(v: typeof versions[0]) {
    setEditing(v);
    setForm({
      product: v.product,
      version: v.version,
      releaseNotes: v.releaseNotes ?? "",
      windowsUrl: v.windowsUrl ?? "",
      macUrl: v.macUrl ?? "",
      isLatest: v.isLatest,
    });
    setShowDialog(true);
  }

  const PRODUCT_LABELS: Record<string, string> = {
    creator: "TeachificCreator™",
    studio: "Teachific Studio™",
    quizcreator: "Teachific QuizMaker™",
  };
  const PRODUCT_ICONS: Record<string, string> = {
    creator: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-creator-Q43rWNPW6eUUYkvwYEJxKM.webp",
    studio: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-studio-7F38Gi9E9JiKgfVToa93B8.webp",
    quizcreator: "https://d2xsxph8kpxj0f.cloudfront.net/310519663401463434/fJXMsdmk8vcb8V4GDt37f6/icon-quizcreator-kzKXGqXXzBGSWcXxf64Xiw.webp",
  };

  const grouped = ["creator", "studio", "quizcreator"].map(p => ({
    product: p,
    label: PRODUCT_LABELS[p],
    versions: versions.filter(v => v.product === p).sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime()),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Desktop App Versions</h2>
          <p className="text-sm text-slate-600 mt-0.5">Manage installer download URLs for Windows (.exe) and macOS (.dmg) builds.</p>
        </div>
        <Button onClick={openNew} className=" hover: gap-1.5">
          <Plus className="w-4 h-4" /> Add Version
        </Button>
      </div>

      {grouped.map(({ product, label, versions: pvs }) => (
        <Card key={product} className="bg-gray-50 border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 text-base flex items-center gap-2">
              <img src={PRODUCT_ICONS[product]} alt={label} className="w-7 h-7 rounded-lg shrink-0" />
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pvs.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">No versions added yet. Click "Add Version" to upload installer URLs.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Windows</TableHead>
                    <TableHead>macOS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Released</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pvs.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-sm">{v.version}</TableCell>
                      <TableCell>
                        {v.windowsUrl ? (
                          <a href={v.windowsUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline text-sm flex items-center gap-1">
                            <Download className="w-3 h-3" /> .exe
                          </a>
                        ) : <span className="text-slate-400 text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        {v.macUrl ? (
                          <a href={v.macUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline text-sm flex items-center gap-1">
                            <Download className="w-3 h-3" /> .dmg
                          </a>
                        ) : <span className="text-slate-400 text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        {v.isLatest ? (
                          <Badge className="bg-teal-100 text-teal-800 border-teal-200">Latest</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Archived</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(v.releasedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(v)}>
                              <Edit className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => { if (confirm("Delete this version?")) del.mutate({ id: v.id }); }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Version" : "Add New Version"}</DialogTitle>
            <DialogDescription>Enter the version number and CDN/S3 download URLs for the installer files.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={form.product} onValueChange={(v) => setForm(f => ({ ...f, product: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="creator">TeachificCreator™</SelectItem>
                  <SelectItem value="studio">Teachific Studio™</SelectItem>
                  <SelectItem value="quizcreator">Teachific QuizMaker™</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Version Number</Label>
              <Input placeholder="1.0.0" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Windows Download URL (.exe)</Label>
              <Input placeholder="https://cdn.teachific.app/releases/creator/TeachificCreator-1.0.0-Setup.exe" value={form.windowsUrl} onChange={e => setForm(f => ({ ...f, windowsUrl: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>macOS Download URL (.dmg)</Label>
              <Input placeholder="https://cdn.teachific.app/releases/creator/TeachificCreator-1.0.0.dmg" value={form.macUrl} onChange={e => setForm(f => ({ ...f, macUrl: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Release Notes (optional)</Label>
              <Textarea placeholder="What's new in this version..." value={form.releaseNotes} onChange={e => setForm(f => ({ ...f, releaseNotes: e.target.value }))} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isLatest} onCheckedChange={v => setForm(f => ({ ...f, isLatest: v }))} />
              <Label>Mark as latest (shown as download on product pages)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={upsert.isPending || !form.version}
              onClick={() => upsert.mutate({ ...form, id: editing?.id })}
            >
              {upsert.isPending ? "Saving..." : "Save Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
