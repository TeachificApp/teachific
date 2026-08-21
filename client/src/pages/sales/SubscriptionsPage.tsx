import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, Search, DollarSign, XCircle, RotateCcw } from "lucide-react";

interface Subscription { id: number; member: string; email: string; plan: string; amount: number; status: "active" | "cancelled" | "past_due"; nextBilling: string; started: string; }

const MOCK: Subscription[] = [
  { id: 1, member: "Alice Johnson", email: "alice@example.com", plan: "Monthly Pro", amount: 49, status: "active", nextBilling: "2026-05-02", started: "2026-01-02" },
  { id: 2, member: "Bob Smith", email: "bob@example.com", plan: "Annual Pro", amount: 399, status: "active", nextBilling: "2027-03-15", started: "2026-03-15" },
  { id: 3, member: "Carol White", email: "carol@example.com", plan: "Monthly Basic", amount: 19, status: "past_due", nextBilling: "2026-04-01", started: "2025-10-01" },
  { id: 4, member: "David Lee", email: "david@example.com", plan: "Monthly Pro", amount: 49, status: "cancelled", nextBilling: "—", started: "2025-08-20" },
];

const statusColor = { active: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-600", past_due: "bg-red-100 text-red-700" };

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>(MOCK);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [action, setAction] = useState<"cancel" | "refund" | null>(null);

  const filtered = subs.filter(s =>
    (filter === "all" || s.status === filter) &&
    (s.member.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCancel = () => {
    if (!selected) return;
    setSubs(p => p.map(s => s.id === selected.id ? { ...s, status: "cancelled", nextBilling: "—" } : s));
    toast.success(`Subscription cancelled for ${selected.member}`);
    setSelected(null); setAction(null);
  };

  const handleRefund = () => {
    if (!selected) return;
    toast.success(`Refund of $${selected.amount} issued to ${selected.member}`);
    setSelected(null); setAction(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><RefreshCw className="w-6 h-6 text-[var(--org-primary)]" /> Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Manage recurring billing, cancellations, and refunds</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{subs.filter(s => s.status === "active").length}</p><p className="text-sm text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{subs.filter(s => s.status === "past_due").length}</p><p className="text-sm text-muted-foreground">Past Due</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${subs.filter(s => s.status === "active").reduce((s, x) => s + x.amount, 0)}</p><p className="text-sm text-muted-foreground">MRR</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left p-3 font-medium">Member</th>
                <th className="text-left p-3 font-medium">Plan</th>
                <th className="text-left p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Next Billing</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b hover:bg-muted/20">
                  <td className="p-3"><div className="font-medium">{s.member}</div><div className="text-xs text-muted-foreground">{s.email}</div></td>
                  <td className="p-3">{s.plan}</td>
                  <td className="p-3">${s.amount}/mo</td>
                  <td className="p-3"><Badge className={statusColor[s.status]}>{s.status.replace("_", " ")}</Badge></td>
                  <td className="p-3">{s.nextBilling}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {s.status === "active" && <Button size="sm" variant="outline" className="text-red-600 text-xs" onClick={() => { setSelected(s); setAction("cancel"); }}><XCircle className="w-3 h-3 mr-1" />Cancel</Button>}
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelected(s); setAction("refund"); }}><RotateCcw className="w-3 h-3 mr-1" />Refund</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={!!action} onOpenChange={() => { setAction(null); setSelected(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{action === "cancel" ? "Cancel Subscription" : "Issue Refund"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {action === "cancel" ? `Cancel the subscription for ${selected?.member}? They will lose access at the end of their billing period.` : `Issue a refund of $${selected?.amount} to ${selected?.member}?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAction(null); setSelected(null); }}>Cancel</Button>
            <Button className={action === "cancel" ? "bg-red-600 hover:bg-red-700" : "org-primary-button"} onClick={action === "cancel" ? handleCancel : handleRefund}>
              {action === "cancel" ? "Confirm Cancel" : "Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
