import { hashContent } from "./content-hash.js";
import { conceptReviewIssue, conceptReviewSchema, conceptResolutionBatchEntrySchema, conceptResolutionExtractionSchema, coverageReviewIssue, importedExtractionSchema, type ConceptReview, type ConceptResolutionBatch, type ConceptResolutionExtraction, type ExtractionBatch, type ExtractionResponse, type ImportedExtraction, type SourceQuestion } from "./schema.js";
import type { CanonicalConcept } from "./types.js";
import { highlightReviewIssue } from "./highlight-review.js";

export class ConceptReviewError extends Error {
  constructor(message: string, readonly issueCode = "CONCEPT_REVIEW_REQUIRED") {
    super(message);
  }
}

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

export function registryFingerprint(concepts: readonly CanonicalConcept[]): string {
  return hashContent([...concepts].sort((a, b) => compare(a.id, b.id)).map(concept => ({
    id: concept.id, canonical_name: concept.canonical_name, definition: concept.definition,
    subject: concept.subject, topic: concept.topic,
    aliases: [...concept.aliases].sort(), parentConceptIds: [...concept.parentConceptIds].sort(),
    status: concept.status, taxonomyVersion: concept.taxonomyVersion, retirement: concept.retirement,
  })));
}

export function proposalFingerprint(extraction: ConceptResolutionExtraction): string {
  const { concept_review, ...proposal } = conceptResolutionExtractionSchema.parse(extraction);
  return hashContent({ ...proposal, concept_review: concept_review && { ...concept_review, audit: undefined } });
}

export function batchProposalsFingerprint(entries: readonly ImportedExtraction[]): string {
  return hashContent([...entries].sort((a, b) =>
    compare(`${a.sourceContainer}:${a.questionId}`, `${b.sourceContainer}:${b.questionId}`))
    .map(value => {
      const entry = importedExtractionSchema.parse(value);
      return {
        sourceContainer: entry.sourceContainer, questionId: entry.questionId,
        sourceContentHash: entry.sourceContentHash, extraction: entry.extraction, verification: entry.verification,
      };
    }));
}

export function conceptResolutionBatchProposalsFingerprint(entries: readonly ConceptResolutionBatch["entries"][number][]): string {
  return hashContent([...entries].sort((a, b) =>
    compare(`${a.sourceContainer}:${a.questionId}`, `${b.sourceContainer}:${b.questionId}`))
    .map(entry => conceptResolutionBatchEntrySchema.parse(entry)));
}

export function bindConceptReview(
  question: SourceQuestion, extraction: ConceptResolutionExtraction, registry: readonly CanonicalConcept[],
  reviewer: string, review: ConceptReview, reviewedAt = new Date().toISOString(),
): ConceptReview {
  return conceptReviewSchema.parse({
    ...review,
    audit: {
      reviewed_by: reviewer, reviewed_at: reviewedAt, registry_fingerprint: registryFingerprint(registry),
      source_content_hash: hashContent(question),
      proposal_fingerprint: proposalFingerprint({ ...extraction, concept_review: review }),
    },
  });
}

export function prepareBatchReview(
  batch: ExtractionBatch, registry: readonly CanonicalConcept[], taxonomyVersion: string,
): Map<string, CanonicalConcept> {
  return prepareReviewedProposals(batch, registry, taxonomyVersion, batchProposalsFingerprint(batch.entries));
}

export function prepareConceptResolutionBatchReview(
  batch: ConceptResolutionBatch, registry: readonly CanonicalConcept[], taxonomyVersion: string,
): Map<string, CanonicalConcept> {
  for (const entry of batch.entries) {
    const audit = entry.extraction.concept_review?.audit;
    if (!audit || audit.reviewed_by !== batch.registry_review.reviewed_by ||
        audit.registry_fingerprint !== batch.registry_review.registry_fingerprint ||
        audit.source_content_hash !== entry.sourceContentHash ||
        audit.proposal_fingerprint !== proposalFingerprint(entry.extraction) ||
        conceptReviewIssue(entry.extraction) ||
        entry.extraction.concept_review.coverage?.status !== "complete" ||
        entry.extraction.concept_review.coverage.uncovered_items.length ||
        entry.extraction.concept_review.highlights?.status !== "complete") {
      throw new ConceptReviewError("Every scoped batch entry needs a complete source/proposal-bound final reviewer audit.", "CONCEPT_BATCH_REVIEW_REQUIRED");
    }
  }
  return prepareReviewedProposals(batch, registry, taxonomyVersion, conceptResolutionBatchProposalsFingerprint(batch.entries));
}

