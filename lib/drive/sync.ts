import { exportDocText, listPolicyDocs } from "./client";
import { parsePolicyDoc } from "./parser";
import { suggestKeywords } from "@/lib/keywords";
import type { KnowledgeRecord } from "@/lib/types";

export interface DriveSyncResult {
  records: KnowledgeRecord[];
  /** ids (bare Drive file ids, not the "drive-" prefixed KnowledgeRecord id) of every Google
   * Doc currently in the folder — used by the client to remove any previously-synced record
   * whose file was archived, deleted, or moved out since the last sync. */
  presentDriveIds: string[];
  warnings: string[];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Orchestrates a full sync: list every Google Doc in the configured folder, export and
 * parse each one, and build the KnowledgeRecords that should be active right now. Deliberately
 * does not pick a single "winner" per category — the LLM system prompt (lib/llm/systemPrompt.ts)
 * already prefers the record with the later effectiveDate and more specificity at answer time,
 * so re-implementing that precedence here would just duplicate already-shipped, eval-tested
 * behavior. */
export async function runDriveSync(): Promise<DriveSyncResult> {
  const files = await listPolicyDocs();
  const records: KnowledgeRecord[] = [];
  const warnings: string[] = [];
  const today = todayISO();

  for (const file of files) {
    const text = await exportDocText(file.id);
    const result = parsePolicyDoc(text, file.name);
    if (!result.ok) {
      warnings.push(result.reason);
      continue;
    }
    const { doc } = result;
    if (doc.status !== "approved") continue;
    if (doc.effectiveDate > today) continue;

    records.push({
      id: `drive-${file.id}`,
      title: doc.title,
      category: doc.category,
      keywords: suggestKeywords(doc.answer),
      answer: doc.answer,
      sourceLabel: doc.title,
      effectiveDate: doc.effectiveDate,
      lastUpdatedBy: file.lastModifyingUserName ?? "Google Drive sync",
      audience: doc.audience,
      sensitivity: "routine",
      status: "approved",
    });
  }

  return { records, presentDriveIds: files.map((f) => f.id), warnings };
}
