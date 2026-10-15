import { z } from "zod";
import { sourceContainers } from "./config.js";

const text = z.string().trim().min(1);
const conceptId = text.regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
const confidence = z.number().min(0).max(1);
const strings = z.array(text);
const assignment = z.object({
  concept_id: conceptId,
  canonical_name: text,
  role: z.enum(["primary", "secondary", "prerequisite", "application"]),
  confidence,
});

export const highlightEvidenceSchema = z.object({
  concept_id: conceptId,
  field: z.enum(["question", "option", "explanation"]),
  option_index: z.number().int().nonnegative().optional(),
  exact_text: z.string().min(1).refine(value => value.trim().length > 0, "Highlight text must not be blank."),
});

export const canonicalConceptSchema = z.object({
  id: conceptId,
  canonical_name: text,
  definition: text,
  subject: text,
  topic: text,
  aliases: strings,
  parentConceptIds: z.array(conceptId),
  status: z.enum(["provisional", "active", "retired"]),
  taxonomyVersion: text,
});

export const profileExtractionSchema = z.object({
  classification: z.object({
    subject: text, topic: text, subtopics: strings,
    question_format: text,
    polarity: z.enum(["positive_selection", "negative_selection", "mixed_or_conditional", "not_applicable"]),
    reasoning_type: strings,
    question_intent: text,
  }),
  concept_profile: z.object({
    primary_concepts: z.array(assignment.extend({ role: z.enum(["primary"]) })).min(1),
    secondary_concepts: z.array(assignment.extend({
      role: z.enum(["secondary", "prerequisite", "application"]),
    })),
    underlying_principle: text,
    knowledge_requirements: strings.min(1),
    entities: z.array(z.object({
      entity_id: conceptId, name: text, entity_type: text,
    })),
    relationships: z.array(z.object({
      subject_entity_id: conceptId,
      relationship_type: conceptId,
      object_entity_id: conceptId.nullable(),
      role: z.enum(["tested_relationship", "claimed_relationship", "verified_relationship"]),
    })),
  }),
  claims: z.array(z.object({
    item_id: text,
    item_type: z.enum(["statement", "matching_pair", "assertion", "reason", "option", "other"]),
    normalized_meaning: text,
    concept_ids: z.array(conceptId).min(1),
    entities: z.array(conceptId),
    claimed_relationship: text,
    verified_relationship: text.nullable(),
    truth_status: z.enum(["true", "false", "partially_true", "ambiguous", "unknown"]),
    verification_source: z.enum(["provided_answer", "provided_explanation", "not_provided", "conflicting_sources"]),
    correction_or_verified_fact: text.nullable(),
    confidence,
  })),
  highlight_evidence: z.array(highlightEvidenceSchema).optional(),
  similarity_profile: z.object({
    concept_summary: text,
    matching_cautions: strings,
  }),
  provenance: z.object({
    inputs_used: z.array(z.enum(["question", "options", "provided_answer", "provided_explanation"])),
    answer_status: z.enum(["provided_not_independently_verified", "missing", "conflict_detected"]),
    truth_labels_based_on: z.enum([
      "provided_answer_only", "provided_explanation", "provided_answer_and_explanation",
      "not_provided", "conflicting_sources",
    ]),
    needs_review: z.boolean(),
    review_notes: strings,
  }),
});

export const extractionResponseSchema = profileExtractionSchema.extend({
  concept_definitions: z.array(canonicalConceptSchema.omit({
    status: true, taxonomyVersion: true,
  })).min(1),
});

export type ProfileExtraction = z.infer<typeof profileExtractionSchema>;
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

export const importedExtractionSchema = z.object({
  sourceContainer: z.enum(sourceContainers),
  questionId: text,
  sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  extraction: extractionResponseSchema,
});
export type ImportedExtraction = z.infer<typeof importedExtractionSchema>;

export const extractionBatchSchema = z.object({
  formatVersion: z.enum(["1"]),
  extractionModel: text,
  entries: z.array(importedExtractionSchema).min(1),
}).superRefine((batch, context) => {
  const seen = new Set<string>();
  batch.entries.forEach((entry, index) => {
    const id = `${entry.sourceContainer}:${entry.questionId}`;
    if (seen.has(id)) context.addIssue({ code: "custom", path: ["entries", index], message: `Duplicate imported profile ${id}.` });
    seen.add(id);
  });
});

export const sourceQuestionSchema = z.object({
  id: z.union([text, z.number().int()]).transform(String),
  question: text,
  options: z.array(z.string()).optional(),
  answer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  modelAnswer: z.string().nullable().optional(),
  model_answer: z.string().nullable().optional(),
  exam: z.string().nullable().optional(),
  year: z.union([z.string(), z.number()]).nullable().optional(),
  subject: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  paper: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
}).transform(value => ({
  id: value.id,
  question: value.question,
  options: value.options ?? [],
  answer: value.answer ?? value.modelAnswer ?? value.model_answer ?? null,
  explanation: value.explanation ?? null,
  exam: value.exam ?? null,
  year: value.year == null ? null : String(value.year),
  subject: value.subject ?? null,
  topic: value.topic ?? null,
  paper: value.paper ?? null,
  isActive: value.isActive !== false,
}));

export type SourceQuestion = z.infer<typeof sourceQuestionSchema>;

