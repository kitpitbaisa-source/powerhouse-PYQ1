import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { CosmosClient } from "@azure/cosmos";
import ts from "typescript";
import { embeddingModel, embeddingPrefix, promptVersion, sourceContainers, type PipelineConfig } from "./config";
import { GoogleEmbeddingAI, GooglePipelineAI, type PipelineAI } from "./google";
import { ConceptPipeline, buildEmbeddingInput, provisionalEmbeddingReview, hashContent, validateVector, type ConceptResolutionRequest, type EmbeddingMaintenanceRequest, type ClassificationMaintenanceRequest, type ClassificationParentMaintenanceRequest, type SubtopicMaintenanceRequest } from "./pipeline";
import { batchProposalsFingerprint, bindConceptReview, conceptResolutionBatchProposalsFingerprint, registryFingerprint } from "./concept-review";
import { highlightReviewIssue } from "./highlight-review";
import {
  CosmosPipelineRepository, ensureContainers, profileContainerDefinition, validateProfileContainer,
  conceptRegistryLockId, type ConceptRegistrySession, type PipelineRepository, type ProfileSnapshot, type SourceQuestionSnapshot,
} from "./repository";
import {
  conceptResolutionBatchSchema, conceptReviewSchema, extractionBatchSchema, importedExtractionSchema, sourceQuestionSchema, validateExtraction,
  profileExtractionSchema, type ExtractionResponse, type SourceQuestion, type StoredProfile,
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
  const extraction = {
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
    highlight_evidence: [
      { concept_id: "ukraine_borders", field: "question", exact_text: "border Ukraine" },
    ],
    concept_review: {
      highlights: {
        status: "complete", rationale: "The concise stem phrase identifies the tested land-adjacency relationship.",
        gaps: [], extended_excerpts: [], dense_fields: [],
      },
      coverage: {
        status: "complete", rationale: "The question tests one land-adjacency fact; both options were considered.",
        uncovered_items: [],
        reviewed_fields: [
          { field: "question", rationale: "Directly tests land adjacency." },
          { field: "option", option_index: 0, rationale: "A land-adjacency candidate, not an independent concept.",
            highlight_gap: "The candidate name does not describe the tested relationship; this fixture selects its stem wording." },
          { field: "option", option_index: 1, rationale: "A land-adjacency candidate, not an independent concept.",
            highlight_gap: "The candidate name does not describe the tested relationship; this fixture selects its stem wording." },
        ],
        items: [{
          item_id: "land_adjacency", meaning: "Ukraine's land adjacency", concept_ids: ["ukraine_borders"], claim_ids: [],
          source_evidence: [{ concept_id: "ukraine_borders", field: "question", exact_text: "border Ukraine" }],
        }],
      },
      decisions: [{
        concept_id: "ukraine_borders", decision: "reuse", existing_concept_id: "ukraine_land_borders",
        meaning_scope_rationale: "Both definitions describe Ukraine's land adjacency at the same scope.",
        role: "primary", role_status: "supported",
        role_rationale: "Land adjacency is directly tested by the question.",
        source_evidence: [{ concept_id: "ukraine_borders", field: "question", exact_text: "border Ukraine" }],
        compared_concept_ids: ["ukraine_land_borders"],
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
  const parsed = importedExtractionSchema.shape.extraction.parse(extraction);
  const repository = new MemoryRepository();
  return {
    ...extraction,
    concept_review: bindConceptReview(
      repository.question, parsed, repository.concepts, "offline-reviewer", parsed.concept_review, "2026-10-19T00:00:00.000Z",
    ),
  };
}

class MemoryRepository implements PipelineRepository {
  question: SourceQuestion = sourceQuestionSchema.parse({
    id: "2262", question: "Which country does not border Ukraine?",
    options: ["Poland", "Lithuania"], answer: "Lithuania",
    exam: "Test", year: "2024", subject: "Geography",
  });
  profile: ProfileSnapshot | undefined;
  provisionalProfile: ProfileSnapshot | undefined;
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
  masterClassification: {
    subject: string; topic: string; subtopics?: { id: string; name: string }[];
  } | undefined = { subject: "Geography", topic: "Borders" };

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
  async saveQuestionClassification(
    _reference: QuestionReference, labels: { subject: string; topic: string },
    verification: QuestionVerification, expected: SourceQuestionSnapshot,
  ): Promise<SourceQuestionSnapshot> {
    const corrected = { ...this.question, subject: labels.subject, topic: labels.topic };
    if (expected.etag !== String(this.questionEtag) ||
        hashContent(expected.question) !== hashContent(this.question) ||
        verification.sourceContentHash !== hashContent(corrected)) {
      throw new QuestionVerificationConflictError("Concurrent classification source update.");
    }
    this.question = corrected;
    this.questionVerification = questionVerificationSchema.parse(verification);
    this.questionEtag++;
    this.verificationWrites++;
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
  async saveSubtopicProfile(document: StoredProfile, etag: string) { return this.saveProfile(document, etag); }
  async readProvisionalProfile() { return structuredClone(this.provisionalProfile); }
  async saveProvisionalProfile(document: StoredProfile, etag?: string): Promise<ProfileSnapshot> {
    assert.equal(etag, this.provisionalProfile?.etag);
    this.provisionalProfile = { document: structuredClone(document), etag: "provisional-1" };
    return structuredClone(this.provisionalProfile);
  }
  async listConcepts() { return structuredClone(this.concepts); }
  async createConcept(concept: CanonicalConcept) {
    this.concepts.push(structuredClone(concept));
    return structuredClone(concept);
  }
  private registryQueue: Promise<unknown> = Promise.resolve();
  async withConceptRegistry<T>(action: (session: ConceptRegistrySession) => Promise<T>): Promise<T> {
    const run = this.registryQueue.then(async () => action({
      concepts: await this.listConcepts(),
      createConcept: concept => this.createConcept(concept),
    }));
    this.registryQueue = run.catch(() => undefined);
    return run;
  }
}

async function provisionalFixture() {
  const repository = new MemoryRepository();
  repository.question.topic = "Borders";
  repository.masterClassification!.subtopics = [{ id: "S03-T01-ST01", name: "Land borders" }];
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  await pipeline.process(reference);
  const verification = flagQuestionForReview(repository.profile!.document.verification!, {
    code: "EXPLANATION_UNCERTAIN", check: "explanation", reason: "Source explanation still needs review.",
    requiredAction: "Review later.", evidence: ["Original issue evidence."],
  });
  verification.checks.master_classification = { status: "passed", reason: "Supported source classification.",
    evidence: ["Supported source classification."] };
  verification.masterClassification = { subjectId: "S03", topicId: "S03-T01" };
  repository.questionVerification = structuredClone(verification);
  repository.profile!.document.verification = structuredClone(verification);
  repository.profile!.document.processing.status = "pending_review";
  repository.profile!.document.embedding = null;
  repository.profile!.document.provenance!.needs_review = true;
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.classification.master = { subjectId: "S03", topicId: "S03-T01", subtopicIds: ["S03-T01-ST01"] };
  extraction.concept_review.decisions[0].decision = "review";
  extraction.concept_review.decisions[0].existing_concept_id = null;
  delete extraction.concept_review.audit;
  const entry = importedExtractionSchema.parse({ ...reference, sourceContentHash: hashContent(repository.question), extraction });
  const request = {
    mode: "flagged_similarity" as const, authorizedBy: "explicit-user-authorization",
    authorizedAt: "2026-10-23T18:00:00.000Z", auditReference: "offline:provisional-test",
    reason: "Provisional embedding authorized; explanation and identity remain flagged.",
    expectedSourceEtag: String(repository.questionEtag), expectedProfileEtag: repository.profile!.etag,
    issues: [{ code: "IDENTITY_PENDING", reason: "Canonical identity has not been admitted." }],
  };
  return { repository, pipeline, ai, calls, entry, request };
}

test("explicit provisional embeddings retain all flags without source or canonical writes", async () => {
  const { repository, pipeline, entry, request, calls } = await provisionalFixture();
  const before = await repository.readQuestionSnapshot();
  const verification = structuredClone(repository.profile!.document.verification);
  const concepts = structuredClone(repository.concepts);
  const previousCalls = structuredClone(calls);
  const previousWrites = repository.writes;
  assert.equal(await pipeline.processProvisionalImported(entry, request), "ready");
  const after = repository.profile!.document;
  assert.equal(repository.writes, previousWrites + 1);
  assert.equal(repository.provisionalProfile, undefined);
  assert.equal(after.processing.status, "ready");
  assert.equal(after.processing.error, null);
  assert.equal(after.processing.provisionalEmbedding!.reviewLevel, "advisory");
  assert.equal(after.verification!.status, "pending_review");
  assert.deepEqual(after.verification, verification);
  assert.deepEqual(await repository.readQuestionSnapshot(), before);
  assert.deepEqual(repository.concepts, concepts);
  assert.equal(calls.extract, previousCalls.extract);
  assert.equal(calls.embed, previousCalls.embed + 1);
  assert.equal(after.embedding!.length, config.dimensions);
  assert.equal(after.processing.provisionalEmbedding!.profileVerificationHash, hashContent(after.verification), "Verification binding");
  assert.equal(after.processing.provisionalEmbedding!.profileExtractionHash,
    hashContent(profileExtractionSchema.parse(after)), "Extraction binding");
  assert.equal(provisionalEmbeddingReview(after)!.reason, request.reason);
  assert(after.processing.provisionalEmbedding!.issues.some(issue => issue.code === "EXPLANATION_UNCERTAIN"));
  assert(after.processing.provisionalEmbedding!.issues.some(issue => issue.code === "IDENTITY_PENDING"));
});

test("provisional embedding rejects stale or missing authorization before provider calls", async t => {
  for (const invalid of ["source", "profile", "authorization", "classification"]) await t.test(invalid, async () => {
    const { repository, pipeline, entry, request, calls } = await provisionalFixture();
    if (invalid === "source") request.expectedSourceEtag = "stale";
    if (invalid === "profile") request.expectedProfileEtag = "stale";
    if (invalid === "authorization") request.authorizedBy = "";
    if (invalid === "classification") repository.questionVerification!.checks.master_classification.status = "pending_review";
    const before = structuredClone(calls);
    const writes = repository.writes;
    await assert.rejects(() => pipeline.processProvisionalImported(entry, request));
    assert.deepEqual(calls, before);
    assert.equal(repository.writes, writes);
  });
});

test("provisional save readback accepts native float32 precision but rejects changed vector values", async t => {
  for (const drift of [false, true]) await t.test(drift ? "changed value" : "float32 storage", async () => {
    const { repository, pipeline, ai, entry, request } = await provisionalFixture();
    ai.embed = async () => [0.3, 0.7, 1.2];
    const save = repository.saveProfile.bind(repository);
    repository.saveProfile = async (document, etag) => {
      const snapshot = await save(document, etag);
      snapshot.document.embedding = snapshot.document.embedding!.map(Math.fround);
      if (drift) snapshot.document.embedding[0] += 0.1;
      repository.profile = structuredClone(snapshot);
      return snapshot;
    };
    if (drift) await assert.rejects(() => pipeline.processProvisionalImported(entry, request), /save could not be confirmed/);
    else assert.equal(await pipeline.processProvisionalImported(entry, request), "ready");
  });
});

test("source drift during provisional embedding does not replace the held profile", async () => {
  const { repository, pipeline, ai, entry, request } = await provisionalFixture();
  const writes = repository.writes;
  ai.embed = async () => { repository.questionEtag++; return [1, 0, 0]; };
  await assert.rejects(() => pipeline.processProvisionalImported(entry, request), /Source changed/);
  assert.equal(repository.writes, writes);
  assert.equal(repository.profile!.document.embedding, null);
});

async function maintenanceFixture() {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  assert.equal(await pipeline.process(reference), "ready");
  const previousSource = structuredClone(repository.question);
  repository.question.topic = "Borders";
  repository.masterClassification = {
    subject: "Geography", topic: "Borders", subtopics: [{ id: "S03-T01-ST01", name: "Land borders" }],
  };
  const classification = profileExtractionSchema.parse(repository.profile!.document).classification;
  classification.master = { subjectId: "S03", topicId: "S03-T01", subtopicIds: ["S03-T01-ST01"] };
  const request: EmbeddingMaintenanceRequest = {
    previousSource, classification, reviewedBy: "maintenance-reviewer", auditReference: "offline:maintenance-test",
  };
  return { repository, pipeline, ai, calls, request };
}

async function classificationFixture() {
  const fixture = await maintenanceFixture();
  fixture.repository.question = structuredClone(fixture.request.previousSource);
  const request: ClassificationMaintenanceRequest = {
    previousSource: structuredClone(fixture.repository.question),
    classification: {
      taxonomy_policy: "independent_source",
      subject: "Geography", topic: "Borders", subtopics: ["Land borders"],
      master: { subjectId: "S03", topicId: "S03-T01", subtopicIds: ["S03-T01-ST01"] },
      subject_confidence: 0.95, topic_confidence: 0.95,
      rationale: "The country-border question directly tests geographic land adjacency.",
      source_evidence: [{ field: "question", exact_text: "border Ukraine" }],
    },
    reviewedBy: "classification-reviewer", auditReference: "offline:classification-backup",
  };
  return { ...fixture, request };
}

async function subtopicFixture() {
  const state = await maintenanceFixture();
  await state.pipeline.maintainEmbedding(reference, state.request);
  for (const verification of [state.repository.questionVerification!, state.repository.profile!.document.verification!]) {
    verification.checks.answer = { ...verification.checks.answer, status: "passed", evidence: ["Existing source answer review."] };
    verification.checks.explanation = { ...verification.checks.explanation, status: "passed", evidence: ["Existing source explanation review."] };
  }
  state.repository.masterClassification!.subtopics!.push({ id: "S03-T01-ST02", name: "Land adjacency" });
  const request: SubtopicMaintenanceRequest = {
    previousSource: structuredClone(state.repository.question),
    expectedSourceEtag: String(state.repository.questionEtag),
    expectedProfileEtag: state.repository.profile!.etag,
    expectedProfileHash: hashContent(state.repository.profile!.document),
    reviewedBy: "subtopic-reviewer", auditReference: "offline:subtopic-backup",
    review: {
      subtopics: [{ id: "S03-T01-ST02", name: "Land adjacency",
        source_evidence: [{ field: "question", exact_text: "border Ukraine" }] }],
      rationale: "The tested geographical relationship is land adjacency.",
    },
  };
  return { ...state, request };
}

test("subtopic-only maintenance preserves source, verification, reviewed hashes, holds and vector", async () => {
  const { repository, pipeline, request, calls } = await subtopicFixture();
  const before = structuredClone(repository.profile!.document);
  const source = await repository.readQuestionSnapshot();
  const beforeCalls = structuredClone(calls);
  const stripChanges = (document: StoredProfile) => {
    const result = structuredClone(document);
    delete result.classification!.subtopics;
    delete result.classification!.master!.subtopicIds;
    delete result.processing.subtopicMaintenance;
    return result;
  };
  assert.equal(await pipeline.maintainSubtopics(reference, request), "ready");
  const after = repository.profile!.document;
  assert.deepEqual(after.classification!.subtopics, ["Land adjacency"]);
  assert.deepEqual(after.classification!.master!.subtopicIds, ["S03-T01-ST02"]);
  assert.deepEqual(stripChanges(after), stripChanges(before));
  assert.deepEqual(await repository.readQuestionSnapshot(), source);
  assert.deepEqual(calls, beforeCalls);
  assert.equal(after.processing.subtopicMaintenance!.previousProfileHash, hashContent(before));
  assert.equal(after.processing.subtopicMaintenance!.freshConceptReview, false);
  assert.equal(after.processing.subtopicMaintenance!.reusedEmbedding, true);
});

test("subtopic-only maintenance rejects stale bindings, unsupported children, bad evidence and incompatible vectors", async t => {
  for (const failure of ["source etag", "profile etag", "profile hash", "source hash", "wrong child", "wrong name",
    "duplicate child", "nonliteral evidence", "explanation only", "incompatible vector", "unreviewed classification", "verified source",
    "unchecked answer", "unchecked explanation", "stale source review"]) {
    await t.test(failure, async () => {
      const { repository, pipeline, request, calls } = await subtopicFixture();
      if (failure === "source etag") request.expectedSourceEtag = "stale";
      if (failure === "profile etag") request.expectedProfileEtag = "stale";
      if (failure === "profile hash") request.expectedProfileHash = hashContent(null);
      if (failure === "source hash") request.previousSource.question = "Changed question.";
      if (failure === "wrong child") request.review.subtopics[0].id = "S03-T02-ST01";
      if (failure === "wrong name") request.review.subtopics[0].name = "Unsupported child";
      if (failure === "duplicate child") request.review.subtopics.push(structuredClone(request.review.subtopics[0]));
      if (failure === "nonliteral evidence") request.review.subtopics[0].source_evidence[0].exact_text = "Not in the source";
      if (failure === "explanation only") request.review.subtopics[0].source_evidence = [{ field: "explanation", exact_text: "border Ukraine" }];
      if (failure === "incompatible vector") {
        repository.profile!.document.processing.embeddingSpaceVersion = "incompatible";
        request.expectedProfileHash = hashContent(repository.profile!.document);
      }
      if (failure === "unreviewed classification") {
        delete repository.profile!.document.classification!.review;
        request.expectedProfileHash = hashContent(repository.profile!.document);
      }
      if (failure === "verified source") {
        repository.questionVerification!.status = "verified";
      }
      if (failure === "unchecked answer") repository.questionVerification!.checks.answer.status = "not_checked";
      if (failure === "unchecked explanation") repository.questionVerification!.checks.explanation.status = "not_checked";
      if (failure === "stale source review") repository.questionVerification!.sourceContentHash = hashContent(null);
      const writes = repository.writes;
      const beforeCalls = structuredClone(calls);
      await assert.rejects(pipeline.maintainSubtopics(reference, request));
      assert.equal(repository.writes, writes);
      assert.deepEqual(calls, beforeCalls);
    });
  }
});

test("Cosmos subtopic patches preserve unknown legacy fields and reject protected-field changes", async context => {
  const { repository: memory, pipeline, request } = await subtopicFixture();
  const before = structuredClone(memory.profile!.document);
  await pipeline.maintainSubtopics(reference, request);
  const proposed = memory.profile!.document;
  const client = new CosmosClient({ endpoint: "https://offline.invalid", key: Buffer.from("offline").toString("base64") });
  context.after(() => client.dispose());
  const database = client.database("offline");
  const container = database.container("question_concept_profiles");
  const item = container.item(before.id, before.id);
  const raw = { ...before, _etag: "before", legacyMetadata: { retained: true },
    classification: { ...before.classification, legacyLabel: "preserved" } };
  let patches = 0;
  context.mock.method(database, "container", () => container);
  context.mock.method(container, "item", () => item);
  context.mock.method(item, "read", async () => ({ resource: structuredClone(raw) }));
  context.mock.method(item, "patch", async (operations, options) => {
    assert.equal(options.accessCondition.condition, raw._etag);
    assert.deepEqual(operations.map(operation => operation.path), [
      "/classification/subtopics", "/classification/master/subtopicIds", "/processing/subtopicMaintenance",
    ]);
    for (const operation of operations) {
      const keys = operation.path.slice(1).split("/");
      let value: any = raw;
      for (const key of keys.slice(0, -1)) value = value[key];
      value[keys.at(-1)!] = structuredClone(operation.value);
    }
    raw._etag = "after";
    patches++;
    return { resource: structuredClone(raw) };
  });
  const repository = new CosmosPipelineRepository(database);
  await assert.rejects(repository.saveSubtopicProfile({ ...proposed, embedding: [0, 0, 1] }, "before"), /protected profile fields/);
  assert.equal(patches, 0);
  await repository.saveSubtopicProfile(proposed, "before");
  assert.equal(patches, 1);
  assert.deepEqual(raw.legacyMetadata, { retained: true });
  assert.equal(raw.classification.legacyLabel, "preserved");
  await assert.rejects(repository.saveSubtopicProfile(proposed, "before"), /Profile changed/);
  assert.equal(patches, 1);
});

test("subtopic-only maintenance detects master drift before saving and uncertain profile writes", async t => {
  for (const failure of ["master drift", "uncertain write"]) await t.test(failure, async () => {
    const { repository, pipeline, request } = await subtopicFixture();
    const beforeWrites = repository.writes;
    if (failure === "master drift") {
      const original = repository.readMasterClassification.bind(repository);
      let reads = 0;
      repository.readMasterClassification = async (...args) => {
        const result = structuredClone(await original(...args));
        if (++reads === 2) result!.subtopics![1].name = "Changed during maintenance";
        return result;
      };
    } else {
      repository.changesDuringSave = true;
    }
    await assert.rejects(pipeline.maintainSubtopics(reference, request),
      failure === "master drift" ? /master changed/ : /requires reconciliation/);
    assert.equal(repository.writes, beforeWrites + (failure === "uncertain write" ? 1 : 0));
  });
});

async function parentClassificationFixture() {
  const fixture = await classificationFixture();
  const source = await fixture.repository.readQuestionSnapshot();
  const request: ClassificationParentMaintenanceRequest = {
    ...fixture.request,
    classification: { ...fixture.request.classification, subtopics: [],
      master: { ...fixture.request.classification.master, subtopicIds: [] } },
    expectedSourceEtag: source.etag, expectedProfileEtag: fixture.repository.profile!.etag,
    pendingIssue: { code: "NEW_SUBTOPIC_REVIEW_REQUIRED", check: "master_classification",
      reason: "The specific border scope needs an approved child.", evidence: ["border Ukraine"],
      requiredAction: "Approve the missing scope; parent correction is not child admission." },
  };
  return { ...fixture, request };
}

async function conceptResolutionFixture(withAnswerHold = false) {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  assert.equal(await pipeline.process(reference), "ready");
  let verification = flagQuestionForReview(repository.questionVerification!, {
    code: "CONCEPT_REVIEW_REQUIRED", check: "concepts", reason: "Review the existing concept's scope.",
    evidence: ["border Ukraine"], requiredAction: "Review its identity, roles and literal highlights.",
  });
  if (withAnswerHold) verification = flagQuestionForReview(verification, {
    code: "SOURCE_ANSWER_REVIEW", check: "answer", reason: "The supplied scoring choice requires separate review.",
    evidence: ["Lithuania"], requiredAction: "Keep the answer issue pending outside concept resolution.",
  });
  repository.questionVerification = structuredClone(verification);
  repository.profile!.document.verification = structuredClone(verification);
  repository.profile!.document.processing.status = "pending_review";
  repository.profile!.document.embedding = null;
  const extraction = importedExtractionSchema.shape.extraction.parse({
    ...profileExtractionSchema.parse(repository.profile!.document),
    concept_definitions: repository.concepts.map(({ status, taxonomyVersion, ...definition }) => definition),
  });
  extraction.concept_review = bindConceptReview(repository.question, extraction, repository.concepts,
    "concept-only-reviewer", extraction.concept_review!);
  const request: ConceptResolutionRequest = {
    sourceContentHash: hashContent(repository.question), extraction,
    reviewedBy: "concept-only-reviewer", auditReference: "offline:concept-only-review",
    expectedSourceEtag: String(repository.questionEtag), expectedProfileEtag: repository.profile!.etag,
    resolvedIssueCodes: ["CONCEPT_REVIEW_REQUIRED"],
  };
  return { repository, pipeline, calls, request };
}

test("concept-only resolution saves concepts without embedding or changing unrelated checks", async () => {
  const { repository, pipeline, request, calls } = await conceptResolutionFixture();
  const source = structuredClone(repository.question);
  const classification = structuredClone(repository.profile!.document.classification);
  const checks = structuredClone(repository.questionVerification!.checks);
  assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_embedding");
  const document = repository.profile!.document;
  assert.equal(document.verification!.checks.concepts.status, "passed");
  assert.equal(document.verification!.status, "unverified");
  assert.deepEqual(document.verification!.issues, []);
  assert.equal(document.embedding, null);
  assert.equal(calls.embed, 1);
  assert.deepEqual(repository.question, source);
  assert.deepEqual(document.classification, classification);
  for (const check of ["question", "answer", "explanation", "master_classification"] as const) {
    assert.deepEqual(document.verification!.checks[check], checks[check]);
  }
  assert.deepEqual(document.verification, repository.questionVerification);
  assert.equal(document.processing.conceptResolution!.mode, "concepts_only");
});

test("concept-only resolution retains answer holds while saving the complete reviewed concepts", async () => {
  const { repository, pipeline, request, calls } = await conceptResolutionFixture(true);
  const answerCheck = structuredClone(repository.questionVerification!.checks.answer);
  assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_review");
  const document = repository.profile!.document;
  assert.equal(document.verification!.checks.concepts.status, "passed");
  assert.deepEqual(document.verification!.checks.answer, answerCheck);
  assert.deepEqual(document.verification!.issues.map(issue => issue.code), ["SOURCE_ANSWER_REVIEW"]);
  assert.deepEqual(document.concept_profile, request.extraction.concept_profile);
  assert.equal(document.provenance!.needs_review, true);
  assert.equal(document.embedding, null);
  assert.equal(calls.embed, 1);
  assert.deepEqual(document.verification, repository.questionVerification);
});

test("concept-only saving retains unresolved concept issues without falsely passing its check", async () => {
  const { repository, pipeline, request } = await conceptResolutionFixture();
  request.resolvedIssueCodes = [];
  assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_review");
  assert.equal(repository.profile!.document.verification!.checks.concepts.status, "pending_review");
  assert.deepEqual(repository.profile!.document.verification!.issues.map(issue => issue.code), ["CONCEPT_REVIEW_REQUIRED"]);
});

test("concept-only saving preserves incomplete classification without inventing an anchor or relaxing full imports", async () => {
  const { repository, pipeline, request } = await conceptResolutionFixture();
  for (const key of ["question_format", "polarity", "reasoning_type", "question_intent", "review"] as const) {
    delete request.extraction.classification[key];
    delete repository.profile!.document.classification![key];
  }
  const classification = structuredClone(repository.profile!.document.classification);
  request.extraction.concept_review = bindConceptReview(repository.question, request.extraction,
    repository.concepts, request.reviewedBy, request.extraction.concept_review!);
  assert.throws(() => importedExtractionSchema.shape.extraction.parse(request.extraction));
  assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_embedding");
  assert.deepEqual(repository.profile!.document.classification, classification);
  assert.equal(repository.profile!.document.verification!.checks.concepts.status, "passed");
  assert.equal(repository.profile!.document.embedding, null);
  assert.equal(await pipeline.processImported({
    ...reference, sourceContentHash: request.sourceContentHash,
    extraction: importedExtractionSchema.shape.extraction.parse(fixture()),
  }), "ready");
});

test("unadmitted concept proposals can be saved only as blocked drafts without canonical creation", async () => {
  const { repository, pipeline, request } = await conceptResolutionFixture();
  const conceptId = "proposed_border_scope";
  const originalId = repository.concepts[0].id;
  const extraction = request.extraction;
  extraction.concept_profile.primary_concepts[0].concept_id = conceptId;
  extraction.concept_definitions[0].id = conceptId;
  for (const evidence of extraction.highlight_evidence!) evidence.concept_id = conceptId;
  for (const item of extraction.concept_review!.coverage!.items) {
    item.concept_ids = [conceptId];
    for (const evidence of item.source_evidence) evidence.concept_id = conceptId;
  }
  const decision = extraction.concept_review!.decisions[0];
  decision.concept_id = conceptId;
  decision.decision = "new";
  decision.existing_concept_id = null;
  decision.compared_concept_ids = [originalId];
  for (const evidence of decision.source_evidence) evidence.concept_id = conceptId;
  extraction.concept_review = bindConceptReview(repository.question, extraction, repository.concepts,
    request.reviewedBy, extraction.concept_review!);
  const writes = repository.writes;
  await assert.rejects(pipeline.saveReviewedConcepts(reference, request), /reviewed creation batch/);
  assert.equal(repository.writes, writes);
  request.allowUnadmittedProposals = true;
  assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_review");
  assert.equal(repository.concepts.length, 1);
  assert.equal(repository.profile!.document.embedding, null);
  assert.equal(repository.profile!.document.verification!.checks.concepts.status, "pending_review");
  assert(repository.profile!.document.verification!.issues.some(issue => issue.code === "CONCEPT_BATCH_REVIEW_REQUIRED"));
  assert.deepEqual(repository.profile!.document.processing.conceptResolution!.proposedConceptIds, [conceptId]);
});

test("concept-only saving can preserve absent classification without inventing labels or embedding input", async () => {
  const { repository, pipeline, request } = await conceptResolutionFixture(true);
  delete request.extraction.classification;
  delete repository.profile!.document.classification;
  request.extraction.concept_review = bindConceptReview(repository.question, request.extraction,
    repository.concepts, request.reviewedBy, request.extraction.concept_review!);
  assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_review");
  assert.equal(repository.profile!.document.classification, undefined);
  assert.equal(repository.profile!.document.concept_embedding_input, "");
  assert.equal(repository.profile!.document.processing.embeddingInputHash, null);
  assert.equal(repository.profile!.document.verification!.checks.concepts.status, "passed");
  assert(repository.profile!.document.verification!.issues.some(issue => issue.code === "SOURCE_ANSWER_REVIEW"));
});

test("concept-only saving rejects stale bindings and unrelated changes before writing", async t => {
  const cases: { name: string; mutate: (state: Awaited<ReturnType<typeof conceptResolutionFixture>>) => void }[] = [
    { name: "source binding", mutate: state => { state.request.expectedSourceEtag = "stale-source"; } },
    { name: "profile binding", mutate: state => { state.request.expectedProfileEtag = "stale-profile"; } },
    { name: "classification", mutate: state => { state.request.extraction.classification.subject = "History"; } },
    { name: "unrelated issue", mutate: state => { state.request.resolvedIssueCodes.push("SOURCE_ANSWER_REVIEW"); } },
    { name: "reviewer binding", mutate: state => { state.request.reviewedBy = "another-reviewer"; } },
    { name: "registry binding", mutate: state => {
      state.repository.concepts.push({ ...state.repository.concepts[0], id: "different_border_fact",
        canonical_name: "Another distinct border fact", definition: "A different relationship." });
    } },
    { name: "literal highlight", mutate: state => {
      state.request.extraction.highlight_evidence![0].exact_text = "not present in the source";
    } },
  ];
  for (const entry of cases) await t.test(entry.name, async () => {
    const state = await conceptResolutionFixture(true);
    entry.mutate(state);
    const writes = state.repository.writes;
    const verificationWrites = state.repository.verificationWrites;
    await assert.rejects(state.pipeline.saveReviewedConcepts(reference, state.request));
    assert.equal(state.repository.writes, writes);
    assert.equal(state.repository.verificationWrites, verificationWrites);
  });
});

async function conceptCreationFixture(absentClassification = false) {
  const state = await conceptResolutionFixture(true);
  const { repository, request } = state;
  repository.concepts = [];
  const extraction = request.extraction;
  if (absentClassification) {
    delete extraction.classification;
    delete repository.profile!.document.classification;
  } else {
    for (const key of ["question_format", "polarity", "reasoning_type", "question_intent", "review"] as const) {
      delete extraction.classification![key];
      delete repository.profile!.document.classification![key];
    }
  }
  const decision = extraction.concept_review!.decisions[0];
  decision.decision = "new";
  decision.existing_concept_id = null;
  decision.compared_concept_ids = [];
  for (const issue of [
    { code: "CONCEPT_BATCH_REVIEW_REQUIRED", check: "concepts" as const,
      reason: "Await final global identity reconciliation.", evidence: ["border Ukraine"],
      requiredAction: "Admit the final reviewed definition." },
    { code: "NEW_SUBTOPIC_REVIEW_REQUIRED", check: "master_classification" as const,
      reason: "Classification approval is separate.", evidence: ["border Ukraine"],
      requiredAction: "Obtain separate classification approval." },
    { code: "CLASSIFICATION_EMBEDDING_MAINTENANCE_REQUIRED", check: "concepts" as const,
      reason: "Embedding maintenance is separate.", evidence: ["border Ukraine"],
      requiredAction: "Perform approved embedding maintenance later." },
  ]) {
    repository.questionVerification = flagQuestionForReview(repository.questionVerification!, issue);
  }
  repository.profile!.document.verification = structuredClone(repository.questionVerification);
  request.resolvedIssueCodes.push("CONCEPT_BATCH_REVIEW_REQUIRED");
  refreshConceptCreationBatch(state);
  return state;
}

function refreshConceptCreationBatch(state: Awaited<ReturnType<typeof conceptResolutionFixture>>) {
  const { request, repository } = state;
  request.extraction.concept_review = bindConceptReview(repository.question, request.extraction,
    repository.concepts, request.reviewedBy, request.extraction.concept_review!);
  const entries = [{ ...reference, sourceContentHash: request.sourceContentHash, extraction: structuredClone(request.extraction) }];
  request.creationBatch = conceptResolutionBatchSchema.parse({
    formatVersion: "1", extractionModel: "offline:reviewed-concepts",
    registry_review: { reviewed_by: request.reviewedBy, reviewed_at: "2026-10-23T00:00:00.000Z",
      registry_fingerprint: registryFingerprint(repository.concepts),
      proposals_fingerprint: conceptResolutionBatchProposalsFingerprint(entries) },
    entries,
  });
}

test("approved concept-only batches admit new identities with partial or absent classification and retain unrelated holds", async t => {
  for (const absent of [false, true]) await t.test(absent ? "absent classification" : "partial classification", async () => {
    const { repository, pipeline, request, calls } = await conceptCreationFixture(absent);
    const before = structuredClone(repository.profile!.document);
    const callsBefore = structuredClone(calls);
    assert.throws(() => importedExtractionSchema.shape.extraction.parse(request.extraction));
    assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_review");
    assert.equal(repository.concepts.length, 1);
    assert.deepEqual(repository.concepts[0], {
      ...request.extraction.concept_definitions[0], status: "provisional", taxonomyVersion: config.taxonomyVersion,
    });
    const saved = repository.profile!.document;
    assert.deepEqual(saved.classification, before.classification);
    assert.deepEqual(repository.questionVerification, saved.verification);
    assert.deepEqual(saved.verification!.issues.map(issue => issue.code), [
      "SOURCE_ANSWER_REVIEW", "NEW_SUBTOPIC_REVIEW_REQUIRED", "CLASSIFICATION_EMBEDDING_MAINTENANCE_REQUIRED",
    ]);
    for (const check of ["question", "answer", "explanation", "master_classification"] as const) {
      assert.deepEqual(saved.verification!.checks[check], before.verification!.checks[check]);
    }
    assert.deepEqual(saved.verification!.corrections, before.verification!.corrections);
    assert.deepEqual(saved.verification!.warnings, before.verification!.warnings);
    assert(before.provenance!.review_notes.every(note => saved.provenance!.review_notes.includes(note)));
    assert.equal(saved.embedding, null);
    assert.deepEqual(calls, callsBefore);
    assert.deepEqual(saved.processing.conceptResolution!.admittedConceptIds, [repository.concepts[0].id]);
    assert.deepEqual(saved.processing.conceptResolution!.creationBatchReview, request.creationBatch!.registry_review);

    // Exact receipt-bound continuation recognizes its own already-created proposal.
    request.expectedSourceEtag = String(repository.questionEtag);
    request.expectedProfileEtag = repository.profile!.etag;
    request.resolvedIssueCodes = [];
    assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_review");
    assert.equal(repository.concepts.length, 1);
    assert.deepEqual(calls, callsBefore);
  });
});

test("scoped selective admission creates only approved identities and keeps mixed questions blocked", async t => {
  for (const clearHold of [false, true]) await t.test(clearHold ? "cannot clear mixed hold" : "preserves mixed hold", async () => {
    const state = await conceptCreationFixture();
    const { repository, pipeline, request, calls } = state;
    const extraction = request.extraction;
    const heldId = "unresolved_supporting_scope";
    extraction.concept_profile.secondary_concepts.push({
      concept_id: heldId, canonical_name: "Unresolved supporting scope", role: "secondary", confidence: 0.9,
    });
    extraction.concept_definitions.push({
      id: heldId, canonical_name: "Unresolved supporting scope",
      definition: "Supporting geographical context whose final scope remains unresolved.",
      subject: "Geography", topic: "Borders", aliases: [], parentConceptIds: [],
    });
    const evidence = { concept_id: heldId, field: "question" as const, exact_text: "border Ukraine" };
    extraction.highlight_evidence!.push(evidence);
    extraction.concept_review!.coverage!.items.push({
      item_id: "supporting_scope", meaning: "Supporting scope awaiting final identity review",
      concept_ids: [heldId], claim_ids: [], source_evidence: [evidence],
    });
    extraction.concept_review!.decisions.push({
      ...extraction.concept_review!.decisions[0], concept_id: heldId, role: "secondary",
      source_evidence: [evidence], role_rationale: "Supporting geographic context, not the primary selection.",
    });
    refreshConceptCreationBatch(state);
    request.creationBatch!.entries[0].approvedNewConceptIds = [extraction.concept_definitions[0].id];
    request.creationBatch!.registry_review.proposals_fingerprint =
      conceptResolutionBatchProposalsFingerprint(request.creationBatch!.entries);
    const beforeCalls = structuredClone(calls);
    if (clearHold) {
      const writes = repository.writes;
      await assert.rejects(pipeline.saveReviewedConcepts(reference, request), /cannot resolve CONCEPT_BATCH_REVIEW_REQUIRED/);
      assert.equal(repository.concepts.length, 0);
      assert.equal(repository.writes, writes);
    } else {
      request.resolvedIssueCodes = request.resolvedIssueCodes.filter(code => code !== "CONCEPT_BATCH_REVIEW_REQUIRED");
      assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_review");
      assert.deepEqual(repository.concepts.map(concept => concept.id), [extraction.concept_definitions[0].id]);
      const saved = repository.profile!.document;
      assert.deepEqual(saved.concept_profile, extraction.concept_profile);
      assert.deepEqual(saved.processing.conceptResolution!.proposedConceptIds, [heldId]);
      assert.deepEqual(saved.processing.conceptResolution!.admittedConceptIds, [extraction.concept_definitions[0].id]);
      assert.equal(saved.verification!.checks.concepts.status, "pending_review");
      assert(saved.verification!.issues.some(issue => issue.code === "CONCEPT_BATCH_REVIEW_REQUIRED"));
      assert.deepEqual(saved.verification, repository.questionVerification);
      assert.equal(saved.embedding, null);
    }
    assert.deepEqual(calls, beforeCalls);
  });
});

test("scoped canonical admission rejects altered, stale, uncertain or conflicting batches before any writes", async t => {
  type State = Awaited<ReturnType<typeof conceptCreationFixture>>;
  const cases: { name: string; mutate: (state: State) => void }[] = [
    { name: "conflicting flags", mutate: state => { state.request.allowUnadmittedProposals = true; } },
    { name: "unassigned approval", mutate: state => {
      state.request.creationBatch!.entries[0].approvedNewConceptIds = ["unassigned_identity"];
    } },
    { name: "duplicate approval", mutate: state => {
      const id = state.request.extraction.concept_definitions[0].id;
      state.request.creationBatch!.entries[0].approvedNewConceptIds = [id, id];
    } },
    { name: "stale source ETag", mutate: state => { state.repository.questionEtag++; } },
    { name: "stale profile ETag", mutate: state => { state.repository.profile!.etag = "changed"; } },
    { name: "changed source", mutate: state => { state.repository.question.question += " Changed."; } },
    { name: "changed classification", mutate: state => { state.request.extraction.classification!.subject = "History"; } },
    { name: "changed packet", mutate: state => { state.request.creationBatch!.entries[0].extraction.similarity_profile.concept_summary += " Changed."; } },
    { name: "nonmember request", mutate: state => {
      state.request.extraction.similarity_profile.concept_summary += " Changed.";
      state.request.extraction.concept_review = bindConceptReview(state.repository.question, state.request.extraction,
        state.repository.concepts, state.request.reviewedBy, state.request.extraction.concept_review!);
    } },
    { name: "nonmember source", mutate: state => {
      state.request.creationBatch!.entries[0].questionId = "other";
      state.request.creationBatch!.registry_review.proposals_fingerprint =
        conceptResolutionBatchProposalsFingerprint(state.request.creationBatch!.entries);
    } },
    { name: "stale registry", mutate: state => {
      state.repository.concepts.push({ ...state.request.extraction.concept_definitions[0], id: "unrelated",
        canonical_name: "Unrelated fact", definition: "An unrelated meaning.", status: "active", taxonomyVersion: "v1" });
    } },
    { name: "receipt reviewer", mutate: state => { state.request.creationBatch!.registry_review.reviewed_by = "another"; } },
    { name: "concept audit reviewer", mutate: state => {
      state.request.extraction.concept_review!.audit!.reviewed_by = "another";
      state.request.creationBatch!.entries[0].extraction = structuredClone(state.request.extraction);
      state.request.creationBatch!.registry_review.proposals_fingerprint =
        conceptResolutionBatchProposalsFingerprint(state.request.creationBatch!.entries);
    } },
    { name: "bad parent", mutate: state => {
      state.request.extraction.concept_definitions[0].parentConceptIds = ["missing_parent"];
      refreshConceptCreationBatch(state);
    } },
    { name: "self parent", mutate: state => {
      state.request.extraction.concept_definitions[0].parentConceptIds = [state.request.extraction.concept_definitions[0].id];
      refreshConceptCreationBatch(state);
    } },
    { name: "held identity", mutate: state => {
      state.request.extraction.concept_review!.decisions[0].decision = "review";
      refreshConceptCreationBatch(state);
    } },
    { name: "uncertain role", mutate: state => {
      state.request.extraction.concept_review!.decisions[0].role_status = "uncertain";
      refreshConceptCreationBatch(state);
    } },
    { name: "unrelated issue resolution", mutate: state => { state.request.resolvedIssueCodes.push("NEW_SUBTOPIC_REVIEW_REQUIRED"); } },
    { name: "embedding hold resolution", mutate: state => {
      state.request.resolvedIssueCodes.push("CLASSIFICATION_EMBEDDING_MAINTENANCE_REQUIRED");
    } },
    { name: "changed published definition", mutate: state => {
      state.repository.concepts.push({ ...state.request.extraction.concept_definitions[0],
        definition: "A changed definition.", status: "provisional", taxonomyVersion: "v1" });
    } },
    { name: "existing identity conflict", mutate: state => {
      state.repository.concepts.push({ ...state.request.extraction.concept_definitions[0], id: "other_identity",
        status: "active", taxonomyVersion: "v1" });
      refreshConceptCreationBatch(state);
    } },
    { name: "duplicate batch source", mutate: state => {
      state.request.creationBatch!.entries.push(structuredClone(state.request.creationBatch!.entries[0]));
    } },
  ];
  for (const entry of cases) await t.test(entry.name, async () => {
    const state = await conceptCreationFixture();
    entry.mutate(state);
    const before = { concepts: structuredClone(state.repository.concepts), writes: state.repository.writes,
      verificationWrites: state.repository.verificationWrites, calls: structuredClone(state.calls) };
    await assert.rejects(state.pipeline.saveReviewedConcepts(reference, state.request));
    assert.deepEqual(state.repository.concepts, before.concepts);
    assert.equal(state.repository.writes, before.writes);
    assert.equal(state.repository.verificationWrites, before.verificationWrites);
    assert.deepEqual(state.calls, before.calls);
  });
});

test("parent-only maintenance repairs labels but retains classification approval and unrelated issues", async () => {
  const { repository, pipeline, request, calls } = await parentClassificationFixture();
  repository.questionVerification = flagQuestionForReview(repository.questionVerification!, {
    code: "SOURCE_CAVEAT", check: "answer", reason: "Supplied answer remains unverified.",
    evidence: ["offline:source"], requiredAction: "Review the answer separately.",
  });
  const before = structuredClone(repository.profile!.document);
  assert.equal(await pipeline.maintainClassificationParents(reference, request), "pending_review");
  const after = repository.profile!.document;
  assert.equal(repository.question.topic, "Borders");
  assert.equal(after.classification!.subject, "Geography");
  assert.deepEqual(after.classification!.master!.subtopicIds, []);
  assert.deepEqual(after.classification!.subtopics, []);
  assert.equal(after.verification!.checks.master_classification.status, "pending_review");
  assert(after.verification!.issues.some(issue => issue.code === "NEW_SUBTOPIC_REVIEW_REQUIRED"));
  assert(after.verification!.issues.some(issue => issue.code === "SOURCE_CAVEAT"));
  assert.deepEqual(after.verification, repository.questionVerification);
  assert.deepEqual(after.concept_profile, before.concept_profile);
  assert.deepEqual(after.claims, before.claims);
  assert.deepEqual(after.highlight_evidence, before.highlight_evidence);
  assert.equal(after.concept_embedding_input, before.concept_embedding_input);
  assert.equal(after.processing.sourceContentHash, hashContent(repository.question));
  assert.equal(after.processing.classificationParentMaintenance!.mode, "classification_parent_only");
  assert.equal(after.embedding, null);
  assert.equal(calls.embed, 1);
  const writes = repository.writes;
  await assert.rejects(pipeline.maintainClassification(reference, {
    ...request, previousSource: structuredClone(repository.question),
    expectedSourceEtag: (await repository.readQuestionSnapshot()).etag,
    expectedProfileEtag: repository.profile!.etag,
  }), /subtopics|small|least/i);
  assert.equal(repository.writes, writes);
});

test("parent-only maintenance rejects unsupported parents, missing holds and stale bindings before writes", async () => {
  for (const failure of ["hold", "evidence", "explanation", "child", "source", "profile", "master", "binding", "identity"] as const) {
    const { repository, pipeline, request } = await parentClassificationFixture();
    if (failure === "hold") delete request.pendingIssue;
    if (failure === "evidence") request.classification.source_evidence[0].exact_text = "not present";
    if (failure === "explanation") request.classification.source_evidence = [{ field: "explanation", exact_text: repository.question.explanation! }];
    if (failure === "child") request.classification.master.subtopicIds = ["S03-T01-ST01"];
    if (failure === "source") request.expectedSourceEtag = "stale";
    if (failure === "profile") request.expectedProfileEtag = "stale";
    if (failure === "master") repository.masterClassification = undefined;
    if (failure === "binding") repository.profile!.document.processing.sourceContentHash = "stale";
    if (failure === "identity") repository.profile!.document.sourceContainer = "state_pcs";
    const writes = repository.writes;
    await assert.rejects(pipeline.maintainClassificationParents(reference, request), undefined, failure);
    assert.equal(repository.writes, writes, failure);
  }
});

test("parent-only maintenance can create only unextracted held metadata for an absent profile", async () => {
  const { repository, pipeline, request, calls } = await parentClassificationFixture();
  repository.profile = undefined; request.expectedProfileEtag = null;
  await pipeline.maintainClassificationParents(reference, request);
  const after = repository.profile!.document;
  assert.equal(after.processing.classificationParentMaintenance!.createdProfile, true);
  assert.equal(after.concept_profile, undefined);
  assert.equal(after.claims, undefined);
  assert.equal(after.concept_review, undefined);
  assert.equal(after.highlight_evidence, undefined);
  assert.equal(after.verification!.checks.master_classification.status, "pending_review");
  assert.equal(after.embedding, null);
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 1);
});

for (const taxonomyPolicy of ["canonical_anchor", "independent_source"] as const) {
test(`classification-only maintenance corrects incomplete profiles without concept or embedding admission (${taxonomyPolicy})`, async () => {
  const { repository, pipeline, calls, request } = await classificationFixture();
  request.classification.taxonomy_policy = taxonomyPolicy;
  delete repository.profile!.document.classification;
  delete repository.profile!.document.concept_profile;
  delete repository.profile!.document.claims;
  delete repository.profile!.document.concept_review;
  const before = structuredClone(repository.profile!.document);
  const concepts = structuredClone(repository.concepts);
  assert.equal(await pipeline.maintainClassification(reference, request), "pending_review");
  const after = repository.profile!.document;
  assert.equal(repository.question.topic, "Borders");
  assert.equal(after.concept_profile, undefined);
  assert.equal(after.claims, undefined);
  assert.equal(after.concept_review, undefined);
  assert.deepEqual(after.highlight_evidence, before.highlight_evidence);
  assert.deepEqual(after.similarity_profile, before.similarity_profile);
  assert.equal(after.concept_embedding_input, before.concept_embedding_input);
  assert.equal(after.embedding, null);
  assert.equal(after.processing.status, "pending_review");
  assert.equal(after.verification?.checks.master_classification.status, "passed");
  assert(after.verification?.issues.some(issue => issue.code === "CONCEPT_REVIEW_REQUIRED"));
  assert.equal(after.classification?.review, undefined);
  assert.equal(after.processing.classificationMaintenance?.review.taxonomy_policy, taxonomyPolicy);
  assert.equal(after.processing.classificationMaintenance?.freshConceptReview, false);
  assert.deepEqual(repository.concepts, concepts);
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 1);
});
}

for (const retainedConceptHold of [false, true]) {
test(`fully reviewed import completes an unextracted classification-only held profile${retainedConceptHold ? " with a retained concept issue" : ""}`, async () => {
  const { repository, pipeline, calls, request } = await classificationFixture();
  delete repository.profile!.document.classification;
  delete repository.profile!.document.concept_profile;
  delete repository.profile!.document.claims;
  delete repository.profile!.document.concept_review;
  if (retainedConceptHold) {
    repository.profile!.document.verification = flagQuestionForReview(
      unverifiedQuestion(hashContent(repository.question)), {
        code: "EXISTING_CONCEPT_SCOPE", check: "concepts", reason: "The prior concepts require complete scope review.",
        evidence: ["offline:prior-concept-hold"], requiredAction: "Submit a complete source-grounded concept review.",
      });
  }
  await pipeline.maintainClassification(reference, request);
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.classification.master = request.classification.master;
  const { audit: _audit, registry_scan: _scan, ...review } = extraction.concept_review!;
  extraction.concept_review = bindConceptReview(repository.question, extraction, repository.concepts,
    "offline-recovery-reviewer", review);
  const sourceHash = hashContent(repository.question);
  const verification = questionVerificationSchema.parse({
    ...unverifiedQuestion(sourceHash), reviewedBy: "offline-recovery-reviewer",
    extractionContentHash: hashContent(extraction),
    masterClassification: repository.questionVerification!.masterClassification,
    checks: { ...repository.questionVerification!.checks,
      concepts: { status: "passed", reason: "Complete source-bound concepts, roles, coverage and highlights reviewed.",
        evidence: ["offline:complete-concept-recovery-review"] } },
    issues: [],
  });
  assert.equal(await pipeline.processImported({ ...reference, sourceContentHash: sourceHash, extraction, verification }), "ready");
  assert.equal(repository.profile!.document.processing.status, "ready");
  assert.equal(repository.profile!.document.embedding?.length, config.dimensions);
  assert.equal(repository.profile!.document.verification.issues.length, 0);
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 2);
});
}

test("malformed prior extractions outside a classification-only hold still fail explicitly", async () => {
  const { repository, pipeline } = await maintenanceFixture();
  delete repository.profile!.document.concept_profile;
  const writes = repository.writes;
  await assert.rejects(pipeline.process(reference), /concept_profile/);
  assert.equal(repository.writes, writes);
});

test("classification-only maintenance preserves unrelated holds and recorded source conflicts", async () => {
  const { repository, pipeline, request } = await classificationFixture();
  const old = repository.profile!.document;
  const sourceHash = hashContent(repository.question);
  const held = flagQuestionForReview(unverifiedQuestion(sourceHash), {
    code: "SOURCE_WORDING_REQUIRED", check: "question", reason: "Original wording is required.",
    requiredAction: "Check the original source.", evidence: ["original source"],
  });
  repository.questionVerification = held;
  old.verification = structuredClone(held);
  old.embedding = null;
  old.processing.status = "pending_review";
  old.provenance!.needs_review = true;
  old.provenance!.answer_status = "conflict_detected";
  const protectedBefore = hashContent({
    concepts: old.concept_profile, claims: old.claims, highlights: old.highlight_evidence,
    review: old.concept_review, similarity: old.similarity_profile,
  });
  await pipeline.maintainClassification(reference, request);
  const after = repository.profile!.document;
  assert(after.verification!.issues.some(issue => issue.code === "SOURCE_WORDING_REQUIRED"));
  assert(after.verification!.issues.some(issue => issue.code === "EXISTING_SOURCE_CONFLICT"));
  assert.equal(after.verification!.checks.question.status, "pending_review");
  assert.equal(after.verification!.checks.answer.status, "pending_review");
  assert.equal(after.verification!.status, "pending_review");
  assert.equal(protectedBefore, hashContent({
    concepts: after.concept_profile, claims: after.claims, highlights: after.highlight_evidence,
    review: after.concept_review, similarity: after.similarity_profile,
  }));
});

test("classification-only maintenance preserves a shared issue code across different review checks", async () => {
  const { repository, pipeline, request } = await classificationFixture();
  let held = unverifiedQuestion(hashContent(repository.question));
  for (const check of ["question", "explanation"] as const) {
    held = flagQuestionForReview(held, {
      code: "SHARED_SOURCE_CAVEAT", check, reason: `Original ${check} evidence is still required.`,
      requiredAction: `Review the original ${check}.`, evidence: [`${check} source`],
    });
  }
  repository.questionVerification = held;
  repository.profile!.document.verification = structuredClone(held);
  repository.profile!.document.embedding = null;
  repository.profile!.document.processing.status = "pending_review";
  repository.profile!.document.provenance!.needs_review = true;
  await pipeline.maintainClassification(reference, request);
  const verification = repository.profile!.document.verification!;
  for (const issue of held.issues) assert(verification.issues.some(saved =>
    saved.code === issue.code && saved.check === issue.check && saved.reason === issue.reason));
  assert.equal(verification.checks.question.status, "pending_review");
  assert.equal(verification.checks.explanation.status, "pending_review");
  assert.equal(verification.checks.master_classification.status, "passed");
});

test("classification-only maintenance creates only an explicitly unextracted held profile when none exists", async () => {
  const { repository, pipeline, calls, request } = await classificationFixture();
  repository.profile = undefined;
  request.expectedProfileEtag = null;
  await pipeline.maintainClassification(reference, request);
  const saved = repository.profile!.document;
  assert.equal(saved.processing.classificationMaintenance?.createdProfile, true);
  assert.equal(saved.processing.classificationMaintenance?.previousProfileHash, hashContent(null));
  assert.equal(saved.processing.extractionModel, "not_extracted:classification_only");
  assert.equal(saved.concept_profile, undefined);
  assert.equal(saved.claims, undefined);
  assert.equal(saved.highlight_evidence, undefined);
  assert.equal(saved.concept_review, undefined);
  assert.equal(saved.similarity_profile, undefined);
  assert.equal(saved.embedding, null);
  assert.equal(saved.processing.status, "pending_review");
  assert.equal(saved.verification?.checks.master_classification.status, "passed");
  assert.equal(saved.verification?.checks.concepts.status, "pending_review");
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 1);
});

test("classification-only maintenance rejects stale sources, nonliteral evidence and inactive mappings before writes", async () => {
  for (const failure of ["stale", "evidence", "master", "source-etag", "profile-etag", "profile-binding", "profile-identity"] as const) {
    const { repository, pipeline, request } = await classificationFixture();
    if (failure === "stale") request.previousSource.question += " changed";
    if (failure === "evidence") request.classification.source_evidence[0].exact_text = "invented evidence";
    if (failure === "master") repository.masterClassification = undefined;
    if (failure === "source-etag") request.expectedSourceEtag = "stale-source-etag";
    if (failure === "profile-etag") request.expectedProfileEtag = "stale-profile-etag";
    if (failure === "profile-binding") repository.profile!.document.processing.sourceContentHash = hashContent({ older: "source" });
    if (failure === "profile-identity") repository.profile!.document.sourceContainer = "state_pcs";
    const beforeWrites = repository.writes;
    const beforeVerificationWrites = repository.verificationWrites;
    await assert.rejects(pipeline.maintainClassification(reference, request));
    assert.equal(repository.writes, beforeWrites);
    assert.equal(repository.verificationWrites, beforeVerificationWrites);
  }
});

test("scoped maintenance preserves legacy concepts/highlights and reuses an unchanged compatible vector", async () => {
  const { repository, pipeline, calls, request } = await maintenanceFixture();
  delete repository.profile!.document.concept_review;
  const before = structuredClone(repository.profile!.document);
  assert.equal(await pipeline.maintainEmbedding(reference, request), "ready");
  const after = repository.profile!.document;
  assert.deepEqual(after.concept_profile, before.concept_profile);
  assert.deepEqual(after.highlight_evidence, before.highlight_evidence);
  assert.equal(after.concept_review, undefined);
  assert.deepEqual(after.embedding, before.embedding);
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 1);
  assert.equal(after.processing.maintenance?.reusedEmbedding, true);
  assert.equal(after.processing.maintenance?.freshConceptReview, false);
  assert.equal(after.verification?.status, "unverified");
  assert.equal(after.verification?.checks.concepts.status, "not_checked");
  assert.equal(after.verification?.checks.master_classification.status, "passed");
});

