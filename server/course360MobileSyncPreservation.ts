import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ExactPair { readonly before: string; readonly after: string }
interface ExactFile {
  readonly path: string;
  readonly baselineSha256: string;
  readonly approvedSha256: string;
  readonly pairs: readonly ExactPair[];
}
interface ExactManifest {
  readonly version: number;
  readonly baselineCommit: string;
  readonly sourceMobileCommit: string;
  readonly sourceLabelCommit: string;
  readonly files: readonly ExactFile[];
}
// Test-only exact inverse of the approved source-sync delta, not a runtime migration
// or general JSX/style normalizer. Original fixtures and hashes are left intact.
const ALLOWED_PATHS = [
  "client/src/pages/admin/FunnelPageEditor.tsx",
  "client/src/pages/admin/SitePageBuilder.tsx",
  "client/src/pages/admin/LandingPageBuilder.tsx",
  "client/src/pages/lms/LandingPageBuilder.tsx",
  "client/src/pages/marketing/FunnelPageEditor.tsx",
] as const;
const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "server/fixtures/course360MobileSyncInverse.json"), "utf8")) as ExactManifest;
if (manifest.version !== 1 || manifest.baselineCommit !== "1485060fac9c1a847fe967eb5b8b2fe2e3116308" ||
    manifest.sourceMobileCommit !== "82ffa97c" || manifest.sourceLabelCommit !== "3e734601" ||
    !Array.isArray(manifest.files) || manifest.files.length !== ALLOWED_PATHS.length ||
    manifest.files.map(file => file.path).sort().join("\n") !== [...ALLOWED_PATHS].sort().join("\n")) {
  throw new Error("Invalid exact mobile-sync inverse scope");
}
for (const file of manifest.files) {
  if (!/^[a-f0-9]{64}$/.test(file.baselineSha256) || !/^[a-f0-9]{64}$/.test(file.approvedSha256) ||
      !Array.isArray(file.pairs) || !file.pairs.length || file.pairs.some((pair: ExactPair) =>
        typeof pair.before !== "string" || typeof pair.after !== "string" || !pair.before || !pair.after || pair.before === pair.after)) {
    throw new Error(`Invalid exact mobile-sync inverse pairs: ${file.path}`);
  }
}
export const COURSE360_MOBILE_SYNC_INVERSES: readonly ExactFile[] = manifest.files;

/** Only accept exact original bytes or the complete approved reversible delta. */
export function restoreCourse360MobileSyncSource(path: string, text: string): string {
  const file = manifest.files.find(entry => entry.path === path);
  if (!file || sha256(text) === file.baselineSha256) return text;
  // Earlier pre-mobile originals may pass to their own independently pinned layer.
  // No other non-approved bytes are allowed on a path covered by this layer.
  if (sha256(text) !== file.approvedSha256) {
    throw new Error(`Unexpected mobile-sync source bytes outside exact inverse: ${path}`);
  }
  let restored = text;
  for (const [index, pair] of file.pairs.entries()) {
    if (restored.split(pair.after).length - 1 !== 1) {
      throw new Error(`Expected exactly one approved mobile-sync fragment: ${path} hunk ${index + 1}`);
    }
    restored = restored.replace(pair.after, pair.before);
  }
  if (sha256(restored) !== file.baselineSha256) throw new Error(`Unexpected restored mobile-sync bytes: ${path}`);
  return restored;
}
