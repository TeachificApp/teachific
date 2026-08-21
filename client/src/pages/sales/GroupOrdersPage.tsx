import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Plus, Search, Eye } from "lucide-react";

interface GroupOrder { id: number; org: string; contact: string; seats: number; used: number; course: string; amount: number; status: "active" | "expired"; created: string; }

const MOCK: GroupOrder[] = [
  { id: 1, org: "Acme Corp", contact: "hr@acme.com", seats: 50, used: 32, course: "Leadership Essentials", amount: 2450, status: "active", created: "2026-01-15" },
  { id: 2, org: "TechStart Inc", contact: "training@techstart.io", seats: 20, used: 20, course: "Python Fundamentals", amount: 980, status: "active", created: "2026-02-01" },
  { id: 3, org: "MedGroup", contact: "cme@medgroup.org", seats: 100, used: 87, course: "HIPAA Compliance 2026", amount: 4900, status: "expired", created: "2025-09-01" },
];

export default function GroupOrdersPage() {
  const [orders] = useState<GroupOrder[]>(MOCK);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [org, setOrg] = useState(""); const [contact, setContact] = useState(""); const [seats, setSeats] = useState(""); const [course, setCourse] = useState("");

  const filtered = orders.filter(o => o.org.toLowerCase().includes(search.toLowerCase()) || o.course.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    if (!org || !contact || !seats || !course) { toast.error("All fields required"); return; }
    toast.success("Group order created — invite link sent to " + contact);
    setOrg(""); setContact(""); setSeats(""); setCourse(""); setShowNew(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-[var(--org-primary)]" /> Group Orders</h1>
          <p className="text-muted-foreground mt-1">Manage bulk registrations and seat allocations for organizations</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="org-primary-button"><Plus className="w-4 h-4 mr-2" /> New Group Order</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{orders.filter(o => o.status === "active").length}</p><p className="text-sm text-muted-foreground">Active Orders</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{orders.reduce((s, o) => s + o.seats, 0)}</p><p className="text-sm text-muted-foreground">Total Seats</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">${orders.reduce((s, o) => s + o.amount, 0).toLocaleString()}</p><p className="text-sm text-muted-foreground">Total Revenue</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search by org or course..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="text-left p-3 font-medium">Organization</th>
                <th className="text-left p-3 font-medium">Course</th>
                <th className="text-left p-3 font-medium">Seats</th>
                <th className="text-left p-3 font-medium">Revenue</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="border-b hover:bg-muted/20">
                  <td className="p-3"><div className="font-medium">{o.org}</div><div className="text-xs text-muted-foreground">{o.contact}</div></td>
                  <td className="p-3">{o.course}</td>
                  <td className="p-3"><div>{o.used} / {o.seats} used</div><div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className="bg-[var(--org-primary)] h-1.5 rounded-full" style={{ width: `${Math.min(100, (o.used / o.seats) * 100)}%` }}></div></div></td>
                  <td className="p-3">${o.amount.toLocaleString()}</td>
                  <td className="p-3"><Badge className={o.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>{o.status}</Badge></td>
                  <td className="p-3"><Button size="sm" variant="outline" onClick={() => toast.info("Opening order details...")}><Eye className="w-3 h-3 mr-1" />View</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Group Order</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Organization Name</Label><Input value={org} onChange={e => setOrg(e.target.value)} placeholder="Acme Corp" className="mt-1" /></div>
            <div><Label>Contact Email</Label><Input value={contact} onChange={e => setContact(e.target.value)} placeholder="hr@acme.com" className="mt-1" /></div>
            <div><Label>Number of Seats</Label><Input type="number" value={seats} onChange={e => setSeats(e.target.value)} placeholder="25" className="mt-1" /></div>
            <div><Label>Course</Label><Input value={course} onChange={e => setCourse(e.target.value)} placeholder="Course name" className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="org-primary-button">Create Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