test("scoped maintenance generates a missing vector without extracting concepts", async () => {
  const { repository, pipeline, calls, request } = await maintenanceFixture();
  repository.profile!.document.embedding = null;
  assert.equal(await pipeline.maintainEmbedding(reference, request), "ready");
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 2);
  assert.equal(repository.profile!.document.processing.maintenance?.embeddingInputChanged, false);
  assert.equal(repository.profile!.document.processing.maintenance?.reusedEmbedding, false);
});

test("embedding maintenance resolves the dedicated classification-only maintenance hold", async () => {
  const { repository, pipeline, calls, request } = await classificationFixture();
  const oldReview = structuredClone(repository.profile!.document.classification!.review!);
  await pipeline.maintainClassification(reference, request);
  const before = structuredClone(repository.profile!.document);
  assert.deepEqual(before.verification!.issues.map(issue => issue.code), ["CLASSIFICATION_EMBEDDING_MAINTENANCE_REQUIRED"]);
  const maintenance: EmbeddingMaintenanceRequest = {
    previousSource: structuredClone(repository.question),
    classification: { ...before.classification!, review: { ...oldReview, taxonomy_policy: "independent_source" } } as EmbeddingMaintenanceRequest["classification"],
    reviewedBy: "embedding-reviewer", auditReference: "offline:classification-then-embedding",
  };
  assert.equal(await pipeline.maintainEmbedding(reference, maintenance), "ready");
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 2);
  for (const key of ["concept_profile", "claims", "concept_review", "highlight_evidence", "similarity_profile", "provenance"] as const) {
    assert.deepEqual(repository.profile!.document[key], before[key]);
  }
  assert.equal(repository.profile!.document.verification!.issues.length, 0);
  assert.equal(repository.profile!.document.processing.maintenance?.freshConceptReview, false);
});

