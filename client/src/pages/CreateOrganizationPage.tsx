import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, ArrowLeft, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

export default function CreateOrganizationPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const createOrg = trpc.orgs.createAdditional.useMutation({
    onSuccess: (data) => {
      toast.success(`Organization "${data.name}" created successfully!`);
      // Switch to the new org and go to its dashboard
      window.location.href = "/lms";
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create organization");
    },
  });

  // Only site owners can create additional orgs
  if (user?.role !== "site_owner") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only site owners can create additional organizations.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setLocation("/lms")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleNameChange = (value: string) => {
    setOrgName(value);
    if (!slugManuallyEdited) {
      setOrgSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 50)
      );
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setOrgSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) { toast.error("Organization name is required"); return; }
    if (!orgSlug.trim()) { toast.error("URL slug is required"); return; }
    if (orgSlug.length < 3) { toast.error("Slug must be at least 3 characters"); return; }
    createOrg.mutate({
      name: orgName.trim(),
      slug: orgSlug.trim(),
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/lms")}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Create New Organization</CardTitle>
                <CardDescription>Set up a separate organization with its own plan and billing.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                Each organization is a completely separate entity with its own subscription, members, courses, and settings.
                After creation, you can configure the subscription from the new org's settings.
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="e.g. Acme Academy"
                  value={orgName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">URL Slug</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="org-slug"
                      placeholder="acme-academy"
                      value={orgSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      required
                      minLength={3}
                      maxLength={50}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your school will be accessible at <strong>{orgSlug || "your-slug"}.teachific.app</strong>
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createOrg.isPending || !orgName.trim() || orgSlug.length < 3}
              >
                {createOrg.isPending ? (
                  "Creating..."
                ) : (
                  <>
                    Continue to Plan Selection
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
