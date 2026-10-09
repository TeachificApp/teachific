export type CuratedCourseVisual = {
  url: string;
  alt: string;
  keywords: readonly string[];
};

/**
 * A small, reviewed Unsplash catalogue keeps course generation reliable when an
 * organization has not configured an Unsplash API credential. The generator
 * topic-matches within this catalogue; authors can replace any visual later in
 * the lesson editor.
 */
export const CURATED_UNSPLASH_COURSE_VISUALS: readonly CuratedCourseVisual[] = [
  {
    url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=85&utm_source=course360&utm_medium=referral",
    alt: "Learners collaborating around a table",
    keywords: ["education", "learning", "course", "students", "training", "teaching", "classroom"],
  },
  {
    url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1600&q=85&utm_source=course360&utm_medium=referral",
    alt: "Team collaborating in a learning session",
    keywords: ["business", "team", "leadership", "marketing", "management", "collaboration", "workshop"],
  },
  {
    url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=85&utm_source=course360&utm_medium=referral",
    alt: "Laptop workspace for digital learning",
    keywords: ["technology", "digital", "software", "coding", "computer", "data", "online"],
  },
  {
    url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1600&q=85&utm_source=course360&utm_medium=referral",
    alt: "Scientific laboratory workspace",
    keywords: ["science", "research", "laboratory", "biology", "chemistry", "medical", "healthcare"],
  },
  {
    url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=85&utm_source=course360&utm_medium=referral",
    alt: "Healthcare professional reviewing clinical information",
    keywords: ["health", "healthcare", "medical", "clinical", "patient", "wellness", "care"],
  },
  {
    url: "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1600&q=85&utm_source=course360&utm_medium=referral",
    alt: "Open books and study materials",
    keywords: ["books", "writing", "reading", "literature", "history", "language", "study"],
  },
] as const;

function words(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(word => word.length > 2),
  );
}

/** Selects a relevant, safe, public Unsplash image without making a third-party runtime API call. */
export function selectCuratedUnsplashCourseVisual(topic: string): CuratedCourseVisual {
  const topicWords = words(topic);
  let bestIndex = 0;
  let bestScore = -1;

  CURATED_UNSPLASH_COURSE_VISUALS.forEach((visual, index) => {
    const score = visual.keywords.reduce((total, keyword) => total + (topicWords.has(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return CURATED_UNSPLASH_COURSE_VISUALS[bestIndex];
}
