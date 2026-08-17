import { FALLBACK_TEXT } from "./constants";
import type { AnswerResult, CalendarData, EscalationRule, KnowledgeRecord, Segment } from "./types";

/** Everything the deterministic engine needs — a subset of FrontDeskState, since this runs
 * server-side in app/api/chat/route.ts from the same grounding data sent for the LLM path
 * (questionLog/announcements aren't needed for answering). */
export interface MatcherGroundingState {
  knowledgeRecords: KnowledgeRecord[];
  escalationRules: EscalationRule[];
  calendar: CalendarData;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchEscalation(query: string, rules: EscalationRule[]): EscalationRule | null {
  const normalized = normalize(query);
  for (const rule of rules) {
    for (const kw of rule.triggerKeywords) {
      if (normalized.includes(normalize(kw))) return rule;
    }
  }
  return null;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function resolveTargetDate(query: string, now: Date): { date: Date; label: string } | null {
  const normalized = normalize(query);

  if (normalized.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return { date: d, label: "tomorrow" };
  }
  if (normalized.includes("today")) {
    return { date: new Date(now), label: "today" };
  }

  for (const day of WEEKDAYS) {
    if (normalized.includes(day)) {
      const target = WEEKDAYS.indexOf(day);
      const d = new Date(now);
      let diff = (target - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7; // "next Monday" style — assume upcoming occurrence, not today
      d.setDate(d.getDate() + diff);
      return { date: d, label: day };
    }
  }
  return null;
}

function closureForDate(calendar: CalendarData, date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const monthDay = `${mm}-${dd}`;
  const y = date.getFullYear();

  for (const closure of calendar.closures) {
    if (closure.recurringAnnually) {
      if (closure.date === monthDay) return closure;
      continue;
    }
    const start = new Date(closure.date + "T00:00:00");
    const end = new Date((closure.endDate ?? closure.date) + "T00:00:00");
    const target = new Date(y, date.getMonth(), date.getDate());
    if (target >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) && target <= new Date(end.getFullYear(), end.getMonth(), end.getDate())) {
      return closure;
    }
  }
  return null;
}

function closureByAlias(query: string, calendar: CalendarData) {
  const normalized = normalize(query);
  for (const closure of calendar.closures) {
    for (const alias of closure.aliases) {
      if (normalized.includes(normalize(alias))) return closure;
    }
  }
  return null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Next occurrence (today or later) of a fixed "MM-DD" date relative to `now`. */
function nextOccurrenceOfMonthDay(monthDay: string, now: Date): Date {
  const [mm, dd] = monthDay.split("-").map(Number);
  const year = now.getFullYear();
  let candidate = new Date(year, mm - 1, dd);
  if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    candidate = new Date(year + 1, mm - 1, dd);
  }
  return candidate;
}

// Common named-date references, resolved independently of whether the school actually
// closes for them — e.g. Challenger doesn't close for Veterans Day, but a parent asking
// "are you open on Veterans Day?" still needs the question recognized as a date question
// so the answer can correctly say "yes, open" rather than falling back to a generic answer.
const NAMED_HOLIDAY_DATES: Record<string, string> = {
  "veterans day": "11-11",
  "veteran's day": "11-11",
  "new year's day": "01-01",
  "new years day": "01-01",
  "independence day": "07-04",
  "fourth of july": "07-04",
  "4th of july": "07-04",
  juneteenth: "06-19",
  christmas: "12-25",
  halloween: "10-31",
};

function namedHolidayDate(query: string, now: Date): Date | null {
  const normalized = normalize(query);
  for (const [alias, monthDay] of Object.entries(NAMED_HOLIDAY_DATES)) {
    if (normalized.includes(normalize(alias))) return nextOccurrenceOfMonthDay(monthDay, now);
  }
  return null;
}

const OPEN_CLOSE_KEYWORDS = ["open", "close", "closed", "closing", "opening", "hours", "school", "daycare"];

function tryCalendarAnswer(query: string, calendar: CalendarData, now: Date): AnswerResult | null {
  const normalized = normalize(query);
  const aliasClosure = closureByAlias(query, calendar);
  const namedDate = namedHolidayDate(query, now);
  // Relative/weekday date references ("today", "tomorrow", "Monday") are ambiguous on their own —
  // e.g. "I forgot to pack lunch today" is not a calendar question — so only resolve them
  // into a calendar answer when paired with an open/closed/hours-style word. A named holiday
  // alias (e.g. "Veterans Day") is unambiguous enough to stand alone.
  const target = OPEN_CLOSE_KEYWORDS.some((kw) => normalized.includes(kw)) ? resolveTargetDate(query, now) : null;

  let checkDate: Date | null = null;

  if (aliasClosure) {
    if (aliasClosure.recurringAnnually) {
      checkDate = nextOccurrenceOfMonthDay(aliasClosure.date, now);
    } else {
      checkDate = new Date(aliasClosure.date + "T00:00:00");
    }
  } else if (namedDate) {
    checkDate = namedDate;
  } else if (target) {
    checkDate = target.date;
  }

  if (!checkDate) return null;

  const closure = closureForDate(calendar, checkDate);
  const dayOfWeek = checkDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const dateStr = formatDate(checkDate);

  let text: string;
  if (closure) {
    text = `We'll be closed on ${dateStr} for ${closure.label}. Regular hours resume the next business day, 7:00 AM – 6:00 PM.`;
  } else if (isWeekend) {
    text = `${dateStr} is a ${dayOfWeek === 0 ? "Sunday" : "Saturday"}, so we're closed that day (we're open Monday–Friday).`;
  } else {
    text = `Yes — we're open on ${dateStr}, 7:00 AM – 6:00 PM. No closures are scheduled for that date.`;
  }

  return {
    mode: "policy",
    text,
    sourceLabel: `Brightwheel Calendar — ${calendar.lastUpdatedBy}`,
    effectiveDate: calendar.effectiveDate,
    category: "hours",
    needsAttention: false,
  };
}

function rawKeywordScore(query: string, record: KnowledgeRecord): number {
  const normalized = normalize(query);
  let score = 0;
  for (const kw of record.keywords) {
    const nkw = normalize(kw);
    if (nkw && normalized.includes(nkw)) {
      score += nkw.split(" ").length;
    }
  }
  return score;
}

function scoreRecord(query: string, record: KnowledgeRecord): number {
  const normalized = normalize(query);
  if (record.excludeKeywords?.some((kw) => normalized.includes(normalize(kw)))) return 0;
  return rawKeywordScore(query, record);
}

/** Best-guess topic for an otherwise-unanswered question, so it still shows up correctly
 * in operator insight clustering even though no record was confident enough to answer from. */
function guessCategory(query: string, records: KnowledgeRecord[]): string | undefined {
  let best: { category: string; score: number } | null = null;
  for (const record of records) {
    const score = rawKeywordScore(query, record);
    if (score > 0 && (!best || score > best.score)) best = { category: record.category, score };
  }
  return best?.category;
}

function findClarifyOption(query: string, record: KnowledgeRecord) {
  if (!record.clarify) return null;
  const normalized = normalize(query);
  let best: { option: (typeof record.clarify.options)[number]; score: number } | null = null;
  for (const option of record.clarify.options) {
    let score = 0;
    for (const kw of option.keywords) {
      if (normalized.includes(normalize(kw))) score += kw.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { option, score };
  }
  return best?.option ?? null;
}

export function resolveClarify(record: KnowledgeRecord, optionLabel: string): AnswerResult {
  const option = record.clarify?.options.find((o) => o.label === optionLabel);
  const append = option?.answerAppend ?? "";
  return {
    mode: "policy",
    text: record.answer.replace("{append}", append),
    sourceLabel: record.sourceLabel,
    effectiveDate: record.effectiveDate,
    matchedRecordId: record.id,
    category: record.category,
    ctaLabel: record.ctaLabel,
    needsAttention: false,
  };
}

/** Deterministic, non-LLM answer engine — the degraded-mode fallback used when Claude is
 * unconfigured or unavailable (see app/api/chat/route.ts). No conversational memory: unlike
 * the LLM path, it scores only the single latest message, so multi-turn follow-ups like a
 * bare "explain" won't resolve here the way they do with the model — an accepted trade-off
 * of degraded mode, not a bug to work around. Still grounded in the same real, operator-
 * published knowledge base, so confirmed answers and safe escalation stay available. */
export function answerQuestion(query: string, segment: Segment, state: MatcherGroundingState, now: Date = new Date()): AnswerResult {
  const escalation = matchEscalation(query, state.escalationRules);
  if (escalation) {
    return {
      mode: "handoff",
      text: escalation.responseText.replace("{contactName}", escalation.contactName),
      matchedRecordId: undefined,
      escalationRuleId: escalation.id,
      category: "escalation",
      needsAttention: true,
      attentionReason: "sensitive",
    };
  }

  const calendarAnswer = tryCalendarAnswer(query, state.calendar, now);
  if (calendarAnswer) return calendarAnswer;

  const approved = state.knowledgeRecords.filter((r) => r.status === "approved");
  let best: { record: KnowledgeRecord; score: number } | null = null;
  for (const record of approved) {
    const score = scoreRecord(query, record);
    if (score > 0 && (!best || score > best.score)) best = { record, score };
  }

  if (!best) {
    return {
      mode: "handoff",
      text: FALLBACK_TEXT,
      category: guessCategory(query, approved),
      needsAttention: true,
      attentionReason: "unmatched",
    };
  }

  const { record } = best;

  if (record.clarify) {
    const option = findClarifyOption(query, record);
    if (option) {
      return resolveClarify(record, option.label);
    }
    return {
      mode: "clarify",
      text: record.clarify.question,
      matchedRecordId: record.id,
      category: record.category,
      needsAttention: false,
      clarify: {
        recordId: record.id,
        question: record.clarify.question,
        options: record.clarify.options.map((o) => o.label),
      },
    };
  }

  return {
    mode: "policy",
    text: record.answer,
    sourceLabel: record.sourceLabel,
    effectiveDate: record.effectiveDate,
    matchedRecordId: record.id,
    category: record.category,
    ctaLabel: record.ctaLabel,
    needsAttention: false,
  };
}

