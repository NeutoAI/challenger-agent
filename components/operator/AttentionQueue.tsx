"use client";

import { useState } from "react";
import { useFrontDesk } from "@/lib/store";
import { CATEGORY_LABELS, CENTER } from "@/lib/constants";
import { suggestKeywords } from "@/lib/keywords";
import type { Audience, KnowledgeRecord, QuestionLogEntry } from "@/lib/types";

const CATEGORY_OPTIONS: KnowledgeRecord["category"][] = [
  "hours",
  "tuition",
  "tours",
  "illness",
  "medication",
  "meals",
  "pickup",
  "weather",
  "uniform",
];

function genId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Action = "add" | "update" | "private" | "unsafe" | null;

function QueueItemCard({ entry }: { entry: QuestionLogEntry }) {
  const { state, publishRecord, updateRecord, resolveAttention, addAnnouncement } = useFrontDesk();
  const [action, setAction] = useState<Action>(null);
  const [notify, setNotify] = useState(false);

  const [addForm, setAddForm] = useState({
    title: entry.text.length > 60 ? entry.text.slice(0, 57) + "…" : entry.text,
    answer: "",
    category: (entry.category as KnowledgeRecord["category"]) || "hours",
    sourceLabel: "Challenger School Policies 2026–27",
    audience: "all" as Audience,
  });

  const [updateRecordId, setUpdateRecordId] = useState(entry.matchedRecordId ?? state?.knowledgeRecords[0]?.id ?? "");
  const existingRecord = state?.knowledgeRecords.find((r) => r.id === updateRecordId);
  const [updateAnswer, setUpdateAnswer] = useState(existingRecord?.answer ?? "");

  if (!state) return null;

  const systemSaid = entry.answerText;
  const isSensitive = entry.attentionReason === "sensitive";

  function resetAndClose() {
    setAction(null);
    setNotify(false);
  }

  function handlePublishAdd() {
    if (!addForm.answer.trim()) return;
    const record: KnowledgeRecord = {
      id: genId("kr"),
      title: addForm.title,
      category: addForm.category,
      keywords: suggestKeywords(entry.text),
      answer: addForm.answer,
      sourceLabel: addForm.sourceLabel,
      effectiveDate: todayISO(),
      lastUpdatedBy: CENTER.director,
      audience: addForm.audience,
      sensitivity: "routine",
      status: "approved",
    };
    publishRecord(record);
    resolveAttention(entry.id);
    if (notify) {
      addAnnouncement(`New policy published: ${record.title} — ${record.answer.slice(0, 140)}`, addForm.audience, record.id);
    }
    resetAndClose();
  }

  function handlePublishUpdate() {
    if (!existingRecord || !updateAnswer.trim()) return;
    const record: KnowledgeRecord = { ...existingRecord, answer: updateAnswer, effectiveDate: todayISO(), lastUpdatedBy: CENTER.director };
    updateRecord(record);
    resolveAttention(entry.id);
    if (notify) {
      addAnnouncement(`Policy updated: ${record.title} — ${record.answer.slice(0, 140)}`, record.audience, record.id);
    }
    resetAndClose();
  }

  function handleQuickResolve() {
    resolveAttention(entry.id);
    resetAndClose();
  }

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
            style={isSensitive ? { background: "var(--rose-light)", color: "var(--rose)" } : { background: "var(--amber-light)", color: "var(--amber)" }}
          >
            {isSensitive ? "Sensitive — routed to staff" : "Unanswered — knowledge gap"}
          </span>
          <p className="text-sm font-medium">{entry.text}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {entry.segment} · {new Date(entry.timestamp).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-2.5 text-xs text-neutral-500 bg-neutral-50 rounded-lg p-2.5">
        <span className="font-medium text-neutral-600">What the system said: </span>
        {systemSaid}
      </div>

      {action === null && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button onClick={() => setAction("add")} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: "var(--brand)" }}>
            Add as FAQ
          </button>
          <button
            onClick={() => setAction("update")}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border"
            style={{ borderColor: "var(--brand)", color: "var(--brand-dark)" }}
          >
            Update existing policy
          </button>
          <button onClick={() => setAction("private")} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--border)" }}>
            Respond privately
          </button>
          <button onClick={() => setAction("unsafe")} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--border)" }}>
            Mark unsafe — requires staff
          </button>
        </div>
      )}

      {action === "add" && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <label className="text-xs font-medium text-neutral-500">
            Title
            <input
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <label className="text-xs font-medium text-neutral-500">
            Answer for parents
            <textarea
              value={addForm.answer}
              onChange={(e) => setAddForm((f) => ({ ...f, answer: e.target.value }))}
              rows={3}
              placeholder="Write the policy answer as it should appear to parents…"
              className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-neutral-500">
              Category
              <select
                value={addForm.category}
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value as KnowledgeRecord["category"] }))}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Audience
              <select
                value={addForm.audience}
                onChange={(e) => setAddForm((f) => ({ ...f, audience: e.target.value as Audience }))}
                className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="all">All families</option>
                <option value="prospective">Prospective</option>
                <option value="enrolled">Enrolled</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-medium text-neutral-500">
            Source label
            <input
              value={addForm.sourceLabel}
              onChange={(e) => setAddForm((f) => ({ ...f, sourceLabel: e.target.value }))}
              className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>

          {addForm.answer.trim() && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-1">Preview — what the parent will see next time</p>
              <div className="rounded-xl border bg-white p-3 text-sm" style={{ borderColor: "var(--border)" }}>
                <span
                  className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
                  style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}
                >
                  Confirmed from center policy
                </span>
                <p className="whitespace-pre-line">{addForm.answer}</p>
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  {addForm.sourceLabel} · Effective {todayISO()}
                </p>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-neutral-500">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify affected families about this new policy
          </label>

          <div className="flex gap-2 mt-1">
            <button onClick={handlePublishAdd} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: "var(--brand)" }}>
              Publish
            </button>
            <button onClick={resetAndClose} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {action === "update" && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <label className="text-xs font-medium text-neutral-500">
            Existing policy
            <select
              value={updateRecordId}
              onChange={(e) => {
                setUpdateRecordId(e.target.value);
                const r = state.knowledgeRecords.find((rec) => rec.id === e.target.value);
                setUpdateAnswer(r?.answer ?? "");
              }}
              className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              {state.knowledgeRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-neutral-500">
            Updated answer
            <textarea
              value={updateAnswer}
              onChange={(e) => setUpdateAnswer(e.target.value)}
              rows={4}
              className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm resize-none"
              style={{ borderColor: "var(--border)" }}
            />
          </label>

          <div>
            <p className="text-xs font-medium text-neutral-500 mb-1">Preview</p>
            <div className="rounded-xl border bg-white p-3 text-sm" style={{ borderColor: "var(--border)" }}>
              <span
                className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
                style={{ background: "var(--brand-light)", color: "var(--brand-dark)" }}
              >
                Confirmed from center policy
              </span>
              <p className="whitespace-pre-line">{updateAnswer}</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-neutral-500">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Notify affected families about this update
          </label>

          <div className="flex gap-2 mt-1">
            <button onClick={handlePublishUpdate} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: "var(--brand)" }}>
              Save & Publish
            </button>
            <button onClick={resetAndClose} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(action === "private" || action === "unsafe") && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs text-neutral-500">
            {action === "private"
              ? "This will be marked as handled outside the system (e.g. a phone call or private message) — no change to the knowledge base."
              : "This will be marked as requiring staff every time — a good candidate for a documented escalation rule later."}
          </p>
          <div className="flex gap-2">
            <button onClick={handleQuickResolve} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: "var(--brand)" }}>
              Confirm
            </button>
            <button onClick={resetAndClose} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AttentionQueue() {
  const { state } = useFrontDesk();
  if (!state) return null;

  const open = state.questionLog
    .filter((e) => e.needsAttention && !e.attentionResolved)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (open.length === 0) {
    return <p className="text-sm text-neutral-400 py-8 text-center">All caught up — no open items in the queue.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {open.map((entry) => (
        <QueueItemCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