test("the dedicated maintenance hold cannot bypass missing classification audit or unrelated concept issues", async t => {
  for (const failure of ["missing audit", "different mapping", "unchecked source", "other concept issue"]) {
    await t.test(failure, async () => {
      const { repository, pipeline, calls, request } = await classificationFixture();
      const oldReview = structuredClone(repository.profile!.document.classification!.review!);
      await pipeline.maintainClassification(reference, request);
      const maintenance: EmbeddingMaintenanceRequest = {
        previousSource: structuredClone(repository.question),
        classification: { ...repository.profile!.document.classification!,
          review: { ...oldReview, taxonomy_policy: "independent_source" } } as EmbeddingMaintenanceRequest["classification"],
        reviewedBy: "embedding-reviewer", auditReference: "offline:classification-then-embedding",
      };
      if (failure === "missing audit") delete repository.profile!.document.processing.classificationMaintenance;
      if (failure === "different mapping") repository.profile!.document.processing.classificationMaintenance!.review.subtopics = ["Different area"];
      if (failure === "unchecked source") repository.questionVerification!.checks.master_classification.status = "not_checked";
      if (failure === "other concept issue") {
        const issue = { code: "CONCEPT_IDENTITY_REVIEW_REQUIRED", check: "concepts" as const,
          reason: "Identity is still uncertain.", evidence: ["border Ukraine"], requiredAction: "Reconcile the identity." };
        repository.profile!.document.verification!.issues.push(issue);
        repository.questionVerification!.issues.push(issue);
      }
      const writes = repository.writes, verificationWrites = repository.verificationWrites;
      await assert.rejects(pipeline.maintainEmbedding(reference, maintenance));
      assert.equal(repository.writes, writes);
      assert.equal(repository.verificationWrites, verificationWrites);
      assert.equal(calls.embed, 1);
    });
  }
});

