"use client";

import { useState } from "react";
import { CENTER } from "@/lib/constants";
import { FeedbackPrompt } from "./FeedbackPrompt";
import type { ChatMessage } from "./ChatTypes";

const MODE_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  policy: { label: "Confirmed from center policy", bg: "var(--brand-light)", fg: "var(--brand-dark)" },
  clarify: { label: "I need one detail", bg: "var(--amber-light)", fg: "var(--amber)" },
  handoff: { label: "A staff member should help with this", bg: "var(--rose-light)", fg: "var(--rose)" },
};

const MODE_BADGE_ES: Record<string, string> = {
  policy: "Confirmado según la política del centro",
  clarify: "Necesito un detalle más",
  handoff: "Un miembro del personal debería ayudar con esto",
};

function splitSummary(text: string): { summary: string; detail: string | null } {
  if (text.length <= 200) return { summary: text, detail: null };
  const idx = text.indexOf(". ", 40);
  if (idx === -1 || idx > 220) return { summary: text, detail: null };
  return { summary: text.slice(0, idx + 1), detail: text.slice(idx + 2) };
}

export function MessageBubble({
  message,
  lang,
  onClarifyPick,
  onFeedback,
  onCta,
  onMessageStaff,
}: {
  message: ChatMessage;
  lang: "en" | "es";
  onClarifyPick: (recordId: string, option: string) => void;
  onFeedback: (entryId: string, feedback: "up" | "down", text?: string) => void;
  onCta: (messageId: string) => void;
  onMessageStaff: (messageId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-white" style={{ background: "var(--brand)" }}>
          {message.text}
        </div>
      </div>
    );
  }

  const badge = message.mode ? MODE_BADGE[message.mode] : null;
  const { summary, detail } = splitSummary(message.text);

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm bg-white border" style={{ borderColor: "var(--border)" }}>
        {badge && (
          <span
            className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-1.5"
            style={{ background: badge.bg, color: badge.fg }}
          >
            {lang === "es" ? MODE_BADGE_ES[message.mode!] : badge.label}
          </span>
        )}

        <p className="whitespace-pre-line leading-relaxed">{summary}</p>
        {detail && (
          <>
            {expanded && <p className="whitespace-pre-line leading-relaxed mt-1.5">{detail}</p>}
            <button onClick={() => setExpanded((v) => !v)} className="text-xs font-medium mt-1.5" style={{ color: "var(--brand)" }}>
              {expanded ? (lang === "es" ? "Mostrar menos" : "Show less") : lang === "es" ? "Mostrar detalles completos" : "Show full policy detail"}
            </button>
          </>
        )}

        {(message.sourceLabel || message.effectiveDate) && (
          <p className="text-[11px] text-neutral-400 mt-2">
            {message.sourceLabel}
            {message.sourceLabel && message.effectiveDate ? " · " : ""}
            {message.effectiveDate ? `Effective ${message.effectiveDate}` : ""}
          </p>
        )}

        {message.clarify && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {message.clarify.options.map((opt) => (
              <button
                key={opt}
                onClick={() => onClarifyPick(message.clarify!.recordId, opt)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border hover:bg-neutral-50"
                style={{ borderColor: "var(--brand)", color: "var(--brand-dark)" }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {message.ctaLabel && (
          <div className="mt-2.5">
            {message.ctaConfirmed ? (
              <p className="text-xs font-medium" style={{ color: "var(--brand-dark)" }}>
                ✓ {lang === "es" ? "Solicitud enviada — te confirmaremos pronto." : "Request noted — we'll confirm shortly."}
              </p>
            ) : (
              <button
                onClick={() => onCta(message.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
                style={{ background: "var(--brand)" }}
              >
                {message.ctaLabel}
              </button>
            )}
          </div>
        )}

        {message.mode === "handoff" && (
          <div className="mt-2.5">
            {message.messageStaffConfirmed ? (
              <p className="text-xs font-medium" style={{ color: "var(--rose)" }}>
                ✓ {lang === "es" ? `Mensaje enviado a ${CENTER.director}.` : `Message sent to ${CENTER.director}.`}
              </p>
            ) : (
              <button
                onClick={() => onMessageStaff(message.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                style={{ borderColor: "var(--rose)", color: "var(--rose)" }}
              >
                {lang === "es" ? "Enviar mensaje al personal" : "Message staff"}
              </button>
            )}
          </div>
        )}

        {message.entryId && (message.mode === "policy" || message.mode === "handoff") && (
          <FeedbackPrompt lang={lang} onSubmit={(fb, text) => onFeedback(message.entryId!, fb, text)} />
        )}
      </div>
    </div>
  );
}
