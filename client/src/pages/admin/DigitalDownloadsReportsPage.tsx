import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Download, Search, Package, ShoppingCart, FileDown, DollarSign, TrendingUp, Clock
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useOrgScope } from "@/hooks/useOrgScope";

export default function DigitalDownloadsReportsPage() {
  const { orgId } = useOrgScope();

  const [productFilter, setProductFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: products } = trpc.lms.downloads.listProducts.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId }
  );

  const { data: orders, isLoading: ordersLoading } = trpc.lms.downloads.listOrders.useQuery(
    { orgId: orgId!, productId: productFilter !== "all" ? parseInt(productFilter) : undefined },
    { enabled: !!orgId }
  );

  const { data: downloadLogs, isLoading: logsLoading } = trpc.lms.downloads.listDownloadLogs.useQuery(
    { orgId: orgId!, productId: productFilter !== "all" ? parseInt(productFilter) : undefined },
    { enabled: !!orgId }
  );

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      const matchesSearch = !search ||
        o.buyerEmail?.toLowerCase().includes(search.toLowerCase()) ||
        o.buyerName?.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const totalRevenue = useMemo(() => {
    return (orders ?? [])
      .filter(o => o.status === "paid")
      .reduce((sum, o) => sum + (parseFloat(o.amount ?? "0")), 0);
  }, [orders]);

  const exportOrdersCSV = () => {
    if (!filteredOrders.length) { toast.error("No orders to export"); return; }
    const headers = ["Order ID", "Buyer Name", "Buyer Email", "Product", "Amount", "Status", "Date", "Downloads"];
    const rows = filteredOrders.map(o => [
      o.id,
      o.buyerName ?? "",
      o.buyerEmail ?? "",
      (products ?? []).find((p: { id: number; title: string }) => p.id === o.productId)?.title ?? `Product #${o.productId}`,
      `$${(parseFloat(o.amount ?? "0")).toFixed(2)}`,
      o.status,
      o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "",
      o.downloadCount ?? 0,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Orders exported");
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      refunded: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      free: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>;
  };

  return (
    <div className="lms-org-theme p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Downloads Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track orders, revenue, and download activity</p>
        </div>
        <Button variant="outline" className="gap-2 self-start" onClick={exportOrdersCSV}>
          <FileDown className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold">${(totalRevenue).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{orders?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{downloadLogs?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Downloads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)] flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-[var(--org-primary)]" />
            </div>
            <div>
              <p className="text-lg font-bold">{products?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by buyer name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {(products ?? []).map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders ({filteredOrders.length})</TabsTrigger>
          <TabsTrigger value="logs">Download Logs ({downloadLogs?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          {ordersLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No orders found</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {filteredOrders.map(o => (
                  <Card key={o.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{o.buyerName || o.buyerEmail || "Anonymous"}</p>
                          <p className="text-xs text-muted-foreground">{o.buyerEmail}</p>
                        </div>
                        {statusBadge(o.status)}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{(products ?? []).find((p: { id: number; title: string }) => p.id === o.productId)?.title ?? `#${o.productId}`}</span>
                        <span className="font-semibold">${(parseFloat(o.amount ?? "0")).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</span>
                        <span>{o.downloadCount ?? 0} downloads</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Downloads</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{o.buyerName || "—"}</p>
                          <p className="text-xs text-muted-foreground">{o.buyerEmail}</p>
                        </TableCell>
                        <TableCell className="text-sm">{(products ?? []).find((p: { id: number; title: string }) => p.id === o.productId)?.title ?? `#${o.productId}`}</TableCell>
                        <TableCell className="font-semibold">${(parseFloat(o.amount ?? "0")).toFixed(2)}</TableCell>
                        <TableCell>{statusBadge(o.status)}</TableCell>
                        <TableCell>{o.downloadCount ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* Download Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          {logsLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !downloadLogs?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Download className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No download logs yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {downloadLogs.map((log, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-1">
                      <p className="font-medium text-sm">{(products ?? []).find((p: { id: number; title: string }) => p.id === log.productId)?.title ?? `Product #${log.productId}`}</p>
                      <p className="text-xs text-muted-foreground">IP: {log.ipAddress ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{log.downloadedAt ? new Date(log.downloadedAt).toLocaleString() : "—"}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Downloaded At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {downloadLogs.map((log, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">
                          {(products ?? []).find((p: { id: number; title: string }) => p.id === log.productId)?.title ?? `Product #${log.productId}`}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">#{log.orderId}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.downloadedAt ? new Date(log.downloadedAt).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
