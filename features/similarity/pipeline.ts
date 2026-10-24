import { hashContent } from "./content-hash.js";
export { hashContent } from "./content-hash.js";
import { embeddingModel, embeddingPrefix, promptVersion, schemaVersion, type PipelineConfig } from "./config.js";
import {
  classificationReviewIssue, classificationTaxonomyIssue, conceptReviewIssue, coverageReviewIssue,
  classificationMaintenanceSchema, classificationParentMaintenanceSchema, conceptResolutionBatchSchema, conceptReviewSchema, extractionBatchSchema, importedExtractionSchema, profileExtractionSchema,
  storedProfileSchema, subtopicMaintenanceReviewSchema, validateConceptExtraction, validateExtraction,
  type ClassificationMaintenance, type ClassificationParentMaintenance, type ConceptResolutionBatch, type ConceptResolutionExtraction, type ExtractionBatch, type ExtractionResponse, type ImportedExtraction, type ProfileExtraction, type SourceQuestion, type StoredProfile,
} from "./schema.js";
import type { EmbeddingAI, PipelineAI } from "./google.js";
import type { ConceptRegistrySession, PipelineRepository, ProfileSnapshot } from "./repository.js";
import {
  assertConceptAdmission, bindConceptReview, ConceptReviewError, prepareBatchReview, prepareConceptResolutionBatchReview, proposalFingerprint, registryFingerprint,
} from "./concept-review.js";
import type { CanonicalConcept, QuestionReference } from "./types.js";
import { highlightReviewIssue } from "./highlight-review.js";
import {
  flagQuestionForReview, hasAcknowledgedSourceWarning, questionVerificationSchema, reviewFlag, validateVerificationBinding, verificationForSource,
  QuestionVerificationConflictError, unverifiedQuestion, type QuestionVerification, type VerificationIssue,
} from "./verification.js";

class ClassificationReviewError extends Error {
  constructor(message: string, readonly conflict = false) {
    super(message);
  }
}
class QuestionReviewError extends Error {
  constructor(readonly issue: VerificationIssue) {
    super(reviewFlag(issue));
  }
}

function assertReviewedClassification(extraction: ProfileExtraction): void {
  const issue = classificationReviewIssue(extraction);
  if (issue) throw new ClassificationReviewError(
    `Classification requires review. ${issue}`, extraction.classification.review?.status === "conflict",
  );
}

function assertReviewedConcepts(extraction: Pick<ProfileExtraction, "concept_profile" | "concept_review">): void {
  const issue = conceptReviewIssue(extraction);
  if (issue) throw new ConceptReviewError(`Concepts require review. ${issue}`);
}

export function buildEmbeddingInput(extraction: ProfileExtraction): string {
  assertReviewedClassification(extraction);
  assertReviewedConcepts(extraction);
  return formatEmbeddingInput(extraction);
}

export function buildProvisionalEmbeddingInput(extraction: ProfileExtraction): string {
  return formatEmbeddingInput(profileExtractionSchema.parse(extraction));
}

export function provisionalEmbeddingReview(profile: StoredProfile) {
  const review = profile.processing.provisionalEmbedding;
  if (!review || review.sourceContentHash !== profile.processing.sourceContentHash ||
      review.profileVerificationHash !== hashContent(profile.verification ?? null)) return undefined;
  const extraction = profileExtractionSchema.safeParse(profile);
  return extraction.success && review.profileExtractionHash === hashContent(extraction.data) ? review : undefined;
}

function formatEmbeddingInput(
  extraction: Pick<ProfileExtraction, "concept_profile"> & {
    classification: Pick<ProfileExtraction["classification"], "subject" | "topic">;
  },
): string {
  const profile = extraction.concept_profile;
  const names = (items: typeof profile.primary_concepts | typeof profile.secondary_concepts) =>
    [...items].sort((a, b) => a.concept_id.localeCompare(b.concept_id))
      .map(item => item.canonical_name).join("; ");
  const entities = new Map(profile.entities.map(entity => [entity.entity_id, entity.name]));
  const relationships = profile.relationships
    .filter(relation => relation.role === "tested_relationship")
    .map(relation => `${entities.get(relation.subject_entity_id)}: ${relation.relationship_type.replaceAll("_", " ")}${relation.object_entity_id ? `: ${entities.get(relation.object_entity_id)}` : ""}`)
    .sort();
  // Keep this allowlist: subtopic names and master IDs are classification-only metadata.
  return [
    `Subject/topic: ${extraction.classification.subject}; ${extraction.classification.topic}.`,
    `Primary concepts: ${names(profile.primary_concepts)}.`,
    `Underlying principle: ${profile.underlying_principle}`,
    `Essential knowledge: ${[...profile.knowledge_requirements].sort().join("; ")}`,
    ...(profile.secondary_concepts.length ? [`Supporting concepts: ${names(profile.secondary_concepts)}.`] : []),
    ...(relationships.length ? [`Tested relationships: ${relationships.join("; ")}.`] : []),
  ].join("\n");
}

export function validateVector(vector: number[], dimensions: number): number[] {
  if (vector.length !== dimensions || !vector.every(Number.isFinite)) {
    throw new Error(`Embedding must contain exactly ${dimensions} finite numbers.`);
  }
  const magnitude = Math.hypot(...vector);
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new Error("Embedding has an invalid magnitude.");
  return vector.map(value => value / magnitude);
}

export function getReusableEmbedding(
  previous: StoredProfile | undefined,
  input: string,
  config: Pick<PipelineConfig, "dimensions" | "embeddingSpaceVersion">,
): number[] | undefined {
  if (!previous || previous.processing.status !== "ready" || previous.embedding === null ||
      previous.processing.embeddingSpaceVersion !== config.embeddingSpaceVersion ||
      previous.processing.embeddingModel !== embeddingModel ||
      previous.processing.embeddingDimensions !== config.dimensions ||
      previous.concept_embedding_input !== input ||
      previous.processing.embeddingInputHash !== hashContent(`${embeddingPrefix}${input}`)) return undefined;
  validateVector(previous.embedding, config.dimensions);
  return previous.embedding;
}

const normalizeLabel = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

export interface EmbeddingMaintenanceRequest {
  previousSource: SourceQuestion;
  classification: ProfileExtraction["classification"];
  reviewedBy: string;
  auditReference: string;
}

export interface SubtopicMaintenanceRequest {
  previousSource: SourceQuestion;
  expectedSourceEtag: string;
  expectedProfileEtag: string;
  expectedProfileHash: string;
  reviewedBy: string;
  auditReference: string;
  review: NonNullable<StoredProfile["processing"]["subtopicMaintenance"]>["review"];
}

export interface ClassificationMaintenanceRequest {
  previousSource: SourceQuestion;
  classification: ClassificationMaintenance;
  reviewedBy: string;
  auditReference: string;
  expectedSourceEtag?: string;
  expectedProfileEtag?: string | null;
}
export interface ClassificationParentMaintenanceRequest extends Omit<ClassificationMaintenanceRequest, "classification"> {
  classification: ClassificationParentMaintenance;
  pendingIssue?: VerificationIssue;
}

export interface ConceptResolutionRequest {
  sourceContentHash: string;
  extraction: ConceptResolutionExtraction;
  reviewedBy: string;
  auditReference: string;
  expectedSourceEtag: string;
  expectedProfileEtag: string;
  resolvedIssueCodes: string[];
  allowUnadmittedProposals?: boolean;
  creationBatch?: ConceptResolutionBatch;
}

type MaintenanceMaster = {
  subject: string; topic: string; subtopics?: { id: string; name: string }[];
};

