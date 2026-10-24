import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { CosmosClient } from "@azure/cosmos";
import { masterContainerId } from "../taxonomy/master.js";
import { conceptsContainerId, profileContainerId } from "./config.js";
import { registryFingerprint } from "./concept-review.js";
import { hashContent } from "./content-hash.js";
import {
  CosmosPipelineRepository, conceptRegistryLockId, type CoordinatedConceptClassificationUpdate,
} from "./repository.js";
import { canonicalConceptSchema, sourceQuestionSchema, storedProfileSchema, type StoredProfile } from "./schema.js";
import type { CanonicalConcept } from "./types.js";
import { flagQuestionForReview, unverifiedQuestion } from "./verification.js";

type RecordDocument = { id: string; _etag: string; [key: string]: unknown };
const concept: CanonicalConcept = {
  id: "ukraine_land_borders", canonical_name: "Ukraine's land borders",
  definition: "Land adjacency involving Ukraine.", subject: "Geography", topic: "Borders",
  aliases: ["Countries bordering Ukraine"], parentConceptIds: [], status: "active", taxonomyVersion: "v1",
};
const other: CanonicalConcept = { ...concept, id: "other_scope", canonical_name: "Other scope" };
const parent: CanonicalConcept = { ...concept, id: "dependent_scope", parentConceptIds: [concept.id] };
const evidence = { concept_id: concept.id, field: "question" as const, exact_text: "border Ukraine" };
const otherEvidence = { ...evidence, concept_id: other.id };

function profileDocument(id: string, reviewOnly = false): StoredProfile {
  const [sourceContainer, questionId] = id.split(":");
  const source = sourceQuestionSchema.parse(questionDocument(questionId));
  const sourceContentHash = hashContent(source);
  const verification = reviewOnly ? flagQuestionForReview(unverifiedQuestion(sourceContentHash), {
    code: "SOURCE_REVIEW_REQUIRED", check: "answer", reason: "Independent answer review is outstanding.",
    requiredAction: "Review the original answer independently.", evidence: ["Lithuania"],
  }) : unverifiedQuestion(sourceContentHash);
  const assigned = reviewOnly ? other : concept;
  return storedProfileSchema.parse({
    id, sourceContainer, questionId, schemaVersion: "1",
    sourceMetadata: { exam: "Test", year: "2026", paper: null },
    classification: {
      subject: "Geography", topic: "Borders", subtopics: [],
      master: { subjectId: "S03", topicId: "S03-T01", subtopicIds: [] },
      review: {
        status: "supported", taxonomy_policy: reviewOnly ? "canonical_anchor" : "independent_source",
        primary_concept_id: assigned.id, subject_confidence: 0.99, topic_confidence: 0.99,
        rationale: "Reviewed source-supported question placement.", source_evidence: [reviewOnly ? otherEvidence : evidence],
      },
    },
    concept_profile: {
      primary_concepts: [{ concept_id: assigned.id, canonical_name: assigned.canonical_name, role: "primary", confidence: 0.99 }],
      secondary_concepts: [], underlying_principle: "Ukraine's land adjacency.",
      knowledge_requirements: ["Know the bordering countries."], entities: [], relationships: [],
    },
    concept_review: {
      decisions: [{
        concept_id: assigned.id, existing_concept_id: concept.id, decision: "reuse",
        meaning_scope_rationale: "Historical semantic review references the same land adjacency.",
        role: "primary", role_status: "supported", role_rationale: "Directly tested.",
        source_evidence: [reviewOnly ? otherEvidence : evidence], compared_concept_ids: [concept.id],
      }],
    },
    claims: [], highlight_evidence: reviewOnly ? [] : [evidence],
    similarity_profile: { concept_summary: "Ukraine's land adjacency.", matching_cautions: [] },
    provenance: {
      inputs_used: ["question", "options"], answer_status: "provided_not_independently_verified",
      truth_labels_based_on: "provided_answer_only", needs_review: reviewOnly,
      review_notes: reviewOnly ? ["Independent answer review is outstanding."] : [],
    },
    verification, concept_embedding_input: "Unchanged source-bound embedding text.",
    embedding: reviewOnly ? null : [0.3, 0.4, 0.5],
    processing: {
      status: reviewOnly ? "pending_review" : "ready", sourceContentHash,
      embeddingInputHash: hashContent("Unchanged source-bound embedding text."),
      promptVersion: "1", taxonomyVersion: "v1", extractionModel: "offline",
      embeddingModel: "offline", embeddingDimensions: 3, embeddingSpaceVersion: "offline:3",
      updatedAt: "2026-10-23T00:00:00.000Z",
      error: reviewOnly ? "REVIEW_FLAG[SOURCE_REVIEW_REQUIRED]: Independent answer review is outstanding." : null,
    },
  });
}

function questionDocument(id: string) {
  return {
    id, question: "Which country does not border Ukraine?", options: ["Poland", "Lithuania"],
    answer: "Lithuania", explanation: "Poland shares a land border with Ukraine.",
    subject: "Geography", topic: "Borders", exam: "Test", year: "2026", isActive: true,
  };
}

// Evaluate only the reference predicates present in the actual repository query.
const referencePredicates: [string, (profile: StoredProfile, id: string) => boolean][] = [
  ["ARRAY_CONTAINS(c.concept_profile.primary_concepts", (p, id) => !!p.concept_profile?.primary_concepts.some(x => x.concept_id === id)],
  ["ARRAY_CONTAINS(c.concept_profile.secondary_concepts", (p, id) => !!p.concept_profile?.secondary_concepts.some(x => x.concept_id === id)],
  ["FROM x IN c.claims", (p, id) => !!p.claims?.some(x => x.concept_ids.includes(id))],
  ["ARRAY_CONTAINS(c.highlight_evidence", (p, id) => !!p.highlight_evidence?.some(x => x.concept_id === id)],
  ["ARRAY_CONTAINS(x.concept_ids", (p, id) => !!p.concept_review?.coverage?.items.some(x => x.concept_ids.includes(id))],
  ["FROM x IN c.concept_review.coverage.items", (p, id) =>
    !!p.concept_review?.coverage?.items.some(x => x.source_evidence.some(e => e.concept_id === id))],
  ["ARRAY_CONTAINS(c.concept_review.decisions", (p, id) => !!p.concept_review?.decisions.some(x => x.concept_id === id)],
  ["x.existing_concept_id = @conceptId", (p, id) => !!p.concept_review?.decisions.some(x => x.existing_concept_id === id)],
  ["FROM x IN c.concept_review.decisions", (p, id) =>
    !!p.concept_review?.decisions.some(x => x.source_evidence.some(e => e.concept_id === id))],
  ["ARRAY_CONTAINS(c.concept_review.highlights.gaps", (p, id) => !!p.concept_review?.highlights?.gaps.some(x => x.concept_id === id)],
  ["ARRAY_CONTAINS(c.concept_review.highlights.extended_excerpts", (p, id) =>
    !!p.concept_review?.highlights?.extended_excerpts.some(x => x.concept_id === id)],
  ["c.classification.review.primary_concept_id = @conceptId", (p, id) => p.classification?.review?.primary_concept_id === id],
  ["ARRAY_CONTAINS(c.classification.review.source_evidence", (p, id) =>
    !!p.classification?.review?.source_evidence.some(x => x.concept_id === id)],
];