test("scoped maintenance completes reviewed classification metadata on concept-only profiles", async () => {
  const { repository, pipeline, calls, request } = await conceptResolutionFixture();
  const fullClassification = structuredClone(request.extraction.classification!);
  const { question_format, polarity, reasoning_type, question_intent, review, ...partialClassification } = fullClassification;
  Object.assign(repository.profile!.document, { classification: partialClassification });
  request.extraction.classification = partialClassification;
  request.extraction.concept_review = bindConceptReview(repository.question, request.extraction,
    repository.concepts, request.reviewedBy, request.extraction.concept_review!);
  assert.equal(await pipeline.saveReviewedConcepts(reference, request), "pending_embedding");
  const before = structuredClone(repository.profile!.document);
  const previousSource = structuredClone(repository.question);
  repository.question.topic = fullClassification.topic;
  const subtopics = fullClassification.subtopics.map((name, index) => ({ id: `S03-T01-ST0${index + 1}`, name }));
  repository.masterClassification = {
    subject: fullClassification.subject, topic: fullClassification.topic, subtopics,
  };
  const maintenance: EmbeddingMaintenanceRequest = {
    previousSource,
    classification: {
      ...fullClassification,
      master: { subjectId: "S03", topicId: "S03-T01", subtopicIds: subtopics.map(item => item.id) },
    } as EmbeddingMaintenanceRequest["classification"],
    reviewedBy: "embedding-readiness-reviewer", auditReference: "offline:reviewed-classification-metadata",
  };
  const missingMetadata = structuredClone(maintenance);
  Object.assign(missingMetadata.classification, { question_intent: undefined });
  const writes = repository.writes;
  await assert.rejects(() => pipeline.maintainEmbedding(reference, missingMetadata));
  assert.equal(repository.writes, writes);
  assert.equal(calls.embed, 1);
  assert.equal(await pipeline.maintainEmbedding(reference, maintenance), "ready");
  assert.equal(calls.extract, 1);
  assert.equal(calls.embed, 2);
  const after = repository.profile!.document;
  assert.equal(after.classification!.question_format, question_format);
  assert.equal(after.classification!.polarity, polarity);
  assert.deepEqual(after.classification!.reasoning_type, reasoning_type);
  assert.equal(after.classification!.question_intent, question_intent);
  for (const key of ["concept_profile", "claims", "concept_review", "highlight_evidence", "similarity_profile", "provenance"] as const) {
    assert.deepEqual(after[key], before[key]);
  }
  assert.equal(after.processing.maintenance?.freshConceptReview, false);
  assert.equal(after.processing.maintenance?.freshHighlightReview, false);
  assert.equal(after.verification?.status, "unverified");
});

test("scoped maintenance retains an existing provisional canonical ID without creating or promoting it", async () => {
  const { repository, pipeline, request } = await maintenanceFixture();
  repository.concepts[0].status = "provisional";
  const before = structuredClone(repository.concepts);
  assert.equal(await pipeline.maintainEmbedding(reference, request), "ready");
  assert.deepEqual(repository.concepts, before);
});

test("independently reviewed classification preserves canonical taxonomy and all normal source review gates", async () => {
  const { repository, pipeline, request, calls } = await maintenanceFixture();
  const canonical = structuredClone(repository.concepts);
  repository.question.topic = request.classification.topic = "Regional borders";
  repository.masterClassification!.topic = "Regional borders";
  await assert.rejects(() => pipeline.maintainEmbedding(reference, request), /classification|taxonomy/i);
  assert.equal(calls.embed, 1);
  request.classification.review!.taxonomy_policy = "independent_source";
  assert.equal(await pipeline.maintainEmbedding(reference, request), "ready");
  assert.deepEqual(repository.concepts, canonical);
  assert.deepEqual(repository.profile!.document.processing.maintenance?.canonicalTaxonomyMismatch, {
    conceptId: "ukraine_land_borders", subject: "Geography", topic: "Borders",
  });
  assert.equal(calls.embed, 2);
  request.previousSource = structuredClone(repository.question);
  delete request.classification.master;
  await assert.rejects(() => pipeline.maintainEmbedding(reference, request), /master/i);
  assert.equal(calls.embed, 2);
});

test("full extraction can opt into independent classification without waiving meaning, role or master review", async () => {
  const repository = new MemoryRepository();
  repository.question.topic = "Regional borders";
  repository.masterClassification = { subject: "Geography", topic: "Regional borders" };
  const extraction = fixture();
  extraction.classification.topic = "Regional borders";
  const proposal = importedExtractionSchema.shape.extraction.parse({
    ...extraction,
    classification: { ...extraction.classification,
      master: { subjectId: "S03", topicId: "S03-T01", subtopicIds: [] },
      subtopics: [], review: { ...extraction.classification.review, taxonomy_policy: "independent_source" } },
  });
  proposal.concept_review = bindConceptReview(
    repository.question, proposal, repository.concepts, "source-classification-reviewer", proposal.concept_review,
  );
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  const entry = { ...reference, sourceContentHash: hashContent(repository.question), extraction: proposal };
  assert.equal(await pipeline.processImported(entry), "ready");
  assert.equal(repository.profile!.document.classification!.topic, "Regional borders");
  assert.equal(repository.profile!.document.concept_profile!.primary_concepts[0].concept_id, "ukraine_land_borders");
  assert.equal(repository.concepts[0].topic, "Borders");
  assert.equal(calls.extract, 0);
});

test("scoped maintenance regenerates changed input but subtopic-only updates reuse the exact vector", async () => {
  const { repository, pipeline, calls, request } = await maintenanceFixture();
  repository.question.topic = request.classification.topic = "Regional borders";
  repository.masterClassification!.topic = "Regional borders";
  repository.concepts[0].topic = "Regional borders";
  const body = structuredClone(repository.profile!.document.concept_profile);
  assert.equal(await pipeline.maintainEmbedding(reference, request), "ready");
  assert.equal(calls.embed, 2);
  assert.equal(repository.profile!.document.processing.maintenance?.embeddingInputChanged, true);
  const vector = structuredClone(repository.profile!.document.embedding);
  const input = repository.profile!.document.concept_embedding_input;
  request.previousSource = structuredClone(repository.question);
  request.classification.subtopics = ["Boundary geography"];
  repository.masterClassification!.subtopics![0].name = "Boundary geography";
  assert.equal(await pipeline.maintainEmbedding(reference, request), "ready");
  assert.equal(calls.embed, 2);
  assert.deepEqual(repository.profile!.document.embedding, vector);
  assert.equal(repository.profile!.document.concept_embedding_input, input);
  assert.deepEqual(repository.profile!.document.concept_profile, body);
});

test("scoped maintenance resolves only source-supported master flags without claiming full verification", async () => {
  const { repository, pipeline, request } = await maintenanceFixture();
  const flag = flagQuestionForReview(unverifiedQuestion(hashContent(request.previousSource)), {
    code: "MASTER_CLASSIFICATION_REVIEW_REQUIRED", check: "master_classification",
    reason: "Legacy source topic was missing.", requiredAction: "Bind the supported active topic.", evidence: ["border Ukraine"],
  });
  repository.profile!.document.verification = flag;
  repository.questionVerification = flag;
  repository.profile!.document.processing.status = "pending_review";
  repository.profile!.document.embedding = null;
  assert.equal(await pipeline.maintainEmbedding(reference, request), "ready");
  assert.equal(repository.profile!.document.verification?.status, "unverified");
  assert.deepEqual(repository.profile!.document.verification?.issues, []);
});

