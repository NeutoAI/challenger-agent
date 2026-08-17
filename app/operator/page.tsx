"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFrontDesk } from "@/lib/store";
import { StatsBar } from "@/components/operator/StatsBar";
import { InsightClusters } from "@/components/operator/InsightClusters";
import { AttentionQueue } from "@/components/operator/AttentionQueue";
import { KBEditor } from "@/components/operator/KBEditor";
import { QuestionLog } from "@/components/operator/QuestionLog";
import { AnnouncementMockup } from "@/components/operator/AnnouncementMockup";

type Tab = "overview" | "queue" | "kb" | "log";

export default function OperatorPage() {
  const { ready, state, resetToSeed } = useFrontDesk();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmingReset, setConfirmingReset] = useState(false);

  async function handleLogout() {
    await fetch("/api/operator-logout", { method: "POST" });
    router.push("/operator/login");
    router.refresh();
  }

  if (!ready || !state) {
    return <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">Loading…</div>;
  }

  const attentionCount = state.questionLog.filter((e) => e.needsAttention && !e.attentionResolved).length;

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "queue", label: "Attention Queue", badge: attentionCount },
    { id: "kb", label: "Knowledge Base" },
    { id: "log", label: "Question Log" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-5xl w-full mx-auto px-4 py-4 gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-semibold">Operator Control Center</h1>
          <p className="text-xs text-neutral-400">
            Unofficial prototype, not affiliated with Challenger School · sample data is stored only in this browser.
          </p>
        </div>
        {confirmingReset ? (
          <div className="flex items-center gap-2 text-xs">
            <span>Reset all demo data?</span>
            <button
              onClick={() => {
                resetToSeed();
                setConfirmingReset(false);
              }}
              className="px-2.5 py-1 rounded-full text-white font-medium"
              style={{ background: "var(--rose)" }}
            >
              Confirm
            </button>
            <button onClick={() => setConfirmingReset(false)} className="px-2.5 py-1 rounded-full border font-medium" style={{ borderColor: "var(--border)" }}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmingReset(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border"
              style={{ borderColor: "var(--border)" }}
            >
              Reset demo data
            </button>
            <button onClick={handleLogout} className="text-xs font-medium px-3 py-1.5 rounded-full border" style={{ borderColor: "var(--border)" }}>
              Log out
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 text-sm font-medium border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 -mb-px border-b-2 whitespace-nowrap flex items-center gap-1.5"
            style={tab === t.id ? { borderColor: "var(--brand)", color: "var(--brand-dark)" } : { borderColor: "transparent", color: "var(--foreground)" }}
          >
            {t.label}
            {!!t.badge && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: "var(--rose)" }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {tab === "overview" && (
          <>
            <StatsBar state={state} />
            <InsightClusters state={state} onJumpToQueue={() => setTab("queue")} />
            <AnnouncementMockup state={state} />
          </>
        )}
        {tab === "queue" && <AttentionQueue />}
        {tab === "kb" && <KBEditor />}
        {tab === "log" && <QuestionLog state={state} />}
      </div>
    </div>
  );
}
