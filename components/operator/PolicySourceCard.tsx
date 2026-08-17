"use client";

import { useState } from "react";
import { useFrontDesk } from "@/lib/store";
import type { KnowledgeRecord } from "@/lib/types";

interface DriveSyncResponse {
  records: KnowledgeRecord[];
  presentDriveIds: string[];
  warnings: string[];
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Never synced";
  return `Last synced ${new Date(iso).toLocaleString()}`;
}

/** An operator drops an approved policy document (a Google Doc, see EXPLAINER.md for the
 * required front-matter format) into the configured Drive folder; "Sync now" calls
 * /api/drive-sync (server-side, holds the service-account credentials) to actually read that
 * folder and pull the current approved set into the knowledge base — grounded fresh at
 * response time, not by retraining the model. On failure this deliberately does not fall back
 * to any placeholder data: an operator relying on "what's currently approved" should see a
 * clear error, not silently-stale or fake-looking content. */
export function PolicySourceCard() {
  const { state, applyDriveSync } = useFrontDesk();
  const [syncing, setSyncing] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!state) return null;

  async function handleSync() {
    setSyncing(true);
    setConfirmation(null);
    setWarnings([]);
    setError(null);
    try {
      const res = await fetch("/api/drive-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : `Sync failed (HTTP ${res.status}).`);
        return;
      }
      const result = data as DriveSyncResponse;
      applyDriveSync(result);
      setConfirmation(`Synced — ${result.records.length} polic${result.records.length === 1 ? "y" : "ies"} active from Drive.`);
      setWarnings(result.warnings);
    } catch {
      setError("Couldn't reach the sync endpoint — check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Policy source: Google Drive folder</p>
          <p className="text-xs text-neutral-500 mt-0.5">New files in this folder are automatically used after sync.</p>
          <p className="text-[11px] text-neutral-400 mt-1.5">{formatSyncedAt(state.lastPolicySyncAt)}</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50 shrink-0"
          style={{ background: "var(--brand)" }}
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {confirmation && (
        <p className="text-xs mt-2.5" style={{ color: "var(--brand-dark)" }}>
          ✓ {confirmation}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="text-xs mt-1.5 flex flex-col gap-0.5" style={{ color: "var(--amber)" }}>
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
      {error && (
        <p className="text-xs mt-2.5" style={{ color: "var(--rose)" }}>
          ✗ {error}
        </p>
      )}
    </div>
  );
}
