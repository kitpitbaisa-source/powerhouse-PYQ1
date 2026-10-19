import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { CosmosClient } from "@azure/cosmos";
import ts from "typescript";
import { embeddingModel, promptVersion, sourceContainers, type PipelineConfig } from "./config";
import { GoogleEmbeddingAI, GooglePipelineAI, type PipelineAI } from "./google";
import { ConceptPipeline, buildEmbeddingInput, hashContent, validateVector } from "./pipeline";
import {
  CosmosPipelineRepository, ensureContainers, profileContainerDefinition, validateProfileContainer,
  type PipelineRepository, type ProfileSnapshot, type SourceQuestionSnapshot,
} from "./repository";
import {
  conceptReviewSchema, extractionBatchSchema, importedExtractionSchema, sourceQuestionSchema, validateExtraction,
  profileExtractionSchema, type SourceQuestion, type StoredProfile,
} from "./schema";
import type { CanonicalConcept, QuestionReference } from "./types";
import {
  flagQuestionForReview, questionVerificationSchema, unverifiedQuestion, verificationForSource,
  QuestionVerificationConflictError, type QuestionVerification,
} from "./verification";

const reference: QuestionReference = { sourceContainer: "questions", questionId: "2262" };
const config: PipelineConfig = {
  apiKey: "offline-test-only",
  extractionModel: "offline-extractor",
  dimensions: 3,
  taxonomyVersion: "v1",
  embeddingSpaceVersion: `${embeddingModel}:3:test:v1`,
};

function fixture() {
  return {
    classification: {
      subject: "Geography", topic: "Borders", subtopics: ["Land borders"],
      question_format: "single_correct_mcq", polarity: "negative_selection",
      reasoning_type: ["spatial_relationship_identification"],
      question_intent: "Identify a country not bordering Ukraine.",
      review: {
        status: "supported", primary_concept_id: "ukraine_borders",
        subject_confidence: 0.96, topic_confidence: 0.94,
        rationale: "The stem tests a country's land adjacency, supporting Geography and Borders.",
        source_evidence: [{ concept_id: "ukraine_borders", field: "question", exact_text: "border Ukraine" }],
      },
    },
    concept_profile: {
      primary_concepts: [{
        concept_id: "ukraine_borders", canonical_name: "Countries bordering Ukraine",
        role: "primary", confidence: 0.9,
      }],
      secondary_concepts: [],
      underlying_principle: "Ukraine's land-boundary relationships.",
      knowledge_requirements: ["Know which countries border Ukraine."],
      entities: [{ entity_id: "country_ukraine", name: "Ukraine", entity_type: "country" }],
      relationships: [],
    },
    claims: [],
    concept_review: {
      decisions: [{
        concept_id: "ukraine_borders", decision: "reuse", existing_concept_id: "ukraine_land_borders",
        meaning_scope_rationale: "Both definitions describe Ukraine's land adjacency at the same scope.",
        role: "primary", role_status: "supported",
        role_rationale: "Land adjacency is directly tested by the question.",
        source_evidence: [{ concept_id: "ukraine_borders", field: "question", exact_text: "border Ukraine" }],
      }],
    },
    similarity_profile: {
      concept_summary: "Ukraine's land borders.", matching_cautions: ["Do not match on negative wording alone."],
    },
    provenance: {
      inputs_used: ["question", "options", "provided_answer"],
      answer_status: "provided_not_independently_verified",
      truth_labels_based_on: "provided_answer_only",
      needs_review: true,
      review_notes: ["Not independently verified."],
    },
    concept_definitions: [{
      id: "ukraine_borders", canonical_name: "Countries bordering Ukraine",
      definition: "Land adjacency involving Ukraine.",
      subject: "Geography", topic: "Borders", aliases: [], parentConceptIds: [],
    }],
  };
}

class MemoryRepository implements PipelineRepository {
  question: SourceQuestion = sourceQuestionSchema.parse({
    id: "2262", question: "Which country does not border Ukraine?",
    options: ["Poland", "Lithuania"], answer: "Lithuania",
    exam: "Test", year: "2024", subject: "Geography",
  });
  profile: ProfileSnapshot | undefined;
  concepts: CanonicalConcept[] = [{
    id: "ukraine_land_borders", canonical_name: "Ukraine's land borders",
    definition: "Land adjacency involving Ukraine.",
    subject: "Geography", topic: "Borders",
    aliases: ["Countries bordering Ukraine"], parentConceptIds: [],
    status: "active", taxonomyVersion: "v1",
  }];
  writes = 0;
  changesDuringSave = false;
  questionVerification: QuestionVerification | undefined;
  questionEtag = 1;
  verificationWrites = 0;
  masterClassification: { subject: string; topic: string } | undefined = { subject: "Geography", topic: "Borders" };

  async readQuestion() { return structuredClone(this.question); }
  async readQuestionSnapshot(): Promise<SourceQuestionSnapshot> {
    return {
      question: structuredClone(this.question), verification: structuredClone(this.questionVerification),
      etag: String(this.questionEtag),
    };
  }
  async saveQuestionVerification(
    _reference: QuestionReference, verification: QuestionVerification, expected: SourceQuestionSnapshot,
  ): Promise<SourceQuestionSnapshot> {
    const data = questionVerificationSchema.parse(verification);
    if (hashContent(this.question) !== data.sourceContentHash || expected.etag !== String(this.questionEtag)) {
      throw new QuestionVerificationConflictError("Concurrent source update.");
    }
    if (JSON.stringify(this.questionVerification) !== JSON.stringify(data)) {
      this.questionVerification = structuredClone(data);
      this.questionEtag++;
      this.verificationWrites++;
    }
    return this.readQuestionSnapshot();
  }
  async readMasterClassification(subjectId: string, topicId: string) {
    return subjectId === "S03" && topicId === "S03-T01" ? this.masterClassification : undefined;
  }
  async readProfile() { return structuredClone(this.profile); }
  async saveProfile(document: StoredProfile, etag?: string): Promise<ProfileSnapshot> {
    if (this.profile?.etag !== etag) throw Object.assign(new Error("Concurrent profile write."), { code: 412 });
    this.writes++;
    this.profile = { document: structuredClone(document), etag: String(this.writes) };
    if (this.changesDuringSave && document.processing.status === "ready") {
      this.profile.etag = "another-worker";
      throw Object.assign(new Error("Concurrent profile write."), { code: 412 });
    }
    return structuredClone(this.profile);
  }
  async listConcepts() { return structuredClone(this.concepts); }
  async createConcept(concept: CanonicalConcept) {
    this.concepts.push(structuredClone(concept));
    return structuredClone(concept);
  }
}

function createAI(overrides: Partial<PipelineAI> = {}) {
  const calls = { extract: 0, embed: 0 };
  const ai: PipelineAI = {
    async extract() { calls.extract++; return fixture(); },
    async reviewConcepts(_question, extraction, concepts) {
      return {
        decisions: [...extraction.concept_profile.primary_concepts, ...extraction.concept_profile.secondary_concepts].map(item => {
          const existing = concepts.find(concept => concept.id === item.concept_id ||
            [concept.canonical_name, ...concept.aliases].includes(item.canonical_name));
          return {
            concept_id: item.concept_id, decision: existing ? "reuse" : "new",
            existing_concept_id: existing?.id ?? null,
            meaning_scope_rationale: existing ? "The registry contains the same tested meaning and scope." : "No equivalent registry definition exists.",
            role: item.role, role_status: "supported", role_rationale: "This concept materially contributes in its assigned role.",
            source_evidence: extraction.classification.review.source_evidence.map(evidence => ({ ...evidence, concept_id: item.concept_id })),
          };
        }),
      };
    },
    async embed() { calls.embed++; return [3, 4, 0]; },
    ...overrides,
  };
  return { ai, calls };
}

