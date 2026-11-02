import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const [platformName, setPlatformName] = useState("Course360™");
  const [allowPublicSignup, setAllowPublicSignup] = useState(false);
  const [defaultAllowDownload, setDefaultAllowDownload] = useState(true);
  const [maxUploadMb, setMaxUploadMb] = useState("500");

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div><h1 className="text-2xl font-bold">Platform Settings</h1><p className="text-muted-foreground text-sm mt-0.5">Global configuration for the Course360™ platform</p></div>

      <Card className="shadow-sm border-border/60">
        <CardHeader><CardTitle className="text-sm">General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Platform Name</Label><Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Max Upload Size (MB)</Label><Input type="number" value={maxUploadMb} onChange={(e) => setMaxUploadMb(e.target.value)} className="max-w-xs" /></div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader><CardTitle className="text-sm">Access Control</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Allow Public Signup</p><p className="text-xs text-muted-foreground">Let new users create accounts without invitation</p></div>
            <Switch checked={allowPublicSignup} onCheckedChange={setAllowPublicSignup} />
          </div>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Default Allow Download</p><p className="text-xs text-muted-foreground">New packages allow download by default</p></div>
            <Switch checked={defaultAllowDownload} onCheckedChange={setDefaultAllowDownload} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => toast.success("Settings saved")} className="gap-2"><Save className="h-4 w-4" />Save Settings</Button>
    </div>
  );
}