async function fixture(context: TestContext) {
  const client = new CosmosClient({ endpoint: "https://offline.invalid", key: Buffer.from("offline").toString("base64") });
  context.after(() => client.dispose());
  const database = client.database("offline");
  const collections = new Map<string, Map<string, RecordDocument>>();
  const containers = new Map<string, ReturnType<typeof database.container>>();
  let revision = 0;
  const state = {
    patches: [] as { container: string; id: string; paths: string[] }[],
    patchMode: "success" as "success" | "lost_response" | "conflict",
    reads: new Map<string, number>(),
    queries: new Map<string, number>(),
    journals: 0,
    activePatches: 0,
    maxActivePatches: 0,
    onJournal: undefined as (() => void) | undefined,
    beforePatch: undefined as ((id: string) => Promise<void>) | undefined,
    onPatch: undefined as ((id: string) => void | Promise<void>) | undefined,
    onRead: undefined as ((container: string, id: string) => void) | undefined,
  };
  const records = (name: string) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  };
  const seed = <T extends { id: string }>(name: string, document: T) => {
    records(name).set(document.id, { ...structuredClone(document), _etag: String(++revision) });
  };
  for (const canonical of [concept, other, parent]) seed(conceptsContainerId, canonical);
  const common = {
    subjectId: "S03", sortOrder: 1, isActive: true, schemaVersion: "1", sourceRevision: "approved",
    legacyIds: [],
  };
  seed(masterContainerId, { ...common, id: "S03", type: "subject", name: "Geography", parentId: null, description: "Geography" });
  seed(masterContainerId, { ...common, id: "S03-T08", type: "topic", name: "Spatial Relationships", parentId: "S03", details: [] });
  for (const [id, reviewOnly] of [["questions:1", false], ["state_pcs:2", true]] as const) {
    const document = profileDocument(id, reviewOnly);
    seed(profileContainerId, { ...document, rawProfileSentinel: ["must", "remain"] });
    seed(document.sourceContainer, {
      ...questionDocument(document.questionId), verification: document.verification, rawQuestionSentinel: { preserve: true },
    });
  }
  const originalContainer = database.container.bind(database);
  context.mock.method(database, "container", (name: string) => {
    if (containers.has(name)) return containers.get(name)!;
    const container = originalContainer(name);
    containers.set(name, container);
    context.mock.method(container.items, "create", async (body: { id: string }) => {
      if (records(name).has(body.id)) throw Object.assign(new Error("Already exists."), { code: 409 });
      assert.equal(name, conceptsContainerId);
      assert.equal(body.id, conceptRegistryLockId);
      seed(name, body);
      return { resource: structuredClone(records(name).get(body.id)) };
    });
    context.mock.method(container.items, "query", (query: { query: string; parameters?: { name: string; value: unknown }[] }) => ({
      async fetchAll() {
        const queryKey = `${name}:${query.query.includes("c.parentConceptIds") ? "parents" :
          query.query.includes("c.id != @lock") ? "registry" :
          query.query.includes('c.processing.status IN ("extracting", "embedding")') ? "leases" : "dependencies"}`;
        state.queries.set(queryKey, (state.queries.get(queryKey) ?? 0) + 1);
        const documents = [...records(name).values()];
        const id = query.parameters?.find(parameter => parameter.name === "@conceptId")?.value as string;
        const ids = query.parameters?.find(parameter => parameter.name === "@conceptIds")?.value as string[] | undefined;
        if (name === conceptsContainerId) {
          if (query.query.includes("c.parentConceptIds")) {
            if (ids) return { resources: structuredClone(documents.filter(document =>
              (document.parentConceptIds as string[] | undefined)?.some(parentId => ids.includes(parentId)))
              .map(document => ({ id: document.id, parentConceptIds: document.parentConceptIds }))) };
            return { resources: documents.filter(document =>
              (document.parentConceptIds as string[] | undefined)?.includes(id)).map(document => document.id) };
          }
          assert.match(query.query, /c\.id != @lock/);
          return { resources: structuredClone(documents.filter(document => document.id !== conceptRegistryLockId)) };
        }
        assert.equal(name, profileContainerId);
        if (ids) {
          for (const field of [
            "c.concept_profile.primary_concepts", "c.concept_profile.secondary_concepts", "c.claims",
            "c.highlight_evidence", "c.concept_review.coverage.items", "x.concept_ids", "x.source_evidence",
            "c.concept_review.decisions", "x.existing_concept_id", "c.concept_review.highlights.gaps",
            "c.concept_review.highlights.extended_excerpts", "c.classification.review.primary_concept_id",
            "c.classification.review.source_evidence",
          ]) assert.ok(query.query.includes(field), `Missing batch dependency predicate: ${field}`);
          return { resources: structuredClone(documents.filter(document => ids.some(id =>
            referencePredicates.some(([, matches]) => matches(storedProfileSchema.parse(document), id))))) };
        }
        if (query.query.includes("@assignment")) {
          return { resources: documents.filter(document => referencePredicates.some(([predicate, matches]) =>
            query.query.includes(predicate) && matches(storedProfileSchema.parse(document), id))).map(document => document.id) };
        }
        assert.match(query.query, /c\.processing\.status IN \("extracting", "embedding"\)/);
        return { resources: documents.filter(document =>
          ["extracting", "embedding"].includes((document.processing as StoredProfile["processing"]).status)).map(document => document.id) };
      },
    }));
    const originalItem = container.item.bind(container);
    context.mock.method(container, "item", (id: string, partition: string) => {
      assert.equal(partition, name === masterContainerId ? "S03" : id);
      const item = originalItem(id, partition);
      context.mock.method(item, "read", async () => {
        const key = `${name}:${id}`;
        state.reads.set(key, (state.reads.get(key) ?? 0) + 1);
        state.onRead?.(name, id);
        const document = records(name).get(id);
        if (!document) throw Object.assign(new Error("Not found."), { code: 404 });
        return { resource: structuredClone(document) };
      });
      const checkEtag = (options: { accessCondition: { type: string; condition: string } }) => {
        assert.equal(options.accessCondition.type, "IfMatch");
        if (records(name).get(id)?._etag !== options.accessCondition.condition) {
          throw Object.assign(new Error("ETag conflict."), { code: 412 });
        }
      };
      context.mock.method(item, "replace", async (body: { id: string }, options: { accessCondition: { type: string; condition: string } }) => {
        checkEtag(options);
        assert.equal(name, conceptsContainerId);
        assert.equal(id, conceptRegistryLockId);
        state.journals++;
        seed(name, body);
        state.onJournal?.();
        return { resource: structuredClone(records(name).get(id)) };
      });
      context.mock.method(item, "patch", async (
        operations: { op: string; path: string; value: unknown }[],
        options: { accessCondition: { type: string; condition: string } },
      ) => {
        checkEtag(options);
        assert.equal(name, conceptsContainerId);
        assert.notEqual(id, conceptRegistryLockId);
        assert.deepEqual(operations.map(operation => [operation.op, operation.path]), [["set", "/subject"], ["set", "/topic"]]);
        state.patches.push({ container: name, id, paths: operations.map(operation => operation.path) });
        state.activePatches++;
        state.maxActivePatches = Math.max(state.maxActivePatches, state.activePatches);
        try {
          await state.beforePatch?.(id);
          checkEtag(options);
          if (state.patchMode === "conflict") throw Object.assign(new Error("Concurrent patch."), { code: 412 });
          const document = { ...records(name).get(id)!, _etag: String(++revision) };
          for (const operation of operations) document[operation.path.slice(1)] = operation.value;
          records(name).set(id, document);
          const resource = structuredClone(document);
          await state.onPatch?.(id);
          if (state.patchMode === "lost_response") throw new Error("Patch committed remotely, response lost.");
          return { resource };
        } finally {
          state.activePatches--;
        }
      });
      context.mock.method(item, "delete", async (options: { accessCondition: { type: string; condition: string } }) => {
        checkEtag(options);
        assert.equal(name, conceptsContainerId);
        assert.equal(id, conceptRegistryLockId);
        records(name).delete(id);
        return {};
      });
      return item;
    });
    return container;
  });
  const repository = new CosmosPipelineRepository(database, 0);
  const update: CoordinatedConceptClassificationUpdate = {
    expected: structuredClone(concept), expectedConceptEtag: records(conceptsContainerId).get(concept.id)!._etag,
    subjectId: "S03", topicId: "S03-T08", subject: "Geography", topic: "Spatial Relationships",
    expectedRegistryFingerprint: registryFingerprint(await repository.listConcepts()),
    proposalsFingerprint: hashContent("Parent-owned semantic proposal review"),
    reviewedBy: "semantic-reviewer", auditReference: "approved-review-receipts.json",
    definitionEvidence: "Land adjacency involving Ukraine.", evidence: ["Land adjacency is a spatial relationship."],
    dependencies: [],
    parentDependencies: [{
      expected: structuredClone(parent), expectedConceptEtag: records(conceptsContainerId).get(parent.id)!._etag,
      meaningScopeRationale: "The dependent meaning retains its unchanged parent relation at the same scope.",
    }],
  };
  for (const id of ["questions:1", "state_pcs:2"]) {
    const profile = (await repository.readProfile(id))!;
    const source = await repository.readQuestionSnapshot({
      sourceContainer: profile.document.sourceContainer, questionId: profile.document.questionId,
    });
    update.dependencies.push({
      profileId: id, profileEtag: profile.etag, profileHash: hashContent(profile.document),
      sourceEtag: source.etag, sourceContentHash: hashContent(source.question), sourceSnapshotHash: hashContent(source),
      sourceEvidence: [{ field: "question", exact_text: "border Ukraine" },
        { field: "option", option_index: 0, exact_text: "Poland" }],
      meaningScopeRationale: "The source tests the same land adjacency; the historical review scope is unchanged.",
    });
  }
  return { repository, records, state, update, seed, collections };
}

