export type ImportedQuizChoice = {
  text: string;
  isCorrect: boolean;
  feedback?: string;
  mediaType?: "none" | "image" | "video";
  mediaUrl?: string;
  matchPairId?: string;
  matchSide?: "left" | "right";
};

export type ImportedQuizQuestion = {
  questionType: "mc" | "tf" | "matching" | "hotspot" | "sequence" | "numeric" | "short_answer";
  questionText: string;
  explanationText?: string;
  points: number;
  choices: ImportedQuizChoice[];
  mediaType?: "none" | "image" | "video";
  mediaUrl?: string;
  mediaAlt?: string;
  hotspotZones?: unknown;
};

function safeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (!candidate || candidate.length > 1024) return undefined;
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function toImportedChoice(choice: any, index: number): ImportedQuizChoice {
  const mediaUrl = safeMediaUrl(choice?.imageUrl ?? choice?.mediaUrl);
  return {
    text: choice?.text || choice?.label || `Option ${index + 1}`,
    isCorrect: choice?.correct === true,
    feedback: typeof choice?.feedback === "string" ? choice.feedback : undefined,
    mediaType: mediaUrl ? "image" : "none",
    mediaUrl,
  };
}

/**
 * Reads the established .quiz export format into the canonical Question Bank
 * import shape. The source package is data only; unsupported media protocols
 * are discarded rather than stored for later learner delivery.
 */
export function parseQuizFileQuestionBankItems(contents: string): ImportedQuizQuestion[] {
  const lines = contents.trim().split(/\r?\n/);
  if (lines[0] !== "TEACHIFIC_QUIZ_V1" || !lines[1]) {
    throw new Error("Invalid .quiz file: expected a supported quiz-file header");
  }
  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(lines[1], "base64").toString("utf8"));
  } catch {
    throw new Error("Could not parse .quiz file. Encrypted files are not supported for import.");
  }
  if (!Array.isArray(payload?.questions)) throw new Error("Invalid .quiz file structure");

  const typeMap: Record<string, ImportedQuizQuestion["questionType"]> = {
    mcq: "mc",
    image_choice: "mc",
    tf: "tf",
    short_answer: "short_answer",
    matching: "matching",
    hotspot: "hotspot",
    ordering: "sequence",
    numeric: "numeric",
  };

  return payload.questions.map((question: any) => {
    const data = question.data ?? {};
    const questionMediaUrl = safeMediaUrl(
      question.imageUrl ?? question.mediaUrl ?? data.imageUrl ?? data.backgroundImageUrl,
    );
    let choices: ImportedQuizChoice[] = [];
    if (question.type === "mcq" || question.type === "image_choice") {
      choices = (data.choices ?? []).map(toImportedChoice);
    } else if (question.type === "tf") {
      choices = [
        { text: "True", isCorrect: data.correct === true },
        { text: "False", isCorrect: data.correct === false },
      ];
    } else if (question.type === "short_answer") {
      choices = data.sampleAnswer ? [{ text: data.sampleAnswer, isCorrect: true }] : [];
    } else if (question.type === "matching") {
      choices = (data.pairs ?? []).flatMap((pair: any, index: number) => [
        {
          text: pair?.premise || `Premise ${index + 1}`,
          isCorrect: true,
          mediaType: safeMediaUrl(pair?.premiseImageUrl) ? "image" : "none",
          mediaUrl: safeMediaUrl(pair?.premiseImageUrl),
          matchPairId: pair?.id || `pair-${index + 1}`,
          matchSide: "left" as const,
        },
        {
          text: pair?.response || `Response ${index + 1}`,
          isCorrect: true,
          mediaType: safeMediaUrl(pair?.responseImageUrl) ? "image" : "none",
          mediaUrl: safeMediaUrl(pair?.responseImageUrl),
          matchPairId: pair?.id || `pair-${index + 1}`,
          matchSide: "right" as const,
        },
      ]);
    } else if (question.type === "ordering") {
      choices = (data.items ?? []).map((item: any, index: number) => ({
        text: item?.text || `Item ${index + 1}`,
        isCorrect: true,
        mediaType: safeMediaUrl(item?.imageUrl) ? "image" : "none",
        mediaUrl: safeMediaUrl(item?.imageUrl),
      }));
    }
    return {
      questionType: typeMap[question.type] ?? "mc",
      questionText: question.stem || "Imported question",
      explanationText: typeof question.explanation === "string" ? question.explanation : undefined,
      points: Number.isFinite(Number(question.points)) ? Number(question.points) : 1,
      choices,
      mediaType: questionMediaUrl ? "image" : "none",
      mediaUrl: questionMediaUrl,
      mediaAlt: typeof data.imageAlt === "string" ? data.imageAlt.slice(0, 255) : undefined,
      hotspotZones: question.type === "hotspot" && Array.isArray(data.regions) ? data.regions : undefined,
    };
  });
}
