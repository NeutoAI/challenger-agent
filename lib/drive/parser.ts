import type { Audience, KnowledgeRecord } from "@/lib/types";

const CATEGORY_VALUES: KnowledgeRecord["category"][] = [
  "hours",
  "tuition",
  "tours",
  "illness",
  "medication",
  "meals",
  "pickup",
  "weather",
  "uniform",
];
const AUDIENCE_VALUES: Audience[] = ["prospective", "enrolled", "all"];

export interface ParsedPolicyDoc {
  title: string;
  category: KnowledgeRecord["category"];
  effectiveDate: string;
  audience: Audience;
  status: "approved" | "draft";
  answer: string;
}

export type ParseResult = { ok: true; doc: ParsedPolicyDoc } | { ok: false; reason: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses the front-matter block described in the plan: a `key: value` block terminated by
 * a line containing only `---`, followed by the policy body verbatim. An optional leading
 * `---` line (standard Jekyll/Hugo-style front matter) is also accepted — only the trailing
 * separator that ends the block is required. Deliberately hand-rolled rather than pulling in
 * a YAML library — the format here is flat key/value pairs, not general YAML, so a full parser
 * would be more surface area than the format needs. */
export function parsePolicyDoc(text: string, fileName: string): ParseResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const fieldsStart = lines[0]?.trim() === "---" ? 1 : 0;
  const relativeSeparatorIdx = lines.slice(fieldsStart).findIndex((line) => line.trim() === "---");
  if (relativeSeparatorIdx === -1) {
    return { ok: false, reason: `${fileName}: missing "---" front-matter separator` };
  }
  const separatorIdx = fieldsStart + relativeSeparatorIdx;

  const fields: Record<string, string> = {};
  for (const line of lines.slice(fieldsStart, separatorIdx)) {
    const match = line.match(/^([a-zA-Z]+)\s*:\s*(.+)$/);
    if (!match) continue;
    // Values may optionally be wrapped in quotes (e.g. `title: "Some Title"`) — strip a
    // matching pair so both quoted and bare values parse to the same result.
    const raw = match[2].trim();
    const unquoted = /^"(.*)"$/.test(raw) || /^'(.*)'$/.test(raw) ? raw.slice(1, -1) : raw;
    fields[match[1].toLowerCase()] = unquoted;
  }

  const { title, category, effectivedate, audience, status } = fields;

  if (!title) return { ok: false, reason: `${fileName}: missing "title"` };
  if (!category) return { ok: false, reason: `${fileName}: missing "category"` };
  if (!CATEGORY_VALUES.includes(category as KnowledgeRecord["category"])) {
    return { ok: false, reason: `${fileName}: category "${category}" is not one of ${CATEGORY_VALUES.join(", ")}` };
  }
  if (!effectivedate) return { ok: false, reason: `${fileName}: missing "effectiveDate"` };
  if (!DATE_RE.test(effectivedate) || Number.isNaN(new Date(effectivedate + "T00:00:00").getTime())) {
    return { ok: false, reason: `${fileName}: effectiveDate "${effectivedate}" is not a valid YYYY-MM-DD date` };
  }
  if (!audience) return { ok: false, reason: `${fileName}: missing "audience"` };
  if (!AUDIENCE_VALUES.includes(audience as Audience)) {
    return { ok: false, reason: `${fileName}: audience "${audience}" is not one of ${AUDIENCE_VALUES.join(", ")}` };
  }
  if (status !== "approved" && status !== "draft") {
    return { ok: false, reason: `${fileName}: status "${status}" is not "approved" or "draft"` };
  }

  const answer = lines
    .slice(separatorIdx + 1)
    .join("\n")
    .trim();
  if (!answer) return { ok: false, reason: `${fileName}: no policy body text after the "---" separator` };

  return {
    ok: true,
    doc: {
      title,
      category: category as KnowledgeRecord["category"],
      effectiveDate: effectivedate,
      audience: audience as Audience,
      status,
      answer,
    },
  };
}