test("scoped maintenance refuses missing data, changed sources, unresolved flags and canonical drift before writes", async t => {
  const cases: Array<{ name: string; change: (state: Awaited<ReturnType<typeof maintenanceFixture>>) => void }> = [
    { name: "missing concept body", change: s => { delete s.repository.profile!.document.concept_profile; } },
    { name: "partial metadata without a concept-only resolution", change: s => {
      Object.assign(s.repository.profile!.document.classification!, { question_intent: undefined });
    } },
    { name: "source content changed", change: s => { s.repository.question.options[0] = "Changed alternative"; } },
    { name: "source/profile binding mismatch", change: s => { s.request.previousSource.answer = "Changed key"; } },
    { name: "inactive canonical ID", change: s => { s.repository.concepts[0].status = "retired"; } },
    { name: "unsupported role", change: s => { s.repository.profile!.document.concept_review!.decisions[0].role_status = "uncertain"; } },
    { name: "wrong master name", change: s => { s.repository.masterClassification!.subtopics![0].name = "Different topic"; } },
    { name: "unresolved legacy processing flag", change: s => {
      s.repository.profile!.document.processing.error = "REVIEW_FLAG[ROLE_REVIEW_REQUIRED]: Existing role is unresolved.";
    } },
    { name: "unresolved source issue", change: s => {
      s.repository.questionVerification = flagQuestionForReview(unverifiedQuestion(hashContent(s.repository.question)), {
        code: "ANSWER_EXPLANATION_CONFLICT", check: "answer", reason: "The source contradicts its key.",
        requiredAction: "Resolve the source conflict.", evidence: ["Lithuania"],
      });
    } },
  ];
  for (const entry of cases) await t.test(entry.name, async () => {
    const state = await maintenanceFixture();
    entry.change(state);
    const writes = state.repository.writes;
    const verificationWrites = state.repository.verificationWrites;
    await assert.rejects(() => state.pipeline.maintainEmbedding(reference, state.request));
    assert.equal(state.repository.writes, writes);
    assert.equal(state.repository.verificationWrites, verificationWrites);
    assert.equal(state.calls.embed, 1);
  });
});

test("scoped maintenance detects source, profile and registry changes during vector generation", async t => {
  for (const kind of ["source", "profile", "registry"] as const) await t.test(kind, async () => {
    const { repository, pipeline, ai, request } = await maintenanceFixture();
    repository.profile!.document.embedding = null;
    const writes = repository.writes;
    const verificationWrites = repository.verificationWrites;
    ai.embed = async () => {
      if (kind === "source") { repository.question.answer = "Changed key"; repository.questionEtag++; }
      if (kind === "profile") repository.profile!.etag = "other-worker";
      if (kind === "registry") repository.concepts[0].definition += " Changed scope.";
      return [1, 0, 0];
    };
    await assert.rejects(() => pipeline.maintainEmbedding(reference, request));
    assert.equal(repository.writes, writes);
    assert.equal(repository.verificationWrites, verificationWrites);
  });
});

function createAI(overrides: Partial<PipelineAI> = {}) {
  const calls = { extract: 0, embed: 0 };
  const ai: PipelineAI = {
    async extract() { calls.extract++; return fixture(); },
    async reviewConcepts(question, extraction, concepts) {
      const assignments = [...extraction.concept_profile.primary_concepts, ...extraction.concept_profile.secondary_concepts];
      return {
        highlights: {
          status: "complete", rationale: "Reviewed concise literal display evidence and implicit supporting meanings.",
          gaps: assignments.flatMap(item =>
            extraction.highlight_evidence?.some(evidence => evidence.concept_id === item.concept_id)
              ? [] : extraction.classification.review.source_evidence.map(evidence => ({
                item_id: item.concept_id, concept_id: item.concept_id, field: evidence.field,
                ...(evidence.option_index !== undefined ? { option_index: evidence.option_index } : {}),
                reason: "This synthetic supporting meaning is implicit in the shared adjacency passage, without a separate literal name.",
              }))),
          extended_excerpts: [], dense_fields: [],
        },
        coverage: {
          status: "complete", rationale: "All fixture source fields, tested facts and supporting concepts were reviewed.", uncovered_items: [],
          reviewed_fields: [
            { field: "question", rationale: "Reviewed the stem.",
              ...(extraction.highlight_evidence?.some(item => item.field === "question") ? {} : {
                highlight_gap: "This synthetic fixture infers the relationship from the alternatives, without a separate selected stem phrase.",
              }) },
            ...question.options.map((_, index) => ({
              field: "option", option_index: index, rationale: "Reviewed this option.",
              ...(extraction.highlight_evidence?.some(item => item.field === "option" && item.option_index === index) ? {} : {
                highlight_gap: "This fixture option is a candidate name or value, not a separate literal description of the relationship.",
              }),
            })),
            ...(question.explanation?.trim() ? [{
              field: "explanation", rationale: "Reviewed supplied explanation.",
              ...(extraction.highlight_evidence?.some(item => item.field === "explanation") ? {} : {
                highlight_gap: "The synthetic explanation supplies verification context, without another selected display phrase.",
              }),
            }] : []),
          ],
          items: assignments.map(item => ({
            item_id: item.concept_id, meaning: item.canonical_name, concept_ids: [item.concept_id],
            claim_ids: extraction.claims.filter(claim => claim.concept_ids.includes(item.concept_id)).map(claim => claim.item_id),
            source_evidence: extraction.classification.review.source_evidence.map(evidence => ({ ...evidence, concept_id: item.concept_id })),
          })),
        },
        decisions: assignments.map(item => {
          const existing = concepts.find(concept => concept.id === item.concept_id ||
            [concept.canonical_name, ...concept.aliases].includes(item.canonical_name));
          return {
            concept_id: item.concept_id, decision: existing ? "reuse" : "new",
            existing_concept_id: existing?.id ?? null,
            meaning_scope_rationale: existing ? "The registry contains the same tested meaning and scope." : "No equivalent registry definition exists.",
            role: item.role, role_status: "supported", role_rationale: "This concept materially contributes in its assigned role.",
            source_evidence: extraction.classification.review.source_evidence.map(evidence => ({ ...evidence, concept_id: item.concept_id })),
            compared_concept_ids: existing ? [existing.id] : [],
          };
        }),
      };
    },
    async embed() { calls.embed++; return [3, 4, 0]; },
    ...overrides,
  };
  return { ai, calls };
}

function reviewImport(repository: MemoryRepository, extraction: ExtractionResponse): void {
  extraction.concept_review = bindConceptReview(repository.question, extraction, repository.concepts, "offline-reviewer", extraction.concept_review);
}

