"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { STORAGE_KEY } from "./constants";
import { buildSeedState } from "./seedData";
import type {
  AnswerResult,
  Announcement,
  Audience,
  EscalationRule,
  FrontDeskState,
  KnowledgeRecord,
  QuestionLogEntry,
  Segment,
} from "./types";

function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const LOCAL_WRITE_EVENT = "front-desk-local-write";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LOCAL_WRITE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LOCAL_WRITE_EVENT, callback);
  };
}

function getSnapshot(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

function readCurrent(): FrontDeskState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FrontDeskState;
  } catch {
    return null;
  }
}

function writeStorage(next: FrontDeskState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(LOCAL_WRITE_EVENT));
}

/** Merges newly-shipped seed records/rules (by id) into an already-saved browser state,
 * without touching existing records — so app updates that add knowledge (like a new policy
 * topic) reach browsers that already seeded, without discarding operator edits or demo
 * history the way a full reseed would. */
function reconcileWithFreshSeed(current: FrontDeskState, freshSeed: FrontDeskState): FrontDeskState {
  const existingRecordIds = new Set(current.knowledgeRecords.map((r) => r.id));
  const newRecords = freshSeed.knowledgeRecords.filter((r) => !existingRecordIds.has(r.id));
  const existingRuleIds = new Set(current.escalationRules.map((r) => r.id));
  const newRules = freshSeed.escalationRules.filter((r) => !existingRuleIds.has(r.id));
  // Backfills fields added to FrontDeskState after a browser already seeded (the stored JSON
  // predates the field, so it's simply absent at runtime despite the type saying required).
  const lastPolicySyncAt = current.lastPolicySyncAt ?? null;
  if (newRecords.length === 0 && newRules.length === 0) {
    return { ...current, seedVersion: freshSeed.seedVersion, lastPolicySyncAt };
  }
  return {
    ...current,
    knowledgeRecords: [...current.knowledgeRecords, ...newRecords],
    escalationRules: [...current.escalationRules, ...newRules],
    seedVersion: freshSeed.seedVersion,
    lastPolicySyncAt,
  };
}

/** Reads the freshest persisted state (not a possibly-stale React closure) and writes the
 * updater's result back. This matters because a single handler often chains several
 * mutations synchronously (e.g. publish a record, then resolve the queue item, then log an
 * announcement) — each must build on the previous one's result, not on the state from when
 * the component last rendered. */
function mutate(updater: (current: FrontDeskState) => FrontDeskState): FrontDeskState | null {
  const current = readCurrent();
  if (!current) return null;
  const next = updater(current);
  writeStorage(next);
  return next;
}

interface FrontDeskContextValue {
  state: FrontDeskState | null;
  ready: boolean;
  /** Logs a question + its already-computed answer (from the LLM route) into the question
   * log. Purely a logging call — the answer itself is computed by lib/llm/client.ts talking
   * to /api/chat, not here, since that's now an async network call rather than a pure
   * function. */
  logAnswer: (query: string, segment: Segment, result: AnswerResult) => string | undefined;
  submitFeedback: (entryId: string, feedback: "up" | "down", feedbackText?: string) => void;
  publishRecord: (record: KnowledgeRecord) => void;
  updateRecord: (record: KnowledgeRecord) => void;
  deleteRecord: (id: string) => void;
  updateEscalationRule: (rule: EscalationRule) => void;
  resolveAttention: (entryId: string) => void;
  addAnnouncement: (text: string, audience: Audience, relatedRecordId?: string) => void;
  /** Applies the result of a real POST /api/drive-sync call (see PolicySourceCard.tsx):
   * upserts every returned record by id, and removes any previously-synced "drive-*" record
   * whose file is no longer in presentDriveIds (archived, deleted, or moved out of the
   * folder). Non-Drive records (hand-authored via KBEditor/AttentionQueue) are untouched. */
  applyDriveSync: (result: { records: KnowledgeRecord[]; presentDriveIds: string[] }) => void;
  resetToSeed: () => void;
}

const FrontDeskContext = createContext<FrontDeskContextValue | null>(null);