function verifiedFixture(repository: MemoryRepository, extraction: unknown = fixture()): QuestionVerification {
  const review = unverifiedQuestion(hashContent(repository.question));
  return questionVerificationSchema.parse({
    ...review,
    status: "verified", reviewedBy: "offline-reviewer",
    extractionContentHash: hashContent(importedExtractionSchema.shape.extraction.parse(extraction)),
    masterClassification: { subjectId: "S03", topicId: "S03-T01" },
    checks: Object.fromEntries(Object.keys(review.checks).map(name =>
      [name, { status: "passed", evidence: [`Independent review record for ${name}: reviewed-source-001`] }])),
    corrections: [{ field: "subject", reason: "Approved source classification correction.", auditReference: "source-backup-001" }],
  });
}

test("every question bank uses unverified independently of a ready embedding", async () => {
  for (const sourceContainer of sourceContainers) {
    const repository = new MemoryRepository();
    const { ai } = createAI();
    assert.equal(await new ConceptPipeline(repository, ai, config).process({ ...reference, sourceContainer }), "ready");
    const saved = repository.profile.document;
    assert.equal(saved.verification.status, "unverified");
    assert.equal(saved.verification.checks.answer.status, "not_checked");
    assert.equal(saved.verification.checks.master_classification.status, "not_checked");
    assert.equal(saved.verification.checks.concepts.status, "passed");
    assert.equal(saved.verification.sourceContentHash, saved.processing.sourceContentHash);
    assert.deepEqual(repository.questionVerification, saved.verification);
    assert.equal(repository.questionVerification.checks.answer.reason, "Not checked yet.");
  }
});

test("verified flags require all checks, review evidence, reviewer and master IDs", () => {
  const repository = new MemoryRepository();
  const complete = verifiedFixture(repository);
  for (const change of [
    (value: QuestionVerification) => { value.reviewedBy = null; },
    (value: QuestionVerification) => { delete value.masterClassification; },
    (value: QuestionVerification) => { value.checks.answer.status = "not_checked"; },
    (value: QuestionVerification) => { value.checks.explanation.evidence = []; },
  ]) {
    const invalid = structuredClone(complete);
    change(invalid);
    assert.throws(() => questionVerificationSchema.parse(invalid), /Verified questions require/);
  }
  assert.throws(() => questionVerificationSchema.parse({
    ...unverifiedQuestion(hashContent(repository.question)), status: "pending_review",
  }), /specific issue/);
});

test("a question keeps separate answer and subject/topic results before concept extraction", async () => {
  const repository = new MemoryRepository();
  repository.question.topic = "Borders";
  const initial = unverifiedQuestion(hashContent(repository.question));
  repository.questionVerification = flagQuestionForReview(questionVerificationSchema.parse({
    ...initial,
    reviewedBy: "offline-reviewer",
    masterClassification: { subjectId: "S03", topicId: "S03-T01" },
    checks: {
      ...initial.checks,
      master_classification: {
        status: "passed", reason: "Subject and topic match the active master.",
        evidence: ["Reviewed source content against S03/S03-T01."],
      },
    },
  }), {
    code: "ANSWER_REVIEW_REQUIRED", check: "answer", reason: "Original answer-key evidence is missing.",
    requiredAction: "Obtain and compare the original final answer key.", evidence: [],
  });
  const original = structuredClone(repository.question);
  const { ai, calls } = createAI();
  assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "pending_review");
  assert.equal(repository.questionVerification.checks.answer.status, "pending_review");
  assert.equal(repository.questionVerification.checks.master_classification.status, "passed");
  assert.equal(repository.questionVerification.checks.master_classification.reason, "Subject and topic match the active master.");
  assert.deepEqual(repository.question, original);
  assert.deepEqual(calls, { extract: 0, embed: 0 });
});

test("question-level verification updates do not change the normalized source hash", () => {
  const question = new MemoryRepository().question;
  const before = hashContent(question);
  const verification = flagQuestionForReview(unverifiedQuestion(before), {
    code: "ANSWER_REVIEW_REQUIRED", check: "answer", reason: "Answer evidence needs review.",
    requiredAction: "Check the answer key.", evidence: [],
  });
  assert.equal(hashContent(sourceQuestionSchema.parse({ ...question, verification })), before);
});

test("Cosmos writes only the question verification field with an ETag and verifies it by reading back", async context => {
  const client = new CosmosClient({
    endpoint: "https://offline.documents.azure.com",
    key: Buffer.from("offline-test-only").toString("base64"),
  });
  context.after(() => client.dispose());
  const database = client.database("offline");
  const container = database.container("questions");
  const item = container.item(reference.questionId, reference.questionId);
  const original = new MemoryRepository().question;
  let raw: Record<string, unknown> = { ...original, _etag: "source-1", customMetadata: "preserve" };
  let patches = 0;
  context.mock.method(database, "container", () => container);
  context.mock.method(container, "item", () => item);
  context.mock.method(item, "read", async () => ({ resource: structuredClone(raw), etag: raw._etag }));
  context.mock.method(item, "patch", async (operations, options) => {
    patches++;
    assert.equal(operations.length, 1);
    assert.equal(operations[0].op, "set");
    assert.equal(operations[0].path, "/verification");
    assert.deepEqual(options.accessCondition, { type: "IfMatch", condition: "source-1" });
    raw = { ...raw, verification: structuredClone(operations[0].value), _etag: "source-2" };
    return { resource: structuredClone(raw), etag: raw._etag };
  });
  const repository = new CosmosPipelineRepository(database);
  const snapshot = await repository.readQuestionSnapshot(reference);
  const verification = unverifiedQuestion(hashContent(snapshot.question));
  const saved = await repository.saveQuestionVerification(reference, verification, snapshot);
  assert.deepEqual(saved.verification, verification);
  assert.equal(raw.customMetadata, "preserve");
  assert.deepEqual(saved.question, original);
  await repository.saveQuestionVerification(reference, verification, saved);
  assert.equal(patches, 1);
  raw._etag = "another-worker";
  raw.verification = flagQuestionForReview(verification, {
    code: "SOURCE_REVIEW_REQUIRED", check: "question", reason: "Another reviewer found an issue.",
    requiredAction: "Resolve the source issue.", evidence: [],
  });
  await assert.rejects(repository.saveQuestionVerification(reference, verification, saved), /updated concurrently/);
  assert.equal(patches, 1);
});

test("source verification changes during processing invalidate the profile without overwriting the new flag", async () => {
  const repository = new MemoryRepository();
  const { ai } = createAI({
    async embed() {
      repository.questionVerification = flagQuestionForReview(unverifiedQuestion(hashContent(repository.question)), {
        code: "ANSWER_REVIEW_REQUIRED", check: "answer", reason: "A concurrent reviewer found a conflict.",
        requiredAction: "Resolve the new answer conflict.", evidence: [],
      });
      repository.questionEtag++;
      return [3, 4, 0];
    },
  });
  await assert.rejects(new ConceptPipeline(repository, ai, config).process(reference), /Concurrent source update/);
  assert.equal(repository.profile.document.processing.status, "stale");
  assert.equal(repository.profile.document.embedding, null);
  assert.equal(repository.questionVerification.status, "pending_review");
  assert.equal(repository.questionVerification.reason, "A concurrent reviewer found a conflict.");
});