export function planEmbeddingMaintenance(
  previous: StoredProfile,
  question: SourceQuestion,
  sourceVerification: QuestionVerification | undefined,
  registry: CanonicalConcept[],
  master: MaintenanceMaster | undefined,
  config: PipelineConfig,
  request: EmbeddingMaintenanceRequest,
) {
  if (!request.reviewedBy.trim() || !request.auditReference.trim()) {
    throw new Error("Embedding maintenance requires an identified reviewer and audit reference.");
  }
  if (previous.questionId !== question.id || request.previousSource.id !== question.id ||
      previous.processing.sourceContentHash !== hashContent(request.previousSource)) {
    throw new Error("Embedding maintenance requires the exact source bound to the existing profile.");
  }
  const material = ({ subject: _subject, topic: _topic, ...body }: SourceQuestion) => body;
  if (hashContent(material(question)) !== hashContent(material(request.previousSource))) {
    throw new Error("Source content changed; classification/embedding-only maintenance is not permitted.");
  }
  if (previous.processing.taxonomyVersion !== config.taxonomyVersion) {
    throw new Error("Taxonomy-version changes require a full extraction review.");
  }
  if (["extracting", "embedding"].includes(previous.processing.status)) {
    throw new Error("Cannot maintain a profile with an unfinished processing operation.");
  }
  const previousExtraction = (previous.processing.conceptResolution?.mode === "concepts_only"
    ? profileExtractionSchema.extend({
      classification: profileExtractionSchema.shape.classification.partial({
        question_format: true, polarity: true, reasoning_type: true, question_intent: true,
      }),
    })
    : profileExtractionSchema).parse(previous);
  const preservedHash = hashContent(previousExtraction);
  const target = request.classification;
  const extraction = profileExtractionSchema.parse({
    ...previousExtraction,
    classification: {
      ...target, ...previousExtraction.classification,
      subject: target.subject, topic: target.topic, subtopics: target.subtopics,
      master: target.master, review: target.review,
    },
  });
  assertReviewedClassification(extraction);
  const pointer = extraction.classification.master;
  if (!pointer || !master || master.subject !== target.subject || master.topic !== target.topic ||
      question.subject !== target.subject || question.topic !== target.topic ||
      pointer.subtopicIds.length !== target.subtopics.length ||
      pointer.subtopicIds.some((id, index) => master.subtopics?.find(s => s.id === id)?.name !== target.subtopics[index])) {
    throw new ClassificationReviewError("Maintenance requires exact supported source labels and active master mappings.");
  }
  const classificationMaintenance = previous.processing.classificationMaintenance;
  const reviewedClassificationOnly = !!classificationMaintenance &&
    (["subject", "topic", "subtopics", "master"] as const).every(key =>
      hashContent(classificationMaintenance.review[key]) === hashContent(target[key])) &&
    [previous.verification, sourceVerification].every(verification =>
      verification?.checks.master_classification.status === "passed" &&
      verification.sourceContentHash === previous.processing.sourceContentHash);
  const resolvedMaintenanceHold = (issue: VerificationIssue) => reviewedClassificationOnly &&
    issue.check === "concepts" && issue.code === "CLASSIFICATION_EMBEDDING_MAINTENANCE_REQUIRED";
  for (const verification of [previous.verification, sourceVerification]) {
    const blocking = verification?.issues.find(issue =>
      issue.check !== "master_classification" && !resolvedMaintenanceHold(issue));
    if (blocking) {
      throw new QuestionReviewError(blocking);
    }
  }
  if (previous.processing.status === "pending_review" && !previous.verification) {
    throw new Error("Legacy review flags must be resolved explicitly before embedding maintenance.");
  }
  const legacyFlag = previous.processing.error?.match(/^REVIEW_FLAG\[([A-Z][A-Z0-9_]*)\]:/);
  if (legacyFlag && !previous.verification?.issues.some(issue =>
    issue.code === legacyFlag[1] && (issue.check === "master_classification" || resolvedMaintenanceHold(issue)))) {
    throw new Error("A recorded processing review flag has not been resolved by the classification review.");
  }
  if (extraction.provenance.answer_status === "conflict_detected" ||
      extraction.provenance.truth_labels_based_on === "conflicting_sources" ||
      extraction.claims.some(claim => claim.verification_source === "conflicting_sources")) {
    throw new Error("Source or answer conflicts cannot be cleared by embedding maintenance.");
  }
  if (extraction.concept_review && (conceptReviewIssue(extraction) ||
      extraction.concept_review.coverage?.status === "uncertain" ||
      extraction.concept_review.coverage?.uncovered_items.length ||
      extraction.concept_review.highlights?.status === "uncertain")) {
    throw new ConceptReviewError("An existing unresolved concept, role, coverage or highlight review must remain held.");
  }
  const assignments = [...extraction.concept_profile.primary_concepts, ...extraction.concept_profile.secondary_concepts];
  const definitions = assignments.map(assignment => {
    const canonical = registry.find(concept => concept.id === assignment.concept_id);
    if (!canonical || canonical.status === "retired" || canonical.taxonomyVersion !== config.taxonomyVersion ||
        ![canonical.canonical_name, ...canonical.aliases].some(name =>
          normalizeLabel(name) === normalizeLabel(assignment.canonical_name))) {
      throw new ConceptReviewError(`Existing concept ${assignment.concept_id} requires canonical reconciliation.`);
    }
    return canonical;
  });
  const validated = validateExtraction({ ...extraction, concept_definitions: definitions }, question);
  assertReviewedClassification(validated);
  const final = profileExtractionSchema.parse(validated);
  for (const key of ["concept_profile", "claims", "concept_review", "highlight_evidence", "similarity_profile", "provenance"] as const) {
    if (hashContent(final[key] ?? null) !== hashContent(extraction[key] ?? null)) {
      throw new Error(`Embedding maintenance must preserve existing ${key}.`);
    }
  }
  const input = formatEmbeddingInput(final);
  const reused = getReusableEmbedding(previous, input, config);
  const sourceHash = hashContent(question);
  const classificationReview = final.classification.review;
  if (!classificationReview) throw new ClassificationReviewError("A supported classification review is required.");
  const anchor = definitions.find(c => c.id === classificationReview.primary_concept_id)!;
  const canonicalTaxonomyMismatch = normalizeLabel(anchor.subject) !== normalizeLabel(target.subject) ||
    normalizeLabel(anchor.topic) !== normalizeLabel(target.topic)
    ? { conceptId: anchor.id, subject: anchor.subject, topic: anchor.topic } : undefined;
  const warnings = [...new Map([
    ...(previous.verification?.warnings ?? []), ...(sourceVerification?.warnings ?? []),
  ].map(warning => [warning.code, warning])).values()];
  if (warnings.length && (sourceHash !== previous.processing.sourceContentHash ||
      [previous.verification, sourceVerification].some(v => v?.warnings?.length && v.sourceContentHash !== sourceHash))) {
    throw new Error("Source-bound warning approvals must be renewed after source changes.");
  }
  const verification = questionVerificationSchema.parse({
    ...unverifiedQuestion(sourceHash),
    reviewedBy: request.reviewedBy,
    masterClassification: { subjectId: pointer.subjectId, topicId: pointer.topicId },
    checks: {
      ...unverifiedQuestion(sourceHash).checks,
      master_classification: {
        status: "passed",
        evidence: [...classificationReview.source_evidence.map(e => e.exact_text), request.auditReference],
      },
    },
    corrections: [...new Map([
      ...(previous.verification?.corrections ?? []), ...(sourceVerification?.corrections ?? []),
    ].map(c => [`${c.auditReference}:${c.field}`, c])).values()],
    ...(warnings.length ? { warnings } : {}),
  });
  const document: StoredProfile = {
    ...previous, ...final, verification, concept_embedding_input: input, embedding: reused ?? null,
    processing: {
      ...previous.processing, sourceContentHash: sourceHash, extractionContentHash: hashContent(final),
      embeddingInputHash: hashContent(embeddingPrefix + input),
      embeddingModel, embeddingDimensions: config.dimensions, embeddingSpaceVersion: config.embeddingSpaceVersion,
      status: reused ? "ready" : "pending_embedding", error: null, updatedAt: new Date().toISOString(),
      maintenance: {
        mode: "classification_embedding_only", reviewedBy: request.reviewedBy, auditReference: request.auditReference,
        updatedAt: new Date().toISOString(), previousSourceContentHash: previous.processing.sourceContentHash,
        preservedExtractionHash: preservedHash, registryFingerprint: registryFingerprint(registry),
        embeddingInputChanged: previous.concept_embedding_input !== input, reusedEmbedding: !!reused,
        freshConceptReview: false, freshHighlightReview: false,
        ...(canonicalTaxonomyMismatch ? { canonicalTaxonomyMismatch } : {}),
      },
    },
  };
  return { document, input, reusedEmbedding: reused, registryFingerprint: registryFingerprint(registry) };
}

export function planSubtopicMaintenance(
  previous: StoredProfile, question: SourceQuestion, sourceVerification: QuestionVerification | undefined,
  registry: CanonicalConcept[], master: MaintenanceMaster | undefined, config: PipelineConfig,
  request: SubtopicMaintenanceRequest,
) {
  if (hashContent(previous) !== request.expectedProfileHash ||
      hashContent(question) !== hashContent(request.previousSource) ||
      previous.processing.sourceContentHash !== hashContent(question)) {
    throw new Error("Subtopic maintenance requires the exact backed-up source and profile.");
  }
  if ([sourceVerification, previous.verification].some(value => value?.status === "verified")) {
    throw new Error("Changing a fully verified extraction requires a separate verification review.");
  }
  if (sourceVerification?.sourceContentHash !== hashContent(question) ||
      sourceVerification.checks.answer.status !== "passed" || sourceVerification.checks.explanation.status !== "passed") {
    throw new Error("Subtopic maintenance requires current passed answer and explanation checks.");
  }
  const review = subtopicMaintenanceReviewSchema.parse(request.review);
  if (new Set(review.subtopics.map(item => item.id)).size !== review.subtopics.length ||
      new Set(review.subtopics.map(item => item.name)).size !== review.subtopics.length) {
    throw new Error("Subtopic maintenance cannot contain duplicate IDs or names.");
  }
  for (const child of review.subtopics) {
    for (const evidence of child.source_evidence) {
      const source = evidence.field === "question" ? question.question
        : evidence.field === "explanation" ? question.explanation
        : evidence.option_index === undefined ? undefined : question.options[evidence.option_index];
      if ((evidence.field !== "option" && evidence.option_index !== undefined) ||
          !source?.includes(evidence.exact_text)) {
        throw new Error("Subtopic evidence must occur literally in its specified source field.");
      }
    }
    if (!child.source_evidence.some(evidence => evidence.field !== "explanation")) {
      throw new Error("Each subtopic needs tested question or option evidence.");
    }
  }
  const extraction = profileExtractionSchema.parse(previous);
  const pointer = extraction.classification.master;
  if (!pointer) throw new Error("Subtopic maintenance requires the existing reviewed master parent.");
  const classification = {
    ...extraction.classification,
    subtopics: review.subtopics.map(item => item.name),
    master: { ...pointer, subtopicIds: review.subtopics.map(item => item.id) },
  };
  const plan = planEmbeddingMaintenance(previous, question, sourceVerification, registry, master, config, {
    previousSource: request.previousSource, classification,
    reviewedBy: request.reviewedBy, auditReference: request.auditReference,
  });
  if (!plan.reusedEmbedding || plan.input !== previous.concept_embedding_input ||
      hashContent(embeddingPrefix + plan.input) !== previous.processing.embeddingInputHash) {
    throw new Error("Subtopic-only maintenance requires an unchanged input and a compatible ready vector.");
  }
  const document = storedProfileSchema.parse({
    ...previous, classification,
    processing: {
      ...previous.processing,
      subtopicMaintenance: {
        mode: "subtopics_only", reviewedBy: request.reviewedBy, auditReference: request.auditReference,
        updatedAt: new Date().toISOString(), previousProfileHash: request.expectedProfileHash,
        sourceContentHash: previous.processing.sourceContentHash,
        previousClassificationHash: hashContent(previous.classification),
        classificationHash: hashContent(classification), registryFingerprint: plan.registryFingerprint,
        review, embeddingInputChanged: false, reusedEmbedding: true,
        freshConceptReview: false, freshHighlightReview: false,
      },
    },
  });
  return { document, registryFingerprint: plan.registryFingerprint };
}

