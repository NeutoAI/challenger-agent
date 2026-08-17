"use client";

import { useState } from "react";
import { useFrontDesk } from "@/lib/store";
import { SegmentPicker } from "@/components/SegmentPicker";
import { ChatWindow } from "@/components/ChatWindow";
import type { Segment } from "@/lib/types";

const BOUNDARY_TEXT: Record<"en" | "es", string> = {
  en: "Unofficial prototype built for a job-application exercise — not affiliated with, endorsed by, or operated by Challenger School. Answers are grounded in Challenger's published materials, but this assistant does not access or discuss any specific child's records.",
  es: "Prototipo no oficial creado para un ejercicio de solicitud de empleo — no está afiliado, respaldado ni operado por Challenger School. Las respuestas se basan en los materiales publicados por Challenger, pero este asistente no accede ni discute los registros de ningún niño específico.",
};

export default function ParentPage() {
  const { ready } = useFrontDesk();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [lang, setLang] = useState<"en" | "es">("en");

  if (!ready) {
    return <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">Loading…</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 max-w-2xl w-full mx-auto">
      <div className="flex items-center justify-between px-4 pt-3">
        {segment ? (
          <button onClick={() => setSegment(null)} className="text-xs text-neutral-400 hover:text-neutral-600">
            ← {lang === "es" ? "Cambiar" : "Switch"}
          </button>
        ) : (
          <span />
        )}
        <div className="flex text-xs font-medium rounded-full border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setLang("en")}
            className="px-2.5 py-1"
            style={lang === "en" ? { background: "var(--brand)", color: "white" } : {}}
          >
            EN
          </button>
          <button
            onClick={() => setLang("es")}
            className="px-2.5 py-1"
            style={lang === "es" ? { background: "var(--brand)", color: "white" } : {}}
          >
            ES
          </button>
        </div>
      </div>

      {segment ? (
        <ChatWindow key={lang} segment={segment} lang={lang} />
      ) : (
        <SegmentPicker lang={lang} onPick={setSegment} />
      )}

      <p className="text-[11px] text-neutral-400 text-center px-6 pb-3 pt-1">{BOUNDARY_TEXT[lang]}</p>
    </div>
  );
}
