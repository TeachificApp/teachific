/**
 * Teachable API helper — wraps the Teachable REST API v1.
 *
 * All requests use the API key in the Authorization header.
 * Rate limit: 60 req/min — we paginate carefully to stay under.
 *
 * Reference: https://docs.teachable.com/reference/introduction
 */

const TEACHABLE_BASE = "https://developers.teachable.com/v1";

export interface TeachableUser {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface TeachableCourse {
  id: number;
  name: string;
  heading: string;
  description: string;
  image_url: string | null;
  url: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeachableEnrollment {
  id: number;
  user_id: number;
  course_id: number;
  enrolled_at: string;
  completed_at: string | null;
  percent_complete: number;
}

export interface TeachableSection {
  id: number;
  name: string;
  position: number;
  lectures: TeachableLecture[];
}

export interface TeachableLecture {
  id: number;
  name: string;
  position: number;
  is_published: boolean;
  lecture_type: string; // video, text, quiz, etc.
}

export interface TeachableSchoolInfo {
  id: number;
  name: string;
  subdomain: string;
  url: string;
}

/**
 * Create a Teachable API fetch function bound to a specific API key.
 */
export function createTeachableClient(apiKey: string) {
  async function teachableFetch<T>(path: string, retries = 3): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(`${TEACHABLE_BASE}${path}`, {
        headers: {
          "apiKey": apiKey,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (res.status === 429) {
        const waitMs = Math.min(5000 * Math.pow(2, attempt), 60000);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        throw new Error("Teachable API rate limit exceeded. Please wait and try again.");
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Teachable API error ${res.status}: ${body.substring(0, 200)}`);
      }

      return res.json() as Promise<T>;
    }
    throw new Error("Teachable API request failed after retries.");
  }

  async function fetchAllPages<T>(
    basePath: string,
    dataKey: string,
    perPage = 100
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const sep = basePath.includes("?") ? "&" : "?";
      const data = await teachableFetch<Record<string, unknown>>(
        `${basePath}${sep}per=&{perPage}&page=${page}`
      );
      const items = (data[dataKey] as T[]) ?? [];
      results.push(...items);

      const meta = data.meta as { total?: number; number_of_pages?: number } | undefined;
      const totalPages = meta?.number_of_pages ?? 1;
      hasMore = page < totalPages;
      page++;

      // Small delay to avoid rate limiting
      if (hasMore) await new Promise(r => setTimeout(r, 300));
    }

    return results;
  }

  return {
    /**
     * Validate the API key by fetching school info.
     */
    async validateApiKey(): Promise<TeachableSchoolInfo> {
      const data = await teachableFetch<{ school: TeachableSchoolInfo }>("/school");
      return data.school;
    },

    /**
     * Get all users from the Teachable school.
     */
    async getAllUsers(): Promise<TeachableUser[]> {
      return fetchAllPages<TeachableUser>("/users", "users");
    },

    /**
     * Get all courses from the Teachable school.
     */
    async getAllCourses(): Promise<TeachableCourse[]> {
      return fetchAllPages<TeachableCourse>("/courses", "courses");
    },

    /**
     * Get all enrollments for a specific course.
     */
    async getCourseEnrollments(courseId: number): Promise<TeachableEnrollment[]> {
      return fetchAllPages<TeachableEnrollment>(
        `/courses/${courseId}/enrollments`,
        "enrollments"
      );
    },

    /**
     * Get all sections (curriculum) for a course.
     */
    async getCourseSections(courseId: number): Promise<TeachableSection[]> {
      const data = await teachableFetch<{ sections: TeachableSection[] }>(
        `/courses/${courseId}/sections`
      );
      return data.sections ?? [];
    },

    /**
     * Get all enrollments across all courses (fetches per-course).
     */
    async getAllEnrollments(courses: TeachableCourse[]): Promise<TeachableEnrollment[]> {
      const all: TeachableEnrollment[] = [];
      for (const course of courses) {
        const enrollments = await this.getCourseEnrollments(course.id);
        all.push(...enrollments);
        await new Promise(r => setTimeout(r, 200));
      }
      return all;
    },
  };
}
