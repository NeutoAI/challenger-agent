import Anthropic from "@anthropic-ai/sdk";
import { FALLBACK_TEXT } from "@/lib/constants";
import { answerQuestion } from "@/lib/matcher";
import { RESPOND_TOOL_NAME, respondToParentTool } from "@/lib/llm/schema";
import { buildSystemPrompt, type GroundingData } from "@/lib/llm/systemPrompt";
import type { AnswerResult, Segment } from "@/lib/types";

interface ChatRequestBody extends GroundingData {
  messages: { role: "user" | "assistant"; content: string }[];
  segment: Segment;
  lang: "en" | "es";
}

function safeFallback(): AnswerResult {
  return {
    mode: "handoff",
    text: FALLBACK_TEXT,
    needsAttention: true,
    attentionReason: "unmatched",
  };
}

/** Degraded-mode fallback: the deterministic keyword-matching engine (lib/matcher.ts), used
 * whenever Claude is unconfigured or unavailable. It has no true conversational memory — a
 * bare "explain" follow-up won't resolve the way it does with the model — but stays grounded
 * in the same real, operator-published knowledge base, so confirmed answers and safe
 * escalation remain available without the LLM. Note: unlike the LLM path, it doesn't
 * translate — a Spanish-language session that falls back here gets an English answer; an
 * accepted limitation of degraded mode, not something to build bilingual content around. */
function runDeterministicFallback(body: ChatRequestBody, reason: string): AnswerResult {
  console.warn(`[api/chat] falling back to deterministic engine: ${reason}`);

  // Join the last two user turns, not just the latest one. A clarify-option tap (e.g.
  // "Kindergarten") carries no context on its own — the LLM path handles this via real
  // thread memory, but the deterministic engine needs the prior question ("What is the
  // tuition?") folded back in to re-match the right record and resolve the option, since
  // ChatWindow.tsx no longer tracks which record a clarify prompt came from (that plumbing
  // was removed when the LLM's own memory made it unnecessary for the primary path).
  const userTurns = body.messages.filter((m) => m.role === "user").map((m) => m.content);
  const query = userTurns.slice(-2).join(" ");
  if (!query) return safeFallback();

  return answerQuestion(
    query,
    body.segment,
    { knowledgeRecords: body.knowledgeRecords, escalationRules: body.escalationRules, calendar: body.calendar },
    new Date()
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json(safeFallback(), { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(runDeterministicFallback(body, "ANTHROPIC_API_KEY not set"));
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const systemPrompt = buildSystemPrompt(
      { centerName: body.centerName, knowledgeRecords: body.knowledgeRecords, escalationRules: body.escalationRules, calendar: body.calendar },
      body.segment,
      body.lang,
      new Date()
    );

    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [respondToParentTool],
      tool_choice: { type: "tool", name: RESPOND_TOOL_NAME },
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return Response.json(runDeterministicFallback(body, "model did not return a tool_use block"));
    }

    const input = toolUse.input as Partial<AnswerResult>;
    if (!input.mode || !input.text) {
      return Response.json(runDeterministicFallback(body, "tool_use input missing mode/text"));
    }

    const result: AnswerResult = {
      mode: input.mode,
      text: input.text,
      sourceLabel: input.sourceLabel,
      effectiveDate: input.effectiveDate,
      matchedRecordId: input.matchedRecordId,
      category: input.category,
      ctaLabel: input.ctaLabel,
      clarify: input.clarify,
      needsAttention: input.needsAttention ?? false,
      attentionReason: input.attentionReason,
    };

    return Response.json(result);
  } catch (err) {
    return Response.json(runDeterministicFallback(body, err instanceof Error ? err.message : "unknown error calling Anthropic"));
  }
}
