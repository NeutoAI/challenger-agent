"use client";

import type { FrontDeskState } from "@/lib/types";

export function AnnouncementMockup({ state }: { state: FrontDeskState }) {
  if (state.announcements.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-medium text-neutral-400 mb-2">Proactive family announcements (mocked — not actually sent)</p>
      <div className="flex flex-col gap-2">
        {state.announcements.map((a) => (
          <div key={a.id} className="rounded-xl border bg-white p-3.5 text-sm" style={{ borderColor: "var(--border)" }}>
            <p>{a.text}</p>
            <p className="text-[11px] text-neutral-400 mt-1">
              To: {a.audience} families · {new Date(a.timestamp).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