function prepareReviewedProposals(
  batch: Pick<ExtractionBatch, "registry_review"> & {
    entries: readonly { extraction: ConceptResolutionExtraction; approvedNewConceptIds?: readonly string[] }[];
  },
  registry: readonly CanonicalConcept[], taxonomyVersion: string, proposalsFingerprint: string,
): Map<string, CanonicalConcept> {
  const receipt = batch.registry_review;
  if (!receipt || receipt.proposals_fingerprint !== proposalsFingerprint) {
    throw new ConceptReviewError("The final batch review does not bind these worker proposals.", "CONCEPT_BATCH_REVIEW_REQUIRED");
  }
  const approvedNew = new Map<string, CanonicalConcept>();
  for (const entry of batch.entries) {
    for (const decision of entry.extraction.concept_review?.decisions ?? []) {
      if (decision.decision !== "new") continue;
      if (entry.approvedNewConceptIds && !entry.approvedNewConceptIds.includes(decision.concept_id)) continue;
      const definition = entry.extraction.concept_definitions.find(item => item.id === decision.concept_id);
      if (!definition) throw new ConceptReviewError(`Unassigned batch proposal ${decision.concept_id}.`, "CONCEPT_BATCH_REVIEW_REQUIRED");
      const canonical: CanonicalConcept = { ...definition, status: "provisional", taxonomyVersion };
      const earlier = approvedNew.get(canonical.id);
      if (earlier && registryFingerprint([earlier]) !== registryFingerprint([canonical])) {
        throw new ConceptReviewError(`Worker proposals disagree on the definition of ${canonical.id}. Reconcile them before processing.`, "CONCEPT_BATCH_REVIEW_REQUIRED");
      }
      approvedNew.set(canonical.id, canonical);
    }
  }
  const normalized = (value: string) => value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const proposals = [...approvedNew.values()];
  for (let index = 0; index < proposals.length; index++) {
    const proposal = proposals[index];
    const duplicate = proposals.slice(0, index).find(other =>
      (normalized(proposal.definition) === normalized(other.definition) &&
        normalized(proposal.subject) === normalized(other.subject) && normalized(proposal.topic) === normalized(other.topic)) ||
      [proposal.canonical_name, ...proposal.aliases].some(label =>
        [other.canonical_name, ...other.aliases].some(candidate => normalized(candidate) === normalized(label))));
    if (duplicate) {
      throw new ConceptReviewError(
        `Worker proposals ${duplicate.id} and ${proposal.id} overlap in name or definition. Resolve their meaning and scope to consistent IDs before any write.`,
        "CONCEPT_BATCH_REVIEW_REQUIRED",
      );
    }
  }
  for (const concept of registry) {
    const approved = approvedNew.get(concept.id);
    if (approved && (concept.status === "retired" ||
        registryFingerprint([{ ...concept, status: "provisional" }]) !== registryFingerprint([approved]))) {
      throw new ConceptReviewError(`Previously published proposal ${concept.id} differs from the reviewed batch.`, "CONCEPT_BATCH_REVIEW_REQUIRED");
    }
  }
  const baseline = registry.filter(concept => !approvedNew.has(concept.id));
  if (registryFingerprint(baseline) !== receipt.registry_fingerprint) {
    throw new ConceptReviewError(
      "The registry changed outside this reviewed batch. Reconcile all worker proposals against the live registry again.",
      "STALE_CONCEPT_REGISTRY_REVIEW",
    );
  }
  return approvedNew;
}

