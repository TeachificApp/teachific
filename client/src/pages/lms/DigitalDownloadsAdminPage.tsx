/**
 * DigitalDownloadsAdminPage.tsx
 * Standalone route wrapper for the Digital Downloads admin.
 * Mounted at /lms/downloads
 */
import DigitalDownloadsAdmin from "./DigitalDownloadsAdmin";

export default function DigitalDownloadsAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <DigitalDownloadsAdmin />
      </div>
    </div>
  );
}