export const storedProfileSchema = profileExtractionSchema.partial().extend({
  id: text,
  sourceContainer: z.enum(sourceContainers),
  questionId: text,
  schemaVersion: text,
  sourceMetadata: z.object({
    exam: z.string().nullable(), year: z.string().nullable(), paper: z.string().nullable(),
  }),
  concept_embedding_input: z.string(),
  embedding: z.array(z.number()).nullable(),
  processing: z.object({
    status: z.enum(["pending_extraction", "extracting", "pending_embedding", "embedding", "ready", "stale", "failed"]),
    sourceContentHash: text,
    embeddingInputHash: text.nullable(),
    promptVersion: text,
    taxonomyVersion: text,
    extractionModel: text,
    extractionContentHash: text.optional(),
    embeddingModel: text,
    embeddingDimensions: z.number().int().positive(),
    embeddingSpaceVersion: text,
    updatedAt: text,
    error: text.nullable(),
  }),
});

export type StoredProfile = z.infer<typeof storedProfileSchema>;

export function validateExtraction(value: unknown, question: SourceQuestion): ExtractionResponse {
  const result = extractionResponseSchema.parse(value);
  const concepts = [
    ...result.concept_profile.primary_concepts,
    ...result.concept_profile.secondary_concepts,
  ];
  const ids = new Set(concepts.map(concept => concept.concept_id));
  if (ids.size !== concepts.length) throw new Error("Extraction contains duplicate concept assignments.");
  const entities = new Set(result.concept_profile.entities.map(entity => entity.entity_id));
  if (entities.size !== result.concept_profile.entities.length) throw new Error("Duplicate entity IDs.");
  const definitions = new Set(result.concept_definitions.map(concept => concept.id));
  if (definitions.size !== result.concept_definitions.length ||
      definitions.size !== ids.size || [...ids].some(id => !definitions.has(id))) {
    throw new Error("Every assigned concept must have exactly one definition.");
  }
  const highlights = new Set<string>();
  for (const highlight of result.highlight_evidence ?? []) {
    if (!ids.has(highlight.concept_id)) throw new Error("Highlight references an undefined concept.");
    if (highlight.field === "option"
      ? highlight.option_index === undefined || highlight.option_index >= question.options.length
      : highlight.option_index !== undefined) {
      throw new Error("Highlight option_index must identify an existing option and is only allowed for option evidence.");
    }
    const source = highlight.field === "question" ? question.question
      : highlight.field === "option" ? question.options[highlight.option_index] : question.explanation;
    if (!source?.includes(highlight.exact_text)) {
      throw new Error(`Highlight exact_text does not occur in its source ${highlight.field}.`);
    }
    const input = highlight.field === "option" ? "options"
      : highlight.field === "explanation" ? "provided_explanation" : "question";
    if (!result.provenance.inputs_used.includes(input)) {
      throw new Error("Highlight evidence cites an input that was not used.");
    }
    const key = JSON.stringify([highlight.concept_id, highlight.field, highlight.option_index, highlight.exact_text]);
    if (highlights.has(key)) throw new Error("Duplicate highlight evidence.");
    highlights.add(key);
  }
  const items = new Set<string>();
  if (/statement|matching|match_the_following|assertion|pair/.test(result.classification.question_format) &&
      result.claims.length === 0) {
    throw new Error("Statement, matching, and assertion/reason questions require individual claim analyses.");
  }
  for (const claim of result.claims) {
    if (items.has(claim.item_id)) throw new Error(`Duplicate claim item ID: ${claim.item_id}`);
    items.add(claim.item_id);
    if (claim.concept_ids.some(id => !ids.has(id)) || claim.entities.some(id => !entities.has(id))) {
      throw new Error(`Claim ${claim.item_id} references an undefined concept or entity.`);
    }
    if (claim.verification_source === "not_provided" &&
        (claim.truth_status !== "unknown" || claim.verified_relationship !== null ||
         claim.correction_or_verified_fact !== null)) {
      throw new Error(`Claim ${claim.item_id} asserts verification without evidence.`);
    }
    if (claim.verification_source === "provided_answer" && !question.answer) {
      throw new Error(`Claim ${claim.item_id} cites a missing answer.`);
    }
    if (claim.verification_source === "provided_explanation" && !question.explanation) {
      throw new Error(`Claim ${claim.item_id} cites a missing explanation.`);
    }
  }
  for (const relation of result.concept_profile.relationships) {
    if (!entities.has(relation.subject_entity_id) ||
        (relation.object_entity_id !== null && !entities.has(relation.object_entity_id))) {
      throw new Error("Relationship references an undefined entity.");
    }
  }
  const inputs = result.provenance.inputs_used;
  if (!inputs.includes("question") ||
      (inputs.includes("provided_answer") && !question.answer) ||
      (inputs.includes("provided_explanation") && !question.explanation)) {
    throw new Error("Extraction provenance does not match the supplied inputs.");
  }
  if (!question.answer && result.provenance.answer_status === "provided_not_independently_verified") {
    throw new Error("Extraction records a supplied answer that does not exist.");
  }
  const evidence = result.provenance.truth_labels_based_on;
  if ((evidence === "provided_answer_only" || evidence === "provided_answer_and_explanation") &&
      (!question.answer || !inputs.includes("provided_answer"))) {
    throw new Error("Truth labels cite an answer that was not supplied or used.");
  }
  if ((evidence === "provided_explanation" || evidence === "provided_answer_and_explanation") &&
      (!question.explanation || !inputs.includes("provided_explanation"))) {
    throw new Error("Truth labels cite an explanation that was not supplied or used.");
  }
  if (result.provenance.answer_status === "conflict_detected" &&
      !result.provenance.needs_review) {
    throw new Error("Conflicting answers must be flagged for review.");
  }
  return result;
}
