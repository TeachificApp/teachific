import { eq } from "drizzle-orm";
import { questionBankFolders } from "../../drizzle/schema";

export type QuestionBankFolderRow = {
  id: number;
  orgId: number;
  parentId: number | null;
  name: string;
};

/** Fetches only Question Bank folders belonging to the specified active organization. */
export async function selectQuestionBankFolders(db: any, orgId: number): Promise<QuestionBankFolderRow[]> {
  const rows = await db.select({
    id: questionBankFolders.id,
    orgId: questionBankFolders.orgId,
    parentId: questionBankFolders.parentId,
    name: questionBankFolders.name,
  }).from(questionBankFolders).where(eq(questionBankFolders.orgId, orgId));
  return rows;
}

/** Includes a folder and all of its descendants without crossing organization boundaries. */
export function collectQuestionBankDescendantFolderIds(
  folders: readonly QuestionBankFolderRow[],
  rootFolderId: number,
  orgId: number,
): number[] {
  const inOrg = folders.filter((folder) => folder.orgId === orgId);
  if (!inOrg.some((folder) => folder.id === rootFolderId)) return [];

  const childrenByParent = new Map<number, number[]>();
  for (const folder of inOrg) {
    if (folder.parentId === null) continue;
    const children = childrenByParent.get(folder.parentId) ?? [];
    children.push(folder.id);
    childrenByParent.set(folder.parentId, children);
  }

  const result: number[] = [];
  const queued = [rootFolderId];
  const seen = new Set<number>();
  while (queued.length > 0) {
    const id = queued.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    queued.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}
