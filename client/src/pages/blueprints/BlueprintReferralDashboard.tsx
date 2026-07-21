import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Copy, Check, BarChart3, Users, MousePointer, TrendingUp, DollarSign, Layers, Plus, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BlueprintReferralDashboard() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newBlueprintId, setNewBlueprintId] = useState<number | "">("");
  const [newCommission, setNewCommission] = useState(20);

  const { data: links, isLoading, refetch } = trpc.blueprintReferrals.listLinks.useQuery({});
  const { data: stats } = trpc.blueprintReferrals.getStats.useQuery({});
  const { data: myBlueprintsData } = trpc.blueprints.adminList.useQuery({ pageSize: 100 });
  const myBlueprints = myBlueprintsData?.blueprints;

  const createLink = trpc.blueprintReferrals.createLink.useMutation({
    onSuccess: (data) => {
      toast.success(`Referral link created: ${data.url}`);
      setCreateOpen(false);
      setNewSlug("");
      setNewBlueprintId("");
      setNewCommission(20);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivate = trpc.blueprintReferrals.deactivateLink.useMutation({
    onSuccess: () => { toast.success("Link deactivated"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const isPlatformAdmin = user?.role === "site_owner" || user?.role === "site_admin";

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBlueprintId || !newSlug) return;
    createLink.mutate({
      blueprintId: Number(newBlueprintId),
      slug: newSlug,
      commissionRate: newCommission / 100,
    });
  }

  // Suggest a slug from blueprint title
  function suggestSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  }

  return (
    <div className="container py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-6 h-6 text-[#24abbc]" />
            <h1 className="text-2xl font-bold">Blueprint Referral Links</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Share your blueprints via subdomain links. Earn commissions when referred users subscribe.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[#24abbc] hover:bg-[#1d8f9e] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create Link
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <StatCard icon={MousePointer} label="Total Clicks" value={stats.totalClicks.toLocaleString()} />
          <StatCard icon={Users} label="Signups" value={stats.totalSignups.toLocaleString()} />
          <StatCard icon={TrendingUp} label="Conversions" value={stats.totalConversions.toLocaleString()} />
          <StatCard
            icon={DollarSign}
            label="Pending Commission"
            value={`$${(stats.pendingCommissionCents / 100).toFixed(2)}`}
            sub="Awaiting payout"
          />
          <StatCard
            icon={DollarSign}
            label="Paid Commission"
            value={`$${(stats.paidCommissionCents / 100).toFixed(2)}`}
            sub="Total earned"
          />
        </div>
      )}

      {/* How it works */}
      <div className="mb-8 rounded-2xl border border-[#24abbc]/20 bg-gradient-to-r from-[#24abbc]/5 to-teal-50/50 p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#24abbc]" />
          How referral links work
        </h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          {[
            { step: "1", title: "Create a link", desc: "Choose a blueprint and a memorable subdomain slug (e.g. my-fitness-school)" },
            { step: "2", title: "Share it", desc: "Your link is slug.teachific.app?ref=1 — share it anywhere: email, social, your course" },
            { step: "3", title: "Earn commissions", desc: "When someone signs up and subscribes, you earn a commission on their subscription" },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#24abbc] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {item.step}
              </div>
              <div>
                <p className="font-medium text-slate-900">{item.title}</p>
                <p className="text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Links table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      ) : !links?.length ? (
        <div className="text-center py-16 text-muted-foreground border rounded-2xl">
          <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No referral links yet</p>
          <p className="text-sm mt-1">Create your first link to start sharing your blueprints.</p>
          <Button className="mt-4 bg-[#24abbc] hover:bg-[#1d8f9e] text-white" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Create First Link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <Card key={link.id} className={`${!link.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Blueprint info */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-1.5 rounded-md bg-[#24abbc]/10 shrink-0">
                      <Layers className="w-4 h-4 text-[#24abbc]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{link.blueprintTitle ?? `Blueprint #${link.blueprintId}`}</p>
                      <p className="text-xs text-muted-foreground">{link.commissionRate * 100}% commission</p>
                    </div>
                  </div>

                  {/* URL */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm font-mono truncate flex-1">
                      <span className="text-muted-foreground text-xs">🔗</span>
                      <span className="truncate">{link.url}</span>
                    </div>
                    <CopyButton text={link.url} />
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                    <div className="flex items-center gap-1">
                      <MousePointer className="w-3.5 h-3.5" />
                      <span>{link.totalClicks}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{link.totalSignups}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{link.totalConversions}</span>
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={link.isActive ? "default" : "secondary"} className="text-xs">
                      {link.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {link.isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deactivate.mutate({ linkId: link.id })}
                        disabled={deactivate.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Referral Link</DialogTitle>
            <DialogDescription>
              Choose a blueprint and a subdomain slug. Your link will be <strong>slug.teachific.app?ref=1</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Blueprint</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={newBlueprintId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setNewBlueprintId(id || "");
                  const bp = myBlueprints?.find((b: any) => b.id === id);
                  if (bp && !newSlug) setNewSlug(suggestSlug(bp.title));
                }}
                required
              >
                <option value="">Select a blueprint...</option>
                {myBlueprints?.map((bp: any) => (
                  <option key={bp.id} value={bp.id}>{bp.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Subdomain slug</Label>
              <div className="flex items-center gap-0">
                <div className="flex-1 relative">
                  <Input
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="my-fitness-school"
                    required
                    minLength={3}
                    maxLength={100}
                    className="rounded-r-none"
                  />
                </div>
                <div className="h-10 px-3 flex items-center bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground whitespace-nowrap">
                  .teachific.app
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Your link: <strong>{newSlug || "slug"}.teachific.app?ref=1</strong>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Commission rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={newCommission}
                onChange={(e) => setNewCommission(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                You earn {newCommission}% of each referred subscriber's monthly payment.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createLink.isPending} className="bg-[#24abbc] hover:bg-[#1d8f9e] text-white">
                {createLink.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : "Create Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
