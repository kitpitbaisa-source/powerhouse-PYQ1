import { z } from "zod";
import { sourceContainers } from "../../../features/similarity/config";
import { highlightEvidenceSchema } from "../../../features/similarity/schema";
import type { MainsQuestion, Question } from "../../types";
import type { QuestionReference, SimilarityMatch, SimilarityQuestionContent, SimilarityResponse } from "./types";

const referenceSchema = z.object({
  sourceContainer: z.enum(sourceContainers),
  questionId: z.string().min(1),
});
const questionFields = referenceSchema.extend({
  id: z.string().min(1), question: z.string().min(1),
  exam: z.string(), year: z.string(), subject: z.string(), topic: z.string().nullable(),
});
const questionSchema = z.discriminatedUnion("kind", [
  questionFields.extend({
    kind: z.literal("objective"), options: z.array(z.string()),
    answer: z.string().nullable(), explanation: z.string().nullable(),
  }),
  questionFields.extend({
    kind: z.literal("descriptive"), paper: z.string().nullable(), modelAnswer: z.string().nullable(),
  }),
]).refine(question => {
  const descriptive = question.sourceContainer === "mains-questions" || question.sourceContainer === "essay-questions";
  return question.id === question.questionId && (question.kind === "descriptive") === descriptive;
}).transform((question): SimilarityQuestionContent => {
  const common = {
    sourceContainer: question.sourceContainer, questionId: question.questionId,
    id: question.id, question: question.question, exam: question.exam,
    year: question.year, subject: question.subject, topic: question.topic,
  };
  return question.kind === "objective"
    ? { ...common, kind: "objective", options: question.options, answer: question.answer, explanation: question.explanation }
    : { ...common, kind: "descriptive", paper: question.paper, modelAnswer: question.modelAnswer };
});
const matchSchema = referenceSchema.extend({
  profileId: z.string().min(1), score: z.number().finite().min(0).max(100),
  relation: z.enum(["same_concept", "related_concept", "partial_concept_overlap", "similar_question_pattern"]),
  reasons: z.array(z.string()),
  sharedConcepts: z.array(z.object({ conceptId: z.string(), canonicalName: z.string() })),
  highlights: z.array(highlightEvidenceSchema).optional(),
  question: questionSchema,
}).refine(match => match.profileId === `${match.sourceContainer}:${match.questionId}` &&
  match.sourceContainer === match.question.sourceContainer && match.questionId === match.question.questionId)
  .transform((match): SimilarityMatch => ({
    ...match, profileId: `${match.sourceContainer}:${match.questionId}`, question: match.question,
  }));
const responseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"), source: referenceSchema,
    rankingVersion: z.string().min(1), matches: z.array(matchSchema),
    sourceHighlights: z.array(highlightEvidenceSchema).optional(),
  }),
  z.object({
    status: z.enum(["pending", "stale", "failed"]), source: referenceSchema,
    message: z.string().min(1), matches: z.tuple([]),
  }),
]);

export function similarityRequestKey(reference: QuestionReference, email?: string | null): string {
  return JSON.stringify([reference.sourceContainer, reference.questionId, email?.trim().toLowerCase() || null]);
}

export function createSimilarityLoader(fetcher: typeof fetch = fetch) {
  const requests = new Map<string, Promise<SimilarityResponse>>();
  return (reference: QuestionReference, email?: string | null): Promise<SimilarityResponse> => {
    const key = similarityRequestKey(reference, email);
    const existing = requests.get(key);
    if (existing) return existing;
    const request = (async (): Promise<SimilarityResponse> => {
      const params = new URLSearchParams({ sourceContainer: reference.sourceContainer, questionId: reference.questionId });
      if (email?.trim()) params.set("email", email.trim().toLowerCase());
      const response = await fetcher(`/api/similarity?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load similar questions (HTTP ${response.status}).`);
      const result = responseSchema.parse(await response.json());
      if (result.source.sourceContainer !== reference.sourceContainer || result.source.questionId !== reference.questionId) {
        throw new Error("Similarity response does not match the selected question.");
      }
      return result.status === "ready"
        ? { ...result, matches: [...result.matches].sort((left, right) => right.score - left.score) }
        : { ...result, matches: [] };
    })();
    requests.set(key, request);
    return request;
  };
}

export function toDisplayQuestion(content: SimilarityQuestionContent): Question | MainsQuestion {
  const common = {
    question: content.question, sourceContainer: content.sourceContainer,
    exam: content.exam, year: content.year, subject: content.subject, topic: content.topic ?? undefined,
  };
  if (content.kind === "descriptive") {
    return { ...common, id: content.id, paper: content.paper ?? undefined, modelAnswer: content.modelAnswer ?? undefined };
  }
  const id = Number(content.id);
  if (!Number.isSafeInteger(id) || String(id) !== content.id) {
    throw new Error("The similar objective question has an unsupported question ID.");
  }
  return { ...common, id, options: content.options, answer: content.answer ?? "", explanation: content.explanation ?? "" };
}