export function planClassificationMaintenance(
  previous: StoredProfile, question: SourceQuestion, sourceVerification: QuestionVerification | undefined,
  master: MaintenanceMaster | undefined, request: ClassificationMaintenanceRequest,
) {
  if (!request.reviewedBy.trim() || !request.auditReference.trim()) {
    throw new Error("Classification maintenance requires a reviewer and backed-up audit reference.");
  }
  const oldHash = hashContent(question);
  if (question.id !== previous.questionId || hashContent(request.previousSource) !== oldHash ||
      previous.processing.sourceContentHash !== oldHash) {
    throw new Error("Classification maintenance requires the exact current source and profile binding.");
  }
  if (["extracting", "embedding"].includes(previous.processing.status)) {
    throw new Error("Cannot classify a profile with an unfinished processing operation.");
  }
  const target = classificationMaintenanceSchema.parse(request.classification);
  const pointer = target.master;
  if (!master || target.subject !== master.subject || target.topic !== master.topic ||
      pointer.subtopicIds.length !== target.subtopics.length ||
      new Set(target.subtopics).size !== target.subtopics.length ||
      pointer.subtopicIds.some((id, index) => master.subtopics?.find(item => item.id === id)?.name !== target.subtopics[index])) {
    throw new ClassificationReviewError("Classification requires exact active master names, IDs and subtopics.");
  }
  for (const evidence of target.source_evidence) {
    const source = evidence.field === "question" ? question.question
      : evidence.field === "explanation" ? question.explanation
      : evidence.option_index === undefined ? undefined : question.options[evidence.option_index];
    if ((evidence.field !== "option" && evidence.option_index !== undefined) ||
        !source?.includes(evidence.exact_text)) {
      throw new ClassificationReviewError("Classification evidence must occur literally in its specified source field.");
    }
  }
  if (!target.source_evidence.some(evidence => evidence.field !== "explanation")) {
    throw new ClassificationReviewError("Classification needs tested question or option evidence, not explanation alone.");
  }
  const correctedQuestion = { ...question, subject: target.subject, topic: target.topic };
  const sourceHash = hashContent(correctedQuestion);
  if (sourceHash !== oldHash &&
      [sourceVerification, previous.verification].some(value => value?.warnings?.length)) {
    throw new Error("Source-bound warning approvals require separate review before classification labels change.");
  }
  let verification = verificationForSource(sourceVerification ?? previous.verification, sourceHash, false);
  const issues = [...new Map([
    ...verification.issues, ...(sourceVerification?.issues ?? []), ...(previous.verification?.issues ?? []),
  ].filter(issue => issue.check !== "master_classification").map(issue => [JSON.stringify(issue), issue])).values()];
  if ((previous.provenance?.answer_status === "conflict_detected" ||
       previous.provenance?.truth_labels_based_on === "conflicting_sources" ||
       previous.claims?.some(claim => claim.verification_source === "conflicting_sources")) &&
      !issues.some(issue => issue.check === "answer" || issue.check === "explanation")) {
    issues.push({
      code: "EXISTING_SOURCE_CONFLICT", check: "answer",
      reason: "The existing profile records an unresolved source or answer conflict; classification review does not resolve it.",
      requiredAction: "Resolve the recorded source/answer conflict separately without changing the reviewed classification.",
      evidence: [request.auditReference],
    });
  }
  const complete = profileExtractionSchema.safeParse(previous);
  const conceptIssue = !complete.success ? "The stored profile has no complete concept extraction."
    : conceptReviewIssue(complete.data) || coverageReviewIssue(complete.data, question) || highlightReviewIssue(complete.data, question);
  if ((conceptIssue || !issues.length) && !issues.some(issue => issue.check === "concepts")) {
    issues.push({
      code: conceptIssue ? "CONCEPT_REVIEW_REQUIRED" : "CLASSIFICATION_EMBEDDING_MAINTENANCE_REQUIRED",
      check: "concepts",
      reason: conceptIssue || "Classification is corrected, but classification-only maintenance does not admit a ready embedding.",
      requiredAction: conceptIssue
        ? "Review the complete source-bound concept extraction, roles, coverage and highlights separately; retain the corrected classification."
        : "Run guarded embedding maintenance or a fully reviewed import; classification-only review does not authorize concept admission.",
      evidence: [request.auditReference],
    });
  }
  const checks = {
    ...verification.checks,
    master_classification: { status: "passed" as const, reason: target.rationale,
      evidence: [...target.source_evidence.map(evidence => evidence.exact_text), request.auditReference] },
  };
  for (const name of ["question", "answer", "explanation", "concepts"] as const) {
    const held = issues.filter(issue => issue.check === name);
    if (held.length) checks[name] = {
      status: "pending_review", reason: held.map(issue => issue.reason).join(" "),
      evidence: held.flatMap(issue => issue.evidence),
    };
  }
  const corrections = ["subject", "topic"].filter(field => question[field] !== correctedQuestion[field])
    .map(field => ({
      field: field as "subject" | "topic", reason: target.rationale, auditReference: request.auditReference,
    }));
  verification = questionVerificationSchema.parse({
    ...verification, status: "pending_review", sourceContentHash: sourceHash, extractionContentHash: undefined,
    reviewedBy: request.reviewedBy, updatedAt: new Date().toISOString(),
    masterClassification: { subjectId: pointer.subjectId, topicId: pointer.topicId }, checks, issues,
    corrections: [...new Map([
      ...verification.corrections, ...(previous.verification?.corrections ?? []), ...corrections,
    ].map(correction => [`${correction.auditReference}:${correction.field}`, correction])).values()],
  });
  const { review: _oldClassificationReview, ...preservedClassification } = previous.classification ?? {};
  const document = storedProfileSchema.parse({
    ...previous,
    classification: {
      ...preservedClassification, subject: target.subject, topic: target.topic,
      subtopics: target.subtopics, master: pointer,
    },
    embedding: null, verification,
    provenance: {
      ...(previous.provenance ?? {
        inputs_used: ["question"], answer_status: question.answer ? "provided_not_independently_verified" : "missing",
        truth_labels_based_on: "not_provided", review_notes: [],
      }),
      needs_review: true,
      review_notes: [...(previous.provenance?.review_notes ?? []),
        `Classification-only review: ${target.rationale} Other review holds remain unresolved. Audit: ${request.auditReference}`],
    },
    processing: {
      ...previous.processing, status: "pending_review", sourceContentHash: sourceHash,
      extractionContentHash: undefined, embeddingInputHash: null,
      error: reviewFlag(issues[0]), updatedAt: new Date().toISOString(),
      classificationMaintenance: {
        mode: "classification_only", reviewedBy: request.reviewedBy, auditReference: request.auditReference,
        updatedAt: new Date().toISOString(), previousSourceContentHash: oldHash, previousProfileHash: hashContent(previous),
        review: target, resolvedIssueCodes: [...new Set([
          ...(sourceVerification?.issues ?? []), ...(previous.verification?.issues ?? []),
        ].filter(issue => issue.check === "master_classification").map(issue => issue.code))],
        freshConceptReview: false, freshHighlightReview: false,
      },
    },
  });
  return { question: correctedQuestion, document };
}

export function planClassificationParentMaintenance(
  previous: StoredProfile, question: SourceQuestion, sourceVerification: QuestionVerification | undefined,
  master: MaintenanceMaster | undefined, request: ClassificationParentMaintenanceRequest,
) {
  if (!request.reviewedBy.trim() || !request.auditReference.trim()) throw new Error("Parent maintenance requires an identified reviewer and backup audit.");
  const oldHash = hashContent(question), target = classificationParentMaintenanceSchema.parse(request.classification);
  if (question.id !== previous.questionId || hashContent(request.previousSource) !== oldHash ||
      previous.processing.sourceContentHash !== oldHash) throw new Error("Parent maintenance requires the exact current source/profile binding.");
  if (["extracting", "embedding"].includes(previous.processing.status)) throw new Error("Cannot repair parents during unfinished processing.");
  if (!master || target.subject !== master.subject || target.topic !== master.topic)
    throw new ClassificationReviewError("Parent maintenance requires exact active subject/topic names and IDs.");
  for (const evidence of target.source_evidence) {
    const value = evidence.field === "option" ? question.options[evidence.option_index ?? -1] : question[evidence.field];
    if ((evidence.field !== "option" && evidence.option_index !== undefined) ||
        !value?.includes(evidence.exact_text)) throw new ClassificationReviewError("Parent evidence must be literal in its specified field.");
  }
  if (!target.source_evidence.some(evidence => evidence.field !== "explanation"))
    throw new ClassificationReviewError("Parent maintenance needs tested question/option evidence.");
  const proposedIssue = request.pendingIssue
    ? flagQuestionForReview(unverifiedQuestion(oldHash), request.pendingIssue).issues[0] : undefined;
  if (proposedIssue && proposedIssue.check !== "master_classification") throw new Error("Parent maintenance can add only a classification hold.");
  const issues = [...new Map([
    ...(sourceVerification?.issues ?? []), ...(previous.verification?.issues ?? []), ...(proposedIssue ? [proposedIssue] : []),
  ].map(issue => [hashContent(issue), issue])).values()];
  const classificationIssues = issues.filter(issue => issue.check === "master_classification");
  if (!classificationIssues.length) throw new Error("Parent-only maintenance must retain an explicit unresolved classification issue.");
  if (!profileExtractionSchema.safeParse(previous).success && !issues.some(issue => issue.check === "concepts"))
    issues.push({ code: "CONCEPT_REVIEW_REQUIRED", check: "concepts",
      reason: "Parent-only maintenance did not produce a complete concept extraction.",
      requiredAction: "Review the full source-bound extraction, roles, coverage and highlights separately.",
      evidence: [request.auditReference] });
  const correctedQuestion = { ...question, subject: target.subject, topic: target.topic }, sourceHash = hashContent(correctedQuestion);
  if (sourceHash !== oldHash && [sourceVerification, previous.verification].some(value => value?.warnings?.length))
    throw new Error("Source-bound warning approvals require separate review before parent labels change.");
  const base = verificationForSource(sourceVerification ?? previous.verification, sourceHash, false);
  const checks = structuredClone(base.checks);
  for (const check of ["question", "answer", "explanation", "concepts", "master_classification"] as const) {
    const retained = issues.filter(issue => issue.check === check);
    if (retained.length) checks[check] = { status: "pending_review", reason: retained.map(issue => issue.reason).join(" "),
      evidence: retained.flatMap(issue => issue.evidence) };
  }
  const corrections = ["subject", "topic"].filter(field => question[field] !== correctedQuestion[field])
    .map(field => ({ field: field as "subject" | "topic", reason: target.rationale, auditReference: request.auditReference }));
  const verification = questionVerificationSchema.parse({
    ...base, status: "pending_review", sourceContentHash: sourceHash, extractionContentHash: undefined,
    reviewedBy: request.reviewedBy, updatedAt: new Date().toISOString(), checks, issues,
    masterClassification: { subjectId: target.master.subjectId, topicId: target.master.topicId },
    warnings: [...new Map([...(sourceVerification?.warnings ?? []), ...(previous.verification?.warnings ?? [])]
      .map(warning => [hashContent(warning), warning])).values()],
    corrections: [...new Map([...(sourceVerification?.corrections ?? []), ...(previous.verification?.corrections ?? []), ...corrections]
      .map(correction => [`${correction.auditReference}:${correction.field}`, correction])).values()],
  });
  const { review: _review, ...classification } = previous.classification ?? {};
  const document = storedProfileSchema.parse({
    ...previous, classification: { ...classification, subject: target.subject, topic: target.topic, subtopics: [], master: target.master },
    verification, embedding: null,
    provenance: { ...(previous.provenance ?? { inputs_used: ["question"],
      answer_status: question.answer ? "provided_not_independently_verified" : "missing", truth_labels_based_on: "not_provided" }),
      needs_review: true,
      review_notes: [...(previous.provenance?.review_notes ?? []),
        `Parent-label review only: ${target.rationale} Subtopic approval and all existing holds remain pending. Audit: ${request.auditReference}`] },
    processing: { ...previous.processing, status: "pending_review", sourceContentHash: sourceHash,
      extractionContentHash: undefined, embeddingInputHash: null, error: reviewFlag(classificationIssues[0]), updatedAt: new Date().toISOString(),
      classificationParentMaintenance: { mode: "classification_parent_only", reviewedBy: request.reviewedBy,
        auditReference: request.auditReference, updatedAt: new Date().toISOString(), previousSourceContentHash: oldHash,
        previousProfileHash: hashContent(previous), review: target,
        retainedIssueCodes: [...new Set(classificationIssues.map(issue => issue.code))], freshConceptReview: false, freshHighlightReview: false } },
  });
  return { question: correctedQuestion, document };
}

export function classificationProfileBase(
  reference: QuestionReference, question: SourceQuestion, config: PipelineConfig,
): StoredProfile {
  return storedProfileSchema.parse({
    id: `${reference.sourceContainer}:${reference.questionId}`,
    sourceContainer: reference.sourceContainer, questionId: reference.questionId, schemaVersion,
    sourceMetadata: { exam: question.exam, year: question.year, paper: question.paper },
    concept_embedding_input: "", embedding: null,
    provenance: {
      inputs_used: ["question", "options", ...(question.answer ? ["provided_answer"] : []),
        ...(question.explanation ? ["provided_explanation"] : [])],
      answer_status: question.answer ? "provided_not_independently_verified" : "missing",
      truth_labels_based_on: "not_provided", needs_review: true,
      review_notes: ["Classification-only placeholder; no concept extraction, role, claim or highlight review was performed."],
    },
    processing: {
      status: "pending_review", sourceContentHash: hashContent(question), embeddingInputHash: null,
      promptVersion: "classification-only-source-review", taxonomyVersion: config.taxonomyVersion,
      extractionModel: "not_extracted:classification_only", embeddingModel,
      embeddingDimensions: config.dimensions, embeddingSpaceVersion: config.embeddingSpaceVersion,
      updatedAt: new Date().toISOString(), error: null,
    },
  });
}