async function batchFixture(context: TestContext, count = 2) {
  const setup = await fixture(context);
  const { repository, records, seed, update, state } = setup;
  const targets = [concept, { ...other, parentConceptIds: [concept.id] }];
  for (let index = 2; index < count; index++) targets.push({ ...other, id: `batch_scope_${index}` });
  for (const target of targets) seed(conceptsContainerId, target);
  seed(conceptsContainerId, { ...parent, parentConceptIds: [concept.id, other.id] });
  for (const raw of records(profileContainerId).values()) {
    const document = storedProfileSchema.parse(raw);
    document.classification!.review!.taxonomy_policy = "independent_source";
    const assigned = document.concept_profile!.primary_concepts[0].concept_id;
    document.concept_profile!.secondary_concepts = targets.filter(target => target.id !== assigned).map(target => ({
      concept_id: target.id, canonical_name: target.canonical_name, role: "secondary", confidence: 0.99,
    }));
    seed(profileContainerId, { ...document, rawProfileSentinel: raw.rawProfileSentinel });
  }
  const registry = await repository.listConcepts();
  const dependencies: CoordinatedConceptClassificationUpdate["dependencies"] = [];
  for (const id of ["questions:1", "state_pcs:2"]) {
    const profile = (await repository.readProfile(id))!;
    const source = await repository.readQuestionSnapshot({
      sourceContainer: profile.document.sourceContainer, questionId: profile.document.questionId,
    });
    dependencies.push({
      ...update.dependencies.find(dependency => dependency.profileId === id)!,
      profileEtag: profile.etag, profileHash: hashContent(profile.document), sourceEtag: source.etag,
      sourceContentHash: hashContent(source.question), sourceSnapshotHash: hashContent(source),
    });
  }
  const updates = targets.map(target => ({
    ...structuredClone(update), expected: structuredClone(target),
    expectedConceptEtag: records(conceptsContainerId).get(target.id)!._etag,
    expectedRegistryFingerprint: registryFingerprint(registry),
    dependencies: structuredClone(dependencies),
    parentDependencies: registry.filter(canonical => canonical.parentConceptIds.includes(target.id)).map(canonical => ({
      expected: canonical, expectedConceptEtag: records(conceptsContainerId).get(canonical.id)!._etag,
      meaningScopeRationale: "The unchanged parent relationship survives the approved metadata-only home change.",
    })),
  }));
  state.reads.clear();
  state.queries.clear();
  return { ...setup, updates };
}

test("shared metadata correction preserves real multiple-source profiles, vectors, raw fields and active holds", async context => {
  const { repository, collections, records, state, update } = await fixture(context);
  const protectedCollections = structuredClone([...collections].filter(([name]) => name !== conceptsContainerId));
  const before = structuredClone(records(conceptsContainerId));
  await repository.withConceptRegistry(async session => {
    const saved = await session.reclassifyCoordinatedConcept(update);
    assert.deepEqual(saved, { ...concept, subject: update.subject, topic: update.topic });
    assert.deepEqual(session.concepts.find(item => item.id === concept.id), saved);
    const noOp = { ...update, expected: saved, expectedConceptEtag: records(conceptsContainerId).get(concept.id)!._etag,
      expectedRegistryFingerprint: registryFingerprint(session.concepts) };
    assert.deepEqual(await session.reclassifyCoordinatedConcept(noOp), saved);
  });
  assert.equal(state.patches.length, 1);
  assert.deepEqual([...collections].filter(([name]) => name !== conceptsContainerId), protectedCollections);
  assert.deepEqual(canonicalConceptSchema.parse(records(conceptsContainerId).get(concept.id)), { ...concept, topic: update.topic });
  assert.deepEqual(records(conceptsContainerId).get(other.id), before.get(other.id));
  assert.deepEqual(records(conceptsContainerId).get(parent.id), before.get(parent.id));
  assert.equal(records(conceptsContainerId).has(conceptRegistryLockId), false);
});

