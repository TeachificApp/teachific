import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useOrgScope } from "@/hooks/useOrgScope";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ClipboardList, Plus, MoreVertical, Edit, Trash2, Eye, Star } from "lucide-react";

const STATUS_VARIANT: Record<string, any> = { draft: "outline", active: "default", closed: "secondary" };

export default function AssignmentsPage() {
  const { orgId, ready } = useOrgScope();
  const utils = trpc.useUtils();
  const { data: assignments, isLoading } = trpc.lms.assignments.list.useQuery({ orgId: orgId! }, { enabled: ready && !!orgId });
  const createMut = trpc.lms.assignments.create.useMutation({
    onSuccess: () => { utils.lms.assignments.list.invalidate(); toast.success("Assignment created"); setCreateOpen(false); resetForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.lms.assignments.update.useMutation({
    onSuccess: () => { utils.lms.assignments.list.invalidate(); toast.success("Updated"); setEditOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.lms.assignments.delete.useMutation({
    onSuccess: () => { utils.lms.assignments.list.invalidate(); toast.success("Deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const gradeMut = trpc.lms.assignments.grade.useMutation({
    onSuccess: () => { utils.lms.assignments.get.invalidate(); toast.success("Graded"); setGradeOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [gradeSubId, setGradeSubId] = useState<number | null>(null);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [maxScore, setMaxScore] = useState("100");
  const [grade, setGrade] = useState(""); const [score, setScore] = useState(""); const [feedback, setFeedback] = useState("");

  const resetForm = () => { setTitle(""); setDescription(""); setMaxScore("100"); };

  const { data: viewDetail } = trpc.lms.assignments.get.useQuery({ id: viewId! }, { enabled: !!viewId });

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6 text-primary" />Assignments</h1><p className="text-muted-foreground mt-0.5">Create and grade student assignments</p></div>
        <Button className="gap-2" onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4" />New Assignment</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{ l: "Total", v: assignments?.length ?? 0 }, { l: "Active", v: assignments?.filter(a => a.status === "active").length ?? 0 }, { l: "Draft", v: assignments?.filter(a => a.status === "draft").length ?? 0 }].map(s => (
          <Card key={s.l}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{s.l}</p><p className="text-3xl font-bold">{s.v}</p></CardContent></Card>
        ))}
      </div>
      {isLoading ? <div className="grid gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        : !assignments?.length ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No assignments yet.</p>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4 mr-2" />Create Assignment</Button>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Max Score</TableHead><TableHead>Due Date</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {assignments.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[a.status ?? "draft"]}>{a.status ?? "draft"}</Badge></TableCell>
                    <TableCell>{a.maxScore ?? "—"}</TableCell>
                    <TableCell>{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewId(a.id)}><Eye className="h-4 w-4 mr-2" />View Submissions</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditId(a.id); setTitle(a.title); setDescription(a.description ?? ""); setMaxScore(String(a.maxScore ?? 100)); setEditOpen(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (confirm("Delete?")) deleteMut.mutate({ id: a.id }); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Assignment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Assignment title" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} /></div>
            <div className="space-y-2"><Label>Max Score</Label><Input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => { if (!title.trim()) { toast.error("Title required"); return; } createMut.mutate({ orgId: orgId!, title, description: description || undefined, maxScore: parseInt(maxScore) || 100 }); }} disabled={createMut.isPending}>{createMut.isPending ? "Creating..." : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent><DialogHeader><DialogTitle>Edit Assignment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Title *</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} /></div>
            <div className="space-y-2"><Label>Max Score</Label><Input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select onValueChange={v => editId && updateMut.mutate({ id: editId, data: { status: v as "draft" | "active" | "closed" } })}>
                <SelectTrigger><SelectValue placeholder="Change status" /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => { if (!editId) return; updateMut.mutate({ id: editId, data: { title, description: description || null, maxScore: parseInt(maxScore, 10) || 100 } }); }} disabled={updateMut.isPending}>{updateMut.isPending ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewId} onOpenChange={v => !v && setViewId(null)}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Submissions — {viewDetail?.title}</DialogTitle></DialogHeader>
          {viewDetail?.submissions?.length === 0 ? <p className="text-muted-foreground py-4 text-center">No submissions yet.</p>
            : <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead>Grade</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>{viewDetail?.submissions?.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.studentName ?? s.studentEmail ?? "Unknown"}</TableCell>
                  <TableCell>{new Date(s.submittedAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={s.status === "graded" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                  <TableCell>{s.grade ?? "—"}</TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => { setGradeSubId(s.id); setGrade(s.grade ?? ""); setScore(String(s.score ?? "")); setFeedback(s.feedback ?? ""); setGradeOpen(true); }}><Star className="h-3.5 w-3.5 mr-1" />Grade</Button></TableCell>
                </TableRow>
              ))}</TableBody></Table>}
        </DialogContent>
      </Dialog>

      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent><DialogHeader><DialogTitle>Grade Submission</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Grade (e.g. A, B+, Pass)</Label><Input value={grade} onChange={e => setGrade(e.target.value)} /></div>
            <div className="space-y-2"><Label>Score</Label><Input type="number" value={score} onChange={e => setScore(e.target.value)} /></div>
            <div className="space-y-2"><Label>Feedback</Label><Textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setGradeOpen(false)}>Cancel</Button><Button onClick={() => { if (!gradeSubId || !grade) return; const numericScore = score ? Number(score) : null; if (numericScore !== null && (!Number.isInteger(numericScore) || numericScore < 0)) { toast.error("Score must be a whole number of zero or greater"); return; } gradeMut.mutate({ submissionId: gradeSubId, grade, score: numericScore, feedback: feedback || null }); }} disabled={gradeMut.isPending}>{gradeMut.isPending ? "Saving..." : "Save Grade"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
