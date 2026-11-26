import type { CreatorBlock, CreatorDocument } from "../../../shared/course360CreatorModel";
import type { CreatorOwnedImageResult } from "../../../shared/course360CreatorOwnedImage";
export type CreatorImageInsertionScope = { orgId: number | null | undefined; projectId: number; slideId: number | null; loadedProjectOrgId: number | null };
export function appendCreatorOwnedImage(document: CreatorDocument, image: CreatorOwnedImageResult, expected: CreatorImageInsertionScope, current: CreatorImageInsertionScope, factory: () => CreatorBlock, canvas: { width: number; height: number }): CreatorDocument {
  if (!expected.orgId || !expected.slideId || expected.orgId !== expected.loadedProjectOrgId || current.orgId !== expected.orgId || current.projectId !== expected.projectId || current.slideId !== expected.slideId || current.loadedProjectOrgId !== expected.orgId || image.orgId !== expected.orgId) throw new Error("School, project or slide changed. The saved image remains in the main library; nothing was inserted.");
  if (!Number.isSafeInteger(image.mediaId) || image.mediaId < 1 || image.mimeType !== "image/png" || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width < 1 || image.height < 1 || image.width > 4096 || image.height > 4096 || image.width * image.height > 8_000_000 || !new RegExp(`^org-${expected.orgId}/media/creator-images/[a-f0-9-]{36}\\.png$`).test(image.key)) throw new Error("Invalid owned image receipt. Existing blocks are unchanged.");
  const block = factory();
  if (block.type !== "image" || !block.id || document.blocks.some(old => old.id === block.id)) throw new Error("A fresh image block is required; no existing block can be replaced.");
  const maxWidth = Math.max(1, canvas.width - 40), maxHeight = Math.max(1, canvas.height - 40);
  const scale = Math.min(1, 600 / image.width, maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale, height = image.height * scale;
  const next = { ...block, mediaId: image.mediaId, src: image.url, alt: image.alt, x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height };
  return { ...document, blocks: [...document.blocks, next] };
}