type ConceptDefinition = ConceptResolutionExtraction["concept_definitions"][number];
const sameConceptDefinition = (left: ConceptDefinition, right: ConceptDefinition) =>
  normalizeLabel(left.definition) === normalizeLabel(right.definition) &&
  normalizeLabel(left.subject) === normalizeLabel(right.subject) &&
  normalizeLabel(left.topic) === normalizeLabel(right.topic);

function planCanonicalConcepts(
  extraction: ConceptResolutionExtraction,
  registry: CanonicalConcept[],
  approvedNew: ReadonlyMap<string, CanonicalConcept>,
) {
  assertReviewedConcepts(extraction);
  const definitions = extraction.concept_definitions;
  const plans = definitions.map(definition => {
    const idMatch = registry.find(concept => concept.id === definition.id);
    const label = normalizeLabel(definition.canonical_name);
    const labelMatches = registry.filter(concept => concept.status !== "retired" &&
      [concept.canonical_name, ...concept.aliases].some(name => normalizeLabel(name) === label));
    if (labelMatches.length > 1) throw new ConceptReviewError(`Ambiguous canonical concept name: ${definition.canonical_name}`);
    if (idMatch && labelMatches[0] && idMatch.id !== labelMatches[0].id) {
      throw new ConceptReviewError(`Concept ID and name resolve to different concepts: ${definition.id}`);
    }
    const decision = extraction.concept_review.decisions.find(item => item.concept_id === definition.id)!;
    const concept = decision.decision === "reuse"
      ? registry.find(item => item.id === decision.existing_concept_id)
      : approvedNew.has(definition.id) ? idMatch : undefined;
    if (decision.decision === "reuse" && !concept) {
      throw new ConceptReviewError(`Concept ${definition.id} requests an unknown canonical ID ${decision.existing_concept_id}.`);
    }
    if (concept?.status === "retired") throw new ConceptReviewError(`Concept ${concept.id} is retired and needs review.`);
    const exactMatches = [idMatch, ...labelMatches, ...registry.filter(item =>
      item.status !== "retired" && sameConceptDefinition(item, definition))].filter(item => item !== undefined);
    if (exactMatches.some(item => item.id !== concept?.id)) {
      throw new ConceptReviewError(`Concept ${definition.id} conflicts with an existing identity; review its meaning and scope before creating or merging.`);
    }
    if (!concept) {
      const parents = definition.parentConceptIds;
      if (parents.includes(definition.id) ||
          parents.some(id => !registry.some(item => item.id === id && item.status !== "retired"))) {
        throw new Error(`Concept ${definition.id} has an invalid parent reference.`);
      }
    }
    return { definition, concept, label };
  });
  const targets = plans.map(plan => plan.concept?.id ?? plan.definition.id);
  if (new Set(targets).size !== targets.length) {
    throw new ConceptReviewError("Multiple assigned concepts resolve to the same canonical ID; consolidate their roles before proceeding.");
  }
  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index];
    if (!plan.concept && plans.slice(0, index).some(previous =>
      sameConceptDefinition(previous.definition, plan.definition) ||
      [previous.definition.canonical_name, ...previous.definition.aliases].some(name =>
        [plan.definition.canonical_name, ...plan.definition.aliases].some(other => normalizeLabel(name) === normalizeLabel(other))))) {
      throw new ConceptReviewError(`Proposed concept ${plan.definition.id} duplicates another assignment's definition or name.`);
    }
  }
  return plans;
}

export async function resolveConcepts(
  extraction: ExtractionResponse,
  registry: CanonicalConcept[],
  repository: Pick<ConceptRegistrySession, "createConcept">,
  taxonomyVersion: string,
  approvedNew: ReadonlyMap<string, CanonicalConcept> = new Map(),
): Promise<ProfileExtraction> {
  const plans = planCanonicalConcepts(extraction, registry, approvedNew);
  const mappings = new Map<string, CanonicalConcept>();
  const classificationPlan = plans.find(plan => plan.definition.id === extraction.classification.review.primary_concept_id);
  if (!classificationPlan) throw new ClassificationReviewError("Classification requires a reviewed primary concept.");
  const taxonomyConflict = classificationTaxonomyIssue(
    extraction.classification, classificationPlan.concept ?? classificationPlan.definition,
  );
  if (taxonomyConflict) throw new ClassificationReviewError(taxonomyConflict, true);
  for (const { definition, concept: existing, label } of plans) {
    let concept = existing;
    if (!concept) {
      concept = await repository.createConcept({ ...definition, status: "provisional", taxonomyVersion });
      if (concept.status === "retired" || normalizeLabel(concept.canonical_name) !== label ||
          !sameConceptDefinition(concept, definition)) {
        throw new ConceptReviewError(`Concept ${definition.id} was concurrently created with a different meaning.`);
      }
      registry.push(concept);
    }
    mappings.set(definition.id, concept);
  }
  const remap = (id: string) => {
    const concept = mappings.get(id);
    if (!concept) throw new Error(`Undefined concept mapping: ${id}`);
    return concept;
  };
  const assignments = (items: ProfileExtraction["concept_profile"]["primary_concepts"] |
    ProfileExtraction["concept_profile"]["secondary_concepts"]) =>
    items.map(item => ({
      ...item, concept_id: remap(item.concept_id).id,
      canonical_name: remap(item.concept_id).canonical_name,
    }));
  const primary = assignments(extraction.concept_profile.primary_concepts);
  const secondary = assignments(extraction.concept_profile.secondary_concepts);
  if (new Set([...primary, ...secondary].map(item => item.concept_id)).size !== primary.length + secondary.length) {
    throw new Error("Multiple extracted concepts resolve to the same canonical ID; extraction needs review.");
  }
  const provisional = [...mappings.values()].filter(concept => concept.status === "provisional");
  const classificationConcept = remap(extraction.classification.review.primary_concept_id);
  const classificationConflict = classificationTaxonomyIssue(extraction.classification, classificationConcept);
  return profileExtractionSchema.parse({
    ...extraction,
    classification: {
      ...extraction.classification,
      review: {
        ...extraction.classification.review,
        ...(classificationConflict ? {
          status: "conflict",
          rationale: `${extraction.classification.review.rationale} ${classificationConflict}`,
        } : {}),
        primary_concept_id: classificationConcept.id,
        source_evidence: extraction.classification.review.source_evidence.map(evidence => ({
          ...evidence, concept_id: remap(evidence.concept_id).id,
        })),
      },
    },
    concept_profile: {
      ...extraction.concept_profile,
      primary_concepts: primary,
      secondary_concepts: secondary,
    },
    claims: extraction.claims.map(claim => ({
      ...claim, concept_ids: [...new Set(claim.concept_ids.map(id => remap(id).id))],
    })),
    concept_review: {
      ...extraction.concept_review,
      ...(extraction.concept_review.highlights ? {
        highlights: {
          ...extraction.concept_review.highlights,
          gaps: extraction.concept_review.highlights.gaps.map(gap => ({
            ...gap, concept_id: remap(gap.concept_id).id,
          })),
          extended_excerpts: extraction.concept_review.highlights.extended_excerpts.map(evidence => ({
            ...evidence, concept_id: remap(evidence.concept_id).id,
          })),
        },
      } : {}),
      ...(extraction.concept_review.coverage ? {
        coverage: {
          ...extraction.concept_review.coverage,
          items: extraction.concept_review.coverage.items.map(item => ({
            ...item, concept_ids: item.concept_ids.map(id => remap(id).id),
            source_evidence: item.source_evidence.map(evidence => ({
              ...evidence, concept_id: remap(evidence.concept_id).id,
            })),
          })),
        },
      } : {}),
      decisions: extraction.concept_review.decisions.map(decision => ({
        ...decision, concept_id: remap(decision.concept_id).id,
        source_evidence: decision.source_evidence.map(evidence => ({
          ...evidence, concept_id: remap(evidence.concept_id).id,
        })),
      })),
    },
    ...(extraction.highlight_evidence ? {
      highlight_evidence: extraction.highlight_evidence.map(highlight => ({
        ...highlight, concept_id: remap(highlight.concept_id).id,
      })),
    } : {}),
    provenance: {
      ...extraction.provenance,
      needs_review: extraction.provenance.needs_review || provisional.length > 0 || !!classificationConflict,
      review_notes: [
        ...extraction.provenance.review_notes,
        ...(classificationConflict ? [classificationConflict] : []),
        ...(provisional.length ? [`Provisional concepts: ${provisional.map(concept => concept.id).join(", ")}`] : []),
      ],
    },
  });
}

class StaleSourceError extends Error {}

interface BatchRegistryContext {
  session: ConceptRegistrySession;
  review?: ExtractionBatch["registry_review"];
  approvedNew: Map<string, CanonicalConcept>;
  issue?: ConceptReviewError;
}

export type ImportOutcome = {
  reference: QuestionReference;
} & ({ result: "ready" | "skipped" | "pending_review" } | { error: unknown });

export class ConceptPipeline {
  constructor(
    private readonly repository: PipelineRepository,
    private readonly ai: PipelineAI | EmbeddingAI,
    private readonly config: PipelineConfig,
  ) {}

