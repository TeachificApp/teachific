import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { CreditCard, Key, Puzzle, Search, Webhook, Zap } from "lucide-react";

const INTEGRATIONS = [
  {
    id: 1,
    name: "Stripe / Payments",
    category: "Payments",
    description: "Connect this organization's own Stripe keys, receipt/payment behavior, PayPal keys, and auto-enrollment settings.",
    href: "/lms/settings/payment",
    action: "Configure payments",
    icon: CreditCard,
    available: true,
  },
  {
    id: 2,
    name: "Zapier & Webhooks",
    category: "Automation",
    description: "Send enrollment, order, form, member, and course completion events to Zapier or custom webhook URLs.",
    href: "/integrations/webhooks",
    action: "Open webhooks",
    icon: Zap,
    available: true,
  },
  {
    id: 3,
    name: "API Keys",
    category: "Developer",
    description: "Manage API keys for programmatic access to this organization's data.",
    href: "/integrations/api",
    action: "Manage keys",
    icon: Key,
    available: true,
  },
  {
    id: 4,
    name: "Thinkific Import",
    category: "Import",
    description: "Connect a Thinkific account and import courses, lessons, media, and members into this organization.",
    href: "/integrations/thinkific",
    action: "Import from Thinkific",
    icon: Webhook,
    available: true,
  },
  {
    id: 5,
    name: "Teachable Import",
    category: "Import",
    description: "Connect a Teachable account and migrate school content into this organization.",
    href: "/integrations/teachable",
    action: "Import from Teachable",
    icon: Webhook,
    available: true,
  },
  {
    id: 6,
    name: "Kajabi Import",
    category: "Import",
    description: "Connect Kajabi and import products, content, and student records into this organization.",
    href: "/integrations/kajabi",
    action: "Import from Kajabi",
    icon: Webhook,
    available: true,
  },
];

export default function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const filtered = INTEGRATIONS.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><Puzzle className="h-6 w-6 text-primary" />Integrations</h1><p className="text-muted-foreground mt-0.5">Connect your school with third-party apps and services</p></div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search integrations..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(i => {
          const Icon = i.icon;
          return (
            <Card key={i.id} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{i.name}</CardTitle>
                      <Badge variant="outline" className="text-xs mt-0.5">{i.category}</Badge>
                    </div>
                  </div>
                  {i.available && <Badge className="text-xs">Available</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs mb-3">{i.description}</CardDescription>
                <Button size="sm" className="w-full" onClick={() => { window.location.href = i.href; }}>
                  {i.action}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
