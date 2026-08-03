/**
 * NewsletterSubscribersPage — Admin page to view and manage newsletter subscribers
 * Accessible at /marketing/newsletter
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Users, RefreshCw, Search, UserMinus, UserCheck, Trash2,
  Download, Mail, Shield, Copy, ExternalLink,
} from "lucide-react";

export default function NewsletterSubscribersPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");

  const isAdmin = user?.role === "site_owner" || user?.role === "site_admin";

  const { data: subscribers, isLoading, refetch } = trpc.newsletter.listSubscribers.useQuery(
    { limit: 500, offset: 0 },
    { enabled: isAdmin },
  );

  const updateMutation = trpc.newsletter.updateSubscriber.useMutation({
    onSuccess: () => {
      toast.success("Subscriber updated");
      utils.newsletter.listSubscribers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.newsletter.deleteSubscriber.useMutation({
    onSuccess: () => {
      toast.success("Subscriber deleted");
      utils.newsletter.listSubscribers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (subscribers ?? []).filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.firstName ?? "").toLowerCase().includes(q) ||
      (s.lastName ?? "").toLowerCase().includes(q) ||
      (s.profession ?? "").toLowerCase().includes(q)
    );
  });

  const activeCount = (subscribers ?? []).filter((s) => s.isActive).length;
  const inactiveCount = (subscribers ?? []).filter((s) => !s.isActive).length;

  const copySubscribeLink = () => {
    const url = `${window.location.origin}/subscribe`;
    navigator.clipboard.writeText(url).then(() => toast.success("Subscribe link copied!"));
  };

  const exportCsv = () => {
    if (!subscribers || subscribers.length === 0) {
      toast.error("No subscribers to export");
      return;
    }
    const rows = [
      ["Email", "First Name", "Last Name", "Profession", "Status", "Subscribed At"],
      ...subscribers.map((s) => [
        s.email,
        s.firstName ?? "",
        s.lastName ?? "",
        s.profession ?? "",
        s.isActive ? "active" : "unsubscribed",
        s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "newsletter_subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-[#189aa1]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <DashboardLayout>
        <div className="container py-12 text-center text-gray-500">Please log in.</div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="container py-12 text-center">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Admin access required.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Newsletter Subscribers</h1>
            <p className="text-sm text-gray-500 mt-1">Manage newsletter subscriptions across all organizations</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copySubscribeLink} className="text-xs">
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Subscribe Link
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open("/subscribe", "_blank")} className="text-xs">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Preview Page
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => refetch()} variant="ghost" className="text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Total Subscribers</p>
                  <p className="text-2xl font-bold text-gray-900">{(subscribers ?? []).length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#189aa1]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#189aa1]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Active</p>
                  <p className="text-2xl font-bold text-green-600">{activeCount}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Unsubscribed</p>
                  <p className="text-2xl font-bold text-gray-400">{inactiveCount}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <UserMinus className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Table */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email, name, profession…"
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <p className="text-xs text-gray-400">{filtered.length} results</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-5 h-5 animate-spin text-[#189aa1]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Mail className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No subscribers found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Profession</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Subscribed</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="text-xs font-mono">{sub.email}</TableCell>
                      <TableCell className="text-xs">
                        {[sub.firstName, sub.lastName].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">{sub.profession ?? "—"}</TableCell>
                      <TableCell className="text-xs text-gray-400">{sub.source ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={sub.isActive ? "default" : "secondary"}
                          className={`text-xs ${sub.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}`}
                        >
                          {sub.isActive ? "Active" : "Unsubscribed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateMutation.mutate({ id: sub.id, isActive: !sub.isActive })}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-[#189aa1]"
                            title={sub.isActive ? "Deactivate" : "Reactivate"}
                          >
                            {sub.isActive ? <UserMinus className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete ${sub.email}? This cannot be undone.`)) {
                                deleteMutation.mutate({ id: sub.id });
                              }
                            }}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