  async processProvisionalImported(
    entry: ImportedExtraction,
    request: {
      mode: "flagged_similarity"; authorizedBy: string; authorizedAt: string;
      auditReference: string; reason: string; expectedSourceEtag: string; expectedProfileEtag: string;
      issues: { code: string; reason: string }[];
    },
  ): Promise<"ready"> {
    const imported = importedExtractionSchema.parse(entry);
    const reference = { sourceContainer: imported.sourceContainer, questionId: imported.questionId };
    const [source, previous] = await Promise.all([
      this.repository.readQuestionSnapshot(reference),
      this.repository.readProfile(`${reference.sourceContainer}:${reference.questionId}`),
    ]);
    if (!previous || source.etag !== request.expectedSourceEtag || previous.etag !== request.expectedProfileEtag ||
        hashContent(source.question) !== imported.sourceContentHash) throw new Error("Provisional source/profile binding changed.");
    if (!source.verification || !previous.document.verification ||
        source.verification.status === "verified" || previous.document.verification.status === "verified") {
      throw new Error("Provisional processing requires existing unverified reviews; verified records need normal maintenance.");
    }
    const response = validateExtraction(imported.extraction, source.question);
    const coverageIssue = coverageReviewIssue(response, source.question);
    if (coverageIssue) throw new Error(coverageIssue);
    const classification = response.classification;
    const mapping = classification.master;
    const master = mapping && await this.repository.readMasterClassification(mapping.subjectId, mapping.topicId, mapping.subtopicIds);
    const classificationDependencies = source.verification.issues.filter(issue => issue.check === "master_classification");
    const supportedParentsWithDependency = classification.review?.status === "supported" &&
      classificationDependencies.length > 0 &&
      classificationDependencies.every(issue => issue.code === "CLASSIFICATION_DEPENDENCY_REVIEW_REQUIRED");
    if (!mapping || !master || master.subject !== classification.subject || master.topic !== classification.topic ||
        source.question.subject !== classification.subject || source.question.topic !== classification.topic ||
        (source.verification.checks.master_classification.status !== "passed" && !supportedParentsWithDependency) ||
        mapping.subtopicIds.some((id, index) => master.subtopics?.find(item => item.id === id)?.name !== classification.subtopics[index])) {
      throw new Error("Provisional embeddings still require supported active source classification.");
    }
    const extraction = profileExtractionSchema.parse({
      ...response,
      provenance: { ...response.provenance, needs_review: true,
        review_notes: [...new Set([...response.provenance.review_notes, request.reason])] },
    });
    const input = buildProvisionalEmbeddingInput(extraction);
    const provisional = {
      mode: request.mode, authorizedBy: request.authorizedBy, authorizedAt: request.authorizedAt,
      auditReference: request.auditReference, reason: request.reason, sourceContentHash: imported.sourceContentHash,
      reviewLevel: "advisory" as const,
      profileExtractionHash: hashContent(extraction),
      sourceVerificationHash: hashContent(source.verification),
      profileVerificationHash: hashContent(questionVerificationSchema.parse(previous.document.verification)),
      activeProfileHash: hashContent(storedProfileSchema.parse(previous.document)),
      issues: [...new Map([
        { code: "PROVISIONAL_EMBEDDING_REVIEW_PENDING", reason: request.reason },
        ...request.issues,
        ...source.verification.issues.map(({ code, reason }) => ({ code, reason })),
        ...previous.document.verification.issues.map(({ code, reason }) => ({ code, reason })),
      ].map(issue => [`${issue.code}:${issue.reason}`, issue])).values()],
    };
    const document = storedProfileSchema.parse({
      ...previous.document, ...extraction,
      concept_embedding_input: input, embedding: Array(this.config.dimensions).fill(0),
      processing: {
        ...previous.document.processing, status: "ready",
        sourceContentHash: imported.sourceContentHash, extractionContentHash: hashContent(response),
        embeddingInputHash: hashContent(`${embeddingPrefix}${input}`),
        promptVersion, taxonomyVersion: this.config.taxonomyVersion, extractionModel: this.config.extractionModel,
        embeddingModel, embeddingDimensions: this.config.dimensions, embeddingSpaceVersion: this.config.embeddingSpaceVersion,
        updatedAt: new Date().toISOString(),
        error: null,
        provisionalEmbedding: provisional,
      },
    });
    const priorProvisional = await this.repository.readProvisionalProfile?.(document.id);
    const vector = getReusableEmbedding(previous.document, input, this.config)
      ?? getReusableEmbedding(priorProvisional?.document, input, this.config)
      ?? validateVector(await this.ai.embed(input), this.config.dimensions);
    const current = await this.repository.readQuestionSnapshot(reference);
    if (current.etag !== source.etag || hashContent(current.question) !== imported.sourceContentHash ||
        hashContent(current.verification) !== hashContent(source.verification)) throw new Error("Source changed during provisional embedding.");
    document.embedding = vector;
    const active = await this.repository.readProfile(document.id);
    if (active?.etag !== previous.etag) throw new Error("Active profile changed during provisional embedding.");
    const saved = await this.repository.saveProfile(document, previous.etag);
    const confirmed = await this.repository.readProfile(document.id);
    if (!confirmed || confirmed.etag !== saved.etag ||
        confirmed.document.embedding?.every((value, index) => Math.fround(value) === Math.fround(vector[index])) !== true ||
        confirmed.document.embedding.length !== vector.length ||
        hashContent({ ...confirmed.document, embedding: document.embedding }) !== hashContent(document)) {
      throw new Error("Provisional embedding save could not be confirmed.");
    }
    return "ready";
  }

  async saveReviewedConcepts(
    reference: QuestionReference, request: ConceptResolutionRequest,
  ): Promise<"pending_review" | "pending_embedding"> {
    if (!request.reviewedBy.trim() || !request.auditReference.trim()) {
      throw new Error("Concept resolution requires an identified reviewer and audit reference.");
    }
    if (request.creationBatch && request.allowUnadmittedProposals !== undefined) {
      throw new Error("A reviewed creation batch cannot be combined with allowUnadmittedProposals.");
    }
    return this.repository.withConceptRegistry(async session => {
      const [source, existing] = await Promise.all([
        this.repository.readQuestionSnapshot(reference),
        this.repository.readProfile(`${reference.sourceContainer}:${reference.questionId}`),
      ]);
      if (!existing || existing.etag !== request.expectedProfileEtag ||
          source.etag !== request.expectedSourceEtag ||
          hashContent(source.question) !== request.sourceContentHash) {
        throw new Error("Source or profile changed after concept review; nothing was saved.");
      }
      const previous = existing.document;
      if (previous.processing.status !== "pending_review" ||
          previous.processing.sourceContentHash !== request.sourceContentHash ||
          previous.id !== `${reference.sourceContainer}:${reference.questionId}` ||
          previous.sourceContainer !== reference.sourceContainer || previous.questionId !== reference.questionId) {
        throw new Error("Concept-only resolution requires the exact source-bound pending profile.");
      }
      const extraction = validateConceptExtraction(request.extraction, source.question);
      for (const key of ["subject", "topic", "subtopics", "master"] as const) {
        if (hashContent(extraction.classification?.[key] ?? null) !==
            hashContent(previous.classification?.[key] ?? null)) {
          throw new Error(`Concept-only resolution cannot change classification ${key}.`);
        }
      }
      if (previous.classification?.review) {
        if (hashContent(extraction.classification?.review ?? null) !== hashContent(previous.classification.review)) {
          throw new Error("Concept-only resolution cannot change the existing classification review.");
        }
      } else if (extraction.classification?.review?.status === "supported" &&
          (source.verification?.checks.master_classification.status !== "passed" ||
            previous.verification?.checks.master_classification.status !== "passed")) {
        throw new Error("Concept-only resolution cannot certify an unchecked classification.");
      }
      assertReviewedConcepts(extraction);
      const creationBatch = request.creationBatch && conceptResolutionBatchSchema.parse(request.creationBatch);
      const approvedNew = creationBatch
        ? prepareConceptResolutionBatchReview(creationBatch, session.concepts, this.config.taxonomyVersion)
        : new Map<string, CanonicalConcept>();
      if (creationBatch) {
        const member = creationBatch.entries.find(entry =>
          entry.sourceContainer === reference.sourceContainer && entry.questionId === reference.questionId);
        if (!member || member.sourceContentHash !== request.sourceContentHash ||
            hashContent(member.extraction) !== hashContent(extraction) ||
            creationBatch.registry_review.reviewed_by !== request.reviewedBy) {
          throw new Error("The exact current concept-resolution request must belong to its final reviewer's creation batch.");
        }
      }
      const reviewedRegistry = creationBatch
        ? session.concepts.filter(concept => !approvedNew.has(concept.id)) : session.concepts;
      assertConceptAdmission(extraction, source.question, reviewedRegistry, !!creationBatch, [...approvedNew.values()]);
      if (extraction.concept_review.audit.reviewed_by !== request.reviewedBy) {
        throw new Error("The concept-resolution reviewer must match the source-bound concept audit.");
      }
      const proposedConceptIds: string[] = [];
      for (const decision of extraction.concept_review.decisions) {
        if (decision.decision === "new" && creationBatch) {
          const approved = approvedNew.get(decision.concept_id);
          if (!approved) {
            if (session.concepts.some(concept => concept.id === decision.concept_id)) {
              throw new Error(`Unadmitted proposal ${decision.concept_id} now exists; reconcile it before saving.`);
            }
            proposedConceptIds.push(decision.concept_id);
            continue;
          }
          const definition = extraction.concept_definitions.find(item => item.id === decision.concept_id);
          if (!approved || !definition ||
              registryFingerprint([{ ...definition, status: "provisional", taxonomyVersion: this.config.taxonomyVersion }]) !==
                registryFingerprint([approved])) {
            throw new Error(`Concept ${decision.concept_id} is not an identical approved batch definition.`);
          }
          continue;
        }
        if (decision.decision === "new" && request.allowUnadmittedProposals) {
          if (session.concepts.some(concept => concept.id === decision.concept_id)) {
            throw new Error(`Proposed concept ${decision.concept_id} already exists; reconcile its identity before saving.`);
          }
          proposedConceptIds.push(decision.concept_id);
          continue;
        }
        const canonical = session.concepts.find(concept => concept.id === decision.concept_id);
        if (decision.decision !== "reuse" || decision.existing_concept_id !== decision.concept_id ||
            !canonical || canonical.status === "retired") {
          throw new Error("Concept-only saving requires normalized existing canonical IDs; new identities require a reviewed creation batch.");
        }
        const { status, taxonomyVersion, retirement, ...definition } = canonical;
        if (hashContent(definition) !== hashContent(extraction.concept_definitions.find(item => item.id === canonical.id))) {
          throw new Error(`Canonical meaning or metadata changed for ${canonical.id}; review the current definition.`);
        }
      }
      const canonicalPlans = creationBatch ? planCanonicalConcepts({
        ...extraction, concept_definitions: extraction.concept_definitions
          .filter(definition => !proposedConceptIds.includes(definition.id)),
      }, session.concepts, approvedNew) : [];
      const admittedConceptIds = creationBatch
        ? extraction.concept_review.decisions.filter(decision => decision.decision === "new" && approvedNew.has(decision.concept_id))
          .map(decision => decision.concept_id) : [];
      const base = source.verification ?? previous.verification;
      if (!base || base.sourceContentHash !== request.sourceContentHash ||
          (previous.verification && previous.verification.sourceContentHash !== request.sourceContentHash)) {
        throw new Error("Concept resolution requires current source-bound verification metadata.");
      }
      for (const check of ["question", "answer", "explanation", "master_classification"] as const) {
        if (source.verification && previous.verification &&
            hashContent(source.verification.checks[check]) !== hashContent(previous.verification.checks[check])) {
          throw new Error(`Source/profile ${check} checks disagree; reconcile them before concept-only saving.`);
        }
      }
      const issues = [...new Map([...base.issues, ...(previous.verification?.issues ?? [])]
        .map(issue => [`${issue.check}:${issue.code}:${issue.reason}`, issue])).values()];
      const resolved = new Set(request.resolvedIssueCodes);
      for (const code of resolved) {
        const matching = issues.filter(issue => issue.code === code);
        if (!matching.length || matching.some(issue => issue.check !== "concepts") ||
            code === "CLASSIFICATION_EMBEDDING_MAINTENANCE_REQUIRED") {
          throw new Error(`Concept-only saving cannot clear ${code}; retain unrelated or embedding-maintenance holds.`);
        }
        if (code === "CONCEPT_BATCH_REVIEW_REQUIRED" && proposedConceptIds.length) {
          throw new Error("Unadmitted concept definitions cannot resolve CONCEPT_BATCH_REVIEW_REQUIRED.");
        }
      }
      const retained = issues.filter(issue => !resolved.has(issue.code));
      if (proposedConceptIds.length) {
        retained.push({
          code: "CONCEPT_BATCH_REVIEW_REQUIRED", check: "concepts",
          reason: "The saved concept extraction contains proposed identities that have not been globally reconciled or admitted.",
          requiredAction: "Compare these meanings with the current registry and all worker proposals; admit only the final reconciled identities through a reviewed creation batch.",
          evidence: [request.auditReference, ...proposedConceptIds],
        });
      }
      const conceptIssues = retained.filter(issue => issue.check === "concepts");
      const reviewedAt = new Date().toISOString();
      const verification = questionVerificationSchema.parse({
        ...base, status: retained.length ? "pending_review" : "unverified",
        reviewedBy: request.reviewedBy, updatedAt: reviewedAt,
        extractionContentHash: hashContent(extraction),
        checks: { ...base.checks, concepts: {
          status: conceptIssues.length ? "pending_review" : "passed",
          reason: conceptIssues.length ? conceptIssues.map(issue => issue.reason).join(" ")
            : "Source-bound concept meaning, scope, roles, coverage and highlights reviewed; no other checks were performed.",
          evidence: [request.auditReference],
        } },
        issues: retained,
        warnings: base.warnings === undefined && previous.verification?.warnings === undefined ? undefined
          : [...new Map([...(base.warnings ?? []), ...(previous.verification?.warnings ?? [])]
            .map(warning => [hashContent(warning), warning])).values()],
        corrections: [...new Map([...base.corrections, ...(previous.verification?.corrections ?? [])]
          .map(correction => [hashContent(correction), correction])).values()],
      });
      const input = extraction.classification
        ? formatEmbeddingInput({ concept_profile: extraction.concept_profile, classification: extraction.classification }) : "";
      const { concept_definitions, ...reviewedProfile } = extraction;
      const document = storedProfileSchema.parse({
        ...previous, ...reviewedProfile, verification, embedding: null,
        concept_embedding_input: input,
        provenance: {
          ...extraction.provenance, needs_review: retained.length > 0 || extraction.provenance.needs_review,
          review_notes: [...new Set([...(previous.provenance?.review_notes ?? []),
            ...extraction.provenance.review_notes,
            `Concept-only resolution: ${request.auditReference}. Other verification checks were preserved; no embedding was generated.`])],
        },
        processing: { ...previous.processing,
          status: retained.length ? "pending_review" : "pending_embedding",
          promptVersion, extractionModel: request.reviewedBy,
          extractionContentHash: hashContent(extraction),
          embeddingInputHash: input ? hashContent(`${embeddingPrefix}${input}`) : null,
          updatedAt: reviewedAt, error: retained.length ? reviewFlag(retained[0]) : null,
          conceptResolution: { mode: "concepts_only", reviewedBy: request.reviewedBy,
            auditReference: request.auditReference, updatedAt: reviewedAt,
            previousProfileHash: hashContent(previous), registryFingerprint: registryFingerprint(session.concepts),
            resolvedIssueCodes: [...resolved], retainedIssueCodes: [...new Set(retained.map(issue => issue.code))],
            proposedConceptIds,
            ...(creationBatch ? { admittedConceptIds, creationBatchReview: creationBatch.registry_review } : {}),
            freshConceptReview: true, freshHighlightReview: true },
        },
      });
      const [currentSource, currentProfile] = await Promise.all([
        this.repository.readQuestionSnapshot(reference), this.repository.readProfile(previous.id),
      ]);
      if (currentSource.etag !== source.etag || currentProfile?.etag !== existing.etag ||
          hashContent(currentSource.question) !== request.sourceContentHash) {
        throw new Error("Source or profile changed during concept review; nothing was saved.");
      }
      for (const { definition, concept } of canonicalPlans) {
        if (concept) continue;
        const approved = approvedNew.get(definition.id);
        if (!approved) throw new Error(`Missing approved canonical plan ${definition.id}.`);
        const created = await session.createConcept(approved);
        if (registryFingerprint([created]) !== registryFingerprint([approved])) {
          throw new ConceptReviewError(`Canonical creation of ${definition.id} did not confirm the exact approved definition.`);
        }
        session.concepts.push(created);
      }
      await this.repository.saveQuestionVerification(reference, verification, currentSource);
      const saved = await this.repository.saveProfile(document, existing.etag);
      const [confirmedSource, confirmedProfile] = await Promise.all([
        this.repository.readQuestionSnapshot(reference), this.repository.readProfile(previous.id),
      ]);
      if (!confirmedProfile || confirmedProfile.etag !== saved.etag ||
          hashContent(confirmedProfile.document) !== hashContent(saved.document) ||
          hashContent(confirmedSource.question) !== request.sourceContentHash ||
          hashContent(confirmedSource.verification ?? null) !== hashContent(verification)) {
        throw new Error("Concept-only source/profile writes could not be confirmed; reconcile their saved snapshots.");
      }
      return document.processing.status === "pending_review" ? "pending_review" : "pending_embedding";
    });
  }