test("source-bound reviewed imports can record verified corrections without treating embedding success as verification", async () => {
  const repository = new MemoryRepository();
  repository.question.topic = "Borders";
  const extraction = fixture();
  extraction.provenance.needs_review = false;
  extraction.provenance.review_notes = [];
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction,
    verification: verifiedFixture(repository, extraction),
  });
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  assert.equal(await pipeline.processImported(entry), "ready");
  assert.equal(repository.profile.document.verification.status, "verified");
  assert.equal(repository.profile.document.verification.corrections[0].auditReference, "source-backup-001");
  assert.equal(await pipeline.processImported(entry), "skipped");
  assert.deepEqual(calls, { extract: 0, embed: 1 });
  entry.extraction.similarity_profile.matching_cautions.push("Changed annotations require a new reviewed-extraction binding.");
  await assert.rejects(pipeline.processImported(entry), /different source or extraction/);
  entry.extraction.similarity_profile.matching_cautions.pop();
  entry.verification.sourceContentHash = "f".repeat(64);
  await assert.rejects(pipeline.processImported(entry), /Verification must reference/);
});

test("verified claims with inactive or mismatched master destinations are held without embedding", async () => {
  for (const unavailable of [false, true]) {
    const repository = new MemoryRepository();
    repository.question.topic = unavailable ? "Borders" : "Incorrect legacy topic";
    if (unavailable) repository.masterClassification = undefined;
    const extraction = fixture();
    extraction.provenance.needs_review = false;
    const entry = importedExtractionSchema.parse({
      ...reference, sourceContentHash: hashContent(repository.question), extraction,
      verification: verifiedFixture(repository, extraction),
    });
    const { ai, calls } = createAI();
    assert.equal(await new ConceptPipeline(repository, ai, config).processImported(entry), "pending_review");
    const saved = repository.profile.document;
    assert.equal(saved.verification.status, "pending_review");
    assert.equal(saved.provenance.needs_review, true);
    assert.match(saved.processing.error, /^REVIEW_FLAG\[MASTER_CLASSIFICATION_MISMATCH\]:/);
    assert.equal(calls.embed, 0);
  }
});

test("answer conflicts produce the same durable flag and follow-up in every bank", async () => {
  for (const sourceContainer of sourceContainers) {
    const repository = new MemoryRepository();
    const extraction = fixture();
    extraction.provenance.answer_status = "conflict_detected";
    const { ai, calls } = createAI({ async extract() { return extraction; } });
    assert.equal(await new ConceptPipeline(repository, ai, config).process({ ...reference, sourceContainer }), "pending_review");
    const saved = repository.profile.document;
    assert.equal(saved.embedding, null);
    assert.equal(saved.verification.status, "pending_review");
    assert.equal(saved.verification.issues[0].code, "ANSWER_EXPLANATION_CONFLICT");
    assert(saved.verification.issues[0].requiredAction);
    assert.equal(repository.questionVerification.status, "pending_review");
    assert.equal(repository.questionVerification.reason, saved.verification.issues[0].reason);
    assert.equal(repository.questionVerification.checks.answer.reason, saved.verification.issues[0].reason);
    assert.match(saved.processing.error, /^REVIEW_FLAG\[ANSWER_EXPLANATION_CONFLICT\]:/);
    assert.equal(calls.embed, 0);
    assert.equal(repository.concepts.length, 1);
  }
});

test("force, source edits and unchecked imports cannot silently clear blocking review issues", async () => {
  const repository = new MemoryRepository();
  const extraction = fixture();
  extraction.classification.review.status = "uncertain";
  const { ai, calls } = createAI({ async extract() { calls.extract++; return extraction; } });
  const pipeline = new ConceptPipeline(repository, ai, config);
  assert.equal(await pipeline.process(reference), "pending_review");
  assert.equal(await pipeline.process(reference, true), "pending_review");
  repository.question.explanation = "New source text requires review of the existing blocking issue.";
  assert.equal(await pipeline.process(reference), "pending_review");
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
    verification: unverifiedQuestion(hashContent(repository.question)),
  });
  assert.equal(await pipeline.processImported(entry), "pending_review");
  assert.equal(repository.profile.document.verification.status, "pending_review");
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 0);
});

test("changed sources invalidate verified checks while preserving correction history and blocking issues", () => {
  const verified = verifiedFixture(new MemoryRepository());
  const changedExtraction = verificationForSource(verified, verified.sourceContentHash, false);
  assert.equal(changedExtraction.status, "unverified");
  assert.equal(changedExtraction.checks.answer.status, "passed");
  assert.equal(changedExtraction.checks.explanation.status, "passed");
  assert.equal(changedExtraction.checks.master_classification.status, "passed");
  assert.equal(changedExtraction.checks.concepts.status, "not_checked");
  const changed = verificationForSource(verified, "f".repeat(64), false);
  assert.equal(changed.status, "unverified");
  assert.equal(changed.checks.answer.status, "not_checked");
  assert.deepEqual(changed.corrections, verified.corrections);
  const blocked = flagQuestionForReview(verified, {
    code: "ANSWER_REVIEW_REQUIRED", check: "answer", reason: "Conflicting answer evidence.",
    requiredAction: "Resolve the source conflict.", evidence: ["Review record 002"],
  });
  const rebased = verificationForSource(blocked, "f".repeat(64), false);
  assert.equal(rebased.status, "pending_review");
  assert.equal(rebased.sourceContentHash, "f".repeat(64));
  assert.equal(rebased.checks.explanation.status, "not_checked");
  assert.deepEqual(rebased.issues, blocked.issues);
});

test("legacy blocking flags are retained rather than silently cleared by a retry", async () => {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  await pipeline.process(reference);
  repository.profile.document.processing.status = "pending_review";
  repository.profile.document.processing.error = "REVIEW_FLAG[ORIGINAL_SOURCE_REQUIRED]: Missing original source.";
  repository.profile.document.embedding = null;
  delete repository.profile.document.verification;
  assert.equal(await pipeline.process(reference, true), "pending_review");
  assert.equal(repository.profile.document.verification.issues[0].code, "ORIGINAL_SOURCE_REQUIRED");
  assert.deepEqual(calls, { extract: 1, embed: 1 });
});

test("canonical aliases resolve to the shared ID and unchanged profiles make no AI calls", async () => {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  assert.equal(await pipeline.process(reference), "ready");
  const saved = repository.profile.document;
  assert.equal(saved.id, "questions:2262");
  assert.equal(saved.concept_profile.primary_concepts[0].concept_id, "ukraine_land_borders");
  assert.equal(saved.concept_profile.primary_concepts[0].canonical_name, "Ukraine's land borders");
  assert.equal(saved.classification.review.source_evidence[0].concept_id, "ukraine_land_borders");
  assert.equal(saved.classification.review.primary_concept_id, "ukraine_land_borders");
  assert.equal(saved.concept_review.decisions[0].concept_id, "ukraine_land_borders");
  assert.equal(saved.concept_review.decisions[0].source_evidence[0].concept_id, "ukraine_land_borders");
  assert.deepEqual(saved.embedding, [0.6, 0.8, 0]);
  assert.equal("question" in saved, false);
  assert.equal(repository.concepts.length, 1);
  assert.equal(await pipeline.process(reference), "skipped");
  assert.deepEqual(calls, { extract: 1, embed: 1 });
  assert.equal(saved.processing.promptVersion, promptVersion);
});

