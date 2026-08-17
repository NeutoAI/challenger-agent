"use client";

export interface QuickReply {
  display: string;
  query: string;
}

export function QuickReplies({ replies, onPick }: { replies: QuickReply[]; onPick: (query: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 px-1">
      {replies.map((r) => (
        <button
          key={r.query}
          onClick={() => onPick(r.query)}
          className="text-xs font-medium px-3 py-2 rounded-xl border bg-white hover:shadow-sm transition-shadow text-left"
          style={{ borderColor: "var(--border)" }}
        >
          {r.display}
        </button>
      ))}
    </div>
  );
}
