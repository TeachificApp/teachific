import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Award, Clock, TrendingUp } from "lucide-react";

export default function StudentDashboardPage() {
  const { user } = useAuth();

  const enrollmentsQuery = trpc.lms.enrollments.list.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user?.id }
  );

  const certificatesQuery = trpc.lms.certificates.list.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user?.id }
  );

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p>Please log in to view your dashboard.</p>
      </div>
    );
  }

  const activeEnrollments = enrollmentsQuery.data?.filter((e: any) => e.status === "active") || [];
  const completedEnrollments = enrollmentsQuery.data?.filter((e: any) => e.status === "completed") || [];
  const totalHoursSpent = enrollmentsQuery.data?.reduce((sum: number, e: any) => sum + (e.hoursSpent || 0), 0) || 0;
  const averageProgress = enrollmentsQuery.data?.length
    ? Math.round(
        enrollmentsQuery.data.reduce((sum: number, e: any) => sum + (e.progressPercentage || 0), 0) /
          enrollmentsQuery.data.length
      )
    : 0;

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user.name}!</h1>
        <p className="text-gray-600">Here's your learning progress overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Courses</p>
                <p className="text-3xl font-bold">{activeEnrollments.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold">{completedEnrollments.length}</p>
              </div>
              <Award className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Hours Spent</p>
                <p className="text-3xl font-bold">{totalHoursSpent}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Progress</p>
                <p className="text-3xl font-bold">{averageProgress}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Courses */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Your Active Courses</h2>
        <div className="grid gap-4">
          {activeEnrollments.map((enrollment: any) => (
            <Card key={enrollment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{enrollment.course?.name}</CardTitle>
                    <CardDescription>
                      {enrollment.progressPercentage || 0}% complete
                    </CardDescription>
                  </div>
                  <Button>Continue</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={enrollment.progressPercentage || 0} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Certificates */}
      {certificatesQuery.data && certificatesQuery.data.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Your Certificates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificatesQuery.data.map((cert: any) => (
              <Card key={cert.id}>
                <CardHeader>
                  <CardTitle>{cert.courseName}</CardTitle>
                  <CardDescription>
                    Issued on {new Date(cert.issuedAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Download Certificate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Recommended for You</h2>
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-600">Based on your learning history, we'll recommend courses here.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
