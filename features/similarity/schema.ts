import { z } from "zod";
import { classificationConfidenceThreshold, sourceContainers } from "./config.js";
import { questionVerificationSchema } from "./verification.js";

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

export const conceptReviewSchema = z.object({
  decisions: z.array(z.object({
    concept_id: conceptId,
    decision: z.enum(["reuse", "new", "review"]),
    existing_concept_id: conceptId.nullable(),
    meaning_scope_rationale: text,
    role: assignment.shape.role,
    role_status: z.enum(["supported", "uncertain", "unrelated"]),
    role_rationale: text,
    source_evidence: z.array(highlightEvidenceSchema),
  })).min(1),
});

export type ConceptReview = z.infer<typeof conceptReviewSchema>;

const classificationReviewSchema = z.object({
  status: z.enum(["supported", "uncertain", "conflict"]),
  primary_concept_id: conceptId,
  subject_confidence: confidence,
  topic_confidence: confidence,
  rationale: text,
  source_evidence: z.array(highlightEvidenceSchema),
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
    review: classificationReviewSchema.optional(),
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
  concept_review: conceptReviewSchema.optional(),
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
  classification: profileExtractionSchema.shape.classification.extend({
    review: classificationReviewSchema,
  }),
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
  verification: questionVerificationSchema.optional(),
}).superRefine((value, context) => {
  if (value.verification && value.verification.sourceContentHash !== value.sourceContentHash) {
    context.addIssue({ code: "custom", path: ["verification"], message: "Verification must reference the imported source hash." });
  }
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
  verification: questionVerificationSchema.optional(),
  processing: z.object({
    status: z.enum(["pending_extraction", "extracting", "pending_review", "pending_embedding", "embedding", "ready", "stale", "failed"]),
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
}).superRefine((value, context) => {
  if (!value.verification) return;
  if (value.verification.sourceContentHash !== value.processing.sourceContentHash) {
    context.addIssue({ code: "custom", path: ["verification"], message: "Verification must refer to the profile's source hash." });
  }
  if (value.verification.status === "verified" &&
      value.verification.extractionContentHash !== value.processing.extractionContentHash) {
    context.addIssue({ code: "custom", path: ["verification"], message: "Verified concepts must reference the reviewed extraction hash." });
  }
  if (value.verification.status === "pending_review" &&
      (value.embedding !== null || value.processing.status === "ready")) {
    context.addIssue({ code: "custom", message: "Review-blocked questions cannot publish a ready vector." });
  }
  if (value.processing.status === "pending_review" &&
      (value.verification.status !== "pending_review" || !value.provenance?.needs_review)) {
    context.addIssue({ code: "custom", message: "Pending-review flags and provenance must remain consistent." });
  }
});

export type StoredProfile = z.infer<typeof storedProfileSchema>;

export function conceptReviewIssue(extraction: ProfileExtraction): string | undefined {
  const decisions = extraction.concept_review?.decisions;
  if (!decisions) return "Concept identity and role assignments have not been reviewed.";
  const assignments = [
    ...extraction.concept_profile.primary_concepts, ...extraction.concept_profile.secondary_concepts,
  ];
  const ids = new Set(decisions.map(decision => decision.concept_id));
  if (ids.size !== decisions.length || decisions.length !== assignments.length ||
      assignments.some(concept => !ids.has(concept.concept_id))) {
    return "Every assigned concept requires exactly one identity and role review.";
  }
  for (const concept of assignments) {
    const decision = decisions.find(item => item.concept_id === concept.concept_id)!;
    if (decision.decision === "review") {
      return `Concept ${concept.concept_id} has uncertain meaning or scope: ${decision.meaning_scope_rationale}`;
    }
    if (decision.role !== concept.role || decision.role_status !== "supported") {
      return `Concept ${concept.concept_id} requires role review: ${decision.role_rationale}`;
    }
    if (!decision.source_evidence.length ||
        decision.source_evidence.some(evidence => evidence.concept_id !== concept.concept_id)) {
      return `Concept ${concept.concept_id} requires source-grounded role evidence.`;
    }
    if ((decision.decision === "reuse") !== (decision.existing_concept_id !== null)) {
      return `Concept ${concept.concept_id} has an inconsistent reuse/new decision.`;
    }
  }
  return undefined;
}

export function classificationTaxonomyIssue(
  classification: Pick<ProfileExtraction["classification"], "subject" | "topic">,
  concept: { subject: string; topic: string },
): string | undefined {
  const normalize = (label: string) => label.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  if (normalize(classification.subject) !== normalize(concept.subject) ||
      normalize(classification.topic) !== normalize(concept.topic)) {
    return `Subject/topic classification conflicts with its primary concept taxonomy (${concept.subject}; ${concept.topic}).`;
  }
  return undefined;
}

export function classificationReviewIssue(extraction: ProfileExtraction): string | undefined {
  const review = extraction.classification.review;
  if (!review) return "Subject/topic classification has not been reviewed.";
  if (review.status !== "supported") {
    return `Subject/topic classification is ${review.status}: ${review.rationale}`;
  }
  if (review.subject_confidence < classificationConfidenceThreshold ||
      review.topic_confidence < classificationConfidenceThreshold) {
    return `Subject/topic classification confidence must be at least ${classificationConfidenceThreshold} for both labels.`;
  }
  const primary = new Set(extraction.concept_profile.primary_concepts.map(concept => concept.concept_id));
  if (!primary.has(review.primary_concept_id) ||
      !review.source_evidence.some(evidence => evidence.concept_id === review.primary_concept_id) ||
      review.source_evidence.some(evidence => !primary.has(evidence.concept_id))) {
    return "Subject/topic classification requires source evidence linked to primary concepts.";
  }
  return undefined;
}

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
  const validateEvidence = (
    entries: z.infer<typeof highlightEvidenceSchema>[], allowedConcepts: Set<string>, label: string,
  ) => {
    const seen = new Set<string>();
    for (const evidence of entries) {
      if (!allowedConcepts.has(evidence.concept_id)) {
        throw new Error(`${label} references an undefined or ineligible concept.`);
      }
      if (evidence.field === "option"
        ? evidence.option_index === undefined || evidence.option_index >= question.options.length
        : evidence.option_index !== undefined) {
        throw new Error(`${label} option_index must identify an existing option and is only allowed for option evidence.`);
      }
      const source = evidence.field === "question" ? question.question
        : evidence.field === "option" ? question.options[evidence.option_index] : question.explanation;
      if (!source?.includes(evidence.exact_text)) {
        throw new Error(`${label} exact_text does not occur in its source ${evidence.field}.`);
      }
      const input = evidence.field === "option" ? "options"
        : evidence.field === "explanation" ? "provided_explanation" : "question";
      if (!result.provenance.inputs_used.includes(input)) {
        throw new Error(`${label} cites an input that was not used.`);
      }
      const key = JSON.stringify([evidence.concept_id, evidence.field, evidence.option_index, evidence.exact_text]);
      if (seen.has(key)) throw new Error(`Duplicate ${label.toLowerCase()}.`);
      seen.add(key);
    }
  };
  validateEvidence(result.highlight_evidence ?? [], ids, "Highlight evidence");
  for (const decision of result.concept_review?.decisions ?? []) {
    validateEvidence(decision.source_evidence, new Set([decision.concept_id]), "Concept review evidence");
    if (!ids.has(decision.concept_id)) throw new Error("Concept review references an unassigned concept.");
  }
  validateEvidence(
    result.classification.review.source_evidence,
    new Set(result.concept_profile.primary_concepts.map(concept => concept.concept_id)),
    "Classification evidence",
  );
  const classificationConcept = result.concept_definitions.find(concept =>
    concept.id === result.classification.review.primary_concept_id &&
    result.concept_profile.primary_concepts.some(primary => primary.concept_id === concept.id));
  if (!classificationConcept) throw new Error("Classification evidence must identify an assigned primary concept.");
  const classificationConflict = classificationTaxonomyIssue(result.classification, classificationConcept);
  if (classificationConflict) {
    result.classification.review.status = "conflict";
    if (!result.classification.review.rationale.includes(classificationConflict)) {
      result.classification.review.rationale += ` ${classificationConflict}`;
    }
    result.provenance.needs_review = true;
    result.provenance.review_notes = [...new Set([...result.provenance.review_notes, classificationConflict])];
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
