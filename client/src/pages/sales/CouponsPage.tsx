import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tag, Plus, Copy, Trash2, Percent, DollarSign } from "lucide-react";

interface Coupon { id: number; code: string; type: "percent" | "fixed"; value: number; uses: number; maxUses: number | null; expires: string | null; active: boolean; }

const MOCK: Coupon[] = [
  { id: 1, code: "WELCOME20", type: "percent", value: 20, uses: 45, maxUses: 100, expires: "2026-12-31", active: true },
  { id: 2, code: "SAVE10", type: "fixed", value: 10, uses: 12, maxUses: null, expires: null, active: true },
  { id: 3, code: "SUMMER50", type: "percent", value: 50, uses: 200, maxUses: 200, expires: "2026-08-31", active: false },
];

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>(MOCK);
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    setCode(Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
  };

  const handleCreate = () => {
    if (!code.trim()) { toast.error("Coupon code required"); return; }
    if (!value || isNaN(Number(value))) { toast.error("Valid discount value required"); return; }
    setCoupons(prev => [...prev, { id: Date.now(), code: code.toUpperCase(), type, value: Number(value), uses: 0, maxUses: maxUses ? Number(maxUses) : null, expires: expires || null, active: true }]);
    setCode(""); setValue(""); setMaxUses(""); setExpires(""); setShowAdd(false);
    toast.success("Coupon created");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="w-6 h-6 text-teal-600" /> Coupons</h1>
          <p className="text-muted-foreground mt-1">Create and manage discount codes for your products</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className=" hover:"><Plus className="w-4 h-4 mr-2" /> Create Coupon</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{coupons.filter(c => c.active).length}</p><p className="text-sm text-muted-foreground">Active Coupons</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{coupons.reduce((s, c) => s + c.uses, 0)}</p><p className="text-sm text-muted-foreground">Total Uses</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{coupons.filter(c => c.expires && new Date(c.expires) < new Date()).length}</p><p className="text-sm text-muted-foreground">Expired</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>All Coupons</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Discount</th>
                <th className="text-left p-3 font-medium">Uses</th>
                <th className="text-left p-3 font-medium">Expires</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} className="border-b hover:bg-muted/20">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-bold text-teal-700">{c.code}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-3"><span className="flex items-center gap-1">{c.type === "percent" ? <Percent className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}{c.value}{c.type === "percent" ? "%" : ""} off</span></td>
                  <td className="p-3">{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                  <td className="p-3">{c.expires ?? "No expiry"}</td>
                  <td className="p-3"><Badge variant={c.active ? "default" : "secondary"} className={c.active ? "bg-green-100 text-green-700" : ""}>{c.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="p-3"><Button size="sm" variant="ghost" className="text-red-500" onClick={() => { setCoupons(p => p.filter(x => x.id !== c.id)); toast.success("Deleted"); }}><Trash2 className="w-3 h-3" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Coupon</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Coupon Code</Label>
              <div className="flex gap-2 mt-1">
                <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. SAVE20" />
                <Button variant="outline" onClick={generateCode}>Generate</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount Type</Label>
                <Select value={type} onValueChange={v => setType(v as "percent" | "fixed")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Value</Label><Input value={value} onChange={e => setValue(e.target.value)} placeholder={type === "percent" ? "20" : "10"} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Max Uses (optional)</Label><Input value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" className="mt-1" /></div>
              <div><Label>Expiry Date (optional)</Label><Input type="date" value={expires} onChange={e => setExpires(e.target.value)} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} className=" hover:">Create Coupon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