test("semantic review reuses a differently named equivalent and remaps all source-bound references", async () => {
  const repository = new MemoryRepository();
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.concept_definitions[0].canonical_name = "Ukraine's neighbouring territories";
  extraction.concept_profile.primary_concepts[0].canonical_name = extraction.concept_definitions[0].canonical_name;
  extraction.highlight_evidence = [{
    concept_id: "ukraine_borders", field: "question", exact_text: "border Ukraine",
  }];
  const { ai, calls } = createAI({
    async extract() { return extraction; },
    async reviewConcepts() { return extraction.concept_review; },
  });
  assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "ready");
  const saved = repository.profile.document;
  assert.equal(repository.concepts.length, 1);
  assert.equal(saved.concept_profile.primary_concepts[0].concept_id, "ukraine_land_borders");
  assert.equal(saved.highlight_evidence[0].concept_id, "ukraine_land_borders");
  assert.equal(saved.concept_review.decisions[0].existing_concept_id, "ukraine_land_borders");
  assert.equal(calls.embed, 1);
});

test("a canonical concept keeps its identity when its role changes to secondary", async () => {
  const repository = new MemoryRepository();
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  const ukraine = extraction.concept_profile.primary_concepts[0];
  extraction.concept_profile.primary_concepts = [{
    concept_id: "poland_borders", canonical_name: "Poland's land borders", role: "primary", confidence: 0.95,
  }];
  extraction.concept_profile.secondary_concepts = [{ ...ukraine, role: "secondary" }];
  extraction.concept_definitions.push({
    id: "poland_borders", canonical_name: "Poland's land borders", definition: "Land adjacency involving Poland.",
    subject: "Geography", topic: "Borders", aliases: [], parentConceptIds: [],
  });
  extraction.classification.review.primary_concept_id = "poland_borders";
  extraction.classification.review.source_evidence = [{
    concept_id: "poland_borders", field: "option", option_index: 0, exact_text: "Poland",
  }];
  const { ai } = createAI({ async extract() { return extraction; } });
  assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "ready");
  assert.equal(repository.profile.document.concept_profile.secondary_concepts[0].concept_id, "ukraine_land_borders");
  assert.equal(repository.profile.document.concept_profile.secondary_concepts[0].role, "secondary");
  assert.equal(repository.profile.document.concept_profile.primary_concepts[0].concept_id, "poland_borders");
  assert.equal(repository.concepts.length, 2);
});

test("uncertain identities, unsupported roles and missing evidence queue review without concepts or vectors", async () => {
  for (const change of [
    (review: ReturnType<typeof fixture>["concept_review"]) => { review.decisions[0].decision = "review"; },
    (review: ReturnType<typeof fixture>["concept_review"]) => { review.decisions[0].role_status = "unrelated"; },
    (review: ReturnType<typeof fixture>["concept_review"]) => { review.decisions[0].role_status = "uncertain"; },
    (review: ReturnType<typeof fixture>["concept_review"]) => { review.decisions[0].role = "secondary"; },
    (review: ReturnType<typeof fixture>["concept_review"]) => { review.decisions[0].source_evidence = []; },
    (review: ReturnType<typeof fixture>["concept_review"]) => { review.decisions[0].existing_concept_id = "unknown_registry_id"; },
  ]) {
    const repository = new MemoryRepository();
    const review = fixture().concept_review;
    change(review);
    const { ai, calls } = createAI({ async reviewConcepts() { return review; } });
    assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "pending_review");
    assert.equal(repository.concepts.length, 1);
    assert.equal(calls.embed, 0);
    assert.equal(repository.profile.document.processing.status, "pending_review");
    assert.equal(repository.profile.document.embedding, null);
    assert.equal(repository.profile.document.provenance.needs_review, true);
    assert(repository.profile.document.processing.error);
  }
});

test("a lower-similarity secondary cannot justify creating any proposed concepts", async () => {
  const repository = new MemoryRepository();
  repository.concepts = [];
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.concept_profile.secondary_concepts.push({
    concept_id: "rainfall", canonical_name: "Rainfall", role: "secondary", confidence: 0.9,
  });
  extraction.concept_definitions.push({
    id: "rainfall", canonical_name: "Rainfall", definition: "Precipitation as rain.",
    subject: "Geography", topic: "Climate", aliases: [], parentConceptIds: [],
  });
  const { ai, calls } = createAI({
    async extract() { return extraction; },
    async reviewConcepts() {
      return {
        decisions: [
          { ...fixture().concept_review.decisions[0], decision: "new", existing_concept_id: null },
          {
            ...fixture().concept_review.decisions[0], concept_id: "rainfall", decision: "new", existing_concept_id: null,
            role: "secondary", role_status: "unrelated",
            role_rationale: "A low similarity or shared Geography subject does not make rainfall necessary to answer.",
            source_evidence: [{ concept_id: "rainfall", field: "question", exact_text: "Ukraine" }],
          },
        ],
      };
    },
  });
  assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "pending_review");
  assert.equal(repository.concepts.length, 0);
  assert.equal(calls.embed, 0);
});

test("new decisions cannot recreate known definitions or collapse distinct scopes sharing an entity", async () => {
  const duplicate = new MemoryRepository();
  const { ai, calls } = createAI({
    async reviewConcepts() {
      return { decisions: [{ ...fixture().concept_review.decisions[0], decision: "new", existing_concept_id: null }] };
    },
  });
  assert.equal(await new ConceptPipeline(duplicate, ai, config).process(reference), "pending_review");
  assert.equal(duplicate.concepts.length, 1);
  assert.equal(calls.embed, 0);

  const distinct = new MemoryRepository();
  distinct.question.question = "What is the population of Ukraine?";
  distinct.question.options = ["35 million", "42 million"];
  distinct.question.answer = "42 million";
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  delete extraction.concept_review;
  extraction.classification.topic = "Population";
  extraction.classification.review.primary_concept_id = "ukraine_population";
  extraction.classification.review.source_evidence = [{
    concept_id: "ukraine_population", field: "question", exact_text: "population of Ukraine",
  }];
  extraction.concept_profile.primary_concepts = [{
    concept_id: "ukraine_population", canonical_name: "Ukraine's population",
    role: "primary", confidence: 0.95,
  }];
  extraction.concept_definitions = [{
    id: "ukraine_population", canonical_name: "Ukraine's population",
    definition: "The number of people living in Ukraine, not its land-boundary relationships.",
    subject: "Geography", topic: "Population", aliases: [], parentConceptIds: [],
  }];
  const reviewed = createAI({ async extract() { return extraction; } });
  assert.equal(await new ConceptPipeline(distinct, reviewed.ai, config).process(reference), "ready");
  assert.equal(distinct.concepts.length, 2);
  assert.equal(distinct.profile.document.concept_profile.primary_concepts[0].concept_id, "ukraine_population");
  assert.equal(distinct.concepts[0].id, "ukraine_land_borders");
});

test("invented review evidence is rejected before concept creation or embedding", async () => {
  const repository = new MemoryRepository();
  const review = fixture().concept_review;
  review.decisions[0].source_evidence[0].exact_text = "an invented scientific principle";
  const { ai, calls } = createAI({ async reviewConcepts() { return review; } });
  await assert.rejects(new ConceptPipeline(repository, ai, config).process(reference), /Concept review evidence exact_text/);
  assert.equal(repository.concepts.length, 1);
  assert.equal(calls.embed, 0);
});

test("an imported missing review queues only that question and a later reviewed import proceeds without generation", async () => {
  const repository = new MemoryRepository();
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
  });
  let embeddings = 0;
  const pipeline = new ConceptPipeline(repository, { async embed() { embeddings++; return [3, 4, 0]; } }, config);
  delete entry.extraction.concept_review;
  assert.equal(await pipeline.processImported(entry), "pending_review");
  assert.equal(embeddings, 0);
  assert.equal(repository.concepts.length, 1);
  entry.extraction.concept_review = conceptReviewSchema.parse(fixture().concept_review);
  entry.verification = questionVerificationSchema.parse({
    ...unverifiedQuestion(entry.sourceContentHash),
    reviewedBy: "offline-reviewer",
    checks: {
      ...unverifiedQuestion(entry.sourceContentHash).checks,
      concepts: { status: "passed", evidence: ["Reviewed the missing identity/role decision against the source."] },
    },
  });
  assert.equal(await pipeline.processImported(entry), "ready");
  assert.equal(embeddings, 1);
});