export function FrontDeskProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Seed localStorage on first-ever visit, or reconcile newly-shipped seed content into an
  // already-saved browser's state (no side effect on React state directly — the write is
  // picked up by useSyncExternalStore via the local-write event).
  useEffect(() => {
    if (raw === null) {
      if (window.localStorage.getItem(STORAGE_KEY) !== null) return;
      writeStorage(buildSeedState(new Date()));
      return;
    }
    let current: FrontDeskState;
    try {
      current = JSON.parse(raw) as FrontDeskState;
    } catch {
      return;
    }
    const freshSeed = buildSeedState(new Date());
    if (current.seedVersion !== freshSeed.seedVersion) {
      writeStorage(reconcileWithFreshSeed(current, freshSeed));
    }
  }, [raw]);

  const state = useMemo<FrontDeskState | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as FrontDeskState;
    } catch {
      return null;
    }
  }, [raw]);

  const logAnswer = useCallback((query: string, segment: Segment, result: AnswerResult): string | undefined => {
    if (result.mode === "clarify") return undefined;
    const id = genId("q");
    let logged = false;
    mutate((c) => {
      const entry: QuestionLogEntry = {
        id,
        text: query,
        answerText: result.text,
        timestamp: new Date().toISOString(),
        segment,
        mode: result.mode,
        category: result.category,
        matchedRecordId: result.matchedRecordId,
        escalationRuleId: result.escalationRuleId,
        needsAttention: result.needsAttention,
        attentionReason: result.attentionReason,
        attentionResolved: false,
        feedback: null,
      };
      logged = true;
      return { ...c, questionLog: [entry, ...c.questionLog] };
    });
    return logged ? id : undefined;
  }, []);

  const submitFeedback = useCallback((entryId: string, feedback: "up" | "down", feedbackText?: string) => {
    mutate((c) => ({ ...c, questionLog: c.questionLog.map((e) => (e.id === entryId ? { ...e, feedback, feedbackText } : e)) }));
  }, []);

  const publishRecord = useCallback((record: KnowledgeRecord) => {
    mutate((c) => {
      const exists = c.knowledgeRecords.some((r) => r.id === record.id);
      const knowledgeRecords = exists ? c.knowledgeRecords.map((r) => (r.id === record.id ? record : r)) : [...c.knowledgeRecords, record];
      return { ...c, knowledgeRecords };
    });
  }, []);

  const updateRecord = publishRecord;

  const deleteRecord = useCallback((id: string) => {
    mutate((c) => ({ ...c, knowledgeRecords: c.knowledgeRecords.filter((r) => r.id !== id) }));
  }, []);

  const updateEscalationRule = useCallback((rule: EscalationRule) => {
    mutate((c) => {
      const exists = c.escalationRules.some((r) => r.id === rule.id);
      const escalationRules = exists ? c.escalationRules.map((r) => (r.id === rule.id ? rule : r)) : [...c.escalationRules, rule];
      return { ...c, escalationRules };
    });
  }, []);

  const resolveAttention = useCallback((entryId: string) => {
    mutate((c) => ({ ...c, questionLog: c.questionLog.map((e) => (e.id === entryId ? { ...e, attentionResolved: true } : e)) }));
  }, []);

  const addAnnouncement = useCallback((text: string, audience: Audience, relatedRecordId?: string) => {
    mutate((c) => {
      const announcement: Announcement = { id: genId("an"), text, audience, timestamp: new Date().toISOString(), relatedRecordId };
      return { ...c, announcements: [announcement, ...c.announcements] };
    });
  }, []);

  const applyDriveSync = useCallback((result: { records: KnowledgeRecord[]; presentDriveIds: string[] }): void => {
    mutate((c) => {
      const stillPresent = new Set(result.presentDriveIds.map((id) => `drive-${id}`));
      const incomingIds = new Set(result.records.map((r) => r.id));
      const kept = c.knowledgeRecords.filter((r) => {
        if (incomingIds.has(r.id)) return false; // replaced by the fresh copy below
        if (r.id.startsWith("drive-") && !stillPresent.has(r.id)) return false; // no longer in the folder
        return true;
      });
      return { ...c, knowledgeRecords: [...kept, ...result.records], lastPolicySyncAt: new Date().toISOString() };
    });
  }, []);

  const resetToSeed = useCallback(() => {
    writeStorage(buildSeedState(new Date()));
  }, []);

  const value: FrontDeskContextValue = {
    state,
    ready: state !== null,
    logAnswer,
    submitFeedback,
    publishRecord,
    updateRecord,
    deleteRecord,
    updateEscalationRule,
    resolveAttention,
    addAnnouncement,
    applyDriveSync,
    resetToSeed,
  };

  return <FrontDeskContext.Provider value={value}>{children}</FrontDeskContext.Provider>;
}

export function useFrontDesk(): FrontDeskContextValue {
  const ctx = useContext(FrontDeskContext);
  if (!ctx) throw new Error("useFrontDesk must be used within FrontDeskProvider");
  return ctx;
}
