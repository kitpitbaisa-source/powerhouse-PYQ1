import assert from "node:assert/strict";
import { test } from "node:test";
import { CosmosClient } from "@azure/cosmos";
import { embeddingModel, promptVersion, type PipelineConfig } from "./config";
import { GoogleEmbeddingAI, GooglePipelineAI, type PipelineAI } from "./google";
import { ConceptPipeline, buildEmbeddingInput, hashContent, validateVector } from "./pipeline";
import {
  ensureContainers, profileContainerDefinition, validateProfileContainer,
  type PipelineRepository, type ProfileSnapshot,
} from "./repository";
import {
  extractionBatchSchema, importedExtractionSchema, sourceQuestionSchema, validateExtraction,
  type SourceQuestion, type StoredProfile,
} from "./schema";
import type { CanonicalConcept, QuestionReference } from "./types";

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

  async readQuestion() { return structuredClone(this.question); }
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
    async embed() { calls.embed++; return [3, 4, 0]; },
    ...overrides,
  };
  return { ai, calls };
}

test("canonical aliases resolve to the shared ID and unchanged profiles make no AI calls", async () => {
  const repository = new MemoryRepository();
  const { ai, calls } = createAI();
  const pipeline = new ConceptPipeline(repository, ai, config);
  assert.equal(await pipeline.process(reference), "ready");
  const saved = repository.profile.document;
  assert.equal(saved.id, "questions:2262");
  assert.equal(saved.concept_profile.primary_concepts[0].concept_id, "ukraine_land_borders");
  assert.equal(saved.concept_profile.primary_concepts[0].canonical_name, "Ukraine's land borders");
  assert.deepEqual(saved.embedding, [0.6, 0.8, 0]);
  assert.equal("question" in saved, false);
  assert.equal(repository.concepts.length, 1);
  assert.equal(await pipeline.process(reference), "skipped");
  assert.deepEqual(calls, { extract: 1, embed: 1 });
  assert.equal(saved.processing.promptVersion, promptVersion);
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

test("new concepts remain provisional and ambiguous aliases fail explicitly", async () => {
  const repository = new MemoryRepository();
  repository.concepts = [];
  const { ai } = createAI();
  await new ConceptPipeline(repository, ai, config).process(reference);
  assert.equal(repository.concepts[0].status, "provisional");
  assert.equal(repository.profile.document.provenance.needs_review, true);
  assert.match(repository.profile.document.provenance.review_notes.join(" "), /Provisional concepts/);

  const conflicting = new MemoryRepository();
  conflicting.concepts.push({ ...conflicting.concepts[0], id: "another_border_concept" });
  await assert.rejects(new ConceptPipeline(conflicting, ai, config).process(reference), /Ambiguous canonical/);
  assert.equal(conflicting.profile.document.processing.status, "failed");
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
  context.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
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
