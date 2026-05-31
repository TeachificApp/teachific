import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Send, Trash2, Edit2 } from "lucide-react";

export default function EmailCampaignsPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    subject: "",
    htmlBody: "",
    textBody: "",
  });

  const campaignsQuery = trpc.emailCampaigns.list.useQuery(
    { orgId: orgId || 0 },
    { enabled: !!orgId }
  );

  const createCampaignMutation = trpc.emailCampaigns.create.useMutation({
    onSuccess: () => {
      campaignsQuery.refetch();
      setNewCampaign({ name: "", subject: "", htmlBody: "", textBody: "" });
      setIsCreating(false);
    },
  });

  const deleteCampaignMutation = trpc.emailCampaigns.delete.useMutation({
    onSuccess: () => campaignsQuery.refetch(),
  });

  if (!orgId) {
    return (
      <div className="p-8">
        <p>Loading organization...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Campaigns</h1>
          <p className="text-gray-600">Create and manage email campaigns for your organization</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Email Campaign</DialogTitle>
              <DialogDescription>Set up a new email campaign for your audience</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Campaign Name</label>
                <Input
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="e.g., Welcome Series"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email Subject</label>
                <Input
                  value={newCampaign.subject}
                  onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  placeholder="e.g., Welcome to our course!"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">HTML Content</label>
                <Textarea
                  value={newCampaign.htmlBody}
                  onChange={(e) => setNewCampaign({ ...newCampaign, htmlBody: e.target.value })}
                  placeholder="HTML email content"
                  rows={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Plain Text Content</label>
                <Textarea
                  value={newCampaign.textBody}
                  onChange={(e) => setNewCampaign({ ...newCampaign, textBody: e.target.value })}
                  placeholder="Plain text fallback"
                  rows={4}
                />
              </div>
              <Button
                onClick={() =>
                  createCampaignMutation.mutate({
                    orgId,
                    name: newCampaign.name,
                    subject: newCampaign.subject,
                    htmlBody: newCampaign.htmlBody,
                    textBody: newCampaign.textBody || null,
                  })
                }
                disabled={!newCampaign.name || !newCampaign.subject || createCampaignMutation.isPending}
              >
                {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {campaignsQuery.data?.map((campaign: any) => (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{campaign.name}</CardTitle>
                  <CardDescription>{campaign.subject}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => deleteCampaignMutation.mutate({ id: campaign.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-semibold capitalize">{campaign.status || "draft"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Recipients</p>
                  <p className="font-semibold">{campaign.recipientCount || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Created</p>
                  <p className="font-semibold">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {campaignsQuery.data?.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-600 mb-4">No campaigns yet. Create your first email campaign.</p>
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
