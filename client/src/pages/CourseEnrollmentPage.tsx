import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Clock, Users, CheckCircle, PlayCircle } from "lucide-react";

export default function CourseEnrollmentPage() {
  const { user } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const enrollmentsQuery = trpc.lms.enrollments.list.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user?.id }
  );

  const courseDetailsQuery = trpc.lms.courses.getById.useQuery(
    { id: selectedCourseId || 0 },
    { enabled: !!selectedCourseId }
  );

  const progressQuery = trpc.lms.progress.getByEnrollment.useQuery(
    { enrollmentId: selectedCourseId || 0 },
    { enabled: !!selectedCourseId }
  );

  if (!user) {
    return (
      <div className="p-8 text-center">
        <p>Please log in to view your courses.</p>
      </div>
    );
  }

  if (!selectedCourseId) {
    return (
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-bold">My Courses</h1>
          <p className="text-gray-600">Continue learning from where you left off</p>
        </div>

        <div className="grid gap-4">
          {enrollmentsQuery.data?.map((enrollment: any) => (
            <Card
              key={enrollment.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedCourseId(enrollment.courseId)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{enrollment.course?.name}</CardTitle>
                    <CardDescription>{enrollment.course?.description}</CardDescription>
                  </div>
                  <span className="text-sm font-semibold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                    {enrollment.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm font-semibold">{enrollment.progressPercentage || 0}%</span>
                    </div>
                    <Progress value={enrollment.progressPercentage || 0} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-gray-600" />
                      <span>{enrollment.lessonsCompleted || 0} lessons</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <span>{enrollment.hoursSpent || 0}h spent</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-600" />
                      <span>{enrollment.enrollmentCount || 0} enrolled</span>
                    </div>
                  </div>
                  <Button className="w-full gap-2">
                    <PlayCircle className="h-4 w-4" />
                    Continue Learning
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {enrollmentsQuery.data?.length === 0 && (
          <Card>
            <CardContent className="pt-8 text-center">
              <p className="text-gray-600 mb-4">You haven't enrolled in any courses yet.</p>
              <Button>Browse Courses</Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <Button variant="outline" onClick={() => setSelectedCourseId(null)}>
        ← Back to My Courses
      </Button>

      {courseDetailsQuery.data && (
        <div>
          <h1 className="text-3xl font-bold">{courseDetailsQuery.data.name}</h1>
          <p className="text-gray-600">{courseDetailsQuery.data.description}</p>
        </div>
      )}

      {progressQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>Your Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm font-semibold">{progressQuery.data.percentageComplete || 0}%</span>
              </div>
              <Progress value={progressQuery.data.percentageComplete || 0} />
            </div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Lessons Completed</p>
                <p className="font-semibold text-lg">{progressQuery.data.lessonsCompleted || 0}</p>
              </div>
              <div>
                <p className="text-gray-600">Quizzes Passed</p>
                <p className="font-semibold text-lg">{progressQuery.data.quizzesPassed || 0}</p>
              </div>
              <div>
                <p className="text-gray-600">Hours Spent</p>
                <p className="font-semibold text-lg">{progressQuery.data.hoursSpent || 0}</p>
              </div>
              <div>
                <p className="text-gray-600">Last Activity</p>
                <p className="font-semibold text-sm">
                  {progressQuery.data.lastActivityAt
                    ? new Date(progressQuery.data.lastActivityAt).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Course Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {courseDetailsQuery.data?.sections?.map((section: any) => (
              <div key={section.id} className="border-t pt-4">
                <h3 className="font-semibold mb-2">{section.name}</h3>
                <div className="space-y-2 ml-4">
                  {section.lessons?.map((lesson: any) => (
                    <div key={lesson.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                      {lesson.isCompleted ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <PlayCircle className="h-5 w-5 text-gray-400" />
                      )}
                      <span className={lesson.isCompleted ? "line-through text-gray-600" : ""}>
                        {lesson.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