function mockRegistry(context: TestContext) {
  const client = new CosmosClient({ endpoint: "https://offline.invalid", key: Buffer.from("offline").toString("base64") });
  context.after(() => client.dispose());
  const database = client.database("offline");
  const container = database.container("concepts");
  const profiles = database.container("question_concept_profiles");
  const records = new Map<string, { id: string; _etag: string; [key: string]: unknown }>();
  let revision = 0;
  const state = { uncertainCanonicalWrite: false, dependencies: [] as string[], active: [] as string[],
    retirementDependencies: [] as string[] };
  context.mock.method(database, "container", (id: string) => {
    if (id === "question_concept_profiles") return profiles;
    assert.equal(id, "concepts");
    return container;
  });
  context.mock.method(profiles.items, "query", (query: { query: string }) => ({
    async fetchAll() {
      return { resources: query.query.includes("@retired") ? state.retirementDependencies
        : query.query.includes("@assignment") ? state.dependencies : state.active };
    },
  }));
  context.mock.method(container.items, "create", async (body: { id: string }) => {
    if (records.has(body.id)) throw Object.assign(new Error("Already exists."), { code: 409 });
    const resource = { ...structuredClone(body), _etag: String(++revision) };
    records.set(body.id, resource);
    if (body.id !== conceptRegistryLockId && state.uncertainCanonicalWrite) {
      throw new Error("The write completed remotely but its response was lost.");
    }
    return { resource: structuredClone(resource) };
  });
  context.mock.method(container.items, "query", (query: { query: string }) => {
    if (query.query.includes("ARRAY_CONTAINS(c.parentConceptIds")) {
      return { async fetchAll() {
        return { resources: [...records.values()].filter(record =>
          (record.parentConceptIds as string[] | undefined)?.includes("ukraine_land_borders")).map(record => record.id) };
      } };
    }
    assert.match(query.query, /c\.id != @lock/);
    return { async fetchAll() {
      return { resources: [...records.values()].filter(record => record.id !== conceptRegistryLockId).map(record => structuredClone(record)) };
    } };
  });
  const originalItem = container.item.bind(container);
  context.mock.method(container, "item", (id: string, partition: string) => {
    assert.equal(partition, id);
    const item = originalItem(id, partition);
    context.mock.method(item, "read", async () => {
      if (!records.has(id)) throw Object.assign(new Error("Not found."), { code: 404 });
      return { resource: structuredClone(records.get(id)) };
    });
    const checkEtag = (options: { accessCondition: { condition: string } }) => {
      if (records.get(id)?._etag !== options.accessCondition.condition) {
        throw Object.assign(new Error("ETag conflict."), { code: 412 });
      }
    };
    context.mock.method(item, "replace", async (body: { id: string }, options: { accessCondition: { condition: string } }) => {
      checkEtag(options);
      assert.equal(body.id, id);
      const resource = { ...structuredClone(body), _etag: String(++revision) };
      records.set(id, resource);
      return { resource: structuredClone(resource) };
    });
    context.mock.method(item, "patch", async (
      operations: { path: string; value: string }[], options: { accessCondition: { condition: string } },
    ) => {
      checkEtag(options);
      const resource = { ...records.get(id), id, _etag: String(++revision) };
      for (const operation of operations) resource[operation.path.slice(1)] = operation.value;
      records.set(id, resource);
      if (state.uncertainCanonicalWrite) throw new Error("The patch completed remotely but its response was lost.");
      return { resource: structuredClone(resource) };
    });
    context.mock.method(item, "delete", async (options: { accessCondition: { condition: string } }) => {
      checkEtag(options);
      records.delete(id);
      return {};
    });
    return item;
  });
  return { database, records, state };
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

test("master-backed extractions preserve subtopic IDs without relabelling source questions", async () => {
  const repository = new MemoryRepository();
  const original = structuredClone(repository.question);
  repository.masterClassification.subtopics = [{ id: "S03-T01-ST01", name: "Land borders" }];
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.classification.master = { subjectId: "S03", topicId: "S03-T01", subtopicIds: ["S03-T01-ST01"] };
  reviewImport(repository, extraction);
  const embedded: string[] = [];
  const { ai, calls } = createAI({ async embed(input) { embedded.push(input); calls.embed++; return [3, 4, 0]; } });
  const result = await new ConceptPipeline(repository, ai, config).processImported({
    ...reference, sourceContentHash: hashContent(repository.question), extraction,
  });
  assert.equal(result, "ready");
  assert.deepEqual(repository.profile.document.classification.master, extraction.classification.master);
  assert.deepEqual(repository.profile.document.classification.subtopics, ["Land borders"]);
  const withoutSubtopics = profileExtractionSchema.parse(repository.profile.document);
  withoutSubtopics.classification.subtopics = [];
  withoutSubtopics.classification.master.subtopicIds = [];
  assert.deepEqual(embedded, [buildEmbeddingInput(withoutSubtopics)]);
  assert.deepEqual(repository.question, original);
  assert.deepEqual(calls, { extract: 0, embed: 1 });
});

test("missing, retired, mismatched or renamed master subtopics block embeddings and concept creation", async () => {
  for (const master of [
    undefined,
    { subject: "Geography", topic: "Borders", subtopics: [] },
    { subject: "Geography", topic: "Borders", subtopics: [{ id: "S03-T01-ST01", name: "Different name" }] },
    { subject: "Geography", topic: "Different topic", subtopics: [{ id: "S03-T01-ST01", name: "Land borders" }] },
  ]) {
    const repository = new MemoryRepository();
    repository.masterClassification = master;
    const concepts = structuredClone(repository.concepts);
    const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
    extraction.classification.master = { subjectId: "S03", topicId: "S03-T01", subtopicIds: ["S03-T01-ST01"] };
    const { ai, calls } = createAI();
    assert.equal(await new ConceptPipeline(repository, ai, config).processImported({
      ...reference, sourceContentHash: hashContent(repository.question), extraction,
    }), "pending_review");
    assert.equal(repository.profile.document.embedding, null);
    assert.match(repository.profile.document.processing.error, /^REVIEW_FLAG\[MASTER_SUBTOPIC_MISMATCH\]:/);
    assert.deepEqual(repository.concepts, concepts);
    assert.deepEqual(calls, { extract: 0, embed: 0 });
    assert.equal(repository.questionVerification.status, "pending_review");
  }
});

test("master-backed imports reject duplicate, cross-parent and unpaired subtopic IDs before writes", () => {
  const repository = new MemoryRepository();
  const base = importedExtractionSchema.shape.extraction.parse(fixture());
  for (const master of [
    { subjectId: "S03", topicId: "S12-T01", subtopicIds: ["S12-T01-ST01"] },
    { subjectId: "S03", topicId: "S03-T01", subtopicIds: ["S03-T02-ST01"] },
    { subjectId: "S03", topicId: "S03-T01", subtopicIds: ["S03-T01-ST01", "S03-T01-ST01"] },
    { subjectId: "S03", topicId: "S03-T01", subtopicIds: [] },
  ]) {
    const extraction = structuredClone(base);
    extraction.classification.master = master;
    assert.throws(() => validateExtraction(extraction, repository.question), /Master classification IDs|one unique name/);
  }
});

test("an unchanged ready import cannot bypass a renamed master subtopic", async () => {
  const repository = new MemoryRepository();
  repository.masterClassification.subtopics = [{ id: "S03-T01-ST01", name: "Land borders" }];
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.classification.master = { subjectId: "S03", topicId: "S03-T01", subtopicIds: ["S03-T01-ST01"] };
  reviewImport(repository, extraction);
  const entry = { ...reference, sourceContentHash: hashContent(repository.question), extraction };
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  assert.equal(await pipeline.processImported(entry), "ready");
  repository.masterClassification.subtopics[0].name = "Renamed area";
  assert.equal(await pipeline.processImported(entry), "pending_review");
  assert.equal(repository.profile.document.embedding, null);
  assert.match(repository.profile.document.processing.error, /^REVIEW_FLAG\[MASTER_SUBTOPIC_MISMATCH\]:/);
  assert.deepEqual(calls, { extract: 0, embed: 1 });
});

test("Cosmos master lookup validates active subtopic parents and reads them in the subject partition", async context => {
  const client = new CosmosClient({ endpoint: "https://offline.invalid", key: Buffer.from("offline").toString("base64") });
  context.after(() => client.dispose());
  const database = client.database("offline");
  const container = database.container("subject_topic_master");
  const common = {
    subjectId: "S12", sortOrder: 1, isActive: true, schemaVersion: "1",
    sourceRevision: "test", legacyIds: [],
  };
  const records = new Map<string, unknown>([
    ["S12", { ...common, id: "S12", type: "subject", parentId: null, name: "Science", description: "Science" }],
    ["S12-T01", { ...common, id: "S12-T01", type: "topic", parentId: "S12", name: "Physics", details: [] }],
    ["S12-T01-ST01", {
      ...common, id: "S12-T01-ST01", type: "subtopic", parentId: "S12-T01", name: "Mechanics", details: [],
    }],
  ]);
  const originalItem = container.item.bind(container);
  context.mock.method(database, "container", (id: string) => {
    assert.equal(id, "subject_topic_master");
    return container;
  });
  context.mock.method(container, "item", (id: string, partition: string) => {
    assert.equal(partition, "S12");
    const item = originalItem(id, partition);
    context.mock.method(item, "read", async () => ({ resource: records.get(id) }));
    return item;
  });
  const repository = new CosmosPipelineRepository(database);
  assert.deepEqual(await repository.readMasterClassification("S12", "S12-T01", ["S12-T01-ST01"]), {
    subject: "Science", topic: "Physics", subtopics: [{ id: "S12-T01-ST01", name: "Mechanics" }],
  });
  assert.equal(await repository.readMasterClassification("S12", "S12-T01", ["S12-T02-ST01"]), undefined);
  records.set("S12-T01-ST01", {
    ...common, id: "S12-T02-ST01", type: "subtopic", parentId: "S12-T02", name: "Mechanics", details: [],
  });
  assert.equal(await repository.readMasterClassification("S12", "S12-T01", ["S12-T01-ST01"]), undefined);
  records.set("S12-T01-ST01", {
    ...common, id: "S12-T01-ST01", type: "subtopic", parentId: "S12-T01", name: "Mechanics", details: [],
    isActive: false,
    retirement: { reason: "Retired", replacementIds: ["S12-T01-ST02"], requiresReview: true },
  });
  assert.equal(await repository.readMasterClassification("S12", "S12-T01", ["S12-T01-ST01"]), undefined);
});

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

test("acknowledged source-quality warnings permit reviewed embeddings without clearing other blockers", async () => {
  for (const code of ["SOURCE_ROUTE_ROUNDING_REVIEW_FLAG", "CLASS_SIZE_NONINTEGER_REVIEW_FLAG"] as const) {
    const repository = new MemoryRepository();
    const sourceHash = hashContent(repository.question);
    const issue = {
      code, check: "question" as const, reason: "Known original-source numerical caveat.",
      requiredAction: "Retain the caveat pending a source correction.", evidence: ["Reviewed original source."],
    };
    repository.questionVerification = flagQuestionForReview(unverifiedQuestion(sourceHash), issue);
    const verification = questionVerificationSchema.parse({
      ...unverifiedQuestion(sourceHash), reviewedBy: "offline-reviewer",
      warnings: [{
        ...issue, acknowledgedBy: "question-owner", acknowledgedAt: "2026-10-22T12:00:00Z",
        authorizationEvidence: ["Owner explicitly approved this question for warned similarity."],
      }],
    });
    const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
    reviewImport(repository, extraction);
    const entry = importedExtractionSchema.parse({ ...reference, sourceContentHash: sourceHash, extraction, verification });
    const { ai, calls } = createAI();
    const pipeline = new ConceptPipeline(repository, ai, config);
    assert.equal(await pipeline.processImported(entry), "ready");
    assert.equal(calls.extract, 0);
    assert.equal(calls.embed, 1);
    assert.equal(repository.profile.document.verification.status, "unverified");
    assert.deepEqual(repository.questionVerification.warnings, verification.warnings);
    assert.deepEqual(repository.profile.document.verification.warnings, verification.warnings);
    assert.equal(repository.profile.document.provenance.needs_review, true);

    repository.questionVerification = flagQuestionForReview(repository.questionVerification, {
      code: "CANONICAL_SCOPE_REVIEW", check: "concepts", reason: "A separate canonical scope conflict.",
      requiredAction: "Reconcile canonical identity.", evidence: ["Actual registry conflict."],
    });
    assert.equal(await pipeline.processImported(entry), "pending_review");
    assert.equal(repository.profile.document.embedding, null);
    assert.equal(calls.embed, 1);
    assert.equal(repository.profile.document.verification.issues[0].code, "CANONICAL_SCOPE_REVIEW");
  }
});

test("source warnings require scoped approval, cannot certify a question, and expire on source changes", () => {
  const initial = unverifiedQuestion(hashContent(new MemoryRepository().question));
  const warning = {
    code: "CLASS_SIZE_NONINTEGER_REVIEW_FLAG", check: "question",
    reason: "The supplied class count is inconsistent.", requiredAction: "Retain the source caveat.",
    evidence: ["Reviewed original wording."], acknowledgedBy: "question-owner",
    acknowledgedAt: "2026-10-22T12:00:00Z", authorizationEvidence: ["Explicit owner approval."],
  };
  const accepted = questionVerificationSchema.parse({
    ...initial, reviewedBy: "offline-reviewer", warnings: [warning],
  });
  for (const invalid of [
    { ...accepted, reviewedBy: null },
    { ...accepted, status: "verified" },
    { ...accepted, warnings: [{ ...warning, authorizationEvidence: [] }] },
    { ...accepted, warnings: [{ ...warning, code: "OFFICIALLY_DELETED_QUESTION" }] },
    { ...accepted, warnings: [{ ...warning, check: "concepts" }] },
  ]) assert.throws(() => questionVerificationSchema.parse(invalid));
  const changed = verificationForSource(accepted, "f".repeat(64), false);
  assert.equal(changed.status, "pending_review");
  assert.equal(changed.issues[0].code, warning.code);
  assert.equal(changed.warnings?.length ?? 0, 0);
  const reflagged = flagQuestionForReview(accepted, { ...accepted.warnings[0], reason: "New conflicting evidence." });
  assert.equal(reflagged.status, "pending_review");
  assert.deepEqual(reflagged.warnings, []);
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
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.provenance.needs_review = false;
  extraction.provenance.review_notes = [];
  reviewImport(repository, extraction);
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
  extraction.highlight_evidence.push(...["poland_borders", "ukraine_borders"].map(concept_id => ({
    concept_id, field: "option" as const, option_index: 0, exact_text: "Poland",
  })));
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
  extraction.highlight_evidence = [...extraction.classification.review.source_evidence];
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

test("missing or incomplete material-item coverage holds the question before any canonical write", async () => {
  for (const change of [
    (extraction: ExtractionResponse) => { delete extraction.concept_review.coverage; },
    (extraction: ExtractionResponse) => { extraction.concept_review.coverage.reviewed_fields.pop(); },
    (extraction: ExtractionResponse) => {
      extraction.concept_review.coverage.status = "uncertain";
      extraction.concept_review.coverage.uncovered_items.push("An independently tested supporting principle was omitted.");
    },
    (extraction: ExtractionResponse) => {
      extraction.claims.push({
        item_id: "statement_i", item_type: "statement", normalized_meaning: "A land-adjacency claim.",
        concept_ids: ["ukraine_borders"], entities: [], claimed_relationship: "Land adjacency.",
        verified_relationship: null, truth_status: "unknown", verification_source: "not_provided",
        correction_or_verified_fact: null, confidence: 0.9,
      });
    },
  ]) {
    const repository = new MemoryRepository();
    repository.concepts = [];
    const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
    extraction.concept_review.decisions[0].decision = "new";
    extraction.concept_review.decisions[0].existing_concept_id = null;
    extraction.concept_review.decisions[0].compared_concept_ids = [];
    change(extraction);
    const { ai, calls } = createAI({
      async extract() { return extraction; },
      async reviewConcepts() { return extraction.concept_review; },
    });
    assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "pending_review");
    assert.match(repository.profile.document.processing.error, /^REVIEW_FLAG\[CONCEPT_COVERAGE_REVIEW_REQUIRED\]:/);
    assert.equal(repository.questionVerification.checks.concepts.status, "pending_review");
    assert.equal(repository.profile.document.embedding, null);
    assert.equal(repository.concepts.length, 0);
    assert.equal(calls.embed, 0);
  }
});

test("a compound inventory retains every claim and distinct supporting concept, with canonical remapping", async () => {
  const repository = new MemoryRepository();
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.classification.question_format = "statement_based";
  extraction.concept_profile.secondary_concepts.push({
    concept_id: "poland_border_association", canonical_name: "Poland and Ukraine land adjacency",
    role: "secondary", confidence: 0.95,
  });
  extraction.concept_definitions.push({
    id: "poland_border_association", canonical_name: "Poland and Ukraine land adjacency",
    definition: "The specific shared land boundary between Poland and Ukraine, narrower than Ukraine's complete neighbour set.",
    subject: "Geography", topic: "Borders", aliases: [], parentConceptIds: ["ukraine_land_borders"],
  });
  extraction.claims = ["ukraine_borders", "poland_border_association"].map((concept, index) => ({
    item_id: `item_${index + 1}`, item_type: "statement",
    normalized_meaning: "An individual land-adjacency association.", concept_ids: [concept], entities: [],
    claimed_relationship: "Land adjacency.", verified_relationship: null, truth_status: "unknown",
    verification_source: "not_provided", correction_or_verified_fact: null, confidence: 0.9,
  }));
  const { ai } = createAI({ async extract() { return extraction; } });
  assert.equal(await new ConceptPipeline(repository, ai, config).process(reference), "ready");
  const saved = repository.profile.document;
  assert.deepEqual(saved.concept_review.coverage.items.map(item => item.concept_ids), [
    ["ukraine_land_borders"], ["poland_border_association"],
  ]);
  assert.deepEqual(saved.concept_review.coverage.items.map(item => item.claim_ids), [["item_1"], ["item_2"]]);
  assert.deepEqual(saved.claims.map(claim => claim.concept_ids), [["ukraine_land_borders"], ["poland_border_association"]]);
  assert.equal(repository.concepts.length, 2);
});

test("offline reviews require identified source/proposal binding, candidate IDs and a current registry", async () => {
  for (const change of [
    (entry: ReturnType<typeof importedExtractionSchema.parse>, _repository: MemoryRepository) => {
      delete entry.extraction.concept_review.audit;
    },
    (entry: ReturnType<typeof importedExtractionSchema.parse>, _repository: MemoryRepository) => {
      entry.extraction.concept_profile.underlying_principle += " Changed after the final review.";
    },
    (entry: ReturnType<typeof importedExtractionSchema.parse>, _repository: MemoryRepository) => {
      entry.extraction.concept_review.decisions[0].compared_concept_ids = [];
      reviewImport(_repository, entry.extraction);
    },
    (_entry: ReturnType<typeof importedExtractionSchema.parse>, repository: MemoryRepository) => {
      repository.concepts[0].aliases.push("A concurrently changed registry alias");
    },
  ]) {
    const repository = new MemoryRepository();
    const entry = importedExtractionSchema.parse({
      ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
    });
    change(entry, repository);
    const initial = structuredClone(repository.concepts);
    let embeddings = 0;
    const pipeline = new ConceptPipeline(repository, { async embed() { embeddings++; return [3, 4, 0]; } }, config);
    assert.equal(await pipeline.processImported(entry), "pending_review");
    assert.match(repository.profile.document.processing.error, /REVIEW_FLAG\[(CONCEPT_REGISTRY_REVIEW_REQUIRED|STALE_CONCEPT_REGISTRY_REVIEW)\]/);
    assert.deepEqual(repository.concepts, initial);
    assert.equal(embeddings, 0);
  }
});

test("a reconciled offline batch admits one new canonical and can resume without treating its own writes as stale", async () => {
  const repository = new MemoryRepository();
  repository.concepts = [];
  const profiles = new Map<string, ProfileSnapshot>();
  repository.readProfile = async (id = "") => structuredClone(profiles.get(id));
  repository.saveProfile = async (document, etag) => {
    assert.equal(profiles.get(document.id)?.etag, etag);
    const snapshot = { document: structuredClone(document), etag: String(++repository.writes) };
    profiles.set(document.id, snapshot);
    repository.profile = snapshot;
    return structuredClone(snapshot);
  };
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  delete extraction.concept_review.audit;
  extraction.concept_review.decisions[0].decision = "new";
  extraction.concept_review.decisions[0].existing_concept_id = null;
  extraction.concept_review.decisions[0].compared_concept_ids = [];
  const batch = extractionBatchSchema.parse({
    formatVersion: "1", extractionModel: config.extractionModel,
    entries: [
      { ...reference, sourceContentHash: hashContent(repository.question), extraction },
      { ...reference, sourceContainer: "state_pcs", sourceContentHash: hashContent(repository.question), extraction },
    ],
  });
  batch.registry_review = {
    reviewed_by: "final-worker-reconciler", reviewed_at: new Date().toISOString(),
    registry_fingerprint: registryFingerprint(repository.concepts),
    proposals_fingerprint: batchProposalsFingerprint(batch.entries),
  };
  let embeddings = 0;
  const pipeline = new ConceptPipeline(repository, { async embed() { embeddings++; return [3, 4, 0]; } }, config);
  assert.deepEqual((await pipeline.processImportedBatch(batch)).map(outcome => "result" in outcome ? outcome.result : "failed"), ["ready", "ready"]);
  assert.equal(repository.concepts.length, 1);
  assert.equal(profiles.get("questions:2262").document.concept_profile.primary_concepts[0].concept_id,
    profiles.get("state_pcs:2262").document.concept_profile.primary_concepts[0].concept_id);
  assert.equal(repository.profile.document.concept_review.audit.reviewed_by, "final-worker-reconciler");
  assert.equal(repository.profile.document.concept_review.audit.batch_proposals_fingerprint, batch.registry_review.proposals_fingerprint);
  assert.deepEqual((await pipeline.processImportedBatch(batch)).map(outcome => "result" in outcome ? outcome.result : "failed"), ["skipped", "skipped"]);
  assert.deepEqual((await pipeline.processImportedBatch(batch, true)).map(outcome => "result" in outcome ? outcome.result : "failed"), ["ready", "ready"]);
  assert.equal(repository.concepts.length, 1);
  assert.equal(embeddings, 4);
});

test("an already-owned registry session admits a reviewed import without reacquiring its coordinator", async () => {
  const repository = new MemoryRepository();
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  const batch = extractionBatchSchema.parse({
    formatVersion: "1", extractionModel: config.extractionModel,
    entries: [{ ...reference, sourceContentHash: hashContent(repository.question), extraction }],
  });
  batch.registry_review = {
    reviewed_by: "owned-consolidation-reviewer", reviewed_at: new Date().toISOString(),
    registry_fingerprint: registryFingerprint(repository.concepts),
    proposals_fingerprint: batchProposalsFingerprint(batch.entries),
  };
  repository.withConceptRegistry = async () => { throw new Error("The existing owner must not acquire a nested coordinator."); };
  const pipeline = new ConceptPipeline(repository, { async embed() { return [3, 4, 0]; } }, config);
  const outcomes = await pipeline.processImportedBatch(batch, false, undefined, {
    concepts: repository.concepts,
    async createConcept() { throw new Error("This import only reuses reviewed canonical identities."); },
  });
  assert.deepEqual(outcomes.map(outcome => "result" in outcome ? outcome.result : "failed"), ["ready"]);
  assert.equal(repository.profile.document.concept_review.audit.reviewed_by, "owned-consolidation-reviewer");
});

test("overlapping worker proposals are rejected batch-wide before even the first canonical write", async () => {
  const repository = new MemoryRepository();
  repository.concepts = [];
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.concept_review.decisions[0].decision = "new";
  extraction.concept_review.decisions[0].existing_concept_id = null;
  extraction.concept_review.decisions[0].compared_concept_ids = [];
  const duplicate = JSON.parse(JSON.stringify(extraction).replaceAll("ukraine_borders", "another_ukraine_boundary_id"));
  const batch = extractionBatchSchema.parse({
    formatVersion: "1", extractionModel: config.extractionModel,
    entries: [
      { ...reference, sourceContentHash: hashContent(repository.question), extraction },
      { ...reference, sourceContainer: "state_pcs", sourceContentHash: hashContent(repository.question), extraction: duplicate },
    ],
  });
  batch.registry_review = {
    reviewed_by: "final-worker-reconciler", reviewed_at: new Date().toISOString(),
    registry_fingerprint: registryFingerprint(repository.concepts),
    proposals_fingerprint: batchProposalsFingerprint(batch.entries),
  };
  const { ai, calls } = createAI();
  const outcomes = await new ConceptPipeline(repository, ai, config).processImportedBatch(batch);
  assert.deepEqual(outcomes.map(outcome => "result" in outcome ? outcome.result : "failed"), ["pending_review", "pending_review"]);
  assert.equal(repository.concepts.length, 0);
  assert.match(repository.profile.document.processing.error, /CONCEPT_BATCH_REVIEW_REQUIRED/);
  assert.deepEqual(calls, { extract: 0, embed: 0 });
});

test("changed worker proposals invalidate their batch receipt before canonical creation", async () => {
  const repository = new MemoryRepository();
  const batch = extractionBatchSchema.parse({
    formatVersion: "1", extractionModel: config.extractionModel,
    entries: [{ ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture() }],
  });
  batch.registry_review = {
    reviewed_by: "final-worker-reconciler", reviewed_at: new Date().toISOString(),
    registry_fingerprint: registryFingerprint(repository.concepts),
    proposals_fingerprint: batchProposalsFingerprint(batch.entries),
  };
  batch.entries[0].extraction.concept_profile.underlying_principle += " A worker changed this after review.";
  const { ai, calls } = createAI();
  const outcomes = await new ConceptPipeline(repository, ai, config).processImportedBatch(batch);
  assert("result" in outcomes[0]);
  assert.equal(outcomes[0].result, "pending_review");
  assert.match(repository.profile.document.processing.error, /^REVIEW_FLAG\[CONCEPT_BATCH_REVIEW_REQUIRED\]/);
  assert.deepEqual(calls, { extract: 0, embed: 0 });
});

test("parallel proposals with different wording are re-reviewed against the prior writer and share one identity", async () => {
  const first = new MemoryRepository();
  const second = new MemoryRepository();
  first.concepts = [];
  second.concepts = first.concepts;
  second.question.id = "2263";
  second.withConceptRegistry = action => first.withConceptRegistry(action);
  const proposals = [first, second].map((repository, index) => {
    repository.question.question = "At what temperature is water's density maximum?";
    repository.question.options = ["4 degrees Celsius", "0 degrees Celsius"];
    repository.question.answer = "4 degrees Celsius";
    const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
    const id = index === 0 ? "water_density_maximum" : "maximum_density_water_temperature";
    const name = index === 0 ? "Maximum density of water" : "Water density peak temperature";
    const evidence = [{ concept_id: id, field: "question" as const, exact_text: "water's density maximum" }];
    extraction.highlight_evidence = evidence;
    extraction.classification = {
      ...extraction.classification, subject: "Science", topic: "Physics", subtopics: [],
      polarity: "positive_selection", question_intent: "Identify water's maximum-density temperature.",
      review: { ...extraction.classification.review, primary_concept_id: id, source_evidence: evidence },
    };
    extraction.concept_profile = {
      ...extraction.concept_profile,
      primary_concepts: [{ concept_id: id, canonical_name: name, role: "primary", confidence: 0.95 }],
      underlying_principle: "Water has its maximum density near four degrees Celsius.",
      knowledge_requirements: ["Know the temperature of maximum water density."], entities: [],
    };
    extraction.concept_definitions = [{
      id, canonical_name: name,
      definition: index === 0 ? "Pure water reaches maximum density at four degrees Celsius."
        : "The density of water peaks near a temperature of four degrees Celsius.",
      subject: "Science", topic: "Physics", aliases: [], parentConceptIds: [],
    }];
    delete extraction.concept_review;
    return extraction;
  });
  const seen: string[][] = [];
  const pipelines = [first, second].map((repository, index) => {
    const baseline = createAI();
    const { ai } = createAI({
      async extract() { return proposals[index]; },
      async reviewConcepts(question, extraction, registry) {
        seen.push(registry.map(concept => concept.id));
        const review = conceptReviewSchema.parse(await baseline.ai.reviewConcepts(question, extraction, registry));
        const existing = registry[0];
        review.decisions[0] = {
          ...review.decisions[0], decision: existing ? "reuse" : "new", existing_concept_id: existing?.id ?? null,
          compared_concept_ids: existing ? [existing.id] : [],
          meaning_scope_rationale: "Both proposals test the same maximum-density temperature of water, despite their different wording.",
        };
        return review;
      },
    });
    return new ConceptPipeline(repository, ai, config);
  });
  assert.deepEqual(await Promise.all(pipelines.map((pipeline, index) =>
    pipeline.process({ ...reference, questionId: index ? "2263" : "2262" }))), ["ready", "ready"]);
  assert.equal(first.concepts.length, 1);
  const canonicalId = first.concepts[0].id;
  assert.deepEqual(seen, [[], [canonicalId]]);
  assert.equal(first.profile.document.concept_profile.primary_concepts[0].concept_id, canonicalId);
  assert.equal(second.profile.document.concept_profile.primary_concepts[0].concept_id, canonicalId);
  assert.equal(second.profile.document.concept_review.coverage.items[0].concept_ids[0], canonicalId);
});

test("Cosmos serializes distinct repository instances and refreshes the registry only after acquiring ownership", async context => {
  const { database, records } = mockRegistry(context);
  const first = new CosmosPipelineRepository(database);
  const second = new CosmosPipelineRepository(database);
  let entered!: () => void;
  let proceed!: () => void;
  const inside = new Promise<void>(resolve => { entered = resolve; });
  const released = new Promise<void>(resolve => { proceed = resolve; });
  const canonical = new MemoryRepository().concepts[0];
  const firstRun = first.withConceptRegistry(async session => {
    assert.deepEqual(session.concepts, []);
    entered();
    await released;
    return session.createConcept(canonical);
  });
  await inside;
  let secondEntered = false;
  const secondRun = second.withConceptRegistry(async session => {
    secondEntered = true;
    assert.deepEqual(session.concepts, [canonical]);
  });
  assert.equal(secondEntered, false);
  proceed();
  await Promise.all([firstRun, secondRun]);
  assert.equal(secondEntered, true);
  assert.deepEqual([...records.keys()], [canonical.id]);
});

test("review failures release the coordinator, but unconfirmed canonical writes retain it for explicit recovery", async context => {
  const { database, records, state } = mockRegistry(context);
  const repository = new CosmosPipelineRepository(database, 0);
  await assert.rejects(repository.withConceptRegistry(async () => { throw new Error("Semantic review failed."); }), /Semantic review failed/);
  assert.equal(records.has(conceptRegistryLockId), false);
  state.uncertainCanonicalWrite = true;
  await assert.rejects(repository.withConceptRegistry(session =>
    session.createConcept(new MemoryRepository().concepts[0])), /outcome is uncertain/);
  const lock = records.get(conceptRegistryLockId);
  assert(lock);
  assert.equal(typeof lock.owner, "string");
  assert.deepEqual(lock.proposals, [new MemoryRepository().concepts[0]]);
  await assert.rejects(new CosmosPipelineRepository(database, 0).withConceptRegistry(async () => {
    assert.fail("An uncertain writer must never be overtaken.");
  }), /coordinator is busy/);
  await assert.rejects(repository.releaseConceptRegistryLock("wrong-owner"), /owner changed/);
  assert.equal(records.has(conceptRegistryLockId), true);
  if (typeof lock.owner !== "string") throw new Error("Missing lock owner.");
  await repository.releaseConceptRegistryLock(lock.owner);
  assert.equal(records.has(conceptRegistryLockId), false);
});

test("coordinated reclassification preserves concept identity and checks the reviewed snapshot", async context => {
  const { database, records } = mockRegistry(context);
  const repository = new CosmosPipelineRepository(database, 0);
  context.mock.method(repository, "readMasterClassification", async () => ({
    subject: "Geography", topic: "Maps, Locations & Spatial Relationships", subtopics: [],
  }));
  const expected = new MemoryRepository().concepts[0];
  const update = {
    expected, subjectId: "S03", topicId: "S03-T08", allowedProfileIds: ["questions:2262"],
    reviewedBy: "classification-reviewer", auditReference: "classification-audit.json",
    sourceContentHash: hashContent(new MemoryRepository().question), evidence: ["border Ukraine"],
  };
  await repository.withConceptRegistry(async session => { await session.createConcept(expected); });
  const saved = await repository.withConceptRegistry(session => session.reclassifyConcept(update));
  assert.deepEqual(saved, { ...expected, topic: "Maps, Locations & Spatial Relationships" });
  assert.equal(records.has(conceptRegistryLockId), false);
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyConcept(update)), /changed after review/);
  assert.equal(records.has(conceptRegistryLockId), false);
});