test("embedding labels come from reviewed content classification, not incorrect question-bank metadata", async () => {
  const repository = new MemoryRepository();
  repository.question.subject = "Incorrect bank subject";
  repository.question.topic = "Incorrect bank topic";
  let input = "";
  const { ai } = createAI({ async embed(value) { input = value; return [3, 4, 0]; } });
  await new ConceptPipeline(repository, ai, config).process(reference);
  assert.match(input, /Subject\/topic: Geography; Borders\./);
  assert.doesNotMatch(input, /Incorrect bank/);
  assert.equal(repository.question.subject, "Incorrect bank subject");
});

test("uncertain, conflicting, low-confidence or unanchored classifications are held before concept creation or embeddings", async () => {
  for (const change of [
    (value: ReturnType<typeof fixture>) => { value.classification.review.status = "uncertain"; },
    (value: ReturnType<typeof fixture>) => { value.classification.review.status = "conflict"; },
    (value: ReturnType<typeof fixture>) => { value.classification.review.subject_confidence = 0.84; },
    (value: ReturnType<typeof fixture>) => { value.classification.review.topic_confidence = 0.84; },
    (value: ReturnType<typeof fixture>) => { value.classification.review.source_evidence = []; },
  ]) {
    const repository = new MemoryRepository();
    repository.concepts = [];
    const extraction = fixture();
    extraction.provenance.needs_review = false;
    change(extraction);
    const { ai, calls } = createAI({ async extract() { calls.extract++; return extraction; } });
    const pipeline = new ConceptPipeline(repository, ai, config);
    assert.equal(await pipeline.process(reference), "pending_review");
    assert.equal(calls.embed, 0);
    assert.equal(repository.concepts.length, 0);
    assert.equal(repository.profile.document.processing.status, "pending_review");
    assert.equal(repository.profile.document.embedding, null);
    assert.equal(repository.profile.document.provenance.needs_review, true);
    assert.match(repository.profile.document.provenance.review_notes.join(" "), /Classification requires review/);
    assert.deepEqual(repository.profile.document.classification.review, extraction.classification.review);
    assert.equal(await pipeline.process(reference), "pending_review");
    assert.equal(calls.extract, 1);
  }
});

test("unreviewed legacy profiles are readable but cannot supply embedding input or skip fresh classification", async () => {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  await pipeline.process(reference);
  delete repository.profile.document.classification.review;
  const legacy = profileExtractionSchema.parse(repository.profile.document);
  assert.throws(() => buildEmbeddingInput(legacy), /has not been reviewed/);
  assert.equal(await pipeline.process(reference), "ready");
  assert.deepEqual(calls, { extract: 2, embed: 2 });
});

test("confident labels that disagree with supplied or canonical primary taxonomy are blocked", async () => {
  for (const field of ["subject", "topic"] as const) {
    const repository = new MemoryRepository();
    const extraction = fixture();
    extraction.classification[field] = "Unrelated classification";
    const { ai, calls } = createAI({ async extract() { return extraction; } });
    assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "pending_review");
    assert.match(repository.profile.document.processing.error, /conflicts with its primary concept taxonomy/);
    assert.equal(calls.embed, 0);
    assert.equal(repository.profile.document.classification.review.status, "conflict");
    assert.equal(repository.profile.document.provenance.needs_review, true);
  }
  const repository = new MemoryRepository();
  repository.concepts[0].topic = "Different canonical topic";
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.concept_profile.secondary_concepts.push({
    concept_id: "land_adjacency_definition", canonical_name: "Meaning of a shared land border",
    role: "prerequisite", confidence: 0.95,
  });
  extraction.concept_definitions.push({
    id: "land_adjacency_definition", canonical_name: "Meaning of a shared land border",
    definition: "A shared land border establishes land adjacency between countries.",
    subject: "Geography", topic: "Borders", aliases: [], parentConceptIds: [],
  });
  const { ai, calls } = createAI({ async extract() { return extraction; } });
  assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "pending_review");
  assert.match(repository.profile.document.processing.error, /Different canonical topic/);
  assert.equal(calls.embed, 0);
  assert.equal(repository.profile.document.classification.review.status, "conflict");
  assert.equal(repository.profile.document.embedding, null);
  assert.equal(repository.concepts.length, 1);
});

test("classification review rejects invented evidence and non-primary anchors before imported writes", async () => {
  const repository = new MemoryRepository();
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
  });
  let embeddings = 0;
  const pipeline = new ConceptPipeline(repository, { async embed() { embeddings++; return [3, 4, 0]; } }, config);
  const valid = entry.extraction.classification.review.source_evidence[0];
  for (const evidence of [
    { ...valid, exact_text: "Ukraine's coastline" },
    { ...valid, concept_id: "unassigned_concept" },
    { ...valid, field: "option" as const },
    { ...valid, field: "explanation" as const },
  ]) {
    entry.extraction.classification.review.source_evidence = [evidence];
    await assert.rejects(pipeline.processImported(entry), /Classification evidence/);
  }
  assert.equal(repository.writes, 0);
  entry.extraction.classification.review.source_evidence = [valid];
  entry.extraction.classification.review.status = "uncertain";
  assert.equal(await pipeline.processImported(entry), "pending_review");
  assert.equal(repository.profile.document.processing.status, "pending_review");
  assert.equal(repository.profile.document.embedding, null);
  assert.equal(embeddings, 0);
});

test("imported extraction calls only embeddings, skips unchanged imports, and reapplies changed annotations", async context => {
  const repository = new MemoryRepository();
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
  });
  let calls = 0;
  context.mock.method(globalThis, "fetch", async (url: string) => {
    calls++;
    assert.match(String(url), /:(?:embedContent|batchEmbedContents)(?:\?|$)/);
    assert.doesNotMatch(String(url), /generateContent/);
    return Response.json({ embeddings: [{ values: [3, 4, 0] }] });
  });
  const importedConfig = { ...config, extractionModel: "gpt-6.1-sol" };
  const pipeline = new ConceptPipeline(repository, new GoogleEmbeddingAI(importedConfig), importedConfig);
  assert.equal(await pipeline.processImported(entry), "ready");
  assert.equal(repository.profile.document.processing.extractionModel, "gpt-6.1-sol");
  assert.equal(repository.profile.document.processing.extractionContentHash, hashContent(entry.extraction));
  assert.equal(await pipeline.processImported(entry), "skipped");
  assert.equal(calls, 1);
  entry.extraction.concept_profile.underlying_principle += " Updated concept annotation.";
  assert.equal(await pipeline.processImported(entry), "ready");
  assert.equal(calls, 2);
});

