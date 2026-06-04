import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Webhook, Plus, Trash2, Send, CheckCircle, XCircle, Zap, Lock, ExternalLink, Clock, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { useOrgPlan } from "@/hooks/useOrgPlan";

const EVENT_TYPES = [
  { value: "new_enrollment", label: "New Enrollment", description: "When a student enrolls in a course" },
  { value: "course_completed", label: "Course Completed", description: "When a student completes a course" },
  { value: "new_order", label: "New Order", description: "When a purchase is made" },
  { value: "form_submitted", label: "Form Submitted", description: "When a form response is submitted" },
  { value: "new_member", label: "New Member", description: "When a new member joins your school" },
];

export default function WebhooksPage() {
  const { orgId } = useOrgScope();
  const { can, isLoading: planLoading } = useOrgPlan(orgId);
  const hasAccess = can("zapierIntegrations");

  const { data: webhooks, isLoading, refetch } = trpc.zapier.list.useQuery(
    undefined,
    { enabled: !!orgId && hasAccess }
  );
  const { data: logs } = trpc.zapier.logs.useQuery(
    { limit: 20 },
    { enabled: !!orgId && hasAccess }
  );

  const createMutation = trpc.zapier.create.useMutation({
    onSuccess: () => { refetch(); toast.success("Webhook created"); setShowAdd(false); setNewUrl(""); setNewName(""); setSelectedEvents([]); },
    onError: (err) => toast.error(err.message),
  });
  const toggleMutation = trpc.zapier.toggle.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.zapier.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Webhook deleted"); },
    onError: (err) => toast.error(err.message),
  });
  const testMutation = trpc.zapier.test.useMutation({
    onSuccess: (data) => toast.success(`Test sent! Status: ${data.status}`),
    onError: (err) => toast.error(err.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const toggleEvent = (ev: string) =>
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);

  const handleAdd = () => {
    if (!orgId) return;
    if (!newUrl.trim()) { toast.error("Please enter a webhook URL"); return; }
    if (selectedEvents.length === 0) { toast.error("Select at least one event"); return; }
    createMutation.mutate({ url: newUrl.trim(), name: newName.trim() || undefined, events: selectedEvents as any });
  };

  if (planLoading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <Lock className="w-12 h-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-semibold">Zapier & Webhook Integrations</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Connect your school with 5,000+ apps via Zapier or send real-time webhook notifications to your own endpoints.
              This feature is available on the <strong>Builder</strong> plan and above.
            </p>
            <Button onClick={() => toast.info("Upgrade from Settings \u2192 Billing")}>
              Upgrade to Builder
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-500" /> Zapier & Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect with Zapier or send real-time event notifications to any URL
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Webhook
        </Button>
      </div>

      {/* Zapier Quick Setup Card */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center text-2xl shrink-0">\u26A1</div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Connect with Zapier</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use your Zapier webhook URL as the endpoint below to trigger Zaps automatically when events happen in your school.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open("https://zapier.com/apps/webhook/integrations", "_blank")}>
            <ExternalLink className="w-3 h-3 mr-1" /> Open Zapier
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="webhooks">
        <TabsList>
          <TabsTrigger value="webhooks">Active Webhooks</TabsTrigger>
          <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4 mt-4">
          {isLoading && <div className="text-center py-8 text-muted-foreground">Loading webhooks...</div>}
          {!isLoading && (!webhooks || webhooks.length === 0) && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Webhook className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No webhooks configured yet.</p>
                <p className="text-xs mt-1">Click \"Add Webhook\" to get started with Zapier or custom integrations.</p>
              </CardContent>
            </Card>
          )}
          {webhooks?.map(wh => (
            <Card key={wh.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {wh.active ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-gray-400 shrink-0" />}
                      <span className="font-medium text-sm">{wh.name || "Unnamed Webhook"}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground truncate block">{wh.url}</span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(wh.events as string[]).map((ev: string) => (
                        <Badge key={ev} variant="secondary" className="text-xs">{ev.replace(/_/g, " ")}</Badge>
                      ))}
                    </div>
                    {wh.lastTriggeredAt && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Last triggered: {new Date(wh.lastTriggeredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={!!wh.active}
                      onCheckedChange={() => toggleMutation.mutate({ id: wh.id })}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testMutation.mutate({ id: wh.id })}
                      disabled={testMutation.isPending}
                    >
                      <Send className="w-3 h-3 mr-1" /> Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => { if (confirm("Delete this webhook?")) deleteMutation.mutate({ id: wh.id }); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Deliveries</CardTitle>
              <CardDescription>Last 20 webhook delivery attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {!logs || logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No delivery logs yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map((log: any) => (
                    <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/40 text-sm">
                      {log.statusCode && log.statusCode >= 200 && log.statusCode < 300 ? (
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{log.eventType?.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground ml-2">\u2192 {log.webhookUrl}</span>
                      </div>
                      <Badge variant={log.statusCode >= 200 && log.statusCode < 300 ? "default" : "destructive"} className="text-xs">
                        {log.statusCode ?? "ERR"}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Webhook Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Webhook Endpoint</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name (optional)</Label>
              <Input placeholder="e.g., Zapier - New Enrollment" value={newName} onChange={e => setNewName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Endpoint URL</Label>
              <Input placeholder="https://hooks.zapier.com/hooks/catch/..." value={newUrl} onChange={e => setNewUrl(e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Paste your Zapier Webhook URL or any HTTPS endpoint</p>
            </div>
            <div>
              <Label className="mb-2 block">Events to send</Label>
              <div className="space-y-2">
                {EVENT_TYPES.map(ev => (
                  <label key={ev.value} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="rounded mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">{ev.label}</span>
                      <p className="text-xs text-muted-foreground">{ev.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Add Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documentation */}
      <Card>
        <CardHeader><CardTitle className="text-base">Integration Guide</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div>
            <h4 className="font-medium text-foreground mb-1">Zapier Setup</h4>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>In Zapier, create a new Zap and choose \"Webhooks by Zapier\" as the trigger</li>
              <li>Select \"Catch Hook\" as the event</li>
              <li>Copy the webhook URL provided by Zapier</li>
              <li>Paste it here and select which events to send</li>
              <li>Click \"Test\" to send a sample payload to Zapier</li>
              <li>Continue building your Zap with any action app</li>
            </ol>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Payload Format</h4>
            <p className="text-xs">
              Teachific sends a <code className="bg-muted px-1 rounded">POST</code> request with a JSON payload containing
              the event type, timestamp, and relevant data. Verify authenticity using the{" "}
              <code className="bg-muted px-1 rounded">X-Teachific-Signature</code> header (HMAC-SHA256 of the raw body using your webhook secret).
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Retry Policy</h4>
            <p className="text-xs">
              Your endpoint must respond with a <code className="bg-muted px-1 rounded">2xx</code> status within 10 seconds.
              Failed deliveries are retried up to 3 times with exponential backoff.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
