export type Audience = "prospective" | "enrolled" | "all";
export type Sensitivity = "routine" | "policy-guidance" | "human-required";
export type RecordStatus = "approved" | "draft";
export type ResponseMode = "policy" | "clarify" | "handoff";
export type Segment = "prospective" | "enrolled" | "unspecified";

export interface ClarifyOption {
  label: string;
  keywords: string[];
  answerAppend: string;
}

export interface KnowledgeRecord {
  id: string;
  title: string;
  category:
    | "hours"
    | "tuition"
    | "tours"
    | "illness"
    | "medication"
    | "meals"
    | "pickup"
    | "weather"
    | "uniform";
  keywords: string[];
  /** If any of these phrases appear in the query, this record is treated as not matching —
   * used to keep an intentional knowledge gap (e.g. a general policy that doesn't cover a
   * specific same-day exception) from swallowing questions it can't actually answer. */
  excludeKeywords?: string[];
  answer: string;
  sourceLabel: string;
  effectiveDate: string; // ISO date
  lastUpdatedBy: string;
  audience: Audience;
  sensitivity: Sensitivity;
  status: RecordStatus;
  clarify?: {
    question: string;
    options: ClarifyOption[];
  };
  ctaLabel?: string;
}

export interface EscalationRule {
  id: string;
  label: string;
  triggerKeywords: string[];
  responseText: string;
  contactName: string;
  contactRole: string;
}

export interface ClosureEntry {
  id: string;
  label: string;
  aliases: string[];
  date: string; // "MM-DD" if recurringAnnually, else "YYYY-MM-DD"
  endDate?: string; // for multi-day ranges, same format as date
  recurringAnnually: boolean;
}

export interface CalendarData {
  hours: { day: string; open: string; close: string }[];
  closures: ClosureEntry[];
  lastUpdatedBy: string;
  effectiveDate: string;
}

export interface QuestionLogEntry {
  id: string;
  text: string;
  /** Exact text shown to the parent for this turn — stored verbatim since LLM-generated
   * answers aren't deterministically reconstructible from a static knowledge record match. */
  answerText: string;
  timestamp: string; // ISO datetime
  segment: Segment;
  mode: ResponseMode;
  category?: string;
  matchedRecordId?: string;
  escalationRuleId?: string;
  needsAttention: boolean;
  attentionReason?: "unmatched" | "sensitive";
  attentionResolved: boolean;
  feedback?: "up" | "down" | null;
  feedbackText?: string;
}

export interface Announcement {
  id: string;
  text: string;
  audience: Audience;
  timestamp: string;
  relatedRecordId?: string;
}

export interface FrontDeskState {
  centerName: string;
  knowledgeRecords: KnowledgeRecord[];
  escalationRules: EscalationRule[];
  calendar: CalendarData;
  questionLog: QuestionLogEntry[];
  announcements: Announcement[];
  /** Signature of the built-in seed content (record/rule ids) at save time — used to detect
   * when new seed records have shipped in an app update so they can be merged into a
   * browser's existing saved state without discarding operator edits or demo history. */
  seedVersion?: string;
  /** ISO timestamp of the last simulated Google Drive policy sync, or null if never synced.
   * See components/operator/PolicySourceCard.tsx — this app doesn't integrate with Drive for
   * real, but demonstrates the intended product behavior: operators drop an approved policy
   * document into a Drive folder, the app ingests it and prioritizes it by effective date. */
  lastPolicySyncAt: string | null;
}

export interface AnswerResult {
  mode: ResponseMode;
  text: string;
  entryId?: string;
  sourceLabel?: string;
  effectiveDate?: string;
  matchedRecordId?: string;
  escalationRuleId?: string;
  category?: string;
  ctaLabel?: string;
  needsAttention: boolean;
  attentionReason?: "unmatched" | "sensitive";
  clarify?: {
    recordId: string;
    question: string;
    options: string[];
  };
}
