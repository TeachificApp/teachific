import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getOrgSubdomainUrl } from "@/hooks/useSubdomain";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, ArrowRight, LogOut } from "lucide-react";

/**
 * SchoolPickerPage
 *
 * Shown when a user logs in at the root domain (course360.app) and belongs
 * to multiple orgs. They choose which school to go to.
 *
 * Also shown for single-org users who somehow land at root before the
 * automatic redirect fires.
 */
export default function SchoolPickerPage() {
  const { user, logout } = useAuth();
  const { data: orgs, isLoading } = trpc.orgs.myOrgs.useQuery(undefined, {
    enabled: !!user,
  });

  const handlePickSchool = (slug: string) => {
    window.location.href = getOrgSubdomainUrl(slug);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <GraduationCap className="h-8 w-8 text-teal-600" />
          <span className="text-2xl font-bold text-gray-900">Course360</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose Your School</h1>
        <p className="text-gray-500 text-base">
          You have access to multiple schools. Select one to continue.
        </p>
      </div>

      {/* School cards */}
      <div className="w-full max-w-lg space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border border-border">
              <CardContent className="p-5 flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-9 w-24" />
              </CardContent>
            </Card>
          ))
        ) : orgs && orgs.length > 0 ? (
          orgs.map((org) => (
            <Card
              key={org.id}
              className="border border-border hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => handlePickSchool(org.slug)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                {/* Logo or initials */}
                <div className="h-14 w-14 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0 overflow-hidden border border-teal-200">
                  {(org as any).logoUrl ? (
                    <img
                      src={(org as any).logoUrl}
                      alt={org.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-teal-700 font-bold text-xl">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Name + URL */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{org.name}</p>
                  <p className="text-sm text-gray-400 truncate">
                    {getOrgSubdomainUrl(org.slug).replace(/^https?:\/\//, "")}
                  </p>
                </div>

                {/* Arrow */}
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-teal-600 transition-colors flex-shrink-0" />
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-10 text-gray-500">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No schools found</p>
            <p className="text-sm mt-1">You are not enrolled in any school yet.</p>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="mt-8">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-gray-600 gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