test("classification updates reject out-of-scope dependencies and active admissions before writing", async context => {
  const { database, records, state } = mockRegistry(context);
  const repository = new CosmosPipelineRepository(database, 0);
  context.mock.method(repository, "readMasterClassification", async () => ({
    subject: "Geography", topic: "Maps, Locations & Spatial Relationships", subtopics: [],
  }));
  const expected = new MemoryRepository().concepts[0];
  await repository.withConceptRegistry(async session => { await session.createConcept(expected); });
  const update = {
    expected, subjectId: "S03", topicId: "S03-T08", allowedProfileIds: ["questions:2262"],
    reviewedBy: "classification-reviewer", auditReference: "classification-audit.json",
    sourceContentHash: hashContent(new MemoryRepository().question), evidence: ["border Ukraine"],
  };
  state.dependencies = ["state_pcs:17"];
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyConcept(update)), /shared outside.*state_pcs:17/);
  state.dependencies = [];
  state.active = ["questions:18"];
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyConcept(update)), /Active pipeline leases/);
  assert.equal(records.get(expected.id)?.topic, expected.topic);
  assert.equal(records.has(conceptRegistryLockId), false);
});

test("an uncertain classification patch retains its owner-bound before/after audit", async context => {
  const { database, records, state } = mockRegistry(context);
  const repository = new CosmosPipelineRepository(database, 0);
  context.mock.method(repository, "readMasterClassification", async () => ({
    subject: "Geography", topic: "Maps, Locations & Spatial Relationships", subtopics: [],
  }));
  const expected = new MemoryRepository().concepts[0];
  await repository.withConceptRegistry(async session => { await session.createConcept(expected); });
  state.uncertainCanonicalWrite = true;
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyConcept({
    expected, subjectId: "S03", topicId: "S03-T08", allowedProfileIds: ["questions:2262"],
    reviewedBy: "classification-reviewer", auditReference: "classification-audit.json",
    sourceContentHash: hashContent(new MemoryRepository().question), evidence: ["border Ukraine"],
  })), /classification outcome is uncertain/);
  const lock = records.get(conceptRegistryLockId);
  assert.deepEqual(lock?.classificationUpdates, [{
    expected, subjectId: "S03", topicId: "S03-T08", allowedProfileIds: ["questions:2262"],
    reviewedBy: "classification-reviewer", auditReference: "classification-audit.json",
    sourceContentHash: hashContent(new MemoryRepository().question), evidence: ["border Ukraine"],
    proposed: { ...expected, topic: "Maps, Locations & Spatial Relationships" },
  }]);
  assert.equal(records.get(expected.id)?.topic, "Maps, Locations & Spatial Relationships");
});

test("isolated definition-only classification preserves identity without invented source dependencies", async context => {
  const { database, records } = mockRegistry(context);
  const repository = new CosmosPipelineRepository(database, 0);
  context.mock.method(repository, "readMasterClassification", async () => ({
    subject: "Geography", topic: "Maps, Locations & Spatial Relationships", subtopics: [],
  }));
  const expected = new MemoryRepository().concepts[0];
  await repository.withConceptRegistry(async session => { await session.createConcept(expected); });
  const update = {
    mode: "isolated_definition_only" as const,
    expected, subjectId: "S03", topicId: "S03-T08", subject: "Geography", topic: "Maps, Locations & Spatial Relationships",
    reviewedBy: "definition-reviewer", auditReference: "isolated-audit.json",
    expectedRegistryFingerprint: registryFingerprint([expected]), proposalsFingerprint: hashContent("approved-proposals"),
    expectedConceptEtag: records.get(expected.id)!._etag,
    definitionEvidence: "Land adjacency involving Ukraine.", evidence: ["Definition tests land adjacency."],
  };
  const saved = await repository.withConceptRegistry(session => session.reclassifyIsolatedConcept(update));
  assert.deepEqual(saved, { ...expected, topic: update.topic });
  assert.equal(records.has(conceptRegistryLockId), false);
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyIsolatedConcept(update)), /registry changed/i);
});

test("isolated classification rejects every dependency, stale review, invalid evidence and active lease", async context => {
  for (const failure of ["profile reference", "parent reference", "active lease", "stale registry", "stale concept",
    "stale etag", "master drift", "master changes during check", "nonliteral definition", "fabricated source scope"]) await context.test(failure, async t => {
    const { database, records, state } = mockRegistry(t);
    const repository = new CosmosPipelineRepository(database, 0);
    let masterReads = 0;
    t.mock.method(repository, "readMasterClassification", async () => ({
      subject: "Geography", topic: failure === "master changes during check" && ++masterReads > 1
        ? "Changed master" : "Maps, Locations & Spatial Relationships", subtopics: [],
    }));
    const expected = new MemoryRepository().concepts[0];
    await repository.withConceptRegistry(async session => { await session.createConcept(expected); });
    const update = {
      mode: "isolated_definition_only" as const,
      expected: structuredClone(expected), subjectId: "S03", topicId: "S03-T08",
      subject: "Geography", topic: "Maps, Locations & Spatial Relationships",
      reviewedBy: "definition-reviewer", auditReference: "isolated-audit.json",
      expectedRegistryFingerprint: registryFingerprint([expected]), proposalsFingerprint: hashContent("approved-proposals"),
      expectedConceptEtag: records.get(expected.id)!._etag,
      definitionEvidence: expected.definition, evidence: ["The definition supports spatial geography."],
    };
    if (failure === "profile reference") state.dependencies = ["questions:17"];
    if (failure === "parent reference") {
      records.set("dependent", { ...structuredClone(expected), id: "dependent", parentConceptIds: [expected.id], _etag: "parent" });
      update.expectedRegistryFingerprint = registryFingerprint([expected, { ...expected, id: "dependent", parentConceptIds: [expected.id] }]);
    }
    if (failure === "active lease") state.active = ["questions:18"];
    if (failure === "stale registry") update.expectedRegistryFingerprint = hashContent(null);
    if (failure === "stale concept") update.expected.definition = "A stale reviewed definition.";
    if (failure === "stale etag") update.expectedConceptEtag = "stale";
    if (failure === "master drift") update.topic = "Renamed master";
    if (failure === "nonliteral definition") update.definitionEvidence = "Unrelated definition";
    if (failure === "fabricated source scope") Object.assign(update, { allowedProfileIds: ["invented"], sourceContentHash: hashContent(null) });
    await assert.rejects(repository.withConceptRegistry(session => session.reclassifyIsolatedConcept(update)));
    assert.equal(records.get(expected.id)!.topic, expected.topic);
    assert.equal(records.has(conceptRegistryLockId), false);
  });
});

test("uncertain isolated classification retains the owner and exact definition-only journal", async context => {
  const { database, records, state } = mockRegistry(context);
  const repository = new CosmosPipelineRepository(database, 0);
  context.mock.method(repository, "readMasterClassification", async () => ({
    subject: "Geography", topic: "Maps, Locations & Spatial Relationships", subtopics: [],
  }));
  const expected = new MemoryRepository().concepts[0];
  await repository.withConceptRegistry(async session => { await session.createConcept(expected); });
  state.uncertainCanonicalWrite = true;
  const update = {
    mode: "isolated_definition_only" as const,
    expected, subjectId: "S03", topicId: "S03-T08", subject: "Geography", topic: "Maps, Locations & Spatial Relationships",
    reviewedBy: "definition-reviewer", auditReference: "isolated-audit.json",
    expectedRegistryFingerprint: registryFingerprint([expected]), proposalsFingerprint: hashContent("approved-proposals"),
    expectedConceptEtag: records.get(expected.id)!._etag,
    definitionEvidence: expected.definition, evidence: ["The definition supports spatial geography."],
  };
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyIsolatedConcept(update)), /outcome is uncertain/);
  assert.deepEqual(records.get(conceptRegistryLockId)!.isolatedClassificationUpdates, [{
    ...update, proposed: { ...expected, topic: update.topic },
  }]);
  await assert.rejects(repository.withConceptRegistry(async () => assert.fail("Retained ownership must block new writers.")), /coordinator is busy/);
});

test("coordinated consolidation retains old identity evidence and points to its unchanged survivor", async context => {
  const { database, records } = mockRegistry(context);
  const repository = new CosmosPipelineRepository(database, 0);
  const expected = new MemoryRepository().concepts[0];
  const replacement = { ...expected, id: `${expected.id}_shared` };
  await repository.withConceptRegistry(async session => {
    await session.createConcept(expected);
    await session.createConcept(replacement);
  });
  const saved = await repository.withConceptRegistry(session => session.consolidateConcept({
    expected, replacement, allowedProfileIds: ["questions:2262"],
    reviewedBy: "equivalence-reviewer", reviewedAt: "2026-10-22T15:00:00.000Z",
    auditReference: "reviewed-consolidation.json", proposalsFingerprint: hashContent("reviewed entries"),
    evidence: ["Same tested association and scope in both original question sources."],
  }));
  assert.deepEqual(saved, { ...expected, status: "retired", retirement: {
    replacementConceptId: replacement.id, retiredAt: "2026-10-22T15:00:00.000Z",
    reviewedBy: "equivalence-reviewer", auditReference: "reviewed-consolidation.json",
  } });
  assert.equal(records.get(replacement.id)?.status, replacement.status);
  assert.equal(records.get(expected.id)?.definition, expected.definition);
  assert.equal(records.has(conceptRegistryLockId), false);
});

test("consolidation rejects stale review, unreviewed dependents and active leases before retirement", async context => {
  const { database, records, state } = mockRegistry(context);
  const repository = new CosmosPipelineRepository(database, 0);
  const expected = new MemoryRepository().concepts[0];
  const replacement = { ...expected, id: `${expected.id}_shared` };
  await repository.withConceptRegistry(async session => {
    await session.createConcept(expected);
    await session.createConcept(replacement);
  });
  const update = {
    expected, replacement, allowedProfileIds: ["questions:2262"],
    reviewedBy: "equivalence-reviewer", reviewedAt: "2026-10-22T15:00:00.000Z",
    auditReference: "reviewed-consolidation.json", proposalsFingerprint: hashContent("reviewed entries"),
    evidence: ["Same tested association and scope."],
  };
  await assert.rejects(repository.withConceptRegistry(session => session.consolidateConcept({
    ...update, replacement: { ...replacement, definition: "Unreviewed replacement meaning." },
  })), /changed after review/);
  state.dependencies = ["state_pcs:17"];
  await assert.rejects(repository.withConceptRegistry(session => session.consolidateConcept(update)), /unreviewed dependent/);
  state.dependencies = [];
  state.active = ["questions:18"];
  await assert.rejects(repository.withConceptRegistry(session => session.consolidateConcept(update)), /Active pipeline leases/);
  assert.equal(records.get(expected.id)?.status, expected.status);
  assert.equal(records.has(conceptRegistryLockId), false);
});

