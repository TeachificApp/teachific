import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Folder, Image, File, Upload } from "lucide-react";

export default function MediaRepositoryPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const foldersQuery = trpc.media.folders.list.useQuery(
    { orgId: orgId || 0 },
    { enabled: !!orgId }
  );

  const assetsQuery = trpc.media.assets.list.useQuery(
    { orgId: orgId || 0, folderId: currentFolderId || undefined },
    { enabled: !!orgId }
  );

  const createFolderMutation = trpc.media.folders.create.useMutation({
    onSuccess: () => {
      foldersQuery.refetch();
      setFolderName("");
      setIsCreatingFolder(false);
    },
  });

  const deleteFolderMutation = trpc.media.folders.delete.useMutation({
    onSuccess: () => foldersQuery.refetch(),
  });

  const deleteAssetMutation = trpc.media.assets.delete.useMutation({
    onSuccess: () => assetsQuery.refetch(),
  });

  if (!orgId) {
    return (
      <div className="p-8">
        <p>Loading organization...</p>
      </div>
    );
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Media Repository</h1>
          <p className="text-gray-600">Manage your organization's media files and folders</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreatingFolder} onOpenChange={setIsCreatingFolder}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Folder className="h-4 w-4" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogDescription>Create a new folder to organize your media</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Folder name"
                />
                <Button
                  onClick={() =>
                    createFolderMutation.mutate({
                      orgId,
                      name: folderName,
                      parentFolderId: currentFolderId || undefined,
                    })
                  }
                  disabled={!folderName || createFolderMutation.isPending}
                >
                  {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Folders */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Folders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {foldersQuery.data?.map((folder: any) => (
            <Card
              key={folder.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => setCurrentFolderId(folder.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Folder className="h-6 w-6 text-blue-500" />
                    <div>
                      <p className="font-semibold">{folder.name}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(folder.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFolderMutation.mutate({ id: folder.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Assets */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Media Files</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assetsQuery.data?.map((asset: any) => (
            <Card key={asset.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getFileIcon(asset.mimeType)}
                    <div className="flex-1">
                      <p className="font-semibold truncate">{asset.filename}</p>
                      <p className="text-sm text-gray-600">
                        {(asset.fileSize / 1024).toFixed(1)} KB
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(asset.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAssetMutation.mutate({ id: asset.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {foldersQuery.data?.length === 0 && assetsQuery.data?.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-600 mb-4">No media files yet. Upload your first file or create a folder.</p>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload First File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
