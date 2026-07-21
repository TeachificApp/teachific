import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Layers, ArrowRight, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function BlueprintPurchaseSuccessPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [blueprintId, setBlueprintId] = useState<number | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const installMutation = trpc.blueprints.install.useMutation({
    onSuccess: () => {
      setInstalled(true);
      setInstalling(false);
    },
    onError: (err) => {
      setError(err.message);
      setInstalling(false);
    },
  });

  // Get the blueprint details (including latestVersionId) via getPublishedById
  const { data: bpData } = trpc.blueprints.getPublishedById.useQuery(
    { blueprintId: blueprintId! },
    { enabled: !!blueprintId && !!user }
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session_id");
    const bpId = params.get("blueprint_id");
    if (sid) setSessionId(sid);
    if (bpId) setBlueprintId(parseInt(bpId));
  }, []);

  useEffect(() => {
    // Auto-install once we have the version ID and user is logged in
    const latestVersionId = bpData?.latestVersionId;
    if (sessionId && blueprintId && latestVersionId && user && !installing && !installed && !error) {
      setInstalling(true);
      installMutation.mutate({ blueprintId, blueprintVersionId: latestVersionId });
    }
  }, [sessionId, blueprintId, bpData, user]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50">
        <div className="text-center max-w-md px-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#24abbc] mx-auto mb-4" />
          <p className="text-slate-600">Verifying your purchase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2 text-slate-900">Installation failed</h1>
          <p className="text-slate-500 mb-6 text-sm">{error}</p>
          <p className="text-slate-400 text-xs mb-6">
            Your payment was successful. Please contact support and we'll install the blueprint manually.
          </p>
          <Button onClick={() => setLocation("/blueprints/installed")}>
            View My Blueprints
          </Button>
        </div>
      </div>
    );
  }

  if (installing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-[#24abbc]/10 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#24abbc]" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-slate-900">Installing your blueprint...</h1>
          <p className="text-slate-500 text-sm">Setting up your school. This takes about 10–30 seconds.</p>
        </div>
      </div>
    );
  }

  if (installed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-slate-900">Blueprint installed!</h1>
          <p className="text-slate-500 mb-8">
            Your school has been set up and is ready to customize. Head to your dashboard to get started.
          </p>
          <Button
            className="bg-[#24abbc] hover:bg-[#1d8f9e] text-white"
            onClick={() => setLocation("/dashboard")}
          >
            Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50">
      <div className="text-center max-w-md px-4">
        <Layers className="w-12 h-12 text-[#24abbc]/40 mx-auto mb-4" />
        <p className="text-slate-500">Processing your purchase...</p>
      </div>
    </div>
  );
}
