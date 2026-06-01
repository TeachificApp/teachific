/**
 * CourseEditorPage.tsx
 * Standalone route wrapper for the course curriculum/lesson editor.
 *
 * Mounted at:
 *   /lms/courses/:id/curriculum
 *   /lms/courses/:id/settings
 *   /lms/courses/:id/pricing
 *   /lms/courses/:id/sales_page
 *   /lms/courses/:id/drip
 *   /lms/courses/:id/after_purchase
 *   /lms/courses/:id
 *   /lms/courses/new  (id=0 → create flow handled inside CourseEditor)
 *
 * This is NOT the LMS hub (LMSAdmin). It renders CourseEditor directly
 * so clicking a course from CoursesPage takes you straight to the editor.
 */
import { useLocation, useParams } from "wouter";
import { CourseEditor } from "./CourseBuilderPage";

export default function CourseEditorPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const courseId = params.id ? Number(params.id) : 0;

  const handleBack = () => {
    navigate("/lms/courses");
  };

  if (!courseId || isNaN(courseId)) {
    // /lms/courses/new — redirect to courses list which has the create dialog
    navigate("/lms/courses");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <CourseEditor courseId={courseId} onBack={handleBack} />
      </div>
    </div>
  );
}
