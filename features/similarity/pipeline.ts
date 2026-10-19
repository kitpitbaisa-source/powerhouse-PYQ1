import { hashContent } from "./content-hash.js";
export { hashContent } from "./content-hash.js";
import { embeddingModel, embeddingPrefix, promptVersion, schemaVersion, type PipelineConfig } from "./config.js";
import {
  classificationReviewIssue, classificationTaxonomyIssue, conceptReviewIssue, importedExtractionSchema, profileExtractionSchema, validateExtraction,
  type ExtractionResponse, type ImportedExtraction, type ProfileExtraction, type SourceQuestion, type StoredProfile,
} from "./schema.js";
import type { EmbeddingAI, PipelineAI } from "./google.js";
import type { PipelineRepository, ProfileSnapshot } from "./repository.js";
import type { CanonicalConcept, QuestionReference } from "./types.js";
import {
  flagQuestionForReview, questionVerificationSchema, reviewFlag, validateVerificationBinding, verificationForSource,
  QuestionVerificationConflictError, type VerificationIssue,
} from "./verification.js";

class ClassificationReviewError extends Error {
  constructor(message: string, readonly conflict = false) {
    super(message);
  }
}
class ConceptReviewError extends Error {}
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

function assertReviewedConcepts(extraction: ProfileExtraction): void {
  const issue = conceptReviewIssue(extraction);
  if (issue) throw new ConceptReviewError(`Concepts require review. ${issue}`);
}

