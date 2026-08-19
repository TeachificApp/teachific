import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSAL_KEY = "teachific-maintenance-2026-08";
// August 25, 2026 at 9:00 AM Eastern Daylight Time (UTC-4). Remove this component after review.
const REMOVE_AFTER = Date.UTC(2026, 7, 25, 13, 0, 0);

export function MaintenanceBanner() {
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [isActive, setIsActive] = useState(() => Date.now() < REMOVE_AFTER);

  useEffect(() => {
    const remainingMs = REMOVE_AFTER - Date.now();
    if (remainingMs <= 0) {
      setIsActive(false);
      return;
    }
    const removalTimer = window.setTimeout(() => setIsActive(false), remainingMs);
    return () => window.clearTimeout(removalTimer);
  }, []);

  useEffect(() => {
    if (!user || !isActive) return;
    setDismissed(window.localStorage.getItem(DISMISSAL_KEY) === "dismissed");
  }, [isActive, user]);

  if (loading || !user || !isActive || dismissed) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSAL_KEY, "dismissed");
    setDismissed(true);
  };

  return (
    <aside
      role="status"
      aria-label="Scheduled server maintenance notice"
      className="relative z-50 flex min-h-9 items-center justify-center border-b border-amber-300 bg-amber-100 px-10 py-1.5 text-center text-xs font-medium text-amber-950"
    >
      <span className="flex items-center justify-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          <strong>Scheduled Server Maintenance Aug 22–24, 2026</strong> — service disruptions may occur as our servers are upgraded. We appreciate your patience as we make improvements to our platform.
        </span>
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 inline-flex h-6 w-6 items-center justify-center rounded text-amber-900 transition-colors hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
        aria-label="Dismiss scheduled maintenance notice"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
