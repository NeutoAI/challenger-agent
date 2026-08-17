"use client";

import { useEffect, useRef, useState } from "react";
import { useFrontDesk } from "@/lib/store";
import { CENTER } from "@/lib/constants";
import { askLLM, type ThreadMessage } from "@/lib/llm/client";
import { MessageBubble } from "./MessageBubble";
import { QuickReplies, type QuickReply } from "./QuickReplies";
import type { ChatMessage } from "./ChatTypes";
import type { AnswerResult, Segment } from "@/lib/types";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const QUICK_REPLIES: Record<Segment, QuickReply[]> = {
  prospective: [
    { display: "What is the tuition for infants?", query: "What is the tuition for infants?" },
    { display: "How can I schedule a tour?", query: "How can I schedule a tour?" },
    { display: "Are you open on Veterans Day?", query: "Are you open on Veterans Day?" },
  ],
  enrolled: [
    { display: "My child has a fever, can they come in?", query: "My child has a fever, can they come in?" },
    {
      display: "I forgot to pack lunch — can you provide lunch today and what is it?",
      query: "I forgot to pack lunch. Can you provide lunch today and what is it?",
    },
    { display: "What's the late pickup fee?", query: "What's the late pickup fee?" },
    { display: "Are you open on Veterans Day?", query: "Are you open on Veterans Day?" },
  ],
  unspecified: [],
};

const QUICK_REPLIES_ES: Record<Segment, QuickReply[]> = {
  prospective: [
    { display: "¿Cuál es la matrícula para bebés?", query: "What is the tuition for infants?" },
    { display: "¿Cómo agendo un tour?", query: "How can I schedule a tour?" },
    { display: "¿Están abiertos el Día de los Veteranos?", query: "Are you open on Veterans Day?" },
  ],
  enrolled: [
    { display: "Mi hijo tiene fiebre, ¿puede venir?", query: "My child has a fever, can they come in?" },
    { display: "Olvidé el almuerzo — ¿pueden darle uno hoy?", query: "I forgot to pack lunch. Can you provide lunch today and what is it?" },
    { display: "¿Cuál es la tarifa por recogida tardía?", query: "What's the late pickup fee?" },
    { display: "¿Están abiertos el Día de los Veteranos?", query: "Are you open on Veterans Day?" },
  ],
  unspecified: [],
};

function greetingFor(lang: "en" | "es"): ChatMessage {
  const text =
    lang === "es"
      ? `¡Hola! Soy el asistente de recepción de ${CENTER.name}. Pregúntame sobre horarios, matrícula, políticas y más.`
      : `Hi! I'm the front desk assistant for ${CENTER.name}. Ask me about hours, tuition, policies, and more.`;
  return { id: genId(), role: "bot", text };
}

export function ChatWindow({ segment, lang }: { segment: Segment; lang: "en" | "es" }) {
  const { state, logAnswer, submitFeedback } = useFrontDesk();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingFor(lang)]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function pushBotFromResult(result: AnswerResult, entryId?: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: genId(),
        role: "bot",
        text: result.text,
        mode: result.mode,
        sourceLabel: result.sourceLabel,
        effectiveDate: result.effectiveDate,
        matchedRecordId: result.matchedRecordId,
        category: result.category,
        ctaLabel: result.ctaLabel,
        clarify: result.clarify,
        entryId,
      },
    ]);
  }

  async function sendMessage(text: string) {
    const query = text.trim();
    if (!query || loading || !state) return;

    // The Messages API requires the thread to start with a "user" turn, so drop any leading
    // bot messages (e.g. the canned greeting) — the model doesn't need to see it anyway.
    const firstUserIdx = messages.findIndex((m) => m.role === "user");
    const priorTurns = firstUserIdx === -1 ? [] : messages.slice(firstUserIdx);
    const threadSoFar: ThreadMessage[] = priorTurns.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
    setMessages((prev) => [...prev, { id: genId(), role: "user", text: query }]);
    setInput("");
    setLoading(true);

    const result = await askLLM([...threadSoFar, { role: "user", content: query }], segment, lang, {
      centerName: state.centerName,
      knowledgeRecords: state.knowledgeRecords,
      escalationRules: state.escalationRules,
      calendar: state.calendar,
    });

    const entryId = logAnswer(query, segment, result);
    pushBotFromResult(result, entryId);
    setLoading(false);
  }

  function handleSend(text?: string) {
    void sendMessage(text ?? input);
  }

  function handleClarifyPick(_recordId: string, option: string) {
    void sendMessage(option);
  }

  function handleFeedback(entryId: string, feedback: "up" | "down", text?: string) {
    submitFeedback(entryId, feedback, text);
  }

  function handleCta(messageId: string) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ctaConfirmed: true } : m)));
  }

  function handleMessageStaff(messageId: string) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, messageStaffConfirmed: true } : m)));
  }

  const showQuickReplies = messages.length <= 1;
  const replies = (lang === "es" ? QUICK_REPLIES_ES : QUICK_REPLIES)[segment];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            lang={lang}
            onClarifyPick={handleClarifyPick}
            onFeedback={handleFeedback}
            onCta={handleCta}
            onMessageStaff={handleMessageStaff}
          />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm bg-white border" style={{ borderColor: "var(--border)" }}>
              <span className="inline-flex gap-1 text-neutral-400">
                <span className="animate-bounce [animation-delay:-0.3s]">•</span>
                <span className="animate-bounce [animation-delay:-0.15s]">•</span>
                <span className="animate-bounce">•</span>
              </span>
            </div>
          </div>
        )}
        {showQuickReplies && !loading && replies.length > 0 && <QuickReplies replies={replies} onPick={(q) => handleSend(q)} />}
      </div>
      <div className="border-t p-3 flex gap-2" style={{ borderColor: "var(--border)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder={lang === "es" ? "Escribe tu pregunta…" : "Type your question…"}
          className="flex-1 rounded-full border px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "var(--border)" }}
          disabled={loading}
        />
        <button
          onClick={() => handleSend()}
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--brand)" }}
          disabled={loading}
        >
          {lang === "es" ? "Enviar" : "Send"}
        </button>
      </div>
    </div>
  );
}
