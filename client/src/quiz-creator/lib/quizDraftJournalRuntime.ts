import type { QuizFile } from "../types/quiz";
export type QuizDraftRecord = { key: string; scope: string; savedAt: number; quiz: QuizFile };
const DB = "course360-quiz-drafts-v1";
function openJournal(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const req = indexedDB.open(DB, 1); req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("drafts")) req.result.createObjectStore("drafts", { keyPath: "key" }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
export async function retainQuizDraft(scope: string, quiz: QuizFile) {
  const db = await openJournal();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("drafts", "readwrite"); const snapshot = JSON.parse(JSON.stringify(quiz)); tx.objectStore("drafts").put({ key: scope + ":" + quiz.meta.id, scope, savedAt: Date.now(), quiz: snapshot }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
}
export async function listQuizDrafts(scope: string): Promise<QuizDraftRecord[]> { const db = await openJournal(); try { return await new Promise((resolve, reject) => { const req = db.transaction("drafts", "readonly").objectStore("drafts").getAll(); req.onsuccess = () => resolve(req.result.filter((row: QuizDraftRecord) => row.scope === scope).sort((a: QuizDraftRecord, b: QuizDraftRecord) => b.savedAt - a.savedAt)); req.onerror = () => reject(req.error); }); } finally { db.close(); } }