test("highlight-only imports remap evidence concepts and retain vectors without another embedding call", async () => {
  const repository = new MemoryRepository();
  let calls = 0;
  const ai = { async embed() { calls++; return [3, 4, 0]; } };
  const pipeline = new ConceptPipeline(repository, ai, config);
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
  });
  await pipeline.processImported(entry);
  const previous = structuredClone(repository.profile.document);
  entry.extraction.highlight_evidence = [
    { concept_id: "ukraine_borders", field: "question", exact_text: " border " },
    { concept_id: "ukraine_borders", field: "option", option_index: 0, exact_text: "Poland" },
  ];
  assert.equal(await pipeline.processImported(entry), "ready");
  const saved = repository.profile.document;
  assert.deepEqual(saved.highlight_evidence, entry.extraction.highlight_evidence.map(highlight => ({
    ...highlight, concept_id: "ukraine_land_borders",
  })));
  assert.deepEqual(saved.embedding, previous.embedding);
  assert.equal(saved.concept_embedding_input, previous.concept_embedding_input);
  assert.equal(saved.processing.embeddingInputHash, previous.processing.embeddingInputHash);
  assert.equal(saved.processing.extractionContentHash, hashContent(validateExtraction(entry.extraction, repository.question)));
  assert.equal(calls, 1);
  assert.equal(await pipeline.processImported(entry), "skipped");
  assert.equal(calls, 1);
  assert.equal(await pipeline.processImported(entry, true), "ready");
  assert.equal(calls, 2);
  const changedSpace = new ConceptPipeline(repository, ai, { ...config, embeddingSpaceVersion: "new-space" });
  assert.equal(await changedSpace.processImported(entry), "ready");
  assert.equal(calls, 3);
});

test("highlight evidence validates exact field text and rejects invalid anchors before writes or AI calls", async () => {
  const repository = new MemoryRepository();
  repository.question.explanation = "Ukraine has a land border with Poland.";
  const extraction = fixture();
  extraction.provenance.inputs_used.push("provided_explanation");
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction,
  });
  const valid = { concept_id: "ukraine_borders", field: "question" as const, exact_text: "Ukraine" };
  entry.extraction.highlight_evidence = [
    valid,
    { ...valid, field: "option", option_index: 1, exact_text: "Lithuania" },
    { ...valid, field: "explanation", exact_text: "land border with Poland" },
  ];
  assert.equal(validateExtraction(entry.extraction, repository.question).highlight_evidence.length, 3);
  let calls = 0;
  const pipeline = new ConceptPipeline(repository, { async embed() { calls++; return [3, 4, 0]; } }, config);
  const invalid: NonNullable<typeof entry.extraction.highlight_evidence>[] = [
    [{ ...valid, concept_id: "unknown_concept" }],
    [{ ...valid, exact_text: "ukraine" }],
    [{ ...valid, exact_text: "Ukraine has borders" }],
    [{ ...valid, exact_text: "   " }],
    [{ ...valid, option_index: 0 }],
    [{ ...valid, field: "option" }],
    [{ ...valid, field: "option", option_index: 2 }],
    [{ ...valid, field: "option", option_index: -1 }],
    [{ ...valid, field: "option", option_index: 1, exact_text: "Poland" }],
    [valid, valid],
  ];
  for (const evidence of invalid) {
    await assert.rejects(pipeline.processImported({ ...entry, extraction: {
      ...entry.extraction, highlight_evidence: evidence,
    } }), /[Hh]ighlight/);
  }
  entry.extraction.provenance.inputs_used = ["question", "options", "provided_answer"];
  await assert.rejects(pipeline.processImported(entry), /input that was not used/);
  repository.question.explanation = null;
  entry.sourceContentHash = hashContent(repository.question);
  await assert.rejects(pipeline.processImported(entry), /source explanation/);
  assert.equal(repository.writes, 0);
  assert.equal(calls, 0);
});

test("stale or invalid imported evidence is rejected before profile writes or embedding calls", async () => {
  const repository = new MemoryRepository();
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
  });
  let calls = 0;
  const pipeline = new ConceptPipeline(repository, { async embed() { calls++; return [1, 0, 0]; } }, config);
  repository.question.question += " Changed.";
  await assert.rejects(pipeline.processImported(entry), /outdated source hash/);
  entry.sourceContentHash = hashContent(repository.question);
  entry.extraction.provenance.inputs_used.push("provided_explanation");
  await assert.rejects(pipeline.processImported(entry), /provenance/);
  assert.equal(calls, 0);
  assert.equal(repository.writes, 0);
});

test("failed imported embeddings resume saved canonical extraction without text generation", async () => {
  const repository = new MemoryRepository();
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
  });
  let fail = true;
  const embeddings = { async embed() {
    if (fail) throw new Error("Embedding unavailable.");
    return [3, 4, 0];
  } };
  await assert.rejects(new ConceptPipeline(repository, embeddings, config).processImported(entry), /Embedding unavailable/);
  assert.equal(repository.profile.document.processing.status, "failed");
  assert.equal(repository.profile.document.concept_profile.primary_concepts[0].concept_id, "ukraine_land_borders");
  repository.listConcepts = async () => { throw new Error("Extraction must be reused."); };
  fail = false;
  assert.equal(await new ConceptPipeline(repository, embeddings, config).processImported(entry), "ready");
});

test("import batches reject duplicate source identities but allow identical IDs in distinct containers", () => {
  const entry = {
    ...reference, sourceContentHash: hashContent(new MemoryRepository().question), extraction: fixture(),
  };
  const batch = { formatVersion: "1", extractionModel: "gpt-6.1-sol", entries: [entry, entry] };
  assert.throws(() => extractionBatchSchema.parse(batch), /Duplicate imported profile/);
  batch.entries = [entry, { ...entry, sourceContainer: "state_pcs" }];
  assert.equal(extractionBatchSchema.parse(batch).entries.length, 2);
});

test("embedding failures are recorded and resume without another extraction", async () => {
  const repository = new MemoryRepository();
  let fail = true;
  const { ai, calls } = createAI({
    async embed() {
      calls.embed++;
      if (fail) throw new Error("Embedding service unavailable.");
      return [3, 4, 0];
    },
  });
  const pipeline = new ConceptPipeline(repository, ai, config);
  await assert.rejects(pipeline.process(reference), /Embedding service unavailable/);
  assert.equal(repository.profile.document.processing.status, "failed");
  assert.equal(repository.profile.document.embedding, null);
  assert.ok(repository.profile.document.classification);
  fail = false;
  assert.equal(await pipeline.process(reference), "ready");
  assert.deepEqual(calls, { extract: 1, embed: 2 });
});

test("source edits invalidate a generated vector instead of publishing stale data", async () => {
  const repository = new MemoryRepository();
  const { ai } = createAI({
    async embed() {
      repository.question.question += " Updated.";
      return [3, 4, 0];
    },
  });
  await assert.rejects(new ConceptPipeline(repository, ai, config).process(reference), /changed during processing/);
  assert.equal(repository.profile.document.processing.status, "stale");
  assert.equal(repository.profile.document.embedding, null);
});

test("changing only the embedding space reuses extraction; explanation edits re-extract", async () => {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  await new ConceptPipeline(repository, ai, config).process(reference);
  const changed = { ...config, embeddingSpaceVersion: "new-space" };
  await new ConceptPipeline(repository, ai, changed).process(reference);
  assert.deepEqual(calls, { extract: 1, embed: 2 });
  repository.question.explanation = "A new supplied explanation.";
  await new ConceptPipeline(repository, ai, changed).process(reference);
  assert.deepEqual(calls, { extract: 2, embed: 3 });
});

test("in-progress leases and optimistic write conflicts do not overwrite another worker", async () => {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  await pipeline.process(reference);
  repository.profile.document.processing.status = "extracting";
  const writes = repository.writes;
  await assert.rejects(pipeline.process(reference), /already processing/);
  assert.equal(repository.writes, writes);
  assert.deepEqual(calls, { extract: 1, embed: 1 });
  repository.profile.document.processing.updatedAt = "2000-01-01T00:00:00.000Z";
  repository.changesDuringSave = true;
  await assert.rejects(pipeline.process(reference), /failure status could not be persisted/);
  assert.equal(repository.profile.etag, "another-worker");
});