  async maintainSubtopics(reference: QuestionReference, request: SubtopicMaintenanceRequest): Promise<"ready"> {
    return this.repository.withConceptRegistry(async session => {
      const id = `${reference.sourceContainer}:${reference.questionId}`;
      const [source, existing] = await Promise.all([
        this.repository.readQuestionSnapshot(reference), this.repository.readProfile(id),
      ]);
      if (!existing || !request.expectedSourceEtag || !request.expectedProfileEtag ||
          source.etag !== request.expectedSourceEtag || existing.etag !== request.expectedProfileEtag ||
          existing.document.id !== id || existing.document.sourceContainer !== reference.sourceContainer ||
          existing.document.questionId !== reference.questionId) {
        throw new Error("Source or profile changed after the subtopic backup; nothing was saved.");
      }
      const pointer = existing.document.classification?.master;
      if (!pointer) throw new Error("Subtopic maintenance requires an existing master parent.");
      const childIds = request.review.subtopics.map(child => child.id);
      const master = await this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, childIds);
      const plan = planSubtopicMaintenance(existing.document, source.question, source.verification,
        session.concepts, master, this.config, request);
      const [currentSource, currentProfile, currentMaster] = await Promise.all([
        this.repository.readQuestionSnapshot(reference), this.repository.readProfile(id),
        this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, childIds),
      ]);
      if (currentSource.etag !== source.etag || currentProfile?.etag !== existing.etag ||
          hashContent(currentSource.question) !== hashContent(source.question) ||
          hashContent(currentSource.verification ?? null) !== hashContent(source.verification ?? null) ||
          hashContent(currentMaster ?? null) !== hashContent(master ?? null)) {
        throw new Error("Source, profile or master changed during subtopic maintenance; nothing was saved.");
      }
      try {
        const saved = await this.repository.saveSubtopicProfile(plan.document, existing.etag);
        const [confirmedSource, confirmedProfile, confirmedMaster] = await Promise.all([
          this.repository.readQuestionSnapshot(reference), this.repository.readProfile(id),
          this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, childIds),
        ]);
        if (!confirmedProfile || confirmedProfile.etag !== saved.etag ||
            hashContent(confirmedProfile.document) !== hashContent(plan.document) ||
            confirmedSource.etag !== source.etag ||
            hashContent(confirmedSource.question) !== hashContent(source.question) ||
            hashContent(confirmedSource.verification ?? null) !== hashContent(source.verification ?? null) ||
            hashContent(confirmedMaster ?? null) !== hashContent(master ?? null)) {
          throw new Error("Subtopic-only read-back or its source/master binding changed.");
        }
      } catch (error) {
        throw new Error("Subtopic maintenance outcome requires reconciliation against its backed-up source/profile; do not retry blindly.", { cause: error });
      }
      return "ready" as const;
    });
  }

  async maintainClassification(reference: QuestionReference, request: ClassificationMaintenanceRequest): Promise<"pending_review"> {
    const source = await this.repository.readQuestionSnapshot(reference);
    const existing = await this.repository.readProfile(`${reference.sourceContainer}:${reference.questionId}`);
    if ((request.expectedSourceEtag && source.etag !== request.expectedSourceEtag) ||
        (request.expectedProfileEtag !== undefined && (existing?.etag ?? null) !== request.expectedProfileEtag)) {
      throw new Error("Source or profile changed after the classification backup; nothing was saved.");
    }
    const previous = existing?.document ?? classificationProfileBase(reference, source.question, this.config);
    if (previous.sourceContainer !== reference.sourceContainer || previous.questionId !== reference.questionId ||
        previous.id !== `${reference.sourceContainer}:${reference.questionId}`) {
      throw new Error("Stored profile identity does not match the reviewed source reference.");
    }
    const pointer = request.classification.master;
    const master = await this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, pointer.subtopicIds);
    const plan = planClassificationMaintenance(previous, source.question, source.verification, master, request);
    if (!existing) {
      plan.document.processing.classificationMaintenance!.createdProfile = true;
      plan.document.processing.classificationMaintenance!.previousProfileHash = hashContent(null);
    }
    const [currentProfile, currentMaster] = await Promise.all([
      this.repository.readProfile(previous.id),
      this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, pointer.subtopicIds),
    ]);
    if (currentProfile?.etag !== existing?.etag || hashContent(currentMaster ?? null) !== hashContent(master ?? null)) {
      throw new Error("Profile or active master changed during classification maintenance; nothing was saved.");
    }
    await this.repository.saveQuestionClassification(reference, plan.question, plan.document.verification!, source);
    const saved = await this.repository.saveProfile(plan.document, existing?.etag);
    const [confirmedSource, confirmedProfile] = await Promise.all([
      this.repository.readQuestionSnapshot(reference), this.repository.readProfile(previous.id),
    ]);
    if (!confirmedProfile || confirmedProfile.etag !== saved.etag ||
        hashContent(confirmedProfile.document) !== hashContent(saved.document) ||
        hashContent(confirmedSource.question) !== hashContent(plan.question) ||
        hashContent(confirmedSource.verification) !== hashContent(saved.document.verification)) {
      throw new Error("Classification maintenance source/profile writes could not be confirmed.");
    }
    return "pending_review";
  }

  async maintainClassificationParents(reference: QuestionReference, request: ClassificationParentMaintenanceRequest): Promise<"pending_review"> {
    const source = await this.repository.readQuestionSnapshot(reference);
    const existing = await this.repository.readProfile(`${reference.sourceContainer}:${reference.questionId}`);
    if (!request.expectedSourceEtag || request.expectedProfileEtag === undefined ||
      source.etag !== request.expectedSourceEtag || (existing?.etag ?? null) !== request.expectedProfileEtag)
      throw new Error("Parent maintenance requires current backed-up source/profile ETags.");
    const previous = existing?.document ?? classificationProfileBase(reference, source.question, this.config);
    if (previous.id !== `${reference.sourceContainer}:${reference.questionId}` ||
      previous.sourceContainer !== reference.sourceContainer || previous.questionId !== reference.questionId)
      throw new Error("Parent maintenance profile identity does not match the source.");
    const pointer = request.classification.master;
    const master = await this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, []);
    const plan = planClassificationParentMaintenance(previous, source.question, source.verification, master, request);
    if (!existing) {
      plan.document.processing.classificationParentMaintenance!.createdProfile = true;
      plan.document.processing.classificationParentMaintenance!.previousProfileHash = hashContent(null);
    }
    const [currentProfile, currentMaster] = await Promise.all([
      this.repository.readProfile(previous.id), this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, []),
    ]);
    if (currentProfile?.etag !== existing?.etag || hashContent(currentMaster ?? null) !== hashContent(master ?? null))
      throw new Error("Profile or active parents changed during maintenance; nothing was saved.");
    await this.repository.saveQuestionClassification(reference, plan.question, plan.document.verification!, source);
    const saved = await this.repository.saveProfile(plan.document, existing?.etag);
    const [confirmedSource, confirmedProfile] = await Promise.all([
      this.repository.readQuestionSnapshot(reference), this.repository.readProfile(previous.id),
    ]);
    if (!confirmedProfile || confirmedProfile.etag !== saved.etag || hashContent(confirmedProfile.document) !== hashContent(saved.document) ||
      hashContent(confirmedSource.question) !== hashContent(plan.question) ||
      hashContent(confirmedSource.verification) !== hashContent(saved.document.verification))
      throw new Error("Parent-only source/profile writes could not be confirmed.");
    return "pending_review";
  }

  async maintainEmbedding(reference: QuestionReference, request: EmbeddingMaintenanceRequest): Promise<"ready"> {
    const source = await this.repository.readQuestionSnapshot(reference);
    const existing = await this.repository.readProfile(`${reference.sourceContainer}:${reference.questionId}`);
    if (!existing) throw new Error("Embedding maintenance cannot create a missing profile.");
    const pointer = request.classification.master;
    const master = pointer
      ? await this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, pointer.subtopicIds) : undefined;
    const plan = planEmbeddingMaintenance(
      existing.document, source.question, source.verification, await this.repository.listConcepts(),
      master, this.config, request,
    );
    const vector = plan.reusedEmbedding ?? validateVector(await this.ai.embed(plan.input), this.config.dimensions);
    return this.repository.withConceptRegistry<"ready">(async session => {
      if (registryFingerprint(session.concepts) !== plan.registryFingerprint) {
        throw new Error("Canonical registry changed during maintenance; recheck the plan before saving.");
      }
      const current = await this.repository.readQuestionSnapshot(reference);
      if (current.etag !== source.etag || hashContent(current.question) !== hashContent(source.question)) {
        throw new StaleSourceError("Source changed during embedding maintenance; nothing was saved.");
      }
      const currentMaster = pointer
        ? await this.repository.readMasterClassification(pointer.subjectId, pointer.topicId, pointer.subtopicIds) : undefined;
      if (hashContent(currentMaster ?? null) !== hashContent(master ?? null)) {
        throw new Error("Active master changed during embedding maintenance; nothing was saved.");
      }
      const currentProfile = await this.repository.readProfile(existing.document.id);
      if (currentProfile?.etag !== existing.etag) throw new Error("Profile changed during embedding maintenance; nothing was saved.");
      const document: StoredProfile = {
        ...plan.document, embedding: vector,
        processing: { ...plan.document.processing, status: "ready", updatedAt: new Date().toISOString() },
      };
      await this.repository.saveQuestionVerification(reference, document.verification!, current);
      const saved = await this.repository.saveProfile(document, existing.etag);
      const readback = await this.repository.readProfile(document.id);
      if (!readback || readback.etag !== saved.etag || hashContent(readback.document) !== hashContent(saved.document)) {
        throw new Error("Embedding maintenance profile write could not be confirmed.");
      }
      return "ready";
    });
  }

  async processImported(entry: ImportedExtraction, force = false): Promise<"ready" | "skipped" | "pending_review"> {
    const imported = importedExtractionSchema.parse(entry);
    return this.process({ sourceContainer: imported.sourceContainer, questionId: imported.questionId }, force, imported);
  }

  async processImportedBatch(
    input: ExtractionBatch, force = false, onOutcome?: (outcome: ImportOutcome) => void,
    registrySession?: ConceptRegistrySession,
  ): Promise<ImportOutcome[]> {
    const batch = extractionBatchSchema.parse(input);
    for (const entry of batch.entries) {
      const question = await this.repository.readQuestion(entry);
      if (hashContent(question) !== entry.sourceContentHash) {
        throw new Error(`Outdated source hash for ${entry.sourceContainer}:${entry.questionId}. No batch processing started.`);
      }
      const extraction = validateExtraction(entry.extraction, question);
      validateVerificationBinding(entry.verification, entry.sourceContentHash, hashContent(extraction));
    }
    const run = async (context?: BatchRegistryContext) => {
      const outcomes: ImportOutcome[] = [];
      for (const entry of batch.entries) {
        const reference = { sourceContainer: entry.sourceContainer, questionId: entry.questionId };
        let outcome: ImportOutcome;
        try {
          outcome = { reference, result: await this.processQuestion(reference, force, entry, context) };
        } catch (error) {
          outcome = { reference, error };
        }
        outcomes.push(outcome);
        onOutcome?.(outcome);
      }
      return outcomes;
    };
    if (!batch.registry_review) return run();
    const coordinated = async (session: ConceptRegistrySession) => {
      const context: BatchRegistryContext = { session, review: batch.registry_review, approvedNew: new Map() };
      try {
        context.approvedNew = prepareBatchReview(batch, session.concepts, this.config.taxonomyVersion);
      } catch (error) {
        if (!(error instanceof ConceptReviewError)) throw error;
        context.issue = error;
      }
      return run(context);
    };
    return registrySession ? coordinated(registrySession) : this.repository.withConceptRegistry(coordinated);
  }

  async process(reference: QuestionReference, force = false, imported?: ImportedExtraction): Promise<"ready" | "skipped" | "pending_review"> {
    return this.processQuestion(reference, force, imported);
  }

  private async processQuestion(
    reference: QuestionReference, force = false, imported?: ImportedExtraction, batch?: BatchRegistryContext,
  ): Promise<"ready" | "skipped" | "pending_review"> {
    const id = `${reference.sourceContainer}:${reference.questionId}`;
    let questionSnapshot = await this.repository.readQuestionSnapshot(reference);
    const question = questionSnapshot.question;
    const sourceHash = hashContent(question);
    if (imported && imported.sourceContentHash !== sourceHash) {
      throw new Error(`Imported extraction for ${id} has an outdated source hash; extract the current question again.`);
    }
    const importedResponse = imported ? validateExtraction(imported.extraction, question) : undefined;
    const extractionContentHash = importedResponse ? hashContent(importedResponse) : undefined;
    if (importedResponse) validateVerificationBinding(imported.verification, sourceHash, extractionContentHash);
    const existing = await this.repository.readProfile(id);
    const previous = existing?.document;
    const previousParse = previous?.classification ? profileExtractionSchema.safeParse(previous) : undefined;
    const classificationOnlyHold = previous?.processing.status === "pending_review" &&
      (previous.processing.classificationMaintenance?.mode === "classification_only" ||
        previous.processing.classificationParentMaintenance?.mode === "classification_parent_only") &&
      previous.embedding === null &&
      previous.verification?.checks.concepts.status === "pending_review";
    const conceptsOnlyHold = previous?.embedding === null &&
      ["pending_review", "pending_embedding"].includes(previous.processing.status) &&
      previous.processing.conceptResolution?.mode === "concepts_only";
    if (previousParse && !previousParse.success && !classificationOnlyHold && !conceptsOnlyHold) throw previousParse.error;
    const previousExtraction = previousParse?.success ? previousParse.data : undefined;
    const sameExtraction = previous?.processing.sourceContentHash === sourceHash &&
      previous.schemaVersion === schemaVersion &&
      previous.processing.promptVersion === promptVersion &&
      previous.processing.taxonomyVersion === this.config.taxonomyVersion &&
      previous.processing.extractionModel === this.config.extractionModel &&
      !!previousExtraction && !classificationReviewIssue(previousExtraction) && !conceptReviewIssue(previousExtraction) &&
      previousExtraction.concept_review?.audit?.source_content_hash === sourceHash &&
      !coverageReviewIssue(previousExtraction, question) &&
      !batch?.issue &&
      (!imported || previous.processing.extractionContentHash === extractionContentHash);
    let verification = verificationForSource(
      questionSnapshot.verification ?? previous?.verification, sourceHash, sameExtraction && !force,
    );
    for (const issue of previous?.verification?.issues ?? []) {
      const canonical = questionSnapshot.verification;
      if (!canonical || canonical.sourceContentHash !== sourceHash ||
          (!hasAcknowledgedSourceWarning(canonical, issue) &&
            (!canonical.reviewedBy || canonical.checks[issue.check].status !== "passed" ||
              !canonical.checks[issue.check].evidence.length))) {
        verification = flagQuestionForReview(verification, issue);
      }
    }
    if (previous?.processing.status === "pending_review" && !previous.verification) {
      const flag = previous.processing.error?.match(/^REVIEW_FLAG\[([A-Z][A-Z0-9_]*)\]:\s*(.*)$/s);
      verification = flagQuestionForReview(verification, {
        code: flag?.[1] ?? "LEGACY_REVIEW_REQUIRED",
        check: "question",
        reason: flag?.[2] || previous.processing.error || "This profile has an unresolved legacy review flag.",
        requiredAction: "Resolve the recorded issue with evidence and submit a source-bound review; retrying is not a resolution.",
        evidence: previous.provenance?.review_notes ?? [],
      });
    }
    if (imported?.verification) {
      const supplied = imported.verification;
      const unresolved = verification.issues.filter(issue =>
        !hasAcknowledgedSourceWarning(supplied, issue) &&
        (!supplied.reviewedBy || supplied.checks[issue.check].status !== "passed" ||
          !supplied.checks[issue.check].evidence.length));
      const corrections = [...new Map([
        ...verification.corrections, ...supplied.corrections,
      ].map(correction => [`${correction.auditReference}:${correction.field}`, correction])).values()];
      const retainedWarnings = (verification.warnings ?? []).filter(warning =>
        !supplied.reviewedBy || supplied.checks[warning.check].status !== "passed" ||
        !supplied.checks[warning.check].evidence.length);
      const warnings = [...new Map([
        ...retainedWarnings, ...(supplied.warnings ?? []),
      ].map(warning => [warning.code, warning])).values()];
      verification = questionVerificationSchema.parse({
        ...supplied, corrections,
        ...(warnings.length ? { warnings } : {}),
      });
      for (const issue of unresolved) verification = flagQuestionForReview(verification, issue);
    }
    const assertVerification = async (extraction?: ProfileExtraction) => {
      const classification = extraction?.classification;
      if (classification?.master) {
        const { subjectId, topicId, subtopicIds } = classification.master;
        const master = await this.repository.readMasterClassification(subjectId, topicId, subtopicIds);
        if (!master || normalizeLabel(classification.subject) !== normalizeLabel(master.subject) ||
            normalizeLabel(classification.topic) !== normalizeLabel(master.topic) ||
            subtopicIds.length !== classification.subtopics.length ||
            subtopicIds.some((id, index) =>
              normalizeLabel(master.subtopics?.find(record => record.id === id)?.name ?? "") !==
                normalizeLabel(classification.subtopics[index]))) {
          throw new QuestionReviewError({
            code: "MASTER_SUBTOPIC_MISMATCH", check: "master_classification",
            reason: "Extraction subject/topic/subtopic IDs and names must match active master records under the same parent.",
            requiredAction: "Review the active master hierarchy and bind each extracted subtopic to its correct ID and name.",
            evidence: [`${subjectId}/${topicId}`, ...subtopicIds],
          });
        }
      }
      if (verification.checks.master_classification.status === "passed") {
        const pointer = verification.masterClassification;
        const master = pointer
          ? await this.repository.readMasterClassification(pointer.subjectId, pointer.topicId) : undefined;
        if (!master || normalizeLabel(question.subject ?? "") !== normalizeLabel(master.subject) ||
            normalizeLabel(question.topic ?? "") !== normalizeLabel(master.topic) ||
            (extraction && (normalizeLabel(extraction.classification.subject) !== normalizeLabel(master.subject) ||
              normalizeLabel(extraction.classification.topic) !== normalizeLabel(master.topic)))) {
          throw new QuestionReviewError({
            code: "MASTER_CLASSIFICATION_MISMATCH", check: "master_classification",
            reason: "Verified classification must match an active master subject/topic pair and the current question and profile labels.",
            requiredAction: "Review the content, correct the approved source labels and master IDs, and submit a source-bound review.",
            evidence: pointer ? [`${pointer.subjectId}/${pointer.topicId}`] : [],
          });
        }
      }
      if (verification.status === "pending_review") throw new QuestionReviewError(verification.issues[0]);
      if (extraction?.provenance.answer_status === "conflict_detected" ||
          extraction?.provenance.truth_labels_based_on === "conflicting_sources") {
        throw new QuestionReviewError({
          code: "ANSWER_EXPLANATION_CONFLICT", check: "answer",
          reason: "The supplied answer or explanation contains an unresolved source conflict.",
          requiredAction: "Check the original question and authoritative answer evidence; document a supported resolution.",
          evidence: extraction.provenance.review_notes,
        });
      }
      if (verification.status !== "verified") return;
      if (verification.extractionContentHash !== (extractionContentHash ?? previous?.processing.extractionContentHash)) {
        throw new QuestionReviewError({
          code: "VERIFIED_EXTRACTION_MISMATCH", check: "concepts",
          reason: "The question's verified concept review refers to a different extraction.",
          requiredAction: "Import the reviewed extraction or review the current concept assignments before marking them verified.",
          evidence: verification.extractionContentHash ? [verification.extractionContentHash] : [],
        });
      }
      if (extraction?.provenance.needs_review) {
        throw new QuestionReviewError({
          code: "UNRESOLVED_PROVENANCE_REVIEW", check: "concepts",
          reason: "A fully verified question cannot retain unresolved extraction review warnings.",
          requiredAction: "Resolve and document the provenance warnings before marking the question verified.",
          evidence: extraction.provenance.review_notes,
        });
      }
    };
    let verificationIssue: QuestionReviewError | undefined;
    try {
      await assertVerification(importedResponse ?? previousExtraction);
    } catch (error) {
      if (!(error instanceof QuestionReviewError)) throw error;
      verificationIssue = error;
    }
    if (!force && sameExtraction && !verificationIssue) {
      const extraction = profileExtractionSchema.parse(previous);
      const input = buildEmbeddingInput(extraction);
      if (getReusableEmbedding(previous, input, this.config)) {
        questionSnapshot = await this.repository.saveQuestionVerification(reference, verification, questionSnapshot);
        if (JSON.stringify(previous.verification) !== JSON.stringify(verification)) {
          await this.repository.saveProfile({ ...previous, verification }, existing.etag);
        }
        return "skipped";
      }
    }
    if (previous && ["extracting", "embedding"].includes(previous.processing.status) &&
        Date.now() - Date.parse(previous.processing.updatedAt) < 15 * 60_000) {
      throw new Error(`Profile ${id} is already processing. Retry after the lease expires.`);
    }
    const reusable = !force && sameExtraction && previous?.classification
      ? profileExtractionSchema.parse(previous) : undefined;
    let document: StoredProfile = {
      id, ...reference, schemaVersion,
      sourceMetadata: { exam: question.exam, year: question.year, paper: question.paper },
      ...(reusable ?? {}),
      verification,
      concept_embedding_input: "",
      embedding: null,
      processing: {
        status: reusable ? "embedding" : "extracting",
        sourceContentHash: sourceHash,
        embeddingInputHash: null,
        promptVersion,
        taxonomyVersion: this.config.taxonomyVersion,
        extractionModel: this.config.extractionModel,
        ...(extractionContentHash ? { extractionContentHash } : {}),
        embeddingModel,
        embeddingDimensions: this.config.dimensions,
        embeddingSpaceVersion: this.config.embeddingSpaceVersion,
        updatedAt: new Date().toISOString(),
        error: null,
      },
    };
    let snapshot: ProfileSnapshot = await this.repository.saveProfile(document, existing?.etag);
    const persist = async (syncQuestion = true) => {
      document.processing.updatedAt = new Date().toISOString();
      if (syncQuestion) {
        questionSnapshot = await this.repository.saveQuestionVerification(reference, document.verification, questionSnapshot);
      }
      snapshot = await this.repository.saveProfile(document, snapshot.etag);
    };
    try {
      if (verificationIssue) throw verificationIssue;
      let extraction = reusable;
      if (!extraction) {
        let response = importedResponse;
        if (!response) {
          if (!("extract" in this.ai)) throw new Error("This embedding-only provider requires an imported extraction.");
          response = validateExtraction(await this.ai.extract(question, await this.repository.listConcepts()), question);
        }
        const extracted = profileExtractionSchema.parse(response);
        document = { ...document, ...extracted };
        await assertVerification(extracted);
        assertReviewedClassification(extracted);
        const proposal = response;
        const admit = async (session: ConceptRegistrySession) => {
          let reviewed = proposal;
          if (batch?.issue) throw batch.issue;
          if (!imported) {
            if (!("reviewConcepts" in this.ai)) throw new ConceptReviewError("Concept identity and role review is required.");
            const review = conceptReviewSchema.parse(await this.ai.reviewConcepts(question, proposal, session.concepts));
            reviewed = validateExtraction({
              ...proposal,
              concept_review: bindConceptReview(question, proposal, session.concepts, this.config.extractionModel, review),
            }, question);
          } else if (batch?.review && proposal.concept_review) {
            reviewed = {
              ...proposal,
              concept_review: {
                ...proposal.concept_review,
                audit: {
                  reviewed_by: batch.review.reviewed_by, reviewed_at: batch.review.reviewed_at,
                  registry_fingerprint: batch.review.registry_fingerprint,
                  batch_proposals_fingerprint: batch.review.proposals_fingerprint,
                  source_content_hash: sourceHash, proposal_fingerprint: proposalFingerprint(proposal),
                },
              },
            };
          }
          document = { ...document, ...profileExtractionSchema.parse(reviewed) };
          assertReviewedConcepts(reviewed);
          assertConceptAdmission(
            reviewed, question, session.concepts, !!batch?.review, batch ? [...batch.approvedNew.values()] : [],
          );
          const current = await this.repository.readQuestion(reference);
          if (hashContent(current) !== sourceHash) throw new StaleSourceError(`Source question ${id} changed before concept admission.`);
          return resolveConcepts(reviewed, session.concepts, session, this.config.taxonomyVersion, batch?.approvedNew);
        };
        extraction = batch ? await admit(batch.session) : await this.repository.withConceptRegistry(admit);
      }
      document = { ...document, ...extraction };
      await assertVerification(extraction);
      const highlightIssue = highlightReviewIssue(extraction, question);
      if (highlightIssue) throw new ConceptReviewError(highlightIssue, "HIGHLIGHT_REVIEW_REQUIRED");
      const input = buildEmbeddingInput(extraction);
      if (document.verification.checks.concepts.status !== "passed") {
        document.verification = questionVerificationSchema.parse({
          ...document.verification,
          updatedAt: new Date().toISOString(),
          checks: {
            ...document.verification.checks,
            concepts: {
              status: "passed",
              evidence: [...new Set(extraction.concept_review.decisions.flatMap(decision =>
                decision.source_evidence.map(evidence => evidence.exact_text)))],
            },
          },
        });
      }
      document = {
        ...document,
        concept_embedding_input: input,
        processing: {
          ...document.processing, status: "pending_embedding",
          embeddingInputHash: hashContent(`${embeddingPrefix}${input}`),
        },
      };
      await persist();
      document.processing.status = "embedding";
      await persist();
      const reusedVector = !force ? getReusableEmbedding(previous, input, this.config) : undefined;
      const vector = reusedVector ?? validateVector(await this.ai.embed(input), this.config.dimensions);
      const latest = await this.repository.readQuestion(reference);
      if (hashContent(latest) !== sourceHash) throw new StaleSourceError(`Source question ${id} changed during processing.`);
      document.embedding = vector;
      document.processing.status = "ready";
      await persist();
      return "ready";
    } catch (error) {
      document.embedding = null;
      const requiresReview = error instanceof ClassificationReviewError || error instanceof ConceptReviewError ||
        error instanceof QuestionReviewError;
      const staleSource = error instanceof StaleSourceError || error instanceof QuestionVerificationConflictError;
      document.processing.status = staleSource ? "stale"
        : requiresReview ? "pending_review" : "failed";
      const issue: VerificationIssue | undefined = error instanceof QuestionReviewError ? error.issue
        : error instanceof ClassificationReviewError ? {
          code: "CLASSIFICATION_REVIEW_REQUIRED", check: "master_classification",
          reason: error.message, requiredAction: "Resolve the classification using source evidence and the active master.",
          evidence: document.classification?.review?.source_evidence.map(item => item.exact_text) ?? [],
        } : error instanceof ConceptReviewError ? {
          code: error.issueCode, check: "concepts",
          reason: error.message, requiredAction: error.issueCode === "HIGHLIGHT_REVIEW_REQUIRED"
            ? "Review concise highlights for every material item; document literal-evidence gaps and justified extended excerpts or dense fields, then submit a source-bound final review."
            : "Review all tested items, meaning, scope and roles against the current registry and all worker proposals; submit a source-bound final review.",
          evidence: document.concept_review?.decisions.flatMap(item => item.source_evidence.map(evidence => evidence.exact_text)) ?? [],
        } : undefined;
      if (issue) document.verification = flagQuestionForReview(document.verification, issue);
      if (staleSource) {
        document.verification = verificationForSource(document.verification, sourceHash, false);
      }
      if (requiresReview) {
        document.provenance ??= {
          inputs_used: ["question"], answer_status: question.answer ? "provided_not_independently_verified" : "missing",
          truth_labels_based_on: "not_provided", needs_review: true, review_notes: [],
        };
        document.provenance.needs_review = true;
        document.provenance.review_notes = [...new Set([
          ...document.provenance.review_notes, error.message,
          ...(issue ? [reviewFlag(issue), `Required action: ${issue.requiredAction}`] : []),
        ])];
      }
      if (error instanceof ClassificationReviewError && error.conflict &&
          document.classification?.review && document.classification.review.status !== "conflict") {
        document.classification.review.status = "conflict";
        if (!document.classification.review.rationale.includes(error.message)) {
          document.classification.review.rationale += ` ${error.message}`;
        }
      }
      const code = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      document.processing.error = typeof code === "number"
        ? `AI request failed with HTTP ${code}.`
        : issue ? reviewFlag(issue)
        : error instanceof Error ? error.message : "Pipeline failed with a non-Error exception.";
      try {
        await persist(!staleSource);
        if (requiresReview) {
          const saved = await this.repository.readProfile(id);
          if (!saved || saved.document.processing.status !== "pending_review" ||
              saved.document.embedding !== null || !saved.document.provenance?.needs_review ||
              JSON.stringify(saved.document.verification) !== JSON.stringify(document.verification) ||
              saved.document.processing.error !== document.processing.error) {
            throw new Error(`Review flag for ${id} could not be verified after saving.`);
          }
        }
      } catch (saveError) {
        throw new AggregateError([error, saveError], `Profile ${id} failed and its failure status could not be persisted.`);
      }
      if (requiresReview) return "pending_review";
      throw new Error(`Profile ${id}: ${document.processing.error}`, { cause: error });
    }
  }
}
