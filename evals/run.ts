import { config as loadEnv } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

// Next.js reads .env.local automatically; plain dotenv defaults to .env, so point it
// explicitly at the same file the app itself uses.
loadEnv({ path: ".env.local" });
import { buildSystemPrompt } from "../lib/llm/systemPrompt";
import { RESPOND_TOOL_NAME, respondToParentTool } from "../lib/llm/schema";
import type { AnswerResult, Segment } from "../lib/types";
import { cases, seed, type EvalGrounding } from "./cases";

const anthropic = new Anthropic();

interface Turn {
  role: "user" | "assistant";
  content: string;
}

/** Mirrors app/api/chat/route.ts's model call exactly (same system prompt builder, same
 * forced tool-use schema) so an eval failure reflects real production behavior, not a
 * reimplementation that could silently drift from it. Throws on failure rather than
 * returning a safe fallback — an eval run needs to know the call itself broke, not have
 * that masked. */
async function callModel(thread: Turn[], segment: Segment, lang: "en" | "es", grounding: EvalGrounding): Promise<AnswerResult> {
  const systemPrompt = buildSystemPrompt(
    { centerName: seed.centerName, knowledgeRecords: grounding.knowledgeRecords, escalationRules: grounding.escalationRules, calendar: grounding.calendar },
    segment,
    lang,
    new Date("2026-08-16T12:00:00Z")
  );

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: thread,
    tools: [respondToParentTool],
    tool_choice: { type: "tool", name: RESPOND_TOOL_NAME },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("model did not return a tool_use block");
  }

  const input = toolUse.input as Partial<AnswerResult>;
  if (!input.mode || !input.text) {
    throw new Error("tool_use input missing mode/text");
  }

  return {
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
}

async function runCase(c: (typeof cases)[number]) {
  const grounding = c.grounding ?? seed;
  const thread: Turn[] = [];
  const results: AnswerResult[] = [];
  for (const turn of c.turns) {
    thread.push({ role: "user", content: turn });
    const result = await callModel(thread, c.segment, c.lang, grounding);
    results.push(result);
    thread.push({ role: "assistant", content: result.text });
  }
  return c.check(results);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set — add it to .env.local before running evals.");
    process.exit(1);
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  console.log(`Running ${cases.length} eval cases against ${model}...\n`);

  let passCount = 0;
  for (const c of cases) {
    process.stdout.write(`  ${c.id} ... `);
    try {
      const { pass, detail } = await runCase(c);
      console.log(pass ? "PASS" : "FAIL");
      console.log(`    ${detail}`);
      if (pass) passCount++;
    } catch (err) {
      console.log("ERROR");
      console.log(`    ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${passCount}/${cases.length} passed.`);
  process.exit(passCount === cases.length ? 0 : 1);
}

main();