test("new concepts remain provisional and ambiguous aliases are queued for review", async () => {
  const repository = new MemoryRepository();
  repository.concepts = [];
  const { ai } = createAI();
  await new ConceptPipeline(repository, ai, config).process(reference);
  assert.equal(repository.concepts[0].status, "provisional");
  assert.equal(repository.profile.document.provenance.needs_review, true);
  assert.match(repository.profile.document.provenance.review_notes.join(" "), /Provisional concepts/);

  const conflicting = new MemoryRepository();
  conflicting.concepts.push({ ...conflicting.concepts[0], id: "another_border_concept" });
  assert.equal(await new ConceptPipeline(conflicting, ai, config).process(reference), "pending_review");
  assert.match(conflicting.profile.document.processing.error, /Ambiguous canonical/);
  assert.equal(conflicting.profile.document.processing.status, "pending_review");
});

test("missing evidence and undefined concept references are rejected before embedding", async () => {
  const repository = new MemoryRepository();
  const bad = fixture();
  bad.provenance.inputs_used.push("provided_explanation");
  assert.throws(() => validateExtraction(bad, repository.question), /provenance/);
  const { ai, calls } = createAI({ async extract() { return bad; } });
  await assert.rejects(new ConceptPipeline(repository, ai, config).process(reference), /provenance/);
  assert.equal(calls.embed, 0);
  assert.equal(repository.profile.document.processing.status, "failed");

  const undefinedConcept = fixture();
  undefinedConcept.concept_definitions[0].id = "unassigned_concept";
  assert.throws(() => validateExtraction(undefinedConcept, repository.question), /exactly one definition/);

  const missingClaims = fixture();
  missingClaims.classification.question_format = "statement_evaluation";
  assert.throws(() => validateExtraction(missingClaims, repository.question), /individual claim analyses/);

  const falseEvidence = fixture();
  falseEvidence.provenance.truth_labels_based_on = "provided_explanation";
  assert.throws(() => validateExtraction(falseEvidence, repository.question), /explanation/);
});

test("focused text excludes answer-selection wording, and invalid vectors cannot be ready", async () => {
  const question = new MemoryRepository().question;
  const extraction = validateExtraction(fixture(), question);
  const input = buildEmbeddingInput(extraction);
  assert.match(input, /Ukraine/);
  assert.doesNotMatch(input, /negative_selection|Lithuania|Test|2024/);
  assert.throws(() => validateVector([1, 2], 3), /exactly 3/);
  assert.throws(() => validateVector([1, NaN, 2], 3), /finite/);
  assert.throws(() => validateVector([0, 0, 0], 3), /magnitude/);
  const repository = new MemoryRepository();
  const { ai } = createAI({ async embed() { return [0, 0, 0]; } });
  await assert.rejects(new ConceptPipeline(repository, ai, config).process(reference), /magnitude/);
  assert.equal(repository.profile.document.processing.status, "failed");
});

test("SDK transient HTTP failures retry at most three times while bad requests never retry", async context => {
  let calls = 0;
  let status = 503;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response("{}", { status, statusText: status === 503 ? "Service Unavailable" : "Bad Request" });
  });
  const provider = new GooglePipelineAI(config);
  await assert.rejects(provider.embed("Land borders."), /Service Unavailable/);
  assert.equal(calls, 3);
  calls = 0;
  status = 400;
  await assert.rejects(provider.embed("Land borders."), /Bad Request/);
  assert.equal(calls, 1);
});

test("SDK transient failures recover without multiplying the three-attempt budget", async context => {
  let calls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls < 3
      ? new Response("{}", { status: 503, statusText: "Service Unavailable" })
      : Response.json({ embeddings: [{ values: [3, 4, 0] }] });
  });
  assert.deepEqual(await new GooglePipelineAI(config).embed("Land borders."), [3, 4, 0]);
  assert.equal(calls, 3);
});

test("extraction sends a single-value role enum to Gemini and rejects invalid primary roles", async context => {
  const question = new MemoryRepository().question;
  question.subject = "Incorrect bank subject";
  question.topic = "Incorrect bank topic";
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    const sent = JSON.parse(body.contents[0].parts[0].text);
    assert.equal("subject" in sent.question, false);
    assert.equal("topic" in sent.question, false);
    assert.equal(sent.question.question, question.question);
    assert.deepEqual(sent.question.options, question.options);
    assert.equal(sent.question.answer, question.answer);
    const role = body.generationConfig.responseJsonSchema.properties.concept_profile
      .properties.primary_concepts.items.properties.role;
    assert.deepEqual(role.enum, ["primary"]);
    assert.equal("const" in role, false);
    return Response.json({
      candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(fixture()) }] } }],
    });
  });
  const extraction = await new GooglePipelineAI(config).extract(question, []);
  assert.equal(validateExtraction(extraction, question).concept_profile.primary_concepts[0].role, "primary");
  const invalid = fixture();
  invalid.concept_profile.primary_concepts[0].role = "secondary";
  assert.throws(() => validateExtraction(invalid, question), /primary/);
});

test("master-constrained extraction receives only active catalogue entries without bank labels", async context => {
  const question = new MemoryRepository().question;
  question.subject = "Current Affairs";
  question.topic = "Legacy topic";
  const common = {
    subjectId: "S01", sortOrder: 1, schemaVersion: "1" as const,
    sourceRevision: "test", legacyIds: [],
  };
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    const sent = JSON.parse(body.contents[0].parts[0].text);
    assert.equal("subject" in sent.question, false);
    assert.equal("topic" in sent.question, false);
    assert.deepEqual(sent.active_subject_topic_master.map((record: { id: string }) => record.id), ["S01", "S01-T01"]);
    assert.match(body.systemInstruction.parts[0].text, /required question-classification catalogue/);
    assert.match(body.systemInstruction.parts[0].text, /rather[\s\S]*than duplicating the concept/);
    return Response.json({
      candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(fixture()) }] } }],
    });
  });
  await new GooglePipelineAI(config, [
    { ...common, id: "S01", type: "subject", parentId: null, name: "History",
      description: "Historical subjects", isActive: true },
    { ...common, id: "S01-T01", type: "topic", parentId: "S01", name: "Ancient India",
      details: ["Ancient historical content"], isActive: true },
    { ...common, id: "S01-T02", type: "topic", parentId: "S01", name: "Retired topic",
      details: [], isActive: false,
      retirement: { reason: "Replaced", replacementIds: ["S01-T01"], requiresReview: true } },
  ]).extract(question, []);
});

test("the independent semantic reviewer receives registry definitions and source roles, not an earlier decision", async context => {
  const repository = new MemoryRepository();
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    const sent = JSON.parse(body.contents[0].parts[0].text);
    assert.equal("subject" in sent.question, false);
    assert.equal("topic" in sent.question, false);
    assert.equal("concept_review" in sent.proposed_extraction, false);
    assert.equal(sent.canonical_concepts.length, 1);
    assert.equal(sent.canonical_concepts[0].definition, repository.concepts[0].definition);
    assert.equal(sent.proposed_extraction.concept_profile.primary_concepts[0].role, "primary");
    const fields = body.generationConfig.responseJsonSchema.properties.decisions.items.properties;
    assert.deepEqual(fields.decision.enum, ["reuse", "new", "review"]);
    assert.deepEqual(fields.role_status.enum, ["supported", "uncertain", "unrelated"]);
    return Response.json({
      candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(fixture().concept_review) }] } }],
    });
  });
  const retired = { ...repository.concepts[0], id: "retired_concept", status: "retired" as const };
  const result = await new GooglePipelineAI(config).reviewConcepts(
    repository.question, importedExtractionSchema.shape.extraction.parse(fixture()), [...repository.concepts, retired],
  );
  assert.deepEqual(result, fixture().concept_review);
});

