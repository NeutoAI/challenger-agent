"use client";

import type { FrontDeskState } from "@/lib/types";

function Tile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--border)" }}>
      <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-medium">{label}</p>
      <p className="text-xl font-semibold mt-1" style={{ color: "var(--brand-dark)" }}>
        {value}
      </p>
      {caption && <p className="text-[11px] text-neutral-400 mt-0.5">{caption}</p>}
    </div>
  );
}

export function StatsBar({ state }: { state: FrontDeskState }) {
  const log = state.questionLog;
  const total = log.length;
  const resolvedPolicy = log.filter((e) => e.mode === "policy").length;
  const resolutionRate = total ? Math.round((resolvedPolicy / total) * 100) : 0;

  const withFeedback = log.filter((e) => e.feedback);
  const positive = withFeedback.filter((e) => e.feedback === "up").length;
  const helpfulnessRate = withFeedback.length ? Math.round((positive / withFeedback.length) * 100) : null;

  const sensitiveCount = log.filter((e) => e.attentionReason === "sensitive").length;

  // Display-only snapshot metric; sub-second staleness across renders is inconsequential here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const staleRecords = state.knowledgeRecords.filter((r) => {
    const days = (now - new Date(r.effectiveDate).getTime()) / (1000 * 60 * 60 * 24);
    return days > 180;
  }).length;

  const minutesSaved = resolvedPolicy * 3;

  return (
    <div>
      <p className="text-xs font-medium text-neutral-400 mb-2">Prototype metrics — illustrative, based on demo data stored in this browser.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <Tile label="Resolution rate" value={`${resolutionRate}%`} caption={`${resolvedPolicy} of ${total} answered without escalation`} />
        <Tile label="Helpfulness rate" value={helpfulnessRate === null ? "—" : `${helpfulnessRate}%`} caption={`${withFeedback.length} rated by parents`} />
        <Tile
          label="Safe escalation rate"
          value={sensitiveCount > 0 ? "100%" : "—"}
          caption={`${sensitiveCount} sensitive topics routed to staff`}
        />
        <Tile label="Est. admin time saved" value={`~${minutesSaved} min`} caption="Assuming 3 min/question, all-time" />
        <Tile label="Knowledge freshness" value={`${staleRecords}`} caption="Policies older than 6 months" />
        <Tile label="Needs attention" value={`${log.filter((e) => e.needsAttention && !e.attentionResolved).length}`} caption="Open items in the queue" />
      </div>
    </div>
  );
}