test("incomplete or uncertain consolidations retain the owner-bound migration journal", async context => {
  for (const uncertain of [false, true]) {
    await context.test(uncertain ? "unconfirmed retirement patch" : "unmigrated dependent", async subcontext => {
      const { database, records, state } = mockRegistry(subcontext);
      const repository = new CosmosPipelineRepository(database, 0);
      const expected = new MemoryRepository().concepts[0];
      const replacement = { ...expected, id: `${expected.id}_shared` };
      await repository.withConceptRegistry(async session => {
        await session.createConcept(expected);
        await session.createConcept(replacement);
      });
      state.uncertainCanonicalWrite = uncertain;
      state.retirementDependencies = uncertain ? [] : ["questions:2262"];
      await assert.rejects(repository.withConceptRegistry(session => session.consolidateConcept({
        expected, replacement, allowedProfileIds: ["questions:2262"],
        reviewedBy: "equivalence-reviewer", reviewedAt: "2026-10-22T15:00:00.000Z",
        auditReference: "reviewed-consolidation.json", proposalsFingerprint: hashContent("reviewed entries"),
        evidence: ["Same tested association and scope."],
      })), uncertain ? /outcome is uncertain/ : /consolidation is incomplete/);
      const lock = records.get(conceptRegistryLockId);
      assert(lock);
      assert(Array.isArray(lock.consolidationUpdates));
      assert.equal(lock.consolidationUpdates.length, 1);
      await assert.rejects(new CosmosPipelineRepository(database, 0).withConceptRegistry(async () => {
        assert.fail("An incomplete consolidation must not be overtaken.");
      }), /coordinator is busy/);
    });
  }
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
  assert.equal(repository.profile.document.classification.review.status, "supported");
  assert.deepEqual(calls, { extract: 2, embed: 1 });
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
  reviewImport(repository, entry.extraction);
  assert.equal(await pipeline.processImported(entry), "ready");
  assert.equal(calls, 2);
});

test("missing or uncertain highlight review durably holds new imports before concept writes or embeddings", async () => {
  for (const change of [
    (extraction: ExtractionResponse) => { delete extraction.concept_review.highlights; },
    (extraction: ExtractionResponse) => { delete extraction.highlight_evidence; },
    (extraction: ExtractionResponse) => { extraction.highlight_evidence = []; },
    (extraction: ExtractionResponse) => { extraction.concept_review.highlights.status = "uncertain"; },
  ]) {
    const repository = new MemoryRepository();
    repository.concepts = [];
    const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
    Object.assign(extraction.concept_review.decisions[0], {
      decision: "new", existing_concept_id: null, compared_concept_ids: [],
    });
    change(extraction);
    reviewImport(repository, extraction);
    let calls = 0;
    const pipeline = new ConceptPipeline(repository, { async embed() { calls++; return [3, 4, 0]; } }, config);
    assert.equal(await pipeline.processImported({
      ...reference, sourceContentHash: hashContent(repository.question), extraction,
    }), "pending_review");
    assert.match(repository.profile.document.processing.error, /^REVIEW_FLAG\[HIGHLIGHT_REVIEW_REQUIRED\]:/);
    assert.equal(repository.questionVerification.checks.concepts.status, "pending_review");
    assert.equal(repository.profile.document.embedding, null);
    assert.equal(repository.concepts.length, 0);
    assert.equal(calls, 0);
  }
});

test("highlight coverage accounts for each material passage and explicit, source-bound gaps", async () => {
  const repository = new MemoryRepository();
  repository.question.question = "Poland borders Ukraine. Lithuania does not border Ukraine.";
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.concept_review.coverage.items = [
    { item_id: "poland", meaning: "Poland adjacency", concept_ids: ["ukraine_borders"], claim_ids: [],
      source_evidence: [{ concept_id: "ukraine_borders", field: "question", exact_text: "Poland borders Ukraine" }] },
    { item_id: "lithuania", meaning: "Lithuania adjacency", concept_ids: ["ukraine_borders"], claim_ids: [],
      source_evidence: [{ concept_id: "ukraine_borders", field: "question", exact_text: "Lithuania does not border Ukraine" }] },
  ];
  extraction.highlight_evidence[0].exact_text = "Poland borders Ukraine";
  assert.match(highlightReviewIssue(extraction, repository.question), /lithuania/);
  extraction.highlight_evidence.push({
    concept_id: "ukraine_borders", field: "question", exact_text: "does not border Ukraine",
  });
  assert.equal(highlightReviewIssue(extraction, repository.question), undefined);
  extraction.highlight_evidence = [];
  extraction.concept_review.coverage.items = [fixture().concept_review.coverage.items[0]];
  repository.question = new MemoryRepository().question;
  extraction.concept_review.highlights.gaps = [{
    item_id: "land_adjacency", concept_id: "ukraine_borders", field: "question",
    reason: "The intended supporting geographic relationship is inferred from comparing alternatives, not a separate literal name.",
  }];
  reviewImport(repository, extraction);
  assert.equal(await new ConceptPipeline(repository, { async embed() { return [3, 4, 0]; } }, config).processImported({
    ...reference, sourceContentHash: hashContent(repository.question), extraction,
  }), "ready");
  assert.equal(repository.profile.document.concept_review.highlights.gaps[0].concept_id, "ukraine_land_borders");
  extraction.concept_review.highlights.gaps[0].item_id = "invented_item";
  assert.match(highlightReviewIssue(extraction, repository.question), /source-supported/);
});

test("highlights in one field cannot silently hide missing review of the stem, another option or explanation", () => {
  const question = new MemoryRepository().question;
  question.question = "Select the correct response.";
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.highlight_evidence = [{
    concept_id: "ukraine_borders", field: "option", option_index: 0, exact_text: "Poland",
  }];
  extraction.concept_review.coverage.items[0].source_evidence = [...extraction.highlight_evidence];
  const fields = extraction.concept_review.coverage.reviewed_fields;
  assert.match(highlightReviewIssue(extraction, question), /question:.*highlight_gap/);
  fields[0].highlight_gap = "The stem is only an instruction; substantive content is in the options.";
  assert.equal(highlightReviewIssue(extraction, question), undefined);
  delete fields[2].highlight_gap;
  assert.match(highlightReviewIssue(extraction, question), /option:1.*highlight_gap/);
  extraction.highlight_evidence.push({
    concept_id: "ukraine_borders", field: "option", option_index: 1, exact_text: "Lithuania",
  });
  question.explanation = "Poland shares a land boundary with Ukraine.";
  fields.push({ field: "explanation", rationale: "Reviewed the source-supported relationship." });
  assert.match(highlightReviewIssue(extraction, question), /explanation:.*highlight_gap/);
  extraction.highlight_evidence.push({
    concept_id: "ukraine_borders", field: "explanation", exact_text: "land boundary with Ukraine",
  });
  assert.equal(highlightReviewIssue(extraction, question), undefined);
});

test("long excerpts and dense fields require reviewed exceptions, not truncation or inflated overlap counts", () => {
  const question = new MemoryRepository().question;
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  const highlight = extraction.highlight_evidence[0];
  const review = extraction.concept_review.highlights;
  for (const [length, requiresReview] of [[180, false], [181, true]] as const) {
    question.question = "a".repeat(length);
    highlight.exact_text = question.question;
    extraction.concept_review.coverage.items[0].source_evidence = [{ ...highlight }];
    assert.equal(!!highlightReviewIssue(extraction, question), requiresReview);
  }
  review.extended_excerpts = [{ ...highlight, reason: "An indivisible source term is necessary in this boundary fixture." }];
  assert.equal(highlightReviewIssue(extraction, question), undefined);
  review.extended_excerpts = [];
  const words = Array.from({ length: 40 }, (_, index) => `w${String(index).padStart(2, "0")}`);
  question.question = words.join(" ");
  extraction.concept_review.coverage.items[0].source_evidence = [{ ...highlight, exact_text: question.question }];
  highlight.exact_text = words.slice(0, 24).join(" ");
  assert.equal(highlightReviewIssue(extraction, question), undefined);
  highlight.exact_text = words.slice(0, 25).join(" ");
  assert.match(highlightReviewIssue(extraction, question), /24 words/);
  highlight.exact_text = words.slice(0, 14).join(" ");
  extraction.highlight_evidence.push({ ...highlight, exact_text: words.slice(14, 28).join(" ") });
  assert.equal(highlightReviewIssue(extraction, question), undefined);
  extraction.highlight_evidence.push({ ...highlight, exact_text: words.slice(0, 10).join(" ") });
  assert.equal(highlightReviewIssue(extraction, question), undefined);
  extraction.highlight_evidence[1].exact_text = words.slice(14, 29).join(" ");
  assert.match(highlightReviewIssue(extraction, question), /70%/);
  review.dense_fields = [{ field: "question", reason: "Each highlighted source condition is materially tested." }];
  assert.equal(highlightReviewIssue(extraction, question), undefined);
  review.dense_fields[0] = { field: "option", option_index: 9, reason: "Invalid source." };
  assert.match(highlightReviewIssue(extraction, question), /distinct source fields/);
});

test("HTML-spanning highlights are held while legacy profiles remain readable and reusable", async () => {
  const repository = new MemoryRepository();
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  repository.question.question = "Which country does not <b>border Ukraine</b>?";
  extraction.highlight_evidence[0].exact_text = "<b>border Ukraine</b>";
  assert.match(highlightReviewIssue(extraction, repository.question), /renderable text segment/);
  repository.question = new MemoryRepository().question;
  const { ai } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  assert.equal(await pipeline.process(reference), "ready");
  delete repository.profile.document.highlight_evidence;
  delete repository.profile.document.concept_review.highlights;
  assert.doesNotThrow(() => profileExtractionSchema.parse(repository.profile.document));
  assert.equal(await pipeline.process(reference), "skipped");
  repository.profile.document.processing.status = "pending_embedding";
  repository.profile.document.embedding = null;
  assert.equal(await pipeline.process(reference), "pending_review");
  assert.match(repository.profile.document.processing.error, /HIGHLIGHT_REVIEW_REQUIRED/);
});

test("answer-selection codes are not concept highlights, but substantive numerical options remain eligible", () => {
  const question = new MemoryRepository().question;
  const extraction = importedExtractionSchema.shape.extraction.parse(fixture());
  extraction.highlight_evidence.push({
    concept_id: "ukraine_borders", field: "option", option_index: 0, exact_text: "1 and 2 only",
  });
  question.options[0] = "1 and 2 only";
  assert.match(highlightReviewIssue(extraction, question), /answer-selection codes/);
  question.options[0] = "4";
  extraction.highlight_evidence[1].exact_text = "4";
  assert.equal(highlightReviewIssue(extraction, question), undefined);
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
  reviewImport(repository, entry.extraction);
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

test("reviewed classification corrections regenerate vectors only when embedding input changes", async () => {
  const repository = new MemoryRepository();
  let calls = 0;
  const pipeline = new ConceptPipeline(repository, { async embed() { calls++; return [3, 4, 0]; } }, config);
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
  });
  assert.equal(await pipeline.processImported(entry), "ready");
  const previous = structuredClone(repository.profile.document);
  repository.question.topic = "Borders";
  entry.sourceContentHash = hashContent(repository.question);
  reviewImport(repository, entry.extraction);
  assert.equal(await pipeline.processImported(entry), "ready");
  const saved = repository.profile.document;
  assert.notEqual(saved.processing.sourceContentHash, previous.processing.sourceContentHash);
  assert.equal(saved.processing.sourceContentHash, entry.sourceContentHash);
  assert.equal(saved.processing.embeddingInputHash, previous.processing.embeddingInputHash);
  assert.deepEqual(saved.embedding, previous.embedding);
  assert.equal(calls, 1);
  assert.equal(await pipeline.processImported(entry), "skipped");
  repository.question.topic = "Maps";
  repository.concepts[0].topic = "Maps";
  repository.masterClassification.topic = "Maps";
  entry.extraction.classification.topic = "Maps";
  entry.extraction.concept_definitions[0].topic = "Maps";
  entry.sourceContentHash = hashContent(repository.question);
  reviewImport(repository, entry.extraction);
  assert.equal(await pipeline.processImported(entry), "ready");
  assert.notEqual(repository.profile.document.processing.embeddingInputHash, previous.processing.embeddingInputHash);
  assert.equal(calls, 2);
});

test("unchanged embedding input still requires a vector and an approved classification", async () => {
  const repository = new MemoryRepository();
  let calls = 0;
  const pipeline = new ConceptPipeline(repository, { async embed() { calls++; return [3, 4, 0]; } }, config);
  const entry = importedExtractionSchema.parse({
    ...reference, sourceContentHash: hashContent(repository.question), extraction: fixture(),
  });
  assert.equal(await pipeline.processImported(entry), "ready");
  repository.profile.document.embedding = null;
  assert.equal(await pipeline.processImported(entry), "ready");
  assert.equal(calls, 2);
  entry.extraction.classification.review.status = "uncertain";
  reviewImport(repository, entry.extraction);
  assert.equal(await pipeline.processImported(entry), "pending_review");
  assert.equal(repository.profile.document.embedding, null);
  assert.equal(calls, 2);
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

test("embedding-space changes regenerate vectors; source edits re-extract but reuse unchanged embedding input", async () => {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  await new ConceptPipeline(repository, ai, config).process(reference);
  const changed = { ...config, embeddingSpaceVersion: "new-space" };
  await new ConceptPipeline(repository, ai, changed).process(reference);
  assert.deepEqual(calls, { extract: 1, embed: 2 });
  repository.question.explanation = "A new supplied explanation.";
  await new ConceptPipeline(repository, ai, changed).process(reference);
  assert.deepEqual(calls, { extract: 2, embed: 2 });
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

test("subtopic names, IDs, ordering and absence do not change embedding text or its hash", () => {
  const question = new MemoryRepository().question;
  const extraction = validateExtraction(fixture(), question);
  const expected = buildEmbeddingInput(extraction);
  const expectedHash = hashContent(embeddingPrefix + expected);
  for (const subtopics of [
    [],
    ["Boundary classifications"],
    ["Boundary classifications", "Adjacency categories"],
    ["Adjacency categories", "Boundary classifications"],
  ]) {
    const changed = structuredClone(extraction);
    changed.classification.subtopics = subtopics;
    changed.classification.master = {
      subjectId: "S03", topicId: "S03-T01",
      subtopicIds: subtopics.map((_, index) => `S03-T01-ST${String(index + 10).padStart(2, "0")}`),
    };
    const input = buildEmbeddingInput(validateExtraction(changed, question));
    assert.equal(input, expected);
    assert.equal(hashContent(embeddingPrefix + input), expectedHash);
    assert.doesNotMatch(input, /Boundary classifications|Adjacency categories|S03-T01/);
  }
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
    assert.match(body.systemInstruction.parts[0].text, /Subtopics are classification-only metadata/);
    assert.match(body.systemInstruction.parts[0].text, /mark classification[\s\S]*uncertain/);
    assert.ok(body.generationConfig.responseJsonSchema.properties.classification.required.includes("master"));
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
      path.join("features", "similarity", "concept-review.ts"),
      path.join("features", "similarity", "highlight-review.ts"),
      path.join("features", "similarity", "pipeline.ts"),
      path.join("features", "taxonomy", "master.ts"),
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
    const batch = extractionBatchSchema.parse({
      formatVersion: "1", extractionModel: "offline-import",
      entries: [
        { ...reference, sourceContentHash: hashContent(first), extraction: unreviewed },
        { sourceContainer: "questions", questionId: third.id, sourceContentHash: hashContent(third), extraction: uncertain },
        { sourceContainer: "questions", questionId: second.id, sourceContentHash: hashContent(second), extraction: fixture() },
      ],
    });
    batch.registry_review = {
      reviewed_by: "offline-batch-reviewer", reviewed_at: new Date().toISOString(),
      registry_fingerprint: registryFingerprint(repository.concepts),
      proposals_fingerprint: batchProposalsFingerprint(batch.entries),
    };
    const mockRepository = `
      const questions = ${JSON.stringify([first, second, third])};
      const concepts = ${JSON.stringify(repository.concepts)};
      const profiles = new Map();
      export function createRepository() {
        return {
          database: {
            container(id) {
              if (id !== "subject_topic_master") throw new Error("Unexpected container: " + id);
              return { items: { query() { return { async fetchAll() { return { resources: [
                { id: "S03", subjectId: "S03", type: "subject", parentId: null, name: "Geography",
                  description: "Geography", sortOrder: 1, isActive: true, schemaVersion: "1",
                  sourceRevision: "test", legacyIds: [] },
                { id: "S03-T01", subjectId: "S03", type: "topic", parentId: "S03", name: "Borders",
                  details: [], sortOrder: 1, isActive: true, schemaVersion: "1",
                  sourceRevision: "test", legacyIds: [] },
                { id: "S03-T01-ST01", subjectId: "S03", type: "subtopic", parentId: "S03-T01", name: "Land borders",
                  details: [], sortOrder: 1, isActive: true, schemaVersion: "1",
                  sourceRevision: "test", legacyIds: [] },
              ] }; } }; } } };
            },
          },
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
          async withConceptRegistry(action) {
            return action({ concepts, async createConcept() { throw new Error("Unexpected concept creation"); } });
          },
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
        constructor(config, master) {
          super();
          if (master?.length !== 3 || !master.some(record => record.type === "subtopic")) {
            throw new Error("The online CLI must supply the active classification master.");
          }
        }
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