test("setup rejects an existing vector policy with incompatible dimensions", () => {
  const definition = profileContainerDefinition(1536);
  validateProfileContainer(definition, 1536);
  assert.throws(() => validateProfileContainer(definition, 768), /incompatible/);
  definition.indexingPolicy.excludedPaths = [];
  assert.throws(() => validateProfileContainer(definition, 1536), /incompatible/);
});

test("dedicated throughput requires explicit creation and valid allocation before any network requests", async () => {
  const database = new CosmosClient({
    endpoint: "https://offline.documents.azure.com",
    key: Buffer.from("offline-test-only").toString("base64"),
  }).database("offline");
  await assert.rejects(ensureContainers(database, 1536, false, 400), /requires --create/);
  await assert.rejects(ensureContainers(database, 1536, true, 399), /at least 400/);
  await assert.rejects(ensureContainers(database, 1536, true, 450), /increments of 100/);
});

test("batch CLIs report review IDs and held flags do not exhaust the processing limit", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const output = await mkdtemp(path.join(root, ".similarity-review-test-"));
  try {
    for (const relative of [
      path.join("features", "similarity", "config.ts"),
      path.join("features", "similarity", "schema.ts"),
      path.join("features", "similarity", "verification.ts"),
      path.join("features", "similarity", "content-hash.ts"),
      path.join("features", "similarity", "pipeline.ts"),
      path.join("scripts", "similarity", "import.ts"),
      path.join("scripts", "similarity", "process.ts"),
    ]) {
      const source = await readFile(path.join(root, relative), "utf8");
      const compiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText.replace(/from "(\.[^"]+)"/g, (match, specifier: string) =>
        specifier.endsWith(".js") ? match : `from "${specifier}.js"`);
      const destination = path.join(output, relative.replace(/\.ts$/, ".js"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, compiled);
    }
    const repository = new MemoryRepository();
    const first = structuredClone(repository.question);
    const second = { ...first, id: "2263" };
    const third = { ...first, id: "2264" };
    const unreviewed = importedExtractionSchema.shape.extraction.parse(fixture());
    delete unreviewed.concept_review;
    const uncertain = fixture();
    uncertain.classification.review.status = "uncertain";
    const batch = {
      formatVersion: "1", extractionModel: "offline-import",
      entries: [
        { ...reference, sourceContentHash: hashContent(first), extraction: unreviewed },
        { sourceContainer: "questions", questionId: third.id, sourceContentHash: hashContent(third), extraction: uncertain },
        { sourceContainer: "questions", questionId: second.id, sourceContentHash: hashContent(second), extraction: fixture() },
      ],
    };
    const mockRepository = `
      const questions = ${JSON.stringify([first, second, third])};
      const concepts = ${JSON.stringify(repository.concepts)};
      const profiles = new Map();
      export function createRepository() {
        return {
          database: {},
          async readQuestion(reference) { return questions.find(question => question.id === reference.questionId); },
          async readQuestionSnapshot(reference) {
            return { question: questions.find(question => question.id === reference.questionId), etag: "source-etag" };
          },
          async saveQuestionVerification(reference, verification, snapshot) {
            return { ...snapshot, verification: structuredClone(verification) };
          },
          async readProfile(id) { return profiles.get(id); },
          async pendingReviewQuestionIds() { return new Set(["2262", "2264"]); },
          async *questionReferences() {
            for (const index of [0, 2, 1]) yield { sourceContainer: "questions", questionId: questions[index].id };
          },
          async listConcepts() { return concepts; },
          async createConcept() { throw new Error("Unexpected concept creation"); },
          async saveProfile(document) {
            const snapshot = { document: structuredClone(document), etag: String(profiles.size + 1) };
            profiles.set(document.id, snapshot);
            return snapshot;
          },
        };
      }
      export async function ensureContainers() {}
    `;
    await writeFile(path.join(output, "features", "similarity", "repository.js"), mockRepository);
    await writeFile(path.join(output, "features", "similarity", "google.js"), `
      export class GoogleEmbeddingAI {
        async embed() { return [1, ...Array(767).fill(0)]; }
      }
      export class GooglePipelineAI extends GoogleEmbeddingAI {
        async extract() { return ${JSON.stringify(fixture())}; }
        async reviewConcepts() { return ${JSON.stringify(fixture().concept_review)}; }
      }
    `);
    await writeFile(path.join(output, "package.json"), JSON.stringify({ type: "module" }));
    const batchFile = path.join(output, "batch.json");
    await writeFile(batchFile, JSON.stringify(batch));
    const { stdout } = await promisify(execFile)(process.execPath, [
      path.join(output, "scripts", "similarity", "import.js"), "--file", batchFile, "--process",
    ], {
      cwd: output, timeout: 15_000,
      env: { ...process.env, NODE_OPTIONS: "", SIMILARITY_GEMINI_API_KEY: "offline-test-only", SIMILARITY_EMBEDDING_DIMENSIONS: "768" },
    });
    assert.match(stdout, /questions:2262: pending_review/);
    assert.match(stdout, /questions:2264: pending_review/);
    assert.match(stdout, /questions:2263: ready/);
    const summary = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
    assert.deepEqual(summary, { ready: 1, skipped: 0, pending_review: 2, failed: 0, pendingReview: ["questions:2262", "questions:2264"] });
    const { stdout: processed } = await promisify(execFile)(process.execPath, [
      path.join(output, "scripts", "similarity", "process.js"), "--source", "questions", "--limit", "1", "--process",
    ], {
      cwd: output, timeout: 15_000,
      env: {
        ...process.env, NODE_OPTIONS: "", SIMILARITY_GEMINI_API_KEY: "offline-test-only",
        SIMILARITY_EMBEDDING_DIMENSIONS: "768", SIMILARITY_EXTRACTION_MODEL: "offline-process",
      },
    });
    const processedSummary = JSON.parse(processed.trim().split(/\r?\n/).at(-1));
    assert.deepEqual(processedSummary, {
      ready: 1, skipped: 0, pending_review: 2, failed: 0, previewed: 0,
      pendingReview: ["questions:2262", "questions:2264"],
    });
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("the transpiled Vercel API starts in native Node ESM without a TypeScript loader", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const output = await mkdtemp(path.join(root, ".vercel-esm-test-"));
  try {
    const modules = (await readdir(path.join(root, "features", "similarity")))
      .filter(name => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map(name => path.join("features", "similarity", name));
    for (const relative of [path.join("api", "index.ts"), path.join("features", "taxonomy", "master.ts"), ...modules]) {
      const source = await readFile(path.join(root, relative), "utf8");
      const result = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      const destination = path.join(output, relative.replace(/\.ts$/, ".js"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, result.outputText);
    }
    await writeFile(path.join(output, "package.json"), JSON.stringify({ type: "module" }));
    const entry = pathToFileURL(path.join(output, "api", "index.js")).href;
    const { stdout } = await promisify(execFile)(process.execPath, [
      "--input-type=module",
      "--eval",
      `const { default: app } = await import(${JSON.stringify(entry)}); if (typeof app !== "function") throw new Error("Missing Express app"); console.log("native-esm-ready");`,
    ], {
      cwd: output,
      timeout: 15_000,
      env: {
        ...process.env,
        NODE_OPTIONS: "",
        COSMOS_ENDPOINT: "https://offline.documents.azure.com",
        COSMOS_KEY: Buffer.from("offline-test-only").toString("base64"),
        RAZORPAY_KEY_ID: "",
        RAZORPAY_KEY_SECRET: "",
      },
    });
    assert.match(stdout, /native-esm-ready/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
