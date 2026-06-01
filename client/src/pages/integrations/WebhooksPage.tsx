import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Webhook, Plus, Trash2, Send, CheckCircle, XCircle } from "lucide-react";

interface WebhookItem {
  id: number;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered: string;
}

const MOCK_WEBHOOKS: WebhookItem[] = [
  { id: 1, url: "https://myapp.com/webhooks/teachific", events: ["enrollment.created", "payment.completed"], active: true, lastTriggered: "2026-04-02" },
  { id: 2, url: "https://zapier.com/hooks/catch/12345", events: ["member.created"], active: false, lastTriggered: "2026-03-28" },
];

const EVENT_TYPES = [
  "enrollment.created", "enrollment.completed", "payment.completed",
  "payment.refunded", "member.created", "member.updated",
  "course.published", "certificate.issued",
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>(MOCK_WEBHOOKS);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const toggleEvent = (ev: string) =>
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);

  const handleAdd = () => {
    if (!newUrl.trim()) { toast.error("Please enter a webhook URL"); return; }
    if (selectedEvents.length === 0) { toast.error("Select at least one event"); return; }
    setWebhooks(prev => [...prev, { id: Date.now(), url: newUrl.trim(), events: selectedEvents, active: true, lastTriggered: "Never" }]);
    setNewUrl(""); setSelectedEvents([]); setShowAdd(false);
    toast.success("Webhook added");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="w-6 h-6 text-teal-600" /> Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">Send real-time event notifications to external services</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className=" hover:">
          <Plus className="w-4 h-4 mr-2" /> Add Webhook
        </Button>
      </div>

      <div className="space-y-4">
        {webhooks.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No webhooks configured yet.</CardContent></Card>
        )}
        {webhooks.map(wh => (
          <Card key={wh.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {wh.active ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-gray-400 shrink-0" />}
                    <span className="font-mono text-sm truncate">{wh.url}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {wh.events.map(ev => <Badge key={ev} variant="secondary" className="text-xs">{ev}</Badge>)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Last triggered: {wh.lastTriggered}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={wh.active} onCheckedChange={() => setWebhooks(p => p.map(w => w.id === wh.id ? { ...w, active: !w.active } : w))} />
                  <Button size="sm" variant="outline" onClick={() => toast.info(`Test ping sent to ${wh.url}`)}>
                    <Send className="w-3 h-3 mr-1" /> Test
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => { setWebhooks(p => p.filter(w => w.id !== wh.id)); toast.success("Deleted"); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Webhook</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Endpoint URL</Label>
              <Input placeholder="https://your-server.com/webhook" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="mb-2 block">Events to send</Label>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_TYPES.map(ev => (
                  <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedEvents.includes(ev)} onChange={() => toggleEvent(ev)} className="rounded" />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} className=" hover:">Add Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle className="text-base">Webhook Documentation</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Teachific sends a <code className="bg-muted px-1 rounded">POST</code> request with a JSON payload to your endpoint when an event occurs.</p>
          <p>Verify authenticity using the <code className="bg-muted px-1 rounded">X-Teachific-Signature</code> header (HMAC-SHA256 of the raw body using your webhook secret).</p>
          <p>Your endpoint must respond with a <code className="bg-muted px-1 rounded">2xx</code> status within 10 seconds. Failed deliveries are retried up to 3 times.</p>
        </CardContent>
      </Card>
    </div>
  );
}