test("review-only dependencies and canonical parent dependencies cannot be omitted or invented", async context => {
  for (const failure of ["omit historical review", "omit parent", "parent record", "parent etag", "invent profile", "invent parent"]) {
    await context.test(failure, async t => {
      const { repository, records, state, update } = await fixture(t);
      if (failure === "omit historical review") update.dependencies.pop();
      if (failure === "omit parent") update.parentDependencies = [];
      if (failure === "parent record") update.parentDependencies[0].expected.definition += " changed";
      if (failure === "parent etag") update.parentDependencies[0].expectedConceptEtag = "stale";
      if (failure === "invent profile") update.dependencies.push({ ...update.dependencies[0], profileId: "questions:99" });
      if (failure === "invent parent") update.parentDependencies.push({
        ...update.parentDependencies[0], expected: { ...parent, id: "fabricated_parent" },
      });
      await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update)), /dependency|dependencies/i);
      assert.equal(state.patches.length, 0);
      assert.equal(records(conceptsContainerId).has(conceptRegistryLockId), false);
    });
  }
});

test("every meaningful historical reference is included, but comparison candidates are not dependencies", async context => {
  const additions: [string, (document: StoredProfile) => void][] = [
    ["primary", p => { p.concept_profile!.primary_concepts[0].concept_id = concept.id; }],
    ["secondary", p => { p.concept_profile!.secondary_concepts.push({
      concept_id: concept.id, canonical_name: concept.canonical_name, role: "secondary", confidence: 0.99,
    }); }],
    ["claims", p => { p.claims = [{
      item_id: "claim", item_type: "statement", normalized_meaning: "Land adjacency", concept_ids: [concept.id],
      entities: [], claimed_relationship: "Borders", verified_relationship: null, truth_status: "unknown",
      verification_source: "not_provided", correction_or_verified_fact: null, confidence: 0.99,
    }]; }],
    ["highlight", p => { p.highlight_evidence = [evidence]; }],
    ["coverage concepts", p => { p.concept_review!.coverage!.items[0].concept_ids = [concept.id]; }],
    ["coverage evidence", p => { p.concept_review!.coverage!.items[0].source_evidence = [evidence]; }],
    ["decision concept", p => { p.concept_review!.decisions[0].concept_id = concept.id; }],
    ["decision existing", p => { p.concept_review!.decisions[0].existing_concept_id = concept.id; }],
    ["decision evidence", p => { p.concept_review!.decisions[0].source_evidence = [evidence]; }],
    ["classification anchor", p => { p.classification!.review!.primary_concept_id = concept.id; }],
    ["classification evidence", p => { p.classification!.review!.source_evidence = [evidence]; }],
    ["highlight gap", p => { p.concept_review!.highlights!.gaps = [{
      item_id: "gap", concept_id: concept.id, field: "question", reason: "Historical implicit evidence review.",
    }]; }],
    ["extended excerpt", p => { p.concept_review!.highlights!.extended_excerpts = [{ ...evidence, reason: "Historical review." }]; }],
    ["comparison candidates only", () => {}],
  ];
  for (const [name, add] of additions) await context.test(name, async t => {
    const { repository, records, state, update, seed } = await fixture(t);
    const document = profileDocument("questions:3", true);
    document.concept_review!.decisions[0].existing_concept_id = other.id;
    document.concept_review!.coverage = {
      status: "complete", rationale: "Historical review.", uncovered_items: [],
      reviewed_fields: [{ field: "question", rationale: "Reviewed." }],
      items: [{
        item_id: "item", meaning: "Other scope", concept_ids: [other.id], claim_ids: [], source_evidence: [otherEvidence],
      }],
    };
    document.concept_review!.highlights = {
      status: "complete", rationale: "Historical review.", gaps: [], extended_excerpts: [], dense_fields: [],
    };
    document.concept_review!.registry_scan = {
      registry_fingerprint: update.expectedRegistryFingerprint, reviewed_concept_count: 3,
      chunks: [{
        start_index: 0, concept_count: 3, registry_fingerprint: update.expectedRegistryFingerprint,
        reviewed_by: "historical-reviewer", reviewed_at: "2026-10-23T00:00:00.000Z", rationale: "Candidate comparison.",
        decisions: [{ concept_id: other.id, equivalent_ids: [concept.id], related_ids: [concept.id],
          uncertain: true, rationale: "Compared only; not used or assigned." }],
      }],
    };
    add(document);
    seed(profileContainerId, storedProfileSchema.parse(document));
    if (name === "comparison candidates only") {
      const before = structuredClone(records(profileContainerId).get(document.id));
      await repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update));
      assert.equal(state.patches.length, 1);
      assert.deepEqual(records(profileContainerId).get(document.id), before);
    } else {
      await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update)),
        /Meaningful profile dependency set/);
      assert.equal(state.patches.length, 0);
    }
  });
});

test("parent-only dependent concepts use real parent approval without invented source receipts", async context => {
  const { repository, records, state, update } = await fixture(context);
  records(profileContainerId).clear();
  update.dependencies = [];
  await repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update));
  assert.equal(state.patches.length, 1);
  assert.deepEqual(canonicalConceptSchema.parse(records(conceptsContainerId).get(parent.id)), parent);
});

