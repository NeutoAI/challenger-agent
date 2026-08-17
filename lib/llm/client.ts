"use client";

import { FALLBACK_TEXT } from "@/lib/constants";
import type { GroundingData } from "@/lib/llm/systemPrompt";
import type { AnswerResult, Segment } from "@/lib/types";

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
}

function networkFallback(): AnswerResult {
  return {
    mode: "handoff",
    text: FALLBACK_TEXT,
    needsAttention: true,
    attentionReason: "unmatched",
  };
}

/** Sends the full conversation thread plus the current browser-held knowledge base state
 * to the server route, which is the only place the LLM API key can live. Stateless per call —
 * there's no server-side session, so every request re-sends the grounding data. */
export async function askLLM(messages: ThreadMessage[], segment: Segment, lang: "en" | "es", grounding: GroundingData): Promise<AnswerResult> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, segment, lang, ...grounding }),
    });
    if (!res.ok) return networkFallback();
    return (await res.json()) as AnswerResult;
  } catch {
    return networkFallback();
  }
}
