import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Search, Download, Send, Settings } from "lucide-react";

interface Invoice { id: number; number: string; member: string; email: string; amount: number; status: "paid" | "pending" | "overdue"; date: string; dueDate: string; }

const MOCK: Invoice[] = [
  { id: 1, number: "INV-2026-001", member: "Alice Johnson", email: "alice@example.com", amount: 299, status: "paid", date: "2026-04-01", dueDate: "2026-04-15" },
  { id: 2, number: "INV-2026-002", member: "Bob Smith", email: "bob@example.com", amount: 49, status: "pending", date: "2026-04-02", dueDate: "2026-04-16" },
  { id: 3, number: "INV-2026-003", member: "Carol White", email: "carol@example.com", amount: 149, status: "overdue", date: "2026-03-15", dueDate: "2026-03-29" },
];

const statusColor = { paid: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700", overdue: "bg-red-100 text-red-700" };

export default function InvoicesPage() {
  const [invoices] = useState<Invoice[]>(MOCK);
  const [search, setSearch] = useState("");
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const filtered = invoices.filter(i => i.member.toLowerCase().includes(search.toLowerCase()) || i.number.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-teal-600" /> Invoices</h1>
          <p className="text-muted-foreground mt-1">Automated invoicing for all transactions</p>
        </div>
        <Button variant="outline" onClick={() => setShowSettings(!showSettings)}><Settings className="w-4 h-4 mr-2" /> Invoice Settings</Button>
      </div>

      {showSettings && (
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Automatic Invoicing</Label>
                <p className="text-sm text-muted-foreground">Automatically send invoices after each purchase</p>
              </div>
              <Switch checked={autoInvoice} onCheckedChange={setAutoInvoice} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Invoice Prefix</Label><Input defaultValue="INV" className="mt-1" /></div>
              <div><Label>Payment Terms (days)</Label><Input type="number" defaultValue="14" className="mt-1" /></div>
            </div>
            <div><Label>Footer Note</Label><Input defaultValue="Thank you for your business!" className="mt-1" /></div>
            <Button className=" hover:" onClick={() => toast.success("Invoice settings saved")}>Save Settings</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{invoices.filter(i => i.status === "paid").length}</p><p className="text-sm text-muted-foreground">Paid</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{invoices.filter(i => i.status === "pending").length}</p><p className="text-sm text-muted-foreground">Pending</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{invoices.filter(i => i.status === "overdue").length}</p><p className="text-sm text-muted-foreground">Overdue</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left p-3 font-medium">Invoice #</th>
                <th className="text-left p-3 font-medium">Member</th>
                <th className="text-left p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Due Date</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 font-mono text-sm">{inv.number}</td>
                  <td className="p-3"><div className="font-medium">{inv.member}</div><div className="text-xs text-muted-foreground">{inv.email}</div></td>
                  <td className="p-3 font-medium">${inv.amount}</td>
                  <td className="p-3"><Badge className={statusColor[inv.status]}>{inv.status}</Badge></td>
                  <td className="p-3">{inv.dueDate}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => toast.info("Downloading invoice...")}><Download className="w-3 h-3" /></Button>
                      {inv.status !== "paid" && <Button size="sm" variant="outline" onClick={() => toast.success("Invoice resent to " + inv.email)}><Send className="w-3 h-3" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
