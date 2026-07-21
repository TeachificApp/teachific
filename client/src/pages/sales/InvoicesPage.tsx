import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText, Search, Plus, Eye, RefreshCw,
  ShoppingCart, DollarSign, Send, Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProductType = "course" | "download" | "bundle" | "membership" | "manual";
type InvoiceStatus = "paid" | "pending" | "refunded";

interface InvoiceRow {
  id: number;
  orgId: number;
  userId: number | null;
  invoiceNumber: string;
  productType: ProductType;
  productId: number | null;
  productTitle: string;
  buyerName: string | null;
  buyerEmail: string | null;
  amountPaid: string;
  currency: string;
  status: InvoiceStatus;
  stripePaymentIntentId: string | null;
  notes: string | null;
  isManual: boolean;
  createdAt: Date;
  orgName?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<InvoiceStatus, string> = {
  paid: "bg-green-100 text-green-700 border-green-200",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  refunded: "bg-slate-100 text-slate-600 border-slate-200",
};

const TYPE_LABELS: Record<ProductType, string> = {
  course: "Course",
  download: "Download",
  bundle: "Bundle",
  membership: "Membership",
  manual: "Manual",
};

function fmt(amount: string | number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

// ─── Receipt / Invoice Modal ──────────────────────────────────────────────────
function ReceiptModal({
  invoice,
  orgName,
  onClose,
}: {
  invoice: InvoiceRow;
  orgName: string;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const resend = trpc.invoices.resend.useMutation({
    onSuccess: () => toast.success("Receipt email sent"),
    onError: (e) => toast.error(e.message),
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Receipt ${invoice.invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; color: #111; padding: 40px; max-width: 680px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
        .brand span { color: #24abbc; }
        .invoice-meta { text-align: right; }
        .invoice-meta h2 { font-size: 26px; font-weight: 700; }
        .invoice-meta p { font-size: 13px; color: #6b7280; margin-top: 4px; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
        .line-item { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
        .total-row { display: flex; justify-content: space-between; padding: 14px 0 0; font-size: 20px; font-weight: 700; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #d1fae5; color: #065f46; }
        .notes { background: #f9fafb; border-radius: 8px; padding: 12px; margin-top: 20px; font-size: 13px; color: #374151; }
        .footer { margin-top: 32px; font-size: 12px; color: #9ca3af; text-align: center; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const date = new Date(invoice.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            Receipt — {invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        {/* Printable receipt */}
        <div ref={printRef} className="bg-white rounded-lg p-6 border border-border">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
                <span className="text-foreground">teach</span>
                <span style={{ color: "#24abbc" }}>ific</span>
                <span className="text-foreground" style={{ fontSize: "0.45em", verticalAlign: "super" }}>™</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{invoice.orgName ?? orgName}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">RECEIPT</div>
              <p className="text-sm text-muted-foreground mt-1">#{invoice.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">{date}</p>
            </div>
          </div>

          <hr className="border-border mb-6" />

          {/* Buyer + Product */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Billed To</p>
              <p className="font-medium">{invoice.buyerName ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{invoice.buyerEmail ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Product</p>
              <p className="font-medium">{invoice.productTitle}</p>
              <p className="text-sm text-muted-foreground">{TYPE_LABELS[invoice.productType]}</p>
            </div>
          </div>

          <hr className="border-border mb-4" />

          {/* Line item */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider">
              <span>Description</span>
              <span>Amount</span>
            </div>
            <div className="flex justify-between font-medium py-2 border-b border-border/40">
              <span>{invoice.productTitle}</span>
              <span>{fmt(invoice.amountPaid, invoice.currency)}</span>
            </div>
          </div>

          {/* Total + status */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2">
              <Badge className={`text-xs border ${STATUS_COLORS[invoice.status]}`}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </Badge>
              {invoice.isManual && (
                <Badge variant="outline" className="text-xs">Manual</Badge>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Paid</p>
              <p className="text-2xl font-bold">{fmt(invoice.amountPaid, invoice.currency)}</p>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-4 p-3 bg-muted/40 rounded-md">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}

          {invoice.stripePaymentIntentId && (
            <p className="text-xs text-muted-foreground mt-4 break-all">
              Payment ref: {invoice.stripePaymentIntentId}
            </p>
          )}

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Thank you for your purchase!
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => resend.mutate({ id: invoice.id })} disabled={resend.isPending}>
            <Send className="h-4 w-4 mr-2" />
            {resend.isPending ? "Sending…" : "Resend Receipt"}
          </Button>
          <Button onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Print / Save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manual Invoice Create Dialog ─────────────────────────────────────────────
function CreateInvoiceDialog({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    productTitle: "",
    buyerName: "",
    buyerEmail: "",
    amountPaid: "",
    currency: "usd",
    productType: "manual" as ProductType,
    notes: "",
    sendEmail: true,
  });

  const create = trpc.invoices.createManual.useMutation({
    onSuccess: () => { toast.success("Invoice created"); onCreated(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productTitle.trim()) return toast.error("Product title is required");
    if (!form.buyerEmail.trim()) return toast.error("Buyer email is required");
    const amount = parseFloat(form.amountPaid);
    if (isNaN(amount) || amount < 0) return toast.error("Enter a valid amount");
    create.mutate({
      orgId,
      productTitle: form.productTitle.trim(),
      buyerName: form.buyerName.trim() || undefined,
      buyerEmail: form.buyerEmail.trim(),
      amountPaid: amount,
      currency: form.currency,
      productType: form.productType,
      notes: form.notes.trim() || undefined,
      sendEmail: form.sendEmail,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-teal-600" />
            Create Manual Invoice
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Product / Service Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Advanced Echo Course"
                value={form.productTitle}
                onChange={(e) => setForm((f) => ({ ...f, productTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Buyer Name</Label>
              <Input
                placeholder="Jane Smith"
                value={form.buyerName}
                onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Buyer Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="jane@example.com"
                value={form.buyerEmail}
                onChange={(e) => setForm((f) => ({ ...f, buyerEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Amount <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amountPaid}
                onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD</SelectItem>
                  <SelectItem value="cad">CAD</SelectItem>
                  <SelectItem value="eur">EUR</SelectItem>
                  <SelectItem value="gbp">GBP</SelectItem>
                  <SelectItem value="aud">AUD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Type</Label>
              <Select value={form.productType} onValueChange={(v) => setForm((f) => ({ ...f, productType: v as ProductType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual / Other</SelectItem>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                  <SelectItem value="membership">Membership</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any additional notes for this invoice…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="sendEmail"
                checked={form.sendEmail}
                onChange={(e) => setForm((f) => ({ ...f, sendEmail: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-teal-600"
              />
              <Label htmlFor="sendEmail" className="cursor-pointer font-normal">
                Send receipt email to buyer
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ProductType>("all");
  const [viewInvoice, setViewInvoice] = useState<InvoiceRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const isPlatformAdmin = user?.role === "site_owner" || user?.role === "site_admin";

  const { data: invoicesData, isLoading, refetch } = trpc.invoices.list.useQuery(
    {
      orgId: undefined,
      status: statusFilter,
      productType: typeFilter,
      pageSize: 100,
    },
    { enabled: !!user }
  );

  const { data: stats } = trpc.invoices.getStats.useQuery(
    { orgId: undefined },
    { enabled: !!user }
  );

  const updateStatus = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const invoices: InvoiceRow[] = ((invoicesData as any)?.invoices ?? []) as InvoiceRow[];

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.buyerName ?? "").toLowerCase().includes(q) ||
      (inv.buyerEmail ?? "").toLowerCase().includes(q) ||
      inv.productTitle.toLowerCase().includes(q)
    );
  });

  // Resolve the org context for manual invoice creation
  // We need the orgId — grab it from the first invoice or from the user's org
  const { data: myOrgs } = trpc.orgs.myOrgs.useQuery(undefined, { enabled: !!user });
  const orgId = myOrgs?.[0]?.id;
  const orgName = myOrgs?.[0]?.name ?? "Teachific";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-600" />
            Transactions &amp; Invoices
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            All purchases, subscriptions, and manual invoices for your organization
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={!orgId}>
          <Plus className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                  <ShoppingCart className="h-4 w-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Transactions</p>
                  <p className="text-xl font-bold">{stats.totalCount.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold">{fmt(stats.totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {stats.byType.slice(0, 2).map((t) => (
            <Card key={t.productType}>
              <CardContent className="pt-4 pb-4">
                <div>
                  <p className="text-xs text-muted-foreground capitalize">{TYPE_LABELS[t.productType as ProductType] ?? t.productType}</p>
                  <p className="text-xl font-bold">{t.count}</p>
                  <p className="text-xs text-muted-foreground">{fmt(t.revenue)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice #, buyer, or product…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="course">Course</SelectItem>
                <SelectItem value="download">Download</SelectItem>
                <SelectItem value="bundle">Bundle</SelectItem>
                <SelectItem value="membership">Membership</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? "transaction" : "transactions"}
            {(search || statusFilter !== "all" || typeFilter !== "all") ? " (filtered)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">No transactions found</p>
              {orgId && (
                <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create manual invoice
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Invoice #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Buyer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-teal-700 whitespace-nowrap">
                        {inv.invoiceNumber}
                        {inv.isManual && (
                          <span className="ml-1 text-[10px] bg-slate-100 text-slate-500 px-1 rounded">M</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[140px]">{inv.buyerName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[140px]">{inv.buyerEmail ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <span className="truncate block" title={inv.productTitle}>{inv.productTitle}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize whitespace-nowrap">
                          {TYPE_LABELS[inv.productType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                        {fmt(inv.amountPaid, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Select
                          value={inv.status}
                          onValueChange={(v) =>
                            updateStatus.mutate({ id: inv.id, status: v as InvoiceStatus })
                          }
                        >
                          <SelectTrigger className={`h-7 text-xs w-28 border ${STATUS_COLORS[inv.status]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewInvoice(inv)}
                          className="h-7 px-2 text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {viewInvoice && (
        <ReceiptModal
          invoice={viewInvoice}
          orgName={orgName}
          onClose={() => setViewInvoice(null)}
        />
      )}
      {showCreate && orgId && (
        <CreateInvoiceDialog
          orgId={orgId}
          onClose={() => setShowCreate(false)}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
}
