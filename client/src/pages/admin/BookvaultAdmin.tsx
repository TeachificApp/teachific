import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RefreshCw, Book, ShoppingCart, CheckCircle2, AlertCircle, ExternalLink,
  Loader2, Search,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    submitted: "bg-blue-100 text-blue-700",
    processing: "bg-yellow-100 text-yellow-700",
    dispatched: "bg-green-100 text-green-700",
    delivered: "bg-green-200 text-green-800",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-600",
  };
  const cls = colors[status.toLowerCase()] ?? "bg-gray-100 text-gray-700";
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>;
}

// ── Connection Status Banner ──────────────────────────────────────────────────
function ConnectionBanner() {
  const statusQ = trpc.bookvaultAdmin.getConnectionStatus.useQuery();
  const testMut = trpc.bookvaultAdmin.testConnection.useMutation({
    onSuccess: () => { toast.success("Bookvault connection verified."); statusQ.refetch(); },
    onError: (err) => toast.error(`Connection failed: ${err.message}`),
  });

  if (statusQ.isLoading) {
    return (
      <Card className="border-muted">
        <CardContent className="py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
        </CardContent>
      </Card>
    );
  }

  const data = statusQ.data;
  if (!data?.configured) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="py-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Bookvault API key not configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add <code className="bg-muted px-1 rounded">BOOKVAULT_API_KEY</code> to your environment secrets to enable print-on-demand book fulfillment.
            </p>
            <a
              href="https://www.bookvault.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
            >
              Get your API key at bookvault.app <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.connected) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Bookvault connection error</p>
              <p className="text-xs text-muted-foreground mt-1">{data.error}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
            {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
      <CardContent className="py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">Connected to Bookvault</span>
          {data.accountName && (
            <Badge variant="secondary" className="text-xs">{data.accountName}</Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
          {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Test
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Titles Catalog Tab ────────────────────────────────────────────────────────
function TitlesTab() {
  const [search, setSearch] = useState("");
  const titlesQ = trpc.bookvaultAdmin.listTitles.useQuery();
  const titles = (titlesQ.data ?? []).filter((t) =>
    !search || t.Title?.toLowerCase().includes(search.toLowerCase()) || t.Isbn?.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by title or ISBN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => titlesQ.refetch()} disabled={titlesQ.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${titlesQ.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {titlesQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog…
        </div>
      ) : titles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {search ? "No titles match your search." : "No titles found in your Bookvault catalog."}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Title</th>
                <th className="text-left px-4 py-2 font-medium">ISBN</th>
                <th className="text-left px-4 py-2 font-medium">Author</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {titles.map((t, i) => (
                <tr key={t.Isbn ?? i} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{t.Title ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.Isbn ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{t.Author ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={t.Status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Linked Products Tab ───────────────────────────────────────────────────────
function LinkedProductsTab() {
  const utils = trpc.useUtils();
  const productsQ = trpc.bookvaultAdmin.listLinkedProducts.useQuery();
  const updateMut = trpc.bookvaultAdmin.updateProductLink.useMutation({
    onSuccess: () => {
      toast.success("Product updated.");
      utils.bookvaultAdmin.listLinkedProducts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const products = productsQ.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Physical products with Bookvault fulfillment enabled. Set the ISBN to link a product to a Bookvault title.
      </p>
      {productsQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No products have Bookvault fulfillment enabled yet.
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <ProductLinkRow
              key={p.id}
              product={p}
              onUpdate={(isbn) => updateMut.mutate({ productId: p.id, bookvaultEnabled: true, bookvaultIsbn: isbn })}
              onDisable={() => updateMut.mutate({ productId: p.id, bookvaultEnabled: false })}
              isPending={updateMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductLinkRow({
  product,
  onUpdate,
  onDisable,
  isPending,
}: {
  product: { id: number; title: string; bookvaultEnabled: boolean; bookvaultIsbn?: string | null };
  onUpdate: (isbn: string) => void;
  onDisable: () => void;
  isPending: boolean;
}) {
  const [isbn, setIsbn] = useState(product.bookvaultIsbn ?? "");

  return (
    <Card>
      <CardContent className="py-3 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{product.title}</p>
          <p className="text-xs text-muted-foreground">ID: {product.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-44 h-8 text-xs font-mono"
            placeholder="ISBN (e.g. 978-…)"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
          />
          <Button
            size="sm"
            disabled={isPending || !isbn.trim()}
            onClick={() => onUpdate(isbn.trim())}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDisable} disabled={isPending}>
            Disable
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab() {
  const utils = trpc.useUtils();
  const ordersQ = trpc.bookvaultAdmin.listOrders.useQuery({ page: 1, limit: 100 });
  const fulfillMut = trpc.bookvaultAdmin.fulfillOrder.useMutation({
    onSuccess: (data) => {
      if (data.submitted) toast.success("Order submitted to Bookvault.");
      else if (data.skipped) toast.info(`Skipped: ${data.reason}`);
      else toast.error(`Failed: ${data.error}`);
      utils.bookvaultAdmin.listOrders.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const refreshMut = trpc.bookvaultAdmin.refreshOrderStatus.useMutation({
    onSuccess: () => {
      toast.success("Status refreshed.");
      utils.bookvaultAdmin.listOrders.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const orders = ordersQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="outline" onClick={() => ordersQ.refetch()} disabled={ordersQ.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${ordersQ.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {ordersQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No Bookvault orders yet.</div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Order</th>
                <th className="text-left px-4 py-2 font-medium">Customer</th>
                <th className="text-left px-4 py-2 font-medium">Product / ISBN</th>
                <th className="text-left px-4 py-2 font-medium">Bookvault Status</th>
                <th className="text-left px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((row) => (
                <tr key={row.order.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">#{row.order.id}</span>
                    <div className="text-xs text-muted-foreground">
                      {new Date(row.order.orderedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{row.user.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{row.user.email}</div>
                  </td>
                  <td className="px-4 py-2">
                    <div>{row.product.title}</div>
                    {row.product.bookvaultIsbn && (
                      <div className="font-mono text-xs text-muted-foreground">{row.product.bookvaultIsbn}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={row.order.bookvaultStatus} />
                    {row.order.bookvaultDocRef && (
                      <div className="text-xs text-muted-foreground mt-0.5">Ref: {row.order.bookvaultDocRef}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {!row.order.bookvaultSubmittedAt ? (
                        <Button
                          size="sm"
                          disabled={fulfillMut.isPending}
                          onClick={() => fulfillMut.mutate({ orderId: row.order.id })}
                        >
                          Submit
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={refreshMut.isPending}
                          onClick={() => refreshMut.mutate({ orderId: row.order.id })}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refresh
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BookvaultAdmin() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Book className="h-6 w-6" />
            Bookvault
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Print-on-demand book fulfillment via{" "}
            <a href="https://www.bookvault.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
              bookvault.app <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>

      <ConnectionBanner />

      <Tabs defaultValue="titles">
        <TabsList>
          <TabsTrigger value="titles">
            <Book className="h-4 w-4 mr-1.5" />
            Title Catalog
          </TabsTrigger>
          <TabsTrigger value="products">
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Linked Products
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="titles" className="mt-4">
          <TitlesTab />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <LinkedProductsTab />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <OrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
