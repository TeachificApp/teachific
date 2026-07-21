/**
 * OrgMergePage.tsx
 * Platform Admin — Merge Organizations
 *
 * 4-step wizard:
 *   Step 1 — Select source org + target org
 *   Step 2 — Preview: counts of all records to be moved
 *   Step 3 — Confirmation: type org name to confirm, then execute
 *   Step 4 — Result: merge summary
 */

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowRight, Building2, Users, BookOpen, Package, Mail, Image,
  CheckCircle2, AlertTriangle, Loader2, ChevronRight, RotateCcw,
  Merge, FileText, Filter, Download, History,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4;

interface OrgOption {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
}

export default function OrgMergePage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sourceParam = params.get("source");

  const [step, setStep] = useState<Step>(1);
  const [sourceOrgId, setSourceOrgId] = useState<number | null>(sourceParam ? Number(sourceParam) : null);
  const [targetOrgId, setTargetOrgId] = useState<number | null>(null);

  // Sync if param changes after mount
  useEffect(() => {
    if (sourceParam) setSourceOrgId(Number(sourceParam));
  }, [sourceParam]);
  const [confirmName, setConfirmName] = useState("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [mergeResult, setMergeResult] = useState<any>(null);

  const { data: orgsData } = trpc.orgs.list.useQuery();
  const orgs: OrgOption[] = (orgsData ?? []).map((o: any) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    isActive: o.isActive ?? true,
  }));

  const activeOrgs = orgs.filter(o => o.isActive);

  const previewQuery = trpc.orgMerge.preview.useQuery(
    { sourceOrgId: sourceOrgId!, targetOrgId: targetOrgId! },
    { enabled: step === 2 && !!sourceOrgId && !!targetOrgId }
  );

  const executeMerge = trpc.orgMerge.execute.useMutation({
    onSuccess: (data) => {
      setMergeResult(data);
      setStep(4);
      toast.success("Organizations merged successfully");
    },
    onError: (err) => {
      toast.error(`Merge failed: ${err.message}`);
    },
  });

  const { data: logsData } = trpc.orgMerge.listLogs.useQuery({ page: 1, pageSize: 10 });

  const sourceOrg = orgs.find(o => o.id === sourceOrgId);
  const targetOrg = orgs.find(o => o.id === targetOrgId);
  const preview = previewQuery.data;

  function handleStep1Next() {
    if (!sourceOrgId || !targetOrgId) {
      toast.error("Please select both a source and target organization");
      return;
    }
    if (sourceOrgId === targetOrgId) {
      toast.error("Source and target organizations must be different");
      return;
    }
    setStep(2);
  }

  function handleExecute() {
    if (!sourceOrgId || !targetOrgId || !sourceOrg) return;
    if (confirmName !== sourceOrg.name) {
      toast.error(`Confirmation name must match exactly: "${sourceOrg.name}"`);
      return;
    }
    setConfirmDialogOpen(false);
    executeMerge.mutate({
      sourceOrgId,
      targetOrgId,
      confirmSourceOrgName: confirmName,
    });
  }

  function handleReset() {
    setStep(1);
    setSourceOrgId(null);
    setTargetOrgId(null);
    setConfirmName("");
    setMergeResult(null);
  }

  const previewRows = preview ? [
    { label: "Members", icon: <Users className="h-4 w-4" />, count: preview.members, conflicts: preview.duplicateMembersCount > 0 ? `${preview.duplicateMembersCount} already in target (will be skipped)` : null },
    { label: "Courses", icon: <BookOpen className="h-4 w-4" />, count: preview.courses, conflicts: null },
    { label: "Content Packages (SCORM)", icon: <Package className="h-4 w-4" />, count: preview.contentPackages, conflicts: null },
    { label: "Enrollments", icon: <CheckCircle2 className="h-4 w-4" />, count: preview.enrollments, conflicts: null },
    { label: "Funnels", icon: <Filter className="h-4 w-4" />, count: preview.funnels, conflicts: null },
    { label: "Digital Downloads", icon: <Download className="h-4 w-4" />, count: preview.downloads, conflicts: null },
    { label: "Forms", icon: <FileText className="h-4 w-4" />, count: preview.forms, conflicts: null },
    { label: "Email Lists", icon: <Mail className="h-4 w-4" />, count: preview.emailLists, conflicts: null },
    { label: "Media Assets", icon: <Image className="h-4 w-4" />, count: preview.mediaAssets, conflicts: null },
    { label: "Blueprint Installs", icon: <Package className="h-4 w-4" />, count: preview.blueprintInstalls, conflicts: null },
  ].filter(r => r.count > 0) : [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
          <Merge className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Merge Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Move all users, courses, and content from one organization into another.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { n: 1, label: "Select Orgs" },
          { n: 2, label: "Preview" },
          { n: 3, label: "Confirm" },
          { n: 4, label: "Done" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              step === s.n
                ? "bg-primary text-primary-foreground"
                : step > s.n
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}>
              {step > s.n ? <CheckCircle2 className="h-3 w-3" /> : <span>{s.n}</span>}
              {s.label}
            </div>
            {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Select orgs ─────────────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Organizations</CardTitle>
            <CardDescription>
              All data from the <strong>source</strong> organization will be moved into the <strong>target</strong> organization.
              The source organization will be deactivated after the merge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr] items-end">
              {/* Source org */}
              <div className="space-y-2">
                <Label>Source Organization <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">This org will be deactivated after merge</p>
                <Select
                  value={sourceOrgId?.toString() ?? ""}
                  onValueChange={(v) => setSourceOrgId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source org..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeOrgs.filter(o => o.id !== targetOrgId).map(o => (
                      <SelectItem key={o.id} value={o.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{o.name}</span>
                          <span className="text-xs text-muted-foreground">({o.slug})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center pb-2">
                <div className="flex flex-col items-center gap-1">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">merges into</span>
                </div>
              </div>

              {/* Target org */}
              <div className="space-y-2">
                <Label>Target Organization <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground">This org will receive all data</p>
                <Select
                  value={targetOrgId?.toString() ?? ""}
                  onValueChange={(v) => setTargetOrgId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target org..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeOrgs.filter(o => o.id !== sourceOrgId).map(o => (
                      <SelectItem key={o.id} value={o.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{o.name}</span>
                          <span className="text-xs text-muted-foreground">({o.slug})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sourceOrgId && targetOrgId && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  <p className="font-medium">This action cannot be undone.</p>
                  <p className="mt-1">
                    All data from <strong>{sourceOrg?.name}</strong> will be permanently moved into{" "}
                    <strong>{targetOrg?.name}</strong>. The source organization will be deactivated.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleStep1Next} disabled={!sourceOrgId || !targetOrgId}>
                Preview Merge <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Preview ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Merge Preview</CardTitle>
            <CardDescription>
              The following records will be moved from <strong>{sourceOrg?.name}</strong> into{" "}
              <strong>{targetOrg?.name}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewQuery.isLoading && (
              <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Analyzing organizations...</span>
              </div>
            )}

            {previewQuery.isError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {previewQuery.error.message}
              </div>
            )}

            {preview && (
              <>
                {/* Summary stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{preview.totalRecords.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total Records</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{preview.members.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">Members</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{preview.courses.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">Courses</div>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <div className="text-2xl font-bold">{preview.contentPackages.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-1">Content Packages</div>
                  </div>
                </div>

                {/* Detail table */}
                {previewRows.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Type</TableHead>
                        <TableHead className="text-right">Records to Move</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map(row => (
                        <TableRow key={row.label}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{row.icon}</span>
                              {row.label}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {row.count.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.conflicts ? (
                              <span className="text-amber-600 dark:text-amber-400">{row.conflicts}</span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {preview.totalRecords === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p>No records found in the source organization.</p>
                    <p className="text-xs mt-1">The merge will still deactivate the source org.</p>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={previewQuery.isLoading || previewQuery.isError}
              >
                Continue to Confirm <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Confirm ─────────────────────────────────────────────────── */}
      {step === 3 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Confirm Merge
            </CardTitle>
            <CardDescription>
              This action is <strong>permanent and cannot be undone</strong>. Please read carefully before proceeding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Source (will be deactivated):</span>
                <span className="font-semibold">{sourceOrg?.name}</span>
                <Badge variant="outline" className="text-xs">{sourceOrg?.slug}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Target (receives all data):</span>
                <span className="font-semibold">{targetOrg?.name}</span>
                <Badge variant="outline" className="text-xs">{targetOrg?.slug}</Badge>
              </div>
              {preview && (
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Records to move:</span>
                  <span className="font-semibold">{preview.totalRecords.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-name">
                Type the name of the source organization to confirm:{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">{sourceOrg?.name}</code>
              </Label>
              <Input
                id="confirm-name"
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={sourceOrg?.name}
                className={confirmName && confirmName !== sourceOrg?.name ? "border-destructive" : ""}
              />
              {confirmName && confirmName !== sourceOrg?.name && (
                <p className="text-xs text-destructive">Name does not match</p>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmDialogOpen(true)}
                disabled={confirmName !== sourceOrg?.name || executeMerge.isPending}
              >
                {executeMerge.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Merging...</>
                ) : (
                  "Execute Merge"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Result ──────────────────────────────────────────────────── */}
      {step === 4 && mergeResult && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Merge Complete
            </CardTitle>
            <CardDescription>
              All data has been successfully moved into <strong>{mergeResult.targetOrgName}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {mergeResult.summary.totalRecords.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Records Moved</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{mergeResult.summary.users.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Members Moved</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{mergeResult.summary.duplicateEmailsResolved.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Duplicate Members Skipped</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{mergeResult.summary.slugConflictsResolved.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">Slug Conflicts Resolved</div>
              </div>
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
              <p className="font-medium">What happened:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>All org data was moved to <strong className="text-foreground">{mergeResult.targetOrgName}</strong></li>
                <li>The source organization has been deactivated</li>
                {mergeResult.summary.duplicateEmailsResolved > 0 && (
                  <li>{mergeResult.summary.duplicateEmailsResolved} members already in the target org were skipped</li>
                )}
                {mergeResult.summary.slugConflictsResolved > 0 && (
                  <li>{mergeResult.summary.slugConflictsResolved} slug conflicts were resolved by appending a suffix</li>
                )}
                <li>Merge log ID: <code className="bg-background px-1 rounded">{mergeResult.logId}</code></li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleReset} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Merge Another Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Merge History ───────────────────────────────────────────────────── */}
      {step === 1 && logsData && logsData.logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Recent Merge History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source → Target</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Initiated By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsData.logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      <span className="font-medium">{log.sourceOrgName}</span>
                      <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                      <span className="font-medium">{log.targetOrgName}</span>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {log.summary?.totalRecords?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          log.status === "completed" ? "default" :
                          log.status === "failed" ? "destructive" :
                          "secondary"
                        }
                        className="text-xs"
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.initiatorName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Final confirmation dialog ────────────────────────────────────────── */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently merge <strong>{sourceOrg?.name}</strong> into{" "}
              <strong>{targetOrg?.name}</strong>. This will move{" "}
              <strong>{preview?.totalRecords.toLocaleString() ?? "all"} records</strong> and deactivate the source
              organization. This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, merge organizations
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
