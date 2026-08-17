const STOPWORDS = new Set([
  "the","a","an","is","are","can","my","i","to","for","of","and","do","does","you","what",
  "how","it","on","in","will","be","we","please","with","has","have","today","that","this",
]);

/** Best-effort keyword extraction for the deterministic matcher (lib/matcher.ts) — used
 * whenever a KnowledgeRecord is created without hand-picked keywords, whether by an operator
 * publishing from the Attention Queue or by a Drive-synced document (lib/drive/sync.ts). */
export function suggestKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return [...new Set(words)].slice(0, 6);
}
