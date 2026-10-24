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

export type SimilarityHighlightTone = "indigo" | "blue" | "violet" | "amber" | "emerald" | "rose";

export function highlightSimilarityTerms(
  html: string,
  tokens: ReadonlySet<string>,
  tone: SimilarityHighlightTone,
  phrases: readonly string[] = [],
) {
  const decoration = tone === "violet"
    ? "bg-violet-500/5 decoration-violet-400/80 dark:bg-violet-400/10 dark:decoration-violet-300/80"
    : tone === "amber"
    ? "bg-amber-400/20 decoration-amber-500/90 dark:bg-amber-400/15 dark:decoration-amber-300/80"
    : tone === "emerald"
    ? "bg-emerald-500/10 decoration-emerald-500/80 dark:bg-emerald-400/10 dark:decoration-emerald-300/80"
    : tone === "rose"
    ? "bg-rose-500/10 decoration-rose-500/80 dark:bg-rose-400/10 dark:decoration-rose-300/80"
    : tone === "blue"
    ? "bg-blue-500/5 decoration-blue-400/80 dark:bg-blue-400/10 dark:decoration-blue-300/80"
    : "bg-indigo-500/5 decoration-indigo-400/80 dark:bg-indigo-400/10 dark:decoration-indigo-300/80";
  const className = `text-inherit underline decoration-2 underline-offset-4 ${decoration}`;
  const phrasePatterns = [...new Set(phrases.map(phrase => phrase.trim()).filter(Boolean))]
    .map(phrase => phrase.split(/\s+/)
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("(?:\\s|&nbsp;|&#0*160;|&#x0*a0;)+"))
    .map(pattern => new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, "giu"));

  return html.split(/(<!--[\s\S]*?-->|<\/?[a-z](?:[^"'<>]|"[^"]*"|'[^']*')*>)/gi).map((part, index) => {
    if (index % 2) return part;
    const entities = [...part.matchAll(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi)]
      .map(match => [match.index, match.index + match[0].length]);
    const ranges: [number, number][] = [];
    for (const pattern of phrasePatterns) {
      // Look from every start so partially overlapping phrases retain their full coverage.
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(part))) {
        const start = match.index;
        const end = start + match[0].length;
        if (!entities.some(([left, right]) =>
          (start > left && start < right) || (end > left && end < right))) {
          ranges.push([start, end]);
        }
        pattern.lastIndex = start + (part.codePointAt(start)! > 0xffff ? 2 : 1);
      }
    }
    if (tokens.size) {
      for (const match of part.matchAll(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);|[a-z0-9]+/gi)) {
        if (!match[0].startsWith("&") && tokens.has(normalizeSimilarityNoun(match[0].toLowerCase()))) {
          ranges.push([match.index, match.index + match[0].length]);
        }
      }
    }
    ranges.sort((left, right) => left[0] - right[0]);
    const merged: [number, number][] = [];
    for (const range of ranges) {
      const previous = merged[merged.length - 1];
      if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
      else merged.push([...range]);
    }
    let result = "";
    let offset = 0;
    for (const [start, end] of merged) {
      result += `${part.slice(offset, start)}<mark class="${className}">${part.slice(start, end)}</mark>`;
      offset = end;
    }
    return result + part.slice(offset);
  }).join("");
}
