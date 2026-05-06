import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { renderBlockPreview } from "@/components/PageBuilder";
import type { Block } from "@/components/PageBuilder";
import { CheckCircle2 } from "lucide-react";

export default function ThankYouPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = parseInt(params.courseId || "0");

  const { data, isLoading, error } = trpc.lms.courses.getThankYouPage.useQuery(
    { courseId },
    { enabled: !!courseId, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If no custom thank-you page is configured, show a default
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Thank You!</h1>
          <p className="text-gray-600">
            Your purchase was successful. You now have access to the course.
          </p>
          <a
            href="/my-courses"
            className="inline-block mt-4 px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
          >
            Go to My Courses
          </a>
        </div>
      </div>
    );
  }

  // Parse and render custom blocks
  let blocks: Block[] = [];
  try {
    const parsed = JSON.parse(data.blocks || "[]");
    blocks = Array.isArray(parsed) ? parsed : [];
  } catch {
    blocks = [];
  }

  if (blocks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Thank You!</h1>
          <p className="text-gray-600">
            Your purchase of <strong>{data.courseTitle}</strong> was successful.
          </p>
          <a
            href="/my-courses"
            className="inline-block mt-4 px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
          >
            Start Learning
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div>
        {blocks.map((block) => (
          <div key={block.id}>
            {renderBlockPreview(block)}
          </div>
        ))}
      </div>
    </div>
  );
}
