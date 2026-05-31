import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Eye } from "lucide-react";

export default function LmsCoursesPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newCourse, setNewCourse] = useState({ name: "", description: "", price: "0" });

  // Get org from user (assuming first org)
  const orgsQuery = trpc.lms.courses.list.useQuery(
    { orgId: orgId || 0 },
    { enabled: !!orgId }
  );

  const createCourseMutation = trpc.lms.courses.create.useMutation({
    onSuccess: () => {
      orgsQuery.refetch();
      setNewCourse({ name: "", description: "", price: "0" });
      setIsCreating(false);
    },
  });

  const deleteCourseMutation = trpc.lms.courses.delete.useMutation({
    onSuccess: () => orgsQuery.refetch(),
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
          <h1 className="text-3xl font-bold">Courses</h1>
          <p className="text-gray-600">Manage your organization's courses</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Course
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Course</DialogTitle>
              <DialogDescription>Add a new course to your organization</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Course Name</label>
                <Input
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  placeholder="e.g., Introduction to Web Design"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="Course description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price ($)</label>
                <Input
                  type="number"
                  value={newCourse.price}
                  onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })}
                  placeholder="0"
                />
              </div>
              <Button
                onClick={() =>
                  createCourseMutation.mutate({
                    orgId,
                    name: newCourse.name,
                    description: newCourse.description || null,
                    price: newCourse.price,
                  })
                }
                disabled={!newCourse.name || createCourseMutation.isPending}
              >
                {createCourseMutation.isPending ? "Creating..." : "Create Course"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {orgsQuery.data?.map((course: any) => (
          <Card key={course.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{course.name}</CardTitle>
                  <CardDescription>{course.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => deleteCourseMutation.mutate({ id: course.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Price</p>
                  <p className="font-semibold">${course.price}</p>
                </div>
                <div>
                  <p className="text-gray-600">Enrollments</p>
                  <p className="font-semibold">{course.enrollmentCount || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-semibold capitalize">{course.status}</p>
                </div>
                <div>
                  <p className="text-gray-600">Created</p>
                  <p className="font-semibold">
                    {new Date(course.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {orgsQuery.data?.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-600 mb-4">No courses yet. Create your first course to get started.</p>
            <Button onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create First Course
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
