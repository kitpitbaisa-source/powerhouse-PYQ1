import type { QuestionReference } from "./types.js";

export const similarityAllTag = "similarity";
// Edge caches hold one result per question; entries live until an admin purges their tags.
export const similarityCdnCacheControl = "public, max-age=31536000";

export function similarityTag(reference: QuestionReference): string {
  return `sim-${reference.sourceContainer}-${reference.questionId.replace(/,/g, "_")}`;
}

export function similarityPurgeTags(source: QuestionReference, matches: readonly QuestionReference[]): string[] {
  return [...new Set([similarityTag(source), ...matches.map(similarityTag)])];
}

export function similarityCacheTags(source: QuestionReference, matches: readonly QuestionReference[]): string[] {
  return [similarityAllTag, ...similarityPurgeTags(source, matches)];
}
