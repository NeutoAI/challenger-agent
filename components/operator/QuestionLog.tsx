"use client";

import { CATEGORY_LABELS } from "@/lib/constants";
import type { FrontDeskState } from "@/lib/types";

const MODE_LABEL: Record<string, string> = {
  policy: "Answered",
  clarify: "Clarified",
  handoff: "Escalated",
};

const MODE_COLOR: Record<string, { bg: string; fg: string }> = {
  policy: { bg: "var(--brand-light)", fg: "var(--brand-dark)" },
  clarify: { bg: "var(--amber-light)", fg: "var(--amber)" },
  handoff: { bg: "var(--rose-light)", fg: "var(--rose)" },
};

export function QuestionLog({ state }: { state: FrontDeskState }) {
  const entries = [...state.questionLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 60);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-y-1.5">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400">
            <th className="px-3 py-1 font-medium">Question</th>
            <th className="px-3 py-1 font-medium">Segment</th>
            <th className="px-3 py-1 font-medium">Category</th>
            <th className="px-3 py-1 font-medium">Outcome</th>
            <th className="px-3 py-1 font-medium">Feedback</th>
            <th className="px-3 py-1 font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const color = MODE_COLOR[e.mode];
            return (
              <tr key={e.id} className="bg-white">
                <td className="px-3 py-2 rounded-l-lg max-w-xs truncate" title={e.text}>
                  {e.text}
                </td>
                <td className="px-3 py-2 text-neutral-500">{e.segment}</td>
                <td className="px-3 py-2 text-neutral-500">{e.category ? CATEGORY_LABELS[e.category] ?? e.category : "—"}</td>
                <td className="px-3 py-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: color.bg, color: color.fg }}>
                    {MODE_LABEL[e.mode]}
                  </span>
                </td>
                <td className="px-3 py-2">{e.feedback === "up" ? "👍" : e.feedback === "down" ? "👎" : "—"}</td>
                <td className="px-3 py-2 rounded-r-lg text-neutral-400 whitespace-nowrap">{new Date(e.timestamp).toLocaleDateString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {entries.length === 0 && <p className="text-sm text-neutral-400 py-8 text-center">No questions logged yet.</p>}
    </div>
  );
}