export function assertConceptAdmission(
  extraction: ConceptResolutionExtraction, question: SourceQuestion, registry: readonly CanonicalConcept[],
  batchApproved = false, proposals: readonly CanonicalConcept[] = [],
): void {
  const coverageIssue = coverageReviewIssue(extraction, question);
  if (coverageIssue) throw new ConceptReviewError(coverageIssue, "CONCEPT_COVERAGE_REVIEW_REQUIRED");
  const review = extraction.concept_review;
  if (!review?.audit || review.audit.source_content_hash !== hashContent(question) ||
      review.audit.proposal_fingerprint !== proposalFingerprint(extraction)) {
    throw new ConceptReviewError(
      "An identified final reviewer must bind the complete coverage and identity review to this source and proposal.",
      "CONCEPT_REGISTRY_REVIEW_REQUIRED",
    );
  }
  if (!batchApproved && review.audit.registry_fingerprint !== registryFingerprint(registry)) {
    throw new ConceptReviewError(
      "The live canonical registry changed after semantic review. Compare the current candidates again; do not create or embed this proposal.",
      "STALE_CONCEPT_REGISTRY_REVIEW",
    );
  }
  if (review.registry_scan) {
    const active = registry.filter(concept => concept.status !== "retired")
      .sort((left, right) => left.id.localeCompare(right.id));
    const scan = review.registry_scan;
    let compared = 0;
    if (scan.registry_fingerprint !== registryFingerprint(registry) ||
        scan.reviewed_concept_count !== active.length) {
      throw new ConceptReviewError("The bounded semantic scan does not bind the complete live registry.");
    }
    const assignmentIds = new Set([
      ...extraction.concept_profile.primary_concepts, ...extraction.concept_profile.secondary_concepts,
    ].map(concept => concept.concept_id));
    for (const chunk of scan.chunks) {
      const records = active.slice(compared, compared + chunk.concept_count);
      const ids = new Set(records.map(concept => concept.id));
      if (chunk.start_index !== compared || records.length !== chunk.concept_count ||
          chunk.registry_fingerprint !== registryFingerprint(records) ||
          chunk.decisions.length !== assignmentIds.size ||
          new Set(chunk.decisions.map(decision => decision.concept_id)).size !== assignmentIds.size ||
          chunk.decisions.some(decision => !assignmentIds.has(decision.concept_id) || decision.uncertain ||
            [...decision.equivalent_ids, ...decision.related_ids].some(id => !ids.has(id)))) {
        throw new ConceptReviewError("A bounded semantic review chunk is missing, overlapping, stale or uncertain.");
      }
      compared += chunk.concept_count;
    }
    if (compared !== active.length) throw new ConceptReviewError("The bounded semantic review omitted registry entries.");
    for (const decision of review.decisions) {
      const equivalent = new Set(scan.chunks.flatMap(chunk => chunk.decisions
        .filter(item => item.concept_id === decision.concept_id).flatMap(item => item.equivalent_ids)));
      if ((decision.decision === "new" && equivalent.size) ||
          (decision.decision === "reuse" && !equivalent.has(decision.existing_concept_id!))) {
        throw new ConceptReviewError("The final identity decision conflicts with the complete registry scan.");
      }
    }
  }
  for (const decision of review.decisions) {
    const compared = decision.compared_concept_ids;
    if (!compared || new Set(compared).size !== compared.length ||
        compared.some(id => ![...registry, ...proposals].some(concept => concept.id === id && concept.status !== "retired")) ||
        (decision.decision === "reuse" && !compared.includes(decision.existing_concept_id!))) {
      throw new ConceptReviewError(
        `Concept ${decision.concept_id} requires explicit, active compared candidate IDs, including its reused canonical ID.`,
        "CONCEPT_REGISTRY_REVIEW_REQUIRED",
      );
    }
  }
  const highlightIssue = highlightReviewIssue(extraction, question);
  if (highlightIssue) throw new ConceptReviewError(highlightIssue, "HIGHLIGHT_REVIEW_REQUIRED");
}
