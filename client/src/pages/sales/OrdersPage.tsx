import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ShoppingCart, MoreVertical, RefreshCw, Search, DollarSign, CheckCircle, XCircle } from "lucide-react";

const STATUS_VARIANT: Record<string, any> = { completed: "default", pending: "secondary", refunded: "outline", failed: "destructive" };

export default function OrdersPage() {
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.lms.courseOrders.list.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });
  const { data: stats } = trpc.lms.courseOrders.stats.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });
  const updateMut = trpc.lms.courseOrders.update.useMutation({
    onSuccess: () => { utils.lms.courseOrders.list.invalidate(); utils.lms.courseOrders.stats.invalidate(); toast.success("Order updated"); },
    onError: (e) => toast.error(e.message),
  });
  const [search, setSearch] = useState("");
  const filtered = orders?.filter(o => !search || o.customerEmail.includes(search) || (o.productName ?? "").toLowerCase().includes(search.toLowerCase())) ?? [];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-primary" />Orders</h1><p className="text-muted-foreground mt-0.5">Track and manage all course purchases</p></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: "Total Orders", v: stats?.total ?? 0, icon: ShoppingCart }, { l: "Completed", v: stats?.completed ?? 0, icon: CheckCircle }, { l: "Refunded", v: stats?.refunded ?? 0, icon: RefreshCw }, { l: "Revenue", v: `$${(stats?.totalRevenue ?? 0).toFixed(2)}`, icon: DollarSign }].map(s => (
          <Card key={s.l}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{s.l}</p><p className="text-2xl font-bold">{s.v}</p></CardContent></Card>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search by email or product..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      {isLoading ? <div className="grid gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        : !filtered.length ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">{orders?.length ? "No orders match your search." : "No orders yet."}</p>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Product</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map(o => (
                  <TableRow key={o.id}>
                    <TableCell><div className="font-medium text-sm">{o.customerName ?? o.customerEmail}</div><div className="text-xs text-muted-foreground">{o.customerEmail}</div></TableCell>
                    <TableCell><div className="text-sm">{o.productName ?? "—"}</div><Badge variant="outline" className="text-xs">{o.productType}</Badge></TableCell>
                    <TableCell className="font-medium">${(o.amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[o.status ?? "pending"]}>{o.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {o.status !== "completed" && <DropdownMenuItem onClick={() => updateMut.mutate({ id: o.id, data: { status: "completed" } })}><CheckCircle className="h-4 w-4 mr-2" />Mark Completed</DropdownMenuItem>}
                          {o.status === "completed" && <DropdownMenuItem onClick={() => updateMut.mutate({ id: o.id, data: { status: "refunded" } })}><RefreshCw className="h-4 w-4 mr-2" />Refund</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
    </div>
  );
}
