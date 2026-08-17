"use client";

import { useState } from "react";
import { useFrontDesk } from "@/lib/store";
import { CATEGORY_LABELS, CENTER } from "@/lib/constants";
import { PolicySourceCard } from "./PolicySourceCard";
import type { Audience, EscalationRule, KnowledgeRecord, RecordStatus, Sensitivity } from "@/lib/types";

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

function RecordRow({ record }: { record: KnowledgeRecord }) {
  const { updateRecord, deleteRecord } = useFrontDesk();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: record.title,
    category: record.category,
    answer: record.answer,
    sourceLabel: record.sourceLabel,
    audience: record.audience,
    sensitivity: record.sensitivity,
    status: record.status,
    effectiveDate: record.effectiveDate,
    lastUpdatedBy: record.lastUpdatedBy,
    keywords: record.keywords.join(", "),
  });

  function save() {
    updateRecord({
      ...record,
      title: form.title,
      category: form.category,
      answer: form.answer,
      sourceLabel: form.sourceLabel,
      audience: form.audience,
      sensitivity: form.sensitivity,
      status: form.status,
      effectiveDate: form.effectiveDate,
      lastUpdatedBy: form.lastUpdatedBy,
      keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
    setOpen(false);
  }

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: "var(--border)" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 p-3.5 text-left">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{record.title}</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            {CATEGORY_LABELS[record.category]} · {record.audience} · {record.status} · effective {record.effectiveDate}
          </p>
        </div>
        <span className="text-xs text-neutral-400 shrink-0">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t p-3.5 flex flex-col gap-2" style={{ borderColor: "var(--border)" }}>
          <label className="text-xs font-medium text-neutral-500">
            Title
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
          </label>
          <label className="text-xs font-medium text-neutral-500">
            Answer
            <textarea value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} rows={4} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm resize-none" style={{ borderColor: "var(--border)" }} />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="text-xs font-medium text-neutral-500">
              Category
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as KnowledgeRecord["category"] }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Audience
              <select value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as Audience }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                <option value="all">All families</option>
                <option value="prospective">Prospective</option>
                <option value="enrolled">Enrolled</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Sensitivity
              <select value={form.sensitivity} onChange={(e) => setForm((f) => ({ ...f, sensitivity: e.target.value as Sensitivity }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                <option value="routine">Routine</option>
                <option value="policy-guidance">Policy guidance</option>
                <option value="human-required">Human required</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Status
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RecordStatus }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                <option value="approved">Approved</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Effective date
              <input type="date" value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Source label
              <input value={form.sourceLabel} onChange={(e) => setForm((f) => ({ ...f, sourceLabel: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
            </label>
          </div>
          <label className="text-xs font-medium text-neutral-500">
            Match keywords (comma-separated)
            <input value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
          </label>
          <div className="flex gap-2 mt-1">
            <button onClick={save} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: "var(--brand)" }}>
              Save
            </button>
            <button onClick={() => deleteRecord(record.id)} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--rose)", color: "var(--rose)" }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewRecordForm({ onDone }: { onDone: () => void }) {
  const { publishRecord } = useFrontDesk();
  const [form, setForm] = useState({
    title: "",
    category: "hours" as KnowledgeRecord["category"],
    answer: "",
    sourceLabel: "Challenger School Policies 2026–27",
    audience: "all" as Audience,
    keywords: "",
  });

  function save() {
    if (!form.title.trim() || !form.answer.trim()) return;
    publishRecord({
      id: genId("kr"),
      title: form.title,
      category: form.category,
      answer: form.answer,
      sourceLabel: form.sourceLabel,
      audience: form.audience,
      sensitivity: "routine",
      status: "approved",
      effectiveDate: new Date().toISOString().slice(0, 10),
      lastUpdatedBy: CENTER.director,
      keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
    onDone();
  }

  return (
    <div className="rounded-xl border bg-white p-3.5 flex flex-col gap-2" style={{ borderColor: "var(--border)" }}>
      <label className="text-xs font-medium text-neutral-500">
        Title
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
      </label>
      <label className="text-xs font-medium text-neutral-500">
        Answer
        <textarea value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} rows={3} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm resize-none" style={{ borderColor: "var(--border)" }} />
      </label>
      <label className="text-xs font-medium text-neutral-500">
        Match keywords (comma-separated)
        <input value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
      </label>
      <div className="flex gap-2">
        <button onClick={save} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: "var(--brand)" }}>
          Add record
        </button>
        <button onClick={onDone} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--border)" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function EscalationRow({ rule }: { rule: EscalationRule }) {
  const { updateEscalationRule } = useFrontDesk();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    triggerKeywords: rule.triggerKeywords.join(", "),
    responseText: rule.responseText,
    contactName: rule.contactName,
    contactRole: rule.contactRole,
  });

  function save() {
    updateEscalationRule({
      ...rule,
      triggerKeywords: form.triggerKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      responseText: form.responseText,
      contactName: form.contactName,
      contactRole: form.contactRole,
    });
    setOpen(false);
  }

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: "var(--border)" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 p-3.5 text-left">
        <p className="text-sm font-medium">{rule.label}</p>
        <span className="text-xs text-neutral-400 shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t p-3.5 flex flex-col gap-2" style={{ borderColor: "var(--border)" }}>
          <label className="text-xs font-medium text-neutral-500">
            Trigger keywords (comma-separated)
            <input value={form.triggerKeywords} onChange={(e) => setForm((f) => ({ ...f, triggerKeywords: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
          </label>
          <label className="text-xs font-medium text-neutral-500">
            Response text (use {"{contactName}"} as a placeholder)
            <textarea value={form.responseText} onChange={(e) => setForm((f) => ({ ...f, responseText: e.target.value }))} rows={3} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm resize-none" style={{ borderColor: "var(--border)" }} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-neutral-500">
              Contact name
              <input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
            </label>
            <label className="text-xs font-medium text-neutral-500">
              Contact role
              <input value={form.contactRole} onChange={(e) => setForm((f) => ({ ...f, contactRole: e.target.value }))} className="mt-0.5 w-full rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border)" }} />
            </label>
          </div>
          <button onClick={save} className="self-start text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: "var(--brand)" }}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

export function KBEditor() {
  const { state } = useFrontDesk();
  const [addingNew, setAddingNew] = useState(false);
  if (!state) return null;

  return (
    <div className="flex flex-col gap-6">
      <PolicySourceCard />
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-neutral-400">Knowledge records — the source of truth parents are answered from</p>
          {!addingNew && (
            <button onClick={() => setAddingNew(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ background: "var(--brand)" }}>
              + Add record
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {addingNew && <NewRecordForm onDone={() => setAddingNew(false)} />}
          {state.knowledgeRecords.map((r) => (
            <RecordRow key={r.id} record={r} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-neutral-400 mb-2">Escalation protocol — topics always routed to a human</p>
        <div className="flex flex-col gap-2">
          {state.escalationRules.map((r) => (
            <EscalationRow key={r.id} rule={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
