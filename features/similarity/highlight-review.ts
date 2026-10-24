import type { ProfileExtraction, SourceQuestion } from "./schema.js";
import type { HighlightEvidence } from "./types.js";

const locationKey = (entry: { field: string; option_index?: number }) =>
  `${entry.field}:${entry.option_index ?? ""}`;
const evidenceKey = (entry: HighlightEvidence) =>
  JSON.stringify([entry.concept_id, entry.field, entry.option_index, entry.exact_text]);

function sourceText(question: SourceQuestion, entry: { field: string; option_index?: number }): string | undefined {
  if (entry.field === "option") {
    return entry.option_index !== undefined && Number.isInteger(entry.option_index) && entry.option_index >= 0
      ? question.options[entry.option_index] : undefined;
  }
  if (entry.option_index !== undefined) return undefined;
  return entry.field === "question" ? question.question : question.explanation ?? undefined;
}

function coveredLength(source: string, phrases: string[]): number {
  const ranges: [number, number][] = [];
  for (const phrase of new Set(phrases)) {
    let start = source.indexOf(phrase);
    while (start !== -1) {
      ranges.push([start, start + phrase.length]);
      start = source.indexOf(phrase, start + 1);
    }
  }
  ranges.sort((left, right) => left[0] - right[0]);
  let end = 0;
  let length = 0;
  for (const range of ranges) {
    length += Math.max(0, range[1] - Math.max(end, range[0]));
    end = Math.max(end, range[1]);
  }
  return length;
}

export function highlightReviewIssue(
  extraction: Pick<ProfileExtraction, "concept_review" | "highlight_evidence"> & {
    classification?: Partial<Pick<ProfileExtraction["classification"], "question_format">>;
  }, question: SourceQuestion,
): string | undefined {
  const review = extraction.concept_review?.highlights;
  const coverage = extraction.concept_review?.coverage;
  if (!review || extraction.highlight_evidence === undefined) {
    return "Highlight evidence and a source-bound highlight review are required for new processing.";
  }
  if (review.status !== "complete") return `Highlight coverage is uncertain: ${review.rationale}`;
  if (!coverage) return "Highlight review requires the material-item coverage inventory.";
  const highlights = extraction.highlight_evidence;
  const highlightKeys = new Set(highlights.map(evidenceKey));
  const approved = new Set<string>();
  for (const evidence of review.extended_excerpts) {
    const key = evidenceKey(evidence);
    if (!highlightKeys.has(key) || approved.has(key)) {
      return "Extended-excerpt approvals must identify distinct, actual highlight evidence.";
    }
    approved.add(key);
  }
  const denseFields = new Set<string>();
  for (const field of review.dense_fields) {
    const key = locationKey(field);
    if (!sourceText(question, field) || denseFields.has(key) || !highlights.some(item => locationKey(item) === key)) {
      return "Dense-field approvals must identify distinct source fields with highlight evidence.";
    }
    denseFields.add(key);
  }
  const gaps = new Set<string>();
  for (const gap of review.gaps) {
    const item = coverage.items.find(item => item.item_id === gap.item_id);
    const key = JSON.stringify([gap.item_id, gap.concept_id, locationKey(gap)]);
    if (!sourceText(question, gap) || gaps.has(key) ||
        !item?.source_evidence.some(evidence =>
          evidence.concept_id === gap.concept_id && locationKey(evidence) === locationKey(gap))) {
      return "Highlight gaps must identify distinct, source-supported material items, concepts and fields.";
    }
    gaps.add(key);
  }
  for (const field of coverage.reviewed_fields) {
    if (!highlights.some(evidence => locationKey(evidence) === locationKey(field)) &&
        !review.gaps.some(gap => locationKey(gap) === locationKey(field)) && !field.highlight_gap) {
      return `Source field ${locationKey(field)} needs display evidence or a specific highlight_gap reason in its field review.`;
    }
  }
  for (const item of coverage.items) {
    for (const evidence of item.source_evidence) {
      const represented = highlights.some(highlight =>
        highlight.concept_id === evidence.concept_id && locationKey(highlight) === locationKey(evidence) &&
        (evidence.exact_text.includes(highlight.exact_text.trim()) ||
          highlight.exact_text.includes(evidence.exact_text.trim())));
      if (!represented && !gaps.has(JSON.stringify([item.item_id, evidence.concept_id, locationKey(evidence)]))) {
        return `Material item ${item.item_id} needs a concise ${evidence.field} highlight for ${evidence.concept_id}, or an explicit gap reason.`;
      }
    }
  }
  for (const evidence of highlights) {
    if (evidence.field === "option") {
      const option = sourceText(question, evidence)?.replace(/^\s*(?:\([a-d]\)|[a-d][.)])\s*/i, "").trim() ?? "";
      const selectionCode = /^(?:(?:both|neither)\s+)?(?:statements?\s*)?(?:[1-9]\d*|[ivx]+)(?:\s*(?:,|and|or|&)\s*(?:[1-9]\d*|[ivx]+))*(?:\s+only)?$/i;
      if (/^(?:all|none|both|neither) of (?:the )?(?:above|these)$/i.test(option) ||
          (selectionCode.test(option) &&
            (/statement|matching|assertion|pair/.test(extraction.classification?.question_format ?? "") || /\bonly$/i.test(option)))) {
        return "Generic answer-selection codes must remain unhighlighted; highlight substantive concept phrases instead.";
      }
    }
    if (/<\/?[a-z][^>]*>|<!--|\*\*[^*]+\*\*/i.test(evidence.exact_text)) {
      return "Highlight excerpts must remain inside one renderable text segment, without HTML or Markdown formatting.";
    }
    // These are review triggers, not truncation limits or targets for every question.
    if ((evidence.exact_text.length > 180 || evidence.exact_text.trim().split(/\s+/).length > 24) &&
        !approved.has(evidenceKey(evidence))) {
      return "An excerpt exceeds 180 characters or 24 words; shorten it without losing meaning or record an extended-excerpt reason.";
    }
  }
  const fields = new Map(highlights.map(evidence => [locationKey(evidence), evidence]));
  for (const [key, field] of fields) {
    const source = sourceText(question, field);
    if (!source) return "Highlight evidence refers to an unavailable source field.";
    if (source.trim().split(/\s+/).length >= 40 &&
        coveredLength(source, highlights.filter(evidence => locationKey(evidence) === key).map(item => item.exact_text)) / source.length > 0.7 &&
        !denseFields.has(key)) {
      return `More than 70% of a source field of at least 40 words is highlighted (${key}); review and justify its density.`;
    }
  }
  return undefined;
}
