import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Library, PackageCheck, Store, Wrench } from "lucide-react";

const sections = [
  {
    id: "marketplace",
    title: "Marketplace",
    path: "/blueprints/marketplace",
    icon: Store,
    description: "Browse reusable school, course, funnel, and product templates when the Blueprint catalog is enabled.",
  },
  {
    id: "installed",
    title: "Installed Blueprints",
    path: "/blueprints/installed",
    icon: PackageCheck,
    description: "Review Blueprint packages that have been installed into this organization.",
  },
  {
    id: "manage",
    title: "Manage Blueprints",
    path: "/blueprints/manage",
    icon: Wrench,
    description: "Create and publish organization-owned Blueprints for reuse across schools.",
  },
];

function getActiveSection() {
  const path = window.location.pathname;
  return sections.find((section) => path.includes(section.id)) ?? null;
}

export default function BlueprintsPage() {
  const activeSection = getActiveSection();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Library className="h-6 w-6 text-primary" />
          Blueprints
        </h1>
        <p className="text-muted-foreground mt-0.5">
          Reusable setup templates for courses, pages, products, funnels, and school configuration.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {activeSection ? activeSection.title : "Blueprint Hub"}
            </CardTitle>
            <Badge variant="outline">Setup area</Badge>
          </div>
          <CardDescription>
            Blueprint links now route to this setup area. The full install/publish catalog requires the Blueprint backend tables and
            procedures to be enabled for this branch.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const active = activeSection?.id === section.id;
          return (
            <Card key={section.id} className={active ? "border-primary shadow-sm" : "hover:shadow-sm transition-shadow"}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    {active && <Badge className="mt-1 text-xs">Current</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{section.description}</p>
                <Button asChild variant={active ? "default" : "outline"} size="sm" className="w-full gap-2">
                  <a href={section.path}>
                    Open {section.title}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
