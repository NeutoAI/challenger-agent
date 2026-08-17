"use client";

import { CATEGORY_LABELS } from "@/lib/constants";
import type { FrontDeskState } from "@/lib/types";

const SUGGESTED_ACTION: Record<string, string> = {
  hours: "Consider publishing a holiday reminder to enrolled families.",
  meals: "This looks like a recurring gap — review it in the Attention Queue and consider publishing a same-day meal policy.",
  pickup: "Consider a reminder about late-pickup fees during peak season.",
  tuition: "Consider publishing a simple rate sheet so families don't need to ask.",
  illness: "This policy is used often — consider pinning it to the family app home screen.",
  tours: "High interest — consider a follow-up nurture message for prospects.",
  weather: "Keep the weather-alert policy visible during storm season.",
  medication: "Consider a reminder about medication form requirements at drop-off.",
  uniform: "Consider a reminder before picture days or other special-function days.",
  escalation: "Multiple sensitive topics this period — review staff response times.",
};

export function InsightClusters({ state, onJumpToQueue }: { state: FrontDeskState; onJumpToQueue: () => void }) {
  // Display-only clustering window; sub-second staleness across renders is inconsequential here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const windowMs = 14 * 24 * 60 * 60 * 1000;
  const cutoff = now - windowMs;
  const recent = state.questionLog.filter((e) => new Date(e.timestamp).getTime() >= cutoff);

  const groups = new Map<string, { count: number; openUnmatched: number }>();
  for (const e of recent) {
    const cat = e.category ?? "other";
    const g = groups.get(cat) ?? { count: 0, openUnmatched: 0 };
    g.count += 1;
    if (e.attentionReason === "unmatched" && !e.attentionResolved) g.openUnmatched += 1;
    groups.set(cat, g);
  }

  const clusters = [...groups.entries()]
    .filter(([, g]) => g.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4);

  if (clusters.length === 0) {
    return null;
  }

  return (
    <div className="mt-5">
      <p className="text-xs font-medium text-neutral-400 mb-2">What families are asking about — last 14 days</p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {clusters.map(([category, g]) => (
          <div key={category} className="rounded-xl border bg-white p-3.5" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold">
              {g.count} question{g.count === 1 ? "" : "s"} about {CATEGORY_LABELS[category] ?? category}
            </p>
            <p className="text-xs text-neutral-500 mt-1">{SUGGESTED_ACTION[category] ?? "Review this topic in the knowledge base."}</p>
            {g.openUnmatched > 0 && (
              <button onClick={onJumpToQueue} className="text-xs font-semibold mt-2" style={{ color: "var(--brand)" }}>
                Review {g.openUnmatched} unanswered in queue →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