export function buildEmbeddingInput(extraction: ProfileExtraction): string {
  assertReviewedClassification(extraction);
  assertReviewedConcepts(extraction);
  const profile = extraction.concept_profile;
  const names = (items: typeof profile.primary_concepts | typeof profile.secondary_concepts) =>
    [...items].sort((a, b) => a.concept_id.localeCompare(b.concept_id))
      .map(item => item.canonical_name).join("; ");
  const entities = new Map(profile.entities.map(entity => [entity.entity_id, entity.name]));
  const relationships = profile.relationships
    .filter(relation => relation.role === "tested_relationship")
    .map(relation => `${entities.get(relation.subject_entity_id)}: ${relation.relationship_type.replaceAll("_", " ")}${relation.object_entity_id ? `: ${entities.get(relation.object_entity_id)}` : ""}`)
    .sort();
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

const normalizeLabel = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

export async function resolveConcepts(
  extraction: ExtractionResponse,
  registry: CanonicalConcept[],
  repository: PipelineRepository,
  taxonomyVersion: string,
): Promise<ProfileExtraction> {
  assertReviewedConcepts(extraction);
  const mappings = new Map<string, CanonicalConcept>();
  const definitions = extraction.concept_definitions;
  const sameDefinition = (left: typeof definitions[number], right: typeof definitions[number]) =>
    normalizeLabel(left.definition) === normalizeLabel(right.definition) &&
    normalizeLabel(left.subject) === normalizeLabel(right.subject) &&
    normalizeLabel(left.topic) === normalizeLabel(right.topic);
  const plans = definitions.map(definition => {
    const idMatch = registry.find(concept => concept.id === definition.id);
    const label = normalizeLabel(definition.canonical_name);
    const labelMatches = registry.filter(concept =>
      [concept.canonical_name, ...concept.aliases].some(name => normalizeLabel(name) === label));
    if (labelMatches.length > 1) throw new ConceptReviewError(`Ambiguous canonical concept name: ${definition.canonical_name}`);
    if (idMatch && labelMatches[0] && idMatch.id !== labelMatches[0].id) {
      throw new ConceptReviewError(`Concept ID and name resolve to different concepts: ${definition.id}`);
    }
    const decision = extraction.concept_review.decisions.find(item => item.concept_id === definition.id)!;
    const concept = decision.decision === "reuse"
      ? registry.find(item => item.id === decision.existing_concept_id) : undefined;
    if (decision.decision === "reuse" && !concept) {
      throw new ConceptReviewError(`Concept ${definition.id} requests an unknown canonical ID ${decision.existing_concept_id}.`);
    }
    if (concept?.status === "retired") throw new ConceptReviewError(`Concept ${concept.id} is retired and needs review.`);
    const exactMatches = [idMatch, ...labelMatches, ...registry.filter(item =>
      item.status !== "retired" && sameDefinition(item, definition))].filter(item => item !== undefined);
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
  const classificationPlan = plans.find(plan => plan.definition.id === extraction.classification.review.primary_concept_id);
  if (!classificationPlan) throw new ClassificationReviewError("Classification requires a reviewed primary concept.");
  const taxonomyConflict = classificationTaxonomyIssue(
    extraction.classification, classificationPlan.concept ?? classificationPlan.definition,
  );
  if (taxonomyConflict) throw new ClassificationReviewError(taxonomyConflict, true);
  if (new Set(targets).size !== targets.length) {
    throw new ConceptReviewError("Multiple assigned concepts resolve to the same canonical ID; consolidate their roles before proceeding.");
  }
  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index];
    if (!plan.concept && plans.slice(0, index).some(previous =>
      sameDefinition(previous.definition, plan.definition) ||
      [previous.definition.canonical_name, ...previous.definition.aliases].some(name =>
        [plan.definition.canonical_name, ...plan.definition.aliases].some(other => normalizeLabel(name) === normalizeLabel(other))))) {
      throw new ConceptReviewError(`Proposed concept ${plan.definition.id} duplicates another assignment's definition or name.`);
    }
  }
  for (const { definition, concept: existing, label } of plans) {
    let concept = existing;
    if (!concept) {
      concept = await repository.createConcept({ ...definition, status: "provisional", taxonomyVersion });
      if (concept.status === "retired" || normalizeLabel(concept.canonical_name) !== label ||
          !sameDefinition(concept, definition)) {
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

export class ConceptPipeline {
  constructor(
    private readonly repository: PipelineRepository,
    private readonly ai: PipelineAI | EmbeddingAI,
    private readonly config: PipelineConfig,
  ) {}

  async processImported(entry: ImportedExtraction, force = false): Promise<"ready" | "skipped" | "pending_review"> {
    const imported = importedExtractionSchema.parse(entry);
    return this.process({ sourceContainer: imported.sourceContainer, questionId: imported.questionId }, force, imported);
  }

  async process(reference: QuestionReference, force = false, imported?: ImportedExtraction): Promise<"ready" | "skipped" | "pending_review"> {
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
    const previousExtraction = previous?.classification ? profileExtractionSchema.parse(previous) : undefined;
    const sameExtraction = previous?.processing.sourceContentHash === sourceHash &&
      previous.schemaVersion === schemaVersion &&
      previous.processing.promptVersion === promptVersion &&
      previous.processing.taxonomyVersion === this.config.taxonomyVersion &&
      previous.processing.extractionModel === this.config.extractionModel &&
      !!previousExtraction && !classificationReviewIssue(previousExtraction) && !conceptReviewIssue(previousExtraction) &&
      (!imported || previous.processing.extractionContentHash === extractionContentHash);
    let verification = verificationForSource(
      questionSnapshot.verification ?? previous?.verification, sourceHash, sameExtraction && !force,
    );
    for (const issue of previous?.verification?.issues ?? []) {
      const canonical = questionSnapshot.verification;
      if (!canonical || canonical.sourceContentHash !== sourceHash || !canonical.reviewedBy ||
          canonical.checks[issue.check].status !== "passed" || !canonical.checks[issue.check].evidence.length) {
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
        !supplied.reviewedBy || supplied.checks[issue.check].status !== "passed" ||
        !supplied.checks[issue.check].evidence.length);
      const corrections = [...new Map([
        ...verification.corrections, ...supplied.corrections,
      ].map(correction => [`${correction.auditReference}:${correction.field}`, correction])).values()];
      verification = questionVerificationSchema.parse({ ...supplied, corrections });
      for (const issue of unresolved) verification = flagQuestionForReview(verification, issue);
    }
    const assertVerification = async (extraction?: ProfileExtraction) => {
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
    if (!force && sameExtraction && previous.processing.status === "ready" &&
        !verificationIssue && previous.processing.embeddingSpaceVersion === this.config.embeddingSpaceVersion) {
      const extraction = profileExtractionSchema.parse(previous);
      const input = buildEmbeddingInput(extraction);
      if (previous.concept_embedding_input === input &&
          previous.processing.embeddingInputHash === hashContent(`${embeddingPrefix}${input}`) &&
          previous.processing.embeddingDimensions === this.config.dimensions &&
          previous.processing.embeddingModel === embeddingModel && previous.embedding !== null) {
        validateVector(previous.embedding, this.config.dimensions);
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
        const concepts = await this.repository.listConcepts();
        let response = importedResponse;
        if (!response) {
          if (!("extract" in this.ai)) throw new Error("This embedding-only provider requires an imported extraction.");
          response = validateExtraction(await this.ai.extract(question, concepts), question);
        }
        const extracted = profileExtractionSchema.parse(response);
        document = { ...document, ...extracted };
        await assertVerification(extracted);
        assertReviewedClassification(extracted);
        if (!imported) {
          if (!("reviewConcepts" in this.ai)) throw new ConceptReviewError("Concept identity and role review is required.");
          const review = await this.ai.reviewConcepts(question, response, concepts);
          response = validateExtraction({ ...response, concept_review: review }, question);
          document = { ...document, ...profileExtractionSchema.parse(response) };
        }
        extraction = await resolveConcepts(response, concepts, this.repository, this.config.taxonomyVersion);
      }
      document = { ...document, ...extraction };
      await assertVerification(extraction);
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
      const reuseVector = !force && imported && previous?.processing.status === "ready" &&
        previous.processing.sourceContentHash === sourceHash &&
        previous.processing.embeddingSpaceVersion === this.config.embeddingSpaceVersion &&
        previous.processing.embeddingModel === embeddingModel &&
        previous.processing.embeddingDimensions === this.config.dimensions &&
        previous.concept_embedding_input === input &&
        previous.processing.embeddingInputHash === hashContent(`${embeddingPrefix}${input}`) &&
        previous.embedding !== null;
      const vector = reuseVector ? previous.embedding : await this.ai.embed(input);
      const normalized = validateVector(vector, this.config.dimensions);
      const latest = await this.repository.readQuestion(reference);
      if (hashContent(latest) !== sourceHash) throw new StaleSourceError(`Source question ${id} changed during processing.`);
      document.embedding = reuseVector ? vector : normalized;
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
          code: "CONCEPT_REVIEW_REQUIRED", check: "concepts",
          reason: error.message, requiredAction: "Review concept meaning, scope, roles and exact source evidence.",
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
