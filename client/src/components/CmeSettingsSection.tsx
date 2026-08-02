/**
 * CmeSettingsSection.tsx
 * Compact CME settings section for embedding in product editor Settings tabs.
 *
 * Shows a "CME not enabled" notice if CardioServ CME is not enabled for the org.
 * When enabled, shows credit hours, form status badge, and an "Open CME Form" button
 * that opens the full CmeActivityFormDialog.
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ExternalLink, AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import CmeActivityFormDialog from "@/components/CmeActivityFormDialog";

type ProductType = "course" | "webinar" | "workshop" | "download" | "bundle" | "cohort";

interface CmeSettingsSectionProps {
  courseId: number;
  productType?: ProductType;
  orgId?: number;
  productTitle?: string;
  creditHours?: string | null;
}

function FormStatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <CheckCircle className="w-3 h-3" /> Complete
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1">
        <Clock className="w-3 h-3" /> In Progress
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
      <AlertCircle className="w-3 h-3" /> Pending
    </Badge>
  );
}

export default function CmeSettingsSection({
  courseId,
  productType = "course",
  orgId,
  productTitle,
  creditHours,
}: CmeSettingsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: cmeStatus, isLoading } = trpc.cme.getCmeStatus.useQuery(
    { courseId, orgId },
    { enabled: !!courseId }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            CardioServ CME
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading CME status...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!cmeStatus?.enabled) {
    return (
      <Card className="border-dashed border-gray-300">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-gray-500">
            <FileText className="w-4 h-4" />
            CardioServ CME
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            CardioServ CME processing is not enabled for your organization.
            Contact your platform administrator to enable it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formStatus = cmeStatus?.formStatus ?? "pending";
  const cmeStatus = cmeStatus?.cmeStatus ?? "draft";
  const lastSentAt = cmeStatus?.lastSentAt;

  return (
    <>
      <Card className="border-teal-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              CardioServ CME Activity Form
            </span>
            <FormStatusBadge status={formStatus} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Credit Hours</p>
              <p className="font-medium">{creditHours ?? cmeStatus?.creditHours ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">CardioServ Status</p>
              <p className="font-medium capitalize">{cmeStatus}</p>
            </div>
            {lastSentAt && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Last Sent</p>
                <p className="font-medium">{new Date(lastSentAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setDialogOpen(true)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {formStatus === "pending" ? "Start CME Form" : "Open CME Form"}
          </Button>
        </CardContent>
      </Card>

      <CmeActivityFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        courseId={courseId}
        productType={productType}
        orgId={orgId}
        productTitle={productTitle}
        creditHours={creditHours}
      />
    </>
  );
}