test("stale receipts, missing scope, invalid source identities and nonliteral evidence reject before canonical writes", async context => {
  const failures: [string, (update: CoordinatedConceptClassificationUpdate, setup: Awaited<ReturnType<typeof fixture>>) => void][] = [
    ["registry", update => { update.expectedRegistryFingerprint = hashContent("stale"); }],
    ["record", update => { update.expected.definition += " stale"; }],
    ["record etag", update => { update.expectedConceptEtag = "stale"; }],
    ["profile hash", update => { update.dependencies[0].profileHash = hashContent("stale"); }],
    ["profile etag", update => { update.dependencies[0].profileEtag = "stale"; }],
    ["source hash", update => { update.dependencies[0].sourceContentHash = hashContent("stale"); }],
    ["source snapshot", update => { update.dependencies[0].sourceSnapshotHash = hashContent("stale"); }],
    ["source etag", update => { update.dependencies[0].sourceEtag = "stale"; }],
    ["master name", update => { update.topic = "Old name"; }],
    ["master parent", (_, setup) => { setup.records(masterContainerId).get("S03-T08")!.parentId = "S04"; }],
    ["master inactive", (_, setup) => { setup.records(masterContainerId).get("S03-T08")!.isActive = false; }],
    ["definition evidence", update => { update.definitionEvidence = "invented definition"; }],
    ["nonliteral stem", update => { update.dependencies[0].sourceEvidence[0].exact_text = "Border Ukraine"; }],
    ["nonliteral option", update => { update.dependencies[0].sourceEvidence[1].exact_text = "Lithuania"; }],
    ["explanation only", update => { update.dependencies[0].sourceEvidence = [{ field: "explanation", exact_text: "Poland" }]; }],
    ["missing option index", update => { delete update.dependencies[0].sourceEvidence[1].option_index; }],
    ["wrong field index", update => { update.dependencies[0].sourceEvidence[0].option_index = 0; }],
    ["unknown container", update => { update.dependencies[0].profileId = "fabricated:1"; }],
    ["missing question id", update => { update.dependencies[0].profileId = "questions:"; }],
    ["profile identity", (_, setup) => { setup.records(profileContainerId).get("questions:1")!.questionId = "2"; }],
    ["unbound profile despite refreshed receipt", (update, setup) => {
      const raw = setup.records(profileContainerId).get("questions:1")!;
      (raw.processing as StoredProfile["processing"]).sourceContentHash = hashContent("different source");
      raw.verification = unverifiedQuestion(hashContent("different source"));
      update.dependencies[0].profileHash = hashContent(storedProfileSchema.parse(raw));
    }],
    ["unknown expected field", update => { Object.assign(update.expected, { allow: "unreviewed" }); }],
    ["empty scope", update => { update.dependencies[0].meaningScopeRationale = " "; }],
    ["empty parent scope", update => { update.parentDependencies[0].meaningScopeRationale = ""; }],
    ["duplicate profile", update => { update.dependencies.push(update.dependencies[0]); }],
    ["duplicate parent", update => { update.parentDependencies.push(update.parentDependencies[0]); }],
    ["isolated", update => { update.dependencies = []; update.parentDependencies = []; }],
    ["fake allow list", update => { Object.assign(update, { allowedProfileIds: ["invented"] }); }],
  ];
  for (const [name, mutate] of failures) await context.test(name, async t => {
    const setup = await fixture(t);
    mutate(setup.update, setup);
    await assert.rejects(setup.repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(setup.update)));
    assert.equal(setup.state.patches.length, 0);
    assert.equal(setup.records(conceptsContainerId).get(concept.id)!.topic, concept.topic);
    assert.equal(setup.records(conceptsContainerId).has(conceptRegistryLockId), false);
  });
});

test("active extraction and embedding leases block metadata-only correction regardless of age", async context => {
  for (const status of ["extracting", "embedding"]) await context.test(status, async t => {
    const { repository, records, state, update } = await fixture(t);
    const document = records(profileContainerId).get("questions:1")!;
    (document.processing as StoredProfile["processing"]).status = status as "extracting" | "embedding";
    (document.processing as StoredProfile["processing"]).updatedAt = "2000-01-01T00:00:00.000Z";
    update.dependencies[0].profileHash = hashContent((await repository.readProfile("questions:1"))!.document);
    await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update)), /Active pipeline leases/);
    assert.equal(state.patches.length, 0);
  });
});

test("metadata changes cannot introduce a new default primary-anchor conflict", async context => {
  const { repository, records, state, update } = await fixture(context);
  const document = records(profileContainerId).get("questions:1")!;
  const classification = document.classification as StoredProfile["classification"];
  classification!.review!.taxonomy_policy = "canonical_anchor";
  update.dependencies[0].profileHash = hashContent((await repository.readProfile("questions:1"))!.document);
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update)), /primary-anchor classification conflict/);
  assert.equal(state.patches.length, 0);
});

test("a legacy primary anchor without classification review cannot acquire a new conflict", async context => {
  const { repository, records, state, update } = await fixture(context);
  const document = records(profileContainerId).get("questions:1")!;
  delete (document.classification as StoredProfile["classification"])!.review;
  update.dependencies[0].profileHash = hashContent((await repository.readProfile("questions:1"))!.document);
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update)), /primary-anchor classification conflict/);
  assert.equal(state.patches.length, 0);
});

test("existing unrelated classification conflicts and review holds remain unchanged", async context => {
  const { repository, records, update } = await fixture(context);
  const document = records(profileContainerId).get("state_pcs:2")!;
  (document.classification as StoredProfile["classification"])!.topic = "Existing unrelated mismatch";
  update.dependencies[1].profileHash = hashContent((await repository.readProfile("state_pcs:2"))!.document);
  const before = structuredClone(document);
  await repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update));
  assert.deepEqual(records(profileContainerId).get("state_pcs:2"), before);
});

test("journal-time source, profile, registry, master and dependency-set drift is rechecked before patching", async context => {
  for (const failure of ["source", "source verification", "profile", "master", "master etag", "registry", "parent etag", "new profile", "new parent", "active lease"]) {
    await context.test(failure, async t => {
      const { repository, records, state, update, seed } = await fixture(t);
      state.onJournal = () => {
        if (failure === "source") records("questions").get("1")!.question = "Changed source";
        if (failure === "source verification") {
          const verification = structuredClone((records("questions").get("1")!.verification)!);
          (verification as { updatedAt: string }).updatedAt = "2026-10-23T01:00:00.000Z";
          records("questions").get("1")!.verification = verification;
        }
        if (failure === "profile") records(profileContainerId).get("questions:1")!._etag = "changed";
        if (failure === "master") records(masterContainerId).get("S03-T08")!.name = "Renamed";
        if (failure === "master etag") records(masterContainerId).get("S03-T08")!._etag = "changed";
        if (failure === "registry") records(conceptsContainerId).get(other.id)!.definition = "Changed registry meaning";
        if (failure === "parent etag") records(conceptsContainerId).get(parent.id)!._etag = "changed";
        if (failure === "new profile") seed(profileContainerId, profileDocument("questions:99"));
        if (failure === "new parent") seed(conceptsContainerId, { ...parent, id: "new_parent_reference" });
        if (failure === "active lease") {
          (records(profileContainerId).get("state_pcs:2")!.processing as StoredProfile["processing"]).status = "embedding";
        }
      };
      await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update)));
      assert.equal(state.patches.length, 0);
      assert.equal(records(conceptsContainerId).has(conceptRegistryLockId), false);
    });
  }
});

