import type { ResponseMode } from "@/lib/types";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  mode?: ResponseMode;
  sourceLabel?: string;
  effectiveDate?: string;
  matchedRecordId?: string;
  category?: string;
  ctaLabel?: string;
  ctaConfirmed?: boolean;
  messageStaffConfirmed?: boolean;
  clarify?: { recordId: string; options: string[] };
  entryId?: string;
  feedbackGiven?: "up" | "down" | null;
}
