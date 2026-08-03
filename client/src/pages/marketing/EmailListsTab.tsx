/**
 * EmailListsTab — Manages email lists and their subscribers
 * Used inside EmailCampaignDashboard
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Trash2, Users, RefreshCw, ChevronDown, ChevronRight,
  Download, Upload, UserMinus, Search, Mail,
} from "lucide-react";

export default function EmailListsTab() {
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [expandedListId, setExpandedListId] = useState<number | null>(null);
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [importListId, setImportListId] = useState<number | null>(null);
  const [csvText, setCsvText] = useState("");

  const { data: lists, isLoading, refetch } = trpc.emailCampaign.listEmailLists.useQuery();

  const createMutation = trpc.emailCampaign.createEmailList.useMutation({
    onSuccess: () => {
      toast.success("List created");
      setShowCreate(false);
      setNewListName("");
      setNewListDesc("");
      utils.emailCampaign.listEmailLists.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.emailCampaign.deleteEmailList.useMutation({
    onSuccess: () => {
      toast.success("List deleted");
      utils.emailCampaign.listEmailLists.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const { data: subscribersData, isLoading: subsLoading } = trpc.emailCampaign.getEmailListSubscribers.useQuery(
    { listId: expandedListId!, limit: 200, offset: 0 },
    { enabled: expandedListId !== null },
  );

  const removeSubscriberMutation = trpc.emailCampaign.removeSubscriber.useMutation({
    onSuccess: () => {
      toast.success("Subscriber removed");
      utils.emailCampaign.getEmailListSubscribers.invalidate();
      utils.emailCampaign.listEmailLists.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const importMutation = trpc.emailCampaign.importSubscribersFromCsv.useMutation({
    onSuccess: (data) => {
      toast.success(`Imported ${data.added} subscribers`);
      setImportListId(null);
      setCsvText("");
      utils.emailCampaign.listEmailLists.invalidate();
      utils.emailCampaign.getEmailListSubscribers.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredSubscribers = (subscribersData?.subscribers ?? []).filter((s) => {
    if (!subscriberSearch) return true;
    const q = subscriberSearch.toLowerCase();
    return (s.email ?? "").toLowerCase().includes(q) || (s.name ?? "").toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-[#189aa1]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Email Lists</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage subscriber lists for targeted campaigns</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} style={{ background: "#189aa1" }} className="text-white">
          <Plus className="w-4 h-4 mr-1" /> New List
        </Button>
      </div>

      {/* Lists */}
      {!lists || lists.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No email lists yet. Create your first list to start building your audience.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => (
            <Card key={list.id} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedListId(expandedListId === list.id ? null : list.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedListId === list.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{list.name}</p>
                      {list.description && <p className="text-xs text-gray-500">{list.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      {list.subscriberCount ?? 0} subscribers
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setImportListId(list.id)}
                      className="text-xs h-7 px-2"
                    >
                      <Upload className="w-3 h-3 mr-1" /> Import
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete list "${list.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate({ id: list.id });
                        }
                      }}
                      className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded subscriber list */}
                {expandedListId === list.id && (
                  <div className="mt-4 border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                          value={subscriberSearch}
                          onChange={(e) => setSubscriberSearch(e.target.value)}
                          placeholder="Search subscribers..."
                          className="pl-8 h-8 text-xs"
                        />
                      </div>
                    </div>
                    {subsLoading ? (
                      <div className="flex justify-center py-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    ) : filteredSubscribers.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No subscribers found</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Email</TableHead>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Subscribed</TableHead>
                            <TableHead className="w-8" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSubscribers.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell className="text-xs font-mono">{sub.email}</TableCell>
                              <TableCell className="text-xs">{sub.name ?? "—"}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={sub.status === "subscribed" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {sub.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-gray-400">
                                {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : "—"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm(`Remove ${sub.email} from this list?`)) {
                                      removeSubscriberMutation.mutate({ subscriberId: sub.id });
                                    }
                                  }}
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                                >
                                  <UserMinus className="w-3 h-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create list dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Email List</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">List Name *</label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Newsletter Subscribers"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
              <Input
                value={newListDesc}
                onChange={(e) => setNewListDesc(e.target.value)}
                placeholder="Brief description of this list"
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ name: newListName, description: newListDesc || undefined })}
              disabled={!newListName.trim() || createMutation.isPending}
              style={{ background: "#189aa1" }}
              className="text-white"
            >
              {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV dialog */}
      <Dialog open={importListId !== null} onOpenChange={(open) => { if (!open) { setImportListId(null); setCsvText(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Subscribers</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-gray-500">
              Paste CSV data below. Format: <code className="bg-gray-100 px-1 rounded">email,name</code> (one per line, header optional).
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              className="w-full border rounded-md p-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#189aa1]"
              placeholder={"email,name\njohn@example.com,John Smith\njane@example.com,Jane Doe"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportListId(null); setCsvText(""); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (importListId) {
                  importMutation.mutate({ listId: importListId, csvData: csvText });
                }
              }}
              disabled={!csvText.trim() || importMutation.isPending}
              style={{ background: "#189aa1" }}
              className="text-white"
            >
              {importMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
