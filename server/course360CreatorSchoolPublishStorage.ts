import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { storeStudioFile, inspectStudioRegistration, resolveStudioStorage, requestStudioStorage } from "./lib/course360StudioStorage";
import { CREATOR_SCHOOL_ARTIFACT_BYTES } from "./course360CreatorSchoolPublishArtifact";

/** Existing generic bounded storage byte/ownership contract; no Studio billing dependency. */
export async function storeCreatorSchoolArtifact(key: string, bytes: Buffer) {
  const signal = AbortSignal.timeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), "course360-creator-publish-"));
  try {
    const path = join(directory, "artifact.zip"); await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    const uploaded = await storeStudioFile(key, path, "application/zip", signal);
    if (uploaded.key !== key) throw new TRPCError({ code: "CONFLICT", message: "Artifact storage returned a different owned key." });
    const receipt = await inspectStudioRegistration(key, uploaded.url, signal);
    if (receipt.key !== key || receipt.size !== bytes.length || receipt.mimeType !== "application/zip") throw new TRPCError({ code: "CONFLICT", message: "Artifact storage size, MIME or key receipt changed." });
    const resolved = await resolveStudioStorage(key, signal);
    const response = await requestStudioStorage(resolved.url, "GET", signal);
    let size = 0; const hash = createHash("sha256");
    try {
      for await (const chunk of response) { size += chunk.length; if (size > CREATOR_SCHOOL_ARTIFACT_BYTES || size > bytes.length) throw new TRPCError({ code: "CONFLICT", message: "Artifact readback exceeded its owned receipt." }); hash.update(chunk); }
    } finally { response.destroy(); }
    if (size !== bytes.length || hash.digest("hex") !== createHash("sha256").update(bytes).digest("hex")) throw new TRPCError({ code: "CONFLICT", message: "Artifact readback bytes did not match the retained learner package." });
    return receipt;
  } finally {
    // Only this function's newly created local scratch directory, never storage/project/user data.
    await rm(directory, { recursive: true, force: true });
  }
}