test("uncertain or conflicting canonical writes retain the complete owner-bound semantic receipt journal", async context => {
  for (const mode of ["lost_response", "conflict", "source readback drift", "profile readback drift", "master readback drift",
    "canonical readback drift", "canonical etag drift", "new review-only dependency", "new parent", "readback failure"]) {
    await context.test(mode, async t => {
      const { repository, records, state, update, seed } = await fixture(t);
      if (mode === "lost_response" || mode === "conflict") state.patchMode = mode;
      state.onPatch = () => {
        if (mode === "source readback drift") records("questions").get("1")!._etag = "changed";
        if (mode === "profile readback drift") records(profileContainerId).get("questions:1")!._etag = "changed";
        if (mode === "master readback drift") records(masterContainerId).get("S03-T08")!._etag = "changed";
        if (mode === "canonical readback drift") records(conceptsContainerId).get(concept.id)!.definition = "Changed meaning";
        if (mode === "canonical etag drift") records(conceptsContainerId).get(concept.id)!._etag = "changed";
        if (mode === "new review-only dependency") seed(profileContainerId, profileDocument("questions:99", true));
        if (mode === "new parent") seed(conceptsContainerId, { ...parent, id: "new_parent_reference" });
        if (mode === "readback failure") state.onRead = () => { throw new Error("Read timed out."); };
      };
      await assert.rejects(repository.withConceptRegistry(async session => {
        await assert.rejects(session.reclassifyCoordinatedConcept(update), /outcome is uncertain/);
        await assert.rejects(session.reclassifyCoordinatedConcept(update), /unresolved write/);
        throw new Error("Retained for reconciliation");
      }), /Retained for reconciliation/);
      state.onRead = undefined;
      assert.equal(state.patches.length, 1);
      const lock = structuredClone(records(conceptsContainerId).get(conceptRegistryLockId)!);
      assert.deepEqual(lock.coordinatedClassificationUpdates, [{ ...update, proposed: { ...concept, topic: update.topic } }]);
      assert.deepEqual(lock.proposals, [{ ...concept, topic: update.topic }]);
      await assert.rejects(new CosmosPipelineRepository(repository.database, 0).withConceptRegistry(async () => {
        assert.fail("A retained owner must not be overtaken.");
      }), /coordinator is busy/);
      await assert.rejects(repository.releaseConceptRegistryLock("wrong-owner"), /owner changed/);
      assert.deepEqual(records(conceptsContainerId).get(conceptRegistryLockId), lock);
    });
  }
});

test("coordinator ownership conflict never patches or deletes the other owner", async context => {
  const { repository, records, state, update } = await fixture(context);
  const replacementOwner = "11111111-1111-4111-8111-111111111111";
  state.onJournal = () => {
    const lock = records(conceptsContainerId).get(conceptRegistryLockId)!;
    lock.owner = replacementOwner;
    lock._etag = "other-owner-etag";
  };
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedConcept(update)),
    /coordinator ownership changed/);
  assert.equal(state.patches.length, 0);
  const lock = records(conceptsContainerId).get(conceptRegistryLockId)!;
  assert.equal(lock.owner, replacementOwner);
  assert.deepEqual(lock.coordinatedClassificationUpdates, [{ ...update, proposed: { ...concept, topic: update.topic } }]);
  await assert.rejects(repository.withConceptRegistry(async () => assert.fail("Other owner cannot be bypassed.")), /coordinator is busy/);
});

