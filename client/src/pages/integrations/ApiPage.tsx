import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Key, Plus, Copy, Trash2, Eye, EyeOff } from "lucide-react";

interface ApiKey { id: number; name: string; key: string; created: string; lastUsed: string; permissions: string[]; }

const MOCK: ApiKey[] = [
  { id: 1, name: "Production App", key: "sk_live_••••••••••••••••••••••••••••••••", created: "2026-03-01", lastUsed: "2026-04-02", permissions: ["read", "write"] },
  { id: 2, name: "Analytics Dashboard", key: "sk_live_••••••••••••••••••••••••••••••••", created: "2026-03-15", lastUsed: "2026-04-01", permissions: ["read"] },
];

export default function ApiPage() {
  const [keys, setKeys] = useState<ApiKey[]>(MOCK);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const create = () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    const newKey = "sk_live_" + Math.random().toString(36).substring(2, 34);
    setKeys(p => [{ id: Date.now(), name, key: newKey, created: new Date().toISOString().split("T")[0], lastUsed: "Never", permissions: ["read"] }, ...p]);
    setShow(false); setName(""); toast.success("API key created — copy it now, it won\'t be shown again");
  };
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Key className="h-6 w-6 text-primary" />API Keys</h1><p className="text-muted-foreground mt-0.5">Manage API keys for programmatic access to your school data</p></div>
        <Button className="gap-2" onClick={() => setShow(true)}><Plus className="h-4 w-4" />New API Key</Button>
      </div>
      <Card><CardHeader><CardTitle className="text-base">API Documentation</CardTitle><CardDescription>Base URL: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://course360.app/api/v1</code></CardDescription></CardHeader>
        <CardContent><Button variant="outline" size="sm" onClick={() => toast.info("API docs coming soon")}>View Documentation</Button></CardContent>
      </Card>
      <div className="grid gap-4">
        {keys.map(k => (
          <Card key={k.id}>
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{k.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono truncate max-w-xs">{k.key}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { navigator.clipboard.writeText(k.key); toast.success("Copied!"); }}><Copy className="h-3 w-3" /></Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Created {k.created} · Last used {k.lastUsed}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {k.permissions.map(p => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setKeys(prev => prev.filter(x => x.id !== k.id)); toast.success("Key revoked"); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent><DialogHeader><DialogTitle>New API Key</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Key Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Production App" /></div>
            <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded p-2">The full key will only be shown once after creation. Make sure to copy it immediately.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShow(false)}>Cancel</Button><Button onClick={create}>Create Key</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
