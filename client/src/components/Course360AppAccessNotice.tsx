import { Course360AppBillingRecovery } from "./Course360AppBillingRecovery";
import { getCourse360MediaLibraryHref } from "@/lib/course360MediaLibrary";
import type { Course360PurchaseApp } from "@shared/course360AppPurchaseIntent";

export function Course360AppAccessNotice({ app, message, retry }: { app: Course360PurchaseApp; message?: string | null; retry?: () => void }) {
  return <div className="rounded-xl border border-teal-400/30 p-4 space-y-3" aria-label="App access status">
    {message && <p role="status">{message}</p>}
    {retry && <button className="underline underline-offset-2" onClick={retry}>Retry access check</button>}
    <Course360AppBillingRecovery app={app} />
    <a href={getCourse360MediaLibraryHref()} className="block underline underline-offset-2">Open your main Course360™ Media Library</a>
  </div>;
}