test("bounded batch coalesces shared-source bindings, stages one complete journal and preserves protected data", async context => {
  const { repository, records, collections, state, updates } = await batchFixture(context);
  const protectedCollections = structuredClone([...collections].filter(([name]) => name !== conceptsContainerId));
  const untouchedParent = structuredClone(records(conceptsContainerId).get(parent.id));
  let journal: RecordDocument | undefined;
  state.onJournal = () => {
    assert.equal(state.patches.length, 0);
    journal = structuredClone(records(conceptsContainerId).get(conceptRegistryLockId));
  };
  await repository.withConceptRegistry(async session => {
    const start = registryFingerprint(session.concepts);
    state.onPatch = () => { assert.equal(registryFingerprint(session.concepts), start); };
    const saved = await session.reclassifyCoordinatedBatch(updates);
    assert.deepEqual(saved, updates.map(update => ({ ...update.expected, subject: update.subject, topic: update.topic })));
    for (const canonical of saved) assert.deepEqual(session.concepts.find(item => item.id === canonical.id), canonical);
  });
  assert.equal(state.journals, 1);
  assert.equal(state.patches.length, 2);
  const entries = journal!.coordinatedClassificationUpdates as (CoordinatedConceptClassificationUpdate & { proposed: CanonicalConcept; batchId: string })[];
  assert.equal(new Set(entries.map(entry => entry.batchId)).size, 1);
  assert.match(entries[0].batchId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(entries.map(({ batchId, ...entry }) => entry),
    updates.map(update => ({ ...update, proposed: { ...update.expected, subject: update.subject, topic: update.topic } })));
  assert.deepEqual([...collections].filter(([name]) => name !== conceptsContainerId), protectedCollections);
  assert.deepEqual(records(conceptsContainerId).get(parent.id), untouchedParent);
  assert.equal(records(conceptsContainerId).get(other.id)!.topic, updates[1].topic);
  assert.deepEqual(records(conceptsContainerId).get(other.id)!.parentConceptIds, [concept.id]);
  assert.equal(records(conceptsContainerId).has(conceptRegistryLockId), false);
  assert.equal(state.reads.get("questions:1"), 2);
  assert.equal(state.reads.get("state_pcs:2"), 2);
  assert.equal(state.reads.get(`${masterContainerId}:S03`), 2);
  assert.equal(state.reads.get(`${masterContainerId}:S03-T08`), 2);
  assert.equal([...state.reads].some(([key]) => key.startsWith(`${profileContainerId}:`)), false);
  assert.equal(state.queries.get(`${profileContainerId}:dependencies`), 2);
  assert.equal(state.queries.get(`${conceptsContainerId}:parents`), 2);
});

test("shared-source batch measurably reduces duplicate reads relative to the unchanged single API", async context => {
  const serial = await batchFixture(context);
  await serial.repository.withConceptRegistry(async session => {
    for (const update of serial.updates) {
      await session.reclassifyCoordinatedConcept({ ...update, expectedRegistryFingerprint: registryFingerprint(session.concepts) });
    }
  });
  const batch = await batchFixture(context);
  await batch.repository.withConceptRegistry(session => session.reclassifyCoordinatedBatch(batch.updates));
  const sum = (values: Map<string, number>) => [...values.values()].reduce((total, count) => total + count, 0);
  const serialSourceReads = serial.state.reads.get("questions:1")! + serial.state.reads.get("state_pcs:2")!;
  const batchSourceReads = batch.state.reads.get("questions:1")! + batch.state.reads.get("state_pcs:2")!;
  assert.equal(serialSourceReads, 12);
  assert.equal(batchSourceReads, 4);
  assert.ok(sum(batch.state.reads) < sum(serial.state.reads));
  assert.ok(sum(batch.state.queries) < sum(serial.state.queries));
  context.diagnostic(`Two shared-source concepts: point reads ${sum(serial.state.reads)} -> ${sum(batch.state.reads)}; ` +
    `inventory queries ${sum(serial.state.queries)} -> ${sum(batch.state.queries)}; source reads ${serialSourceReads} -> ${batchSourceReads}.`);
});

test("batch bounds are fixed at 20 distinct concepts and four concurrent canonical patches", async context => {
  const { repository, records, state, updates } = await batchFixture(context, 20);
  await repository.withConceptRegistry(session => session.reclassifyCoordinatedBatch(updates));
  assert.equal(state.patches.length, 20);
  assert.equal(state.maxActivePatches, 4);
  assert.equal(state.activePatches, 0);
  assert.equal(state.journals, 1);
  assert.equal(state.reads.get("questions:1"), 2);
  assert.equal(state.queries.get(`${profileContainerId}:dependencies`), 2);
  assert.equal(records(conceptsContainerId).has(conceptRegistryLockId), false);
});

test("invalid batch scopes, receipts and complete inventories fail before journal or canonical mutation", async context => {
  const failures: [string, (setup: Awaited<ReturnType<typeof batchFixture>>) => void][] = [
    ["empty", setup => { setup.updates = []; }],
    ["duplicate", setup => { setup.updates.push(setup.updates[0]); }],
    ["over 20", setup => {
      setup.updates = Array.from({ length: 21 }, (_, index) => ({
        ...setup.updates[0], expected: { ...concept, id: `too_many_${index}` },
      }));
    }],
    ["one stale registry receipt", setup => { setup.updates[1].expectedRegistryFingerprint = hashContent("stale"); }],
    ["live registry drift", setup => { setup.records(conceptsContainerId).get(parent.id)!.definition += " changed"; }],
    ["record drift", setup => { setup.updates[1].expected.definition += " stale"; }],
    ["record etag drift", setup => { setup.records(conceptsContainerId).get(other.id)!._etag = "changed"; }],
    ["definition evidence", setup => { setup.updates[1].definitionEvidence = "not literal"; }],
    ["profile drift", setup => { setup.records(profileContainerId).get("questions:1")!._etag = "changed"; }],
    ["profile hash", setup => { setup.updates[1].dependencies[0].profileHash = hashContent("stale"); }],
    ["source drift", setup => { setup.records("questions").get("1")!._etag = "changed"; }],
    ["source snapshot receipt", setup => { setup.updates[1].dependencies[0].sourceSnapshotHash = hashContent("stale"); }],
    ["source content receipt", setup => { setup.updates[1].dependencies[0].sourceContentHash = hashContent("stale"); }],
    ["nonliteral source evidence", setup => { setup.updates[1].dependencies[0].sourceEvidence[0].exact_text = "not literal"; }],
    ["missing dependency scope", setup => { setup.updates[1].dependencies[0].meaningScopeRationale = ""; }],
    ["missing parent scope", setup => { setup.updates[0].parentDependencies[0].meaningScopeRationale = ""; }],
    ["duplicate profile", setup => { setup.updates[0].dependencies.push(setup.updates[0].dependencies[0]); }],
    ["duplicate parent", setup => { setup.updates[0].parentDependencies.push(setup.updates[0].parentDependencies[0]); }],
    ["unknown source container", setup => { setup.updates[0].dependencies[0].profileId = "invented:1"; }],
    ["omitted profile", setup => { setup.updates[0].dependencies.pop(); }],
    ["omitted parent", setup => { setup.updates[0].parentDependencies.pop(); }],
    ["in-batch parent expected drift", setup => {
      setup.updates[0].parentDependencies.find(dependency => dependency.expected.id === other.id)!.expected.topic = "Fabricated";
    }],
    ["parent etag drift", setup => { setup.records(conceptsContainerId).get(parent.id)!._etag = "changed"; }],
    ["master name drift", setup => { setup.records(masterContainerId).get("S03-T08")!.name = "Renamed"; }],
    ["master parent drift", setup => { setup.records(masterContainerId).get("S03-T08")!.parentId = "S04"; }],
    ["master inactive", setup => { setup.records(masterContainerId).get("S03-T08")!.isActive = false; }],
    ["new primary-anchor conflict", setup => {
      const document = setup.records(profileContainerId).get("questions:1")!;
      (document.classification as StoredProfile["classification"])!.review!.taxonomy_policy = "canonical_anchor";
      const hash = hashContent(storedProfileSchema.parse(document));
      setup.updates.forEach(update => { update.dependencies[0].profileHash = hash; });
    }],
  ];
  for (const [name, mutate] of failures) await context.test(name, async t => {
    const setup = await batchFixture(t);
    mutate(setup);
    const before = structuredClone([...setup.collections].filter(([name]) => name !== conceptsContainerId));
    await assert.rejects(setup.repository.withConceptRegistry(session => session.reclassifyCoordinatedBatch(setup.updates)));
    assert.equal(setup.state.patches.length, 0);
    assert.equal(setup.state.journals, 0);
    assert.equal(setup.records(conceptsContainerId).has(conceptRegistryLockId), false);
    assert.deepEqual([...setup.collections].filter(([name]) => name !== conceptsContainerId), before);
  });
});

test("a review-only dependency cannot be omitted from a batch", async context => {
  const { repository, records, state, updates } = await batchFixture(context);
  const reviewOnly = records(profileContainerId).get("state_pcs:2")!;
  (reviewOnly.concept_profile as StoredProfile["concept_profile"])!.secondary_concepts = [];
  const updatedHash = hashContent(storedProfileSchema.parse(reviewOnly));
  updates[0].dependencies = updates[0].dependencies.filter(dependency => dependency.profileId !== "state_pcs:2");
  updates[1].dependencies[1].profileHash = updatedHash;
  await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedBatch(updates)),
    /Meaningful batch profile dependency set/);
  assert.equal(state.patches.length, 0);
  assert.equal(state.journals, 0);
});

test("batch corrections preserve source-bound holds but block every active pipeline lease", async context => {
  for (const status of ["extracting", "embedding"] as const) await context.test(status, async t => {
    const { repository, records, state, updates, seed } = await batchFixture(t);
    const document = profileDocument("questions:99", true);
    document.concept_review!.decisions[0].existing_concept_id = other.id;
    document.processing.status = status;
    document.processing.updatedAt = "2000-01-01T00:00:00.000Z";
    seed(profileContainerId, document);
    await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedBatch(updates)), /Active pipeline leases/);
    assert.equal(state.patches.length, 0);
    assert.equal(records(conceptsContainerId).has(conceptRegistryLockId), false);
  });
});

