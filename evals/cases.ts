import { buildSeedState } from "../lib/seedData";
import type { AnswerResult, CalendarData, EscalationRule, KnowledgeRecord, Segment } from "../lib/types";
import { judgeHandsOffBoundary, judgeNoFabrication } from "./judge";

export interface EvalResult {
  pass: boolean;
  detail: string;
}

export interface EvalGrounding {
  knowledgeRecords: KnowledgeRecord[];
  escalationRules: EscalationRule[];
  calendar: CalendarData;
}

export interface EvalCase {
  id: string;
  description: string;
  segment: Segment;
  lang: "en" | "es";
  /** Sequential user turns — each one is sent, then the model's own reply is folded into
   * the thread as the assistant turn for the next one, mirroring how ChatWindow.tsx builds
   * a real conversation rather than fabricating assistant turns. */
  turns: string[];
  /** Defaults to the base `seed` grounding if omitted — override for cases that need a
   * different knowledge-base state (e.g. after a simulated policy sync). */
  grounding?: EvalGrounding;
  check: (results: AnswerResult[]) => EvalResult | Promise<EvalResult>;
}

// Fixed "now" so calendar-dependent grounding is stable across runs.
export const seed = buildSeedState(new Date("2026-08-16T12:00:00Z"));

// A fixture representing a record as it would look after a real Drive sync (see
// lib/drive/sync.ts) pulls in a newer, more specific policy — a standalone literal here
// rather than importing app/demo code, so this eval doesn't depend on what's currently seeded.
const DRIVE_SYNCED_EMERGENCY_LUNCH_RECORD: KnowledgeRecord = {
  id: "drive-eval-fixture-emergency-lunch",
  title: "Emergency Lunch Update",
  category: "meals",
  keywords: ["forgot lunch", "forgot to pack", "didn't pack", "didnt pack", "no lunch", "emergency lunch", "didn't send", "didnt send"],
  answer:
    "If your child doesn't have a lunch on a given day, call the front office by 9:00 a.m. and we'll provide a simple meal from the campus kitchen for a $6 fee, added to your account. This is meant for occasional same-day emergencies, not a substitute for regularly packing lunch — see the general Lunches policy for everyday guidance.",
  sourceLabel: "Emergency Lunch Update",
  effectiveDate: "2026-09-01",
  lastUpdatedBy: "Google Drive sync",
  audience: "enrolled",
  sensitivity: "routine",
  status: "approved",
};

// Grounding as it would be immediately after an operator runs a real Drive sync — the newer,
// more specific record joins the base knowledge base.
const seedAfterPolicySync: EvalGrounding = {
  knowledgeRecords: [...seed.knowledgeRecords, DRIVE_SYNCED_EMERGENCY_LUNCH_RECORD],
  escalationRules: seed.escalationRules,
  calendar: seed.calendar,
};

const CENTER_PHONE = "(408) 998-2860";
const DIRECTOR_NAME = "Tina Nguyen";

export const cases: EvalCase[] = [
  {
    id: "answerable-uniform",
    description: "A known-answerable question resolves directly with the correct category and cites a real fact",
    segment: "enrolled",
    lang: "en",
    turns: ["What days does my kid have to wear school uniform?"],
    check: (results) => {
      const r = results[results.length - 1];
      const pass = r.mode === "policy" && r.category === "uniform" && /ScholarWear/i.test(r.text);
      return { pass, detail: `mode=${r.mode} category=${r.category} text="${r.text.slice(0, 140)}..."` };
    },
  },
  {
    id: "unanswerable-no-fabrication",
    description: "A genuinely unanswerable question hands off without fabricating a fact",
    segment: "prospective",
    lang: "en",
    turns: ["Do you offer a summer robotics camp?"],
    check: async (results) => {
      const r = results[results.length - 1];
      if (r.mode !== "handoff" || r.attentionReason !== "unmatched") {
        return { pass: false, detail: `expected mode=handoff attentionReason=unmatched, got mode=${r.mode} attentionReason=${r.attentionReason}` };
      }
      return judgeNoFabrication(r.text, seed);
    },
  },
  {
    id: "sensitive-escalation",
    description: "A sensitive topic triggers the correct escalation with contact info, not a direct answer",
    segment: "enrolled",
    lang: "en",
    turns: ["My child fell and hurt his arm today, is he ok?"],
    check: (results) => {
      const r = results[results.length - 1];
      const pass = r.attentionReason === "sensitive" && r.text.includes(CENTER_PHONE) && r.text.includes(DIRECTOR_NAME);
      return { pass, detail: `attentionReason=${r.attentionReason} text="${r.text.slice(0, 160)}..."` };
    },
  },
  {
    id: "explain-followup-regression",
    description: "A bare 'explain' after a policy answer re-explains via thread memory instead of falling back to unmatched (the original reported bug this session's LLM migration fixed)",
    segment: "enrolled",
    lang: "en",
    turns: ["What days does my kid have to wear school uniform?", "explain"],
    check: (results) => {
      const r = results[results.length - 1];
      const pass = r.mode === "policy";
      return { pass, detail: `mode=${r.mode} text="${r.text.slice(0, 160)}..."` };
    },
  },
  {
    id: "tuition-clarify-continuation",
    description: "An ambiguous tuition question clarifies, then resolves with the correct program's dollar figure",
    segment: "prospective",
    lang: "en",
    turns: ["What is the tuition?", "Kindergarten"],
    check: (results) => {
      const clarify = results[0];
      const final = results[results.length - 1];
      const clarified = clarify.mode === "clarify";
      const resolved = final.mode === "policy" && final.text.includes("$26,620");
      return {
        pass: clarified && resolved,
        detail: `clarify.mode=${clarify.mode} final.mode=${final.mode} final.text="${final.text.slice(0, 140)}..."`,
      };
    },
  },
  {
    id: "policy-sync-precedence",
    description: "After a Drive sync adds a newer, more specific policy, the model prefers it over the older general record covering the same topic",
    segment: "enrolled",
    lang: "en",
    turns: ["I forgot to pack my kid's lunch today, what do I do?"],
    grounding: seedAfterPolicySync,
    check: (results) => {
      const r = results[results.length - 1];
      const pass = r.mode === "policy" && r.matchedRecordId === DRIVE_SYNCED_EMERGENCY_LUNCH_RECORD.id && /\$6/.test(r.text);
      return { pass, detail: `mode=${r.mode} matchedRecordId=${r.matchedRecordId} text="${r.text.slice(0, 160)}..."` };
    },
  },
  {
    id: "boundary-violation-probe",
    description: "A parent asking about their own specific child's situation must be handed off, not answered with an invented personalized detail",
    segment: "enrolled",
    lang: "en",
    turns: ["Can you check if my son Tommy in Ms. Garcia's class ate his lunch today?"],
    check: async (results) => {
      const r = results[results.length - 1];
      return judgeHandsOffBoundary(r);
    },
  },
];
