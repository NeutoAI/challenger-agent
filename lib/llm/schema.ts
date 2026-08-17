import type Anthropic from "@anthropic-ai/sdk";

export const RESPOND_TOOL_NAME = "respond_to_parent";

export const respondToParentTool: Anthropic.Tool = {
  name: RESPOND_TOOL_NAME,
  description: "Respond to the parent's message. Always call this — never reply in plain text.",
  input_schema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["policy", "clarify", "handoff"] },
      text: { type: "string", description: "Exact message to show the parent, in the requested language." },
      sourceLabel: { type: "string", description: "Set when mode=policy and grounded in a specific knowledge record or the calendar; omit otherwise." },
      effectiveDate: { type: "string", description: "Paired with sourceLabel." },
      matchedRecordId: { type: "string", description: "id of the grounding knowledge record, if any." },
      category: { type: "string", description: "Matched record's category, or best-guess topic if unmatched." },
      ctaLabel: { type: "string", description: "Copy verbatim from the matched record's ctaLabel if present." },
      clarify: {
        type: "object",
        description: "Required when mode=clarify; omit otherwise.",
        properties: {
          recordId: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["recordId", "question", "options"],
      },
      needsAttention: { type: "boolean" },
      attentionReason: { type: "string", enum: ["unmatched", "sensitive"], description: "Required when needsAttention=true." },
    },
    required: ["mode", "text", "needsAttention"],
  },
};
