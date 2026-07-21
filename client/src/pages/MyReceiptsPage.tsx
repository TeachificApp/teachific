import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Search, Download, Receipt } from "lucide-react";

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
  manual: "Invoice",
};

function fmt(amount: string | number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────
function ReceiptModal({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

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
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
        .line-item { display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
        .total-row { display: flex; justify-content: space-between; padding: 14px 0 0; font-size: 20px; font-weight: 700; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #d1fae5; color: #065f46; }
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
            <Receipt className="h-5 w-5 text-teal-600" />
            Receipt — {invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="bg-white rounded-lg p-6 border border-border">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", letterSpacing: "-0.02em" }}>
                <span className="text-foreground">teach</span>
                <span style={{ color: "#24abbc" }}>ific</span>
                <span className="text-foreground" style={{ fontSize: "0.45em", verticalAlign: "super" }}>™</span>
              </div>
              {invoice.orgName && (
                <p className="text-sm text-muted-foreground mt-1">{invoice.orgName}</p>
              )}
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

          {/* Total */}
          <div className="flex justify-between items-center pt-2">
            <Badge className={`text-xs border ${STATUS_COLORS[invoice.status]}`}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Badge>
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

        <DialogFooter>
          <Button onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Print / Save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyReceiptsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [viewInvoice, setViewInvoice] = useState<InvoiceRow | null>(null);

  const { data: invoicesData, isLoading } = trpc.invoices.list.useQuery(
    { pageSize: 100 },
    { enabled: !!user }
  );

  const invoices: InvoiceRow[] = ((invoicesData as any)?.invoices ?? []) as InvoiceRow[];

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.productTitle.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="w-6 h-6 text-teal-600" />
          My Receipts
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your purchase history and downloadable receipts
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by product or invoice number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {filtered.length} {filtered.length === 1 ? "purchase" : "purchases"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Receipt className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {search ? "No receipts match your search" : "No purchases yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-muted/20 transition-colors"
                >
                  {/* Icon */}
                  <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg shrink-0">
                    <FileText className="h-5 w-5 text-teal-600" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{inv.productTitle}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {TYPE_LABELS[inv.productType]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="font-mono">{inv.invoiceNumber}</span>
                      <span>
                        {new Date(inv.createdAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                      <Badge className={`text-xs border ${STATUS_COLORS[inv.status]}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </Badge>
                    </div>
                  </div>

                  {/* Amount + action */}
                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular-nums">{fmt(inv.amountPaid, inv.currency)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 mt-1 text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                      onClick={() => setViewInvoice(inv)}
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1" />
                      View Receipt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt modal */}
      {viewInvoice && (
        <ReceiptModal
          invoice={viewInvoice}
          onClose={() => setViewInvoice(null)}
        />
      )}
    </div>
  );
}
