import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { restoreCourse360MobileSyncSource } from "./course360MobileSyncPreservation";

export interface MobileEditorInversePair { readonly before: string; readonly after: string }
export interface MobileEditorInverseFile {
  readonly path: string;
  readonly baselineSha256: string;
  readonly approvedSha256: string;
  readonly pairs: readonly MobileEditorInversePair[];
}
interface MobileEditorInverseManifest {
  readonly version: number;
  readonly baselineCommit: string;
  readonly files: readonly MobileEditorInverseFile[];
}

// Test-only exact restoration: never imported by client or production server code.
// This is not a general JSX/style normalizer. No path aliases or fuzzy matches are accepted.
const ALLOWED_PATHS = [
  "client/src/components/LessonBlockEditor.tsx",
  "client/src/pages/admin/LandingPageBuilder.tsx",
  "client/src/pages/lms/CourseBuilderPage.tsx",
  "client/src/pages/lms/LandingPageBuilder.tsx",
] as const;
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "server/fixtures/course360MobileEditorInverse.json"), "utf8")) as MobileEditorInverseManifest;
if (manifest.version !== 1 || manifest.baselineCommit !== "8dd13f463bfa269cd848ea48a2efdf0b35955af7" ||
    !Array.isArray(manifest.files) || manifest.files.length !== ALLOWED_PATHS.length ||
    manifest.files.map(file => file.path).sort().join("\n") !== [...ALLOWED_PATHS].sort().join("\n")) {
  throw new Error("Invalid exact mobile-editor inverse manifest scope");
}
for (const file of manifest.files) {
  if (!/^[a-f0-9]{64}$/.test(file.baselineSha256) || !/^[a-f0-9]{64}$/.test(file.approvedSha256) ||
      !Array.isArray(file.pairs) || !file.pairs.length || file.pairs.some((pair: MobileEditorInversePair) =>
        typeof pair.before !== "string" || typeof pair.after !== "string" || !pair.before || !pair.after || pair.before === pair.after)) {
    throw new Error(`Invalid exact mobile-editor inverse pairs: ${file.path}`);
  }
}
export const COURSE360_MOBILE_EDITOR_INVERSES: readonly MobileEditorInverseFile[] = manifest.files;

function occurrenceCount(text: string, fragment: string): number {
  let count = 0;
  let cursor = 0;
  while ((cursor = text.indexOf(fragment, cursor)) !== -1) { count += 1; cursor += 1; }
  return count;
}

/** Restore only the enumerated, exact approved mobile repair, retaining every old hash assertion. */
export function restoreCourse360MobileEditorSource(path: string, text: string): string {
  const file = manifest.files.find(entry => entry.path === path);
  if (file && sha256(text) === file.baselineSha256) return text;
  try { text = restoreCourse360MobileSyncSource(path, text); }
  catch (error) {
    if (!file) throw error;
    // The original inverse independently requires its complete approved source
    // hash AND restored baseline hash; malformed bytes cannot bypass either layer.
  }
  if (!file) return text;
  // Already-original source stays original; no incomplete or mixed repair is accepted.
  if (sha256(text) === file.baselineSha256) return text;
  let restored = text;
  for (const [index, pair] of file.pairs.entries()) {
    if (occurrenceCount(restored, pair.after) !== 1) {
      throw new Error(`Expected exactly one approved mobile-editor fragment: ${path} hunk ${index + 1}`);
    }
    restored = restored.replace(pair.after, pair.before);
  }
  if (sha256(text) !== file.approvedSha256 || sha256(restored) !== file.baselineSha256) {
    throw new Error(`Unexpected mobile-editor source bytes outside exact inverse: ${path}`);
  }
  return restored;
}