test("partial and uncertain batch writes retain every staged pair and drain all in-flight workers", async context => {
  const { repository, records, state, updates } = await batchFixture(context, 6);
  let allStarted!: () => void;
  let releaseOthers!: () => void;
  const started = new Promise<void>(resolve => { allStarted = resolve; });
  const otherGate = new Promise<void>(resolve => { releaseOthers = resolve; });
  let calls = 0;
  let failed!: () => void;
  const firstFailed = new Promise<void>(resolve => { failed = resolve; });
  state.beforePatch = async id => {
    if (++calls === 4) allStarted();
    if (id === updates[0].expected.id) {
      await started;
      failed();
      throw new Error("First patch rejected while other writes are in flight.");
    }
    await otherGate;
  };
  let finished = false;
  const running = repository.withConceptRegistry(async session => {
    const before = structuredClone(session.concepts);
    await assert.rejects(session.reclassifyCoordinatedBatch(updates), /batch outcome is uncertain/);
    assert.deepEqual(session.concepts, before);
    await assert.rejects(session.reclassifyCoordinatedBatch(updates), /unresolved write/);
  }).finally(() => { finished = true; });
  await firstFailed;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(finished, false);
  assert.equal(state.activePatches, 3);
  releaseOthers();
  await running;
  assert.equal(state.activePatches, 0);
  assert.equal(state.maxActivePatches, 4);
  assert.equal(state.patches.length, 4);
  assert.equal(records(conceptsContainerId).get(updates[0].expected.id)!.topic, concept.topic);
  for (const update of updates.slice(1, 4)) assert.equal(records(conceptsContainerId).get(update.expected.id)!.topic, update.topic);
  for (const update of updates.slice(4)) assert.equal(records(conceptsContainerId).get(update.expected.id)!.topic, update.expected.topic);
  const lock = structuredClone(records(conceptsContainerId).get(conceptRegistryLockId)!);
  const entries = lock.coordinatedClassificationUpdates as (CoordinatedConceptClassificationUpdate & { proposed: CanonicalConcept; batchId: string })[];
  assert.deepEqual(entries.map(({ batchId, ...entry }) => entry),
    updates.map(update => ({ ...update, proposed: { ...update.expected, subject: update.subject, topic: update.topic } })));
  assert.equal(new Set(entries.map(entry => entry.batchId)).size, 1);
  await assert.rejects(repository.withConceptRegistry(async () => assert.fail("Partial batch owner cannot be overtaken.")), /coordinator is busy/);
  assert.deepEqual(records(conceptsContainerId).get(conceptRegistryLockId), lock);
});

test("batch final read-back verifies source/profile/master/parent/dependency bindings and retains uncertain owners", async context => {
  for (const failure of ["response lost", "conflicting patch", "source", "source verification", "profile", "master", "master etag",
    "registry", "parent etag", "in-batch parent identity", "in-batch parent etag", "new parent", "new review-only dependency",
    "missing canonical", "active lease", "missing read-back", "coordinator drift"]) {
    await context.test(failure, async t => {
      const { repository, records, state, updates, seed } = await batchFixture(t);
      if (failure === "response lost") state.patchMode = "lost_response";
      if (failure === "conflicting patch") state.patchMode = "conflict";
      let once = false;
      state.onPatch = id => {
        if (failure === "in-batch parent etag") {
          if (id === other.id) records(conceptsContainerId).get(other.id)!._etag = "changed";
          return;
        }
        if (once) return;
        once = true;
        if (failure === "source") records("questions").get("1")!._etag = "changed";
        if (failure === "source verification") {
          (records("questions").get("1")!.verification as { updatedAt: string }).updatedAt = "2026-10-23T01:00:00.000Z";
        }
        if (failure === "profile") records(profileContainerId).get("questions:1")!._etag = "changed";
        if (failure === "master") records(masterContainerId).get("S03-T08")!.name = "Renamed";
        if (failure === "master etag") records(masterContainerId).get("S03-T08")!._etag = "changed";
        if (failure === "registry") seed(conceptsContainerId, { ...other, id: "unreviewed_registry_entry" });
        if (failure === "parent etag") records(conceptsContainerId).get(parent.id)!._etag = "changed";
        if (failure === "in-batch parent identity") records(conceptsContainerId).get(other.id)!.definition = "Changed meaning";
        if (failure === "new parent") seed(conceptsContainerId, { ...parent, id: "unreviewed_parent" });
        if (failure === "new review-only dependency") seed(profileContainerId, profileDocument("questions:99", true));
        if (failure === "missing canonical") records(conceptsContainerId).delete(concept.id);
        if (failure === "active lease") {
          const document = profileDocument("questions:99", true);
          document.concept_review!.decisions[0].existing_concept_id = other.id;
          document.processing.status = "embedding";
          seed(profileContainerId, document);
        }
        if (failure === "missing read-back") state.onRead = () => { throw new Error("Read timed out."); };
        if (failure === "coordinator drift") records(conceptsContainerId).get(conceptRegistryLockId)!._etag = "changed";
      };
      await assert.rejects(repository.withConceptRegistry(async session => {
        const before = structuredClone(session.concepts);
        await assert.rejects(session.reclassifyCoordinatedBatch(updates), /batch outcome is uncertain/);
        assert.deepEqual(session.concepts, before);
        throw new Error("Retained for batch reconciliation");
      }), /Retained for batch reconciliation/);
      state.onRead = undefined;
      assert.equal(state.activePatches, 0);
      const lock = structuredClone(records(conceptsContainerId).get(conceptRegistryLockId)!);
      assert.equal((lock.coordinatedClassificationUpdates as unknown[]).length, updates.length);
      assert.deepEqual(lock.proposals, updates.map(update => ({ ...update.expected, subject: update.subject, topic: update.topic })));
      await assert.rejects(new CosmosPipelineRepository(repository.database, 0).withConceptRegistry(async () => {
        assert.fail("Uncertain batch must retain its owner.");
      }), /coordinator is busy/);
      assert.deepEqual(records(conceptsContainerId).get(conceptRegistryLockId), lock);
    });
  }
});

test("batch journal ownership and complete payload are confirmed before any worker may patch", async context => {
  for (const failure of ["owner", "payload"]) await context.test(failure, async t => {
    const { repository, records, state, updates } = await batchFixture(t);
    state.onJournal = () => {
      const lock = records(conceptsContainerId).get(conceptRegistryLockId)!;
      if (failure === "owner") lock.owner = "11111111-1111-4111-8111-111111111111";
      if (failure === "payload") lock.coordinatedClassificationUpdates = [];
      lock._etag = "concurrent-journal";
    };
    await assert.rejects(repository.withConceptRegistry(session => session.reclassifyCoordinatedBatch(updates)),
      /journal outcome is uncertain/);
    assert.equal(state.patches.length, 0);
    assert.equal(records(conceptsContainerId).has(conceptRegistryLockId), true);
  });
});
