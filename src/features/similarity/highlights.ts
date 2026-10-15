import type { HighlightEvidence, SharedConcept } from "./types";

export function similarityHighlightPhrases(
  evidence: readonly HighlightEvidence[] | undefined,
  concepts: readonly SharedConcept[],
  field: HighlightEvidence["field"],
  optionIndex?: number,
): string[] {
  if (!evidence) return field === "question" ? concepts.map(concept => concept.canonicalName) : [];
  return [...new Set(evidence.filter(highlight =>
    highlight.field === field &&
    (field !== "option" || highlight.option_index === optionIndex)
  ).map(highlight => highlight.exact_text))];
}

export const normalizeSimilarityNoun = (token: string) => {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (
    token.endsWith("s")
    && token.length > 4
    && !token.endsWith("ss")
    && !token.endsWith("ics")
    && !token.endsWith("is")
    && !token.endsWith("us")
  ) {
    return token.slice(0, -1);
  }
  return token;
};

export function highlightSimilarityTerms(
  html: string,
  tokens: ReadonlySet<string>,
  tone: "indigo" | "blue" | "violet",
  phrases: readonly string[] = [],
) {
  const className = tone === "violet"
    ? "rounded-sm border-b border-violet-400/60 bg-gradient-to-br from-[#080312] via-[#2E1065] to-[#17092E] bg-clip-text px-0.5 font-semibold text-transparent [text-shadow:0_0_6px_rgba(139,92,246,0.4),0_0_16px_rgba(124,58,237,0.25)] dark:from-violet-200 dark:via-violet-100 dark:to-violet-300 dark:[text-shadow:0_0_6px_rgba(196,181,253,0.5),0_0_14px_rgba(167,139,250,0.6),0_0_28px_rgba(139,92,246,0.4)]"
    : tone === "blue"
    ? "rounded-md border-b-2 border-blue-400 bg-blue-100 px-1 font-semibold text-blue-900 dark:bg-blue-500/25 dark:text-blue-100"
    : "rounded-md border-b-2 border-indigo-400 bg-indigo-100 px-1 font-semibold text-indigo-900 dark:bg-indigo-500/25 dark:text-indigo-100";
  const phrasePatterns = [...new Set(phrases.map(phrase => phrase.trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .map(phrase => phrase.split(/\s+/)
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(?:\\s|&nbsp;)+"));
  const phrasePattern = phrasePatterns.length
    ? `(?<![a-z0-9])(?:${phrasePatterns.join("|")})(?![a-z0-9])`
    : null;
  const matchPattern = new RegExp([
    "&(?:#\\d+|#x[0-9a-f]+|[a-z]+);",
    ...(phrasePattern ? [phrasePattern] : []),
    "[a-z0-9]+",
  ].join("|"), "gi");
  const isPhrase = phrasePattern ? new RegExp(`^(?:${phrasePattern})$`, "i") : null;

  return html.split(/(<[^>]*>)/g).map(part => part.startsWith("<") ? part
    : part.replace(matchPattern, value => {
      if (value.startsWith("&")) return value;
      return isPhrase?.test(value) || tokens.has(normalizeSimilarityNoun(value.toLowerCase()))
        ? `<mark class="${className}">${value}</mark>`
        : value;
    })).join("");
}
