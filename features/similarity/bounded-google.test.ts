import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { BoundedGooglePipelineAI, extractionCandidates } from "./bounded-google";
import { TextRequestBudget } from "./request-budget";
import { assertConceptAdmission, bindConceptReview } from "./concept-review";
import { extractionResponseSchema, sourceQuestionSchema, type ConceptReview } from "./schema";
import type { CanonicalConcept } from "./types";
import type { PipelineConfig } from "./config";
import { buildMasterRecords } from "../taxonomy/master";

const config: PipelineConfig = {
  apiKey: "offline-test-only", extractionModel: "offline-model", dimensions: 3,
  taxonomyVersion: "v1", embeddingSpaceVersion: "offline-space",
};
const question = sourceQuestionSchema.parse({
  id: "1", question: "Which body makes laws?", options: ["Legislature", "Executive"], answer: "Legislature",
});
const evidence = { concept_id: "tested_fact", field: "question" as const, exact_text: "makes laws" };
const finalReview: ConceptReview = {
  decisions: [{
    concept_id: "tested_fact", decision: "reuse", existing_concept_id: "opaque_identity",
    meaning_scope_rationale: "The definitions describe the same legislative authority.",
    role: "primary", role_status: "supported", role_rationale: "The authority is directly tested.",
    source_evidence: [evidence], compared_concept_ids: ["opaque_identity"],
  }],
  coverage: {
    status: "complete", rationale: "The tested authority and both alternatives were considered.", uncovered_items: [],
    reviewed_fields: [
      { field: "question", rationale: "The tested legislative role." },
      ...[0, 1].map(option_index => ({
        field: "option" as const, option_index, rationale: "A candidate authority.",
        highlight_gap: "An authority name alone is not the tested legislative relationship.",
      })),
    ],
    items: [{ item_id: "law_making", meaning: "Legislative authority.", concept_ids: ["tested_fact"],
      claim_ids: [], source_evidence: [evidence] }],
  },
  highlights: { status: "complete", rationale: "The concise stem phrase identifies the tested role.",
    gaps: [], extended_excerpts: [], dense_fields: [] },
};
const extraction = extractionResponseSchema.parse({
  classification: {
    subject: "Polity", topic: "Legislature", subtopics: [],
    question_format: "single_correct", polarity: "positive_selection", reasoning_type: ["recall"],
    question_intent: "Identify legislative authority.",
    review: { status: "supported", primary_concept_id: "tested_fact",
      subject_confidence: 0.95, topic_confidence: 0.95, rationale: "Legislative authority is directly tested.",
      source_evidence: [evidence] },
  },
  concept_profile: {
    primary_concepts: [{ concept_id: "tested_fact", canonical_name: "Law-making authority", role: "primary", confidence: 1 }],
    secondary_concepts: [], underlying_principle: "Legislatures make laws.",
    knowledge_requirements: ["Know legislative authority."], entities: [], relationships: [],
  },
  concept_definitions: [{
    id: "tested_fact", canonical_name: "Law-making authority", definition: "The body responsible for making laws.",
    subject: "Polity", topic: "Legislature", aliases: [], parentConceptIds: [],
  }],
  claims: [], highlight_evidence: [evidence],
  similarity_profile: { concept_summary: "Legislative authority.", matching_cautions: [] },
  provenance: { inputs_used: ["question", "options", "provided_answer"], answer_status: "provided_not_independently_verified",
    truth_labels_based_on: "provided_answer_only", needs_review: false, review_notes: [] },
});
const registry: CanonicalConcept[] = [
  ...["alpha", "beta", "gamma"].map(id => ({
    id, canonical_name: `Unrelated ${id}`, definition: "A separate principle.",
    subject: "Science", topic: "Other", aliases: [], parentConceptIds: [], status: "active" as const, taxonomyVersion: "v1",
  })),
  { id: "opaque_identity", canonical_name: "Statutory authorship", definition: "Authority endowed with legislative competence.",
    subject: "Polity", topic: "Legislature", aliases: ["Enactment competence"], parentConceptIds: [],
    status: "provisional", taxonomyVersion: "v1" },
  { id: "retired", canonical_name: "Retired identity", definition: "An obsolete record.",
    subject: "Other", topic: "Other", aliases: [], parentConceptIds: [], status: "retired", taxonomyVersion: "v1" },
];

function mockProvider(context: TestContext, mode: "valid" | "uncertain" | "foreign" | "contradictory" = "valid") {
  const visited: string[] = [];
  let finalCalls = 0;
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    if (String(url).includes("countTokens")) {
      const request = JSON.parse(body.contents[0].parts[0].text);
      const payload = JSON.parse(request.contents);
      return Response.json({ totalTokens: payload.review_id && payload.canonical_concepts.rows.length > 1 ? 5000 : 100 });
    }
    const payload = JSON.parse(body.contents[0].parts[0].text);
    let result: unknown;
    if (payload.review_id) {
      const rows = payload.canonical_concepts.rows;
      assert.equal(rows.length, 1, "Oversized registry chunks must be split before generation.");
      const id = rows[0][0];
      const original = registry.find(concept => concept.id === id)!;
      assert.deepEqual(rows[0], [
        original.id, original.canonical_name, original.definition, original.subject, original.topic,
        original.aliases, original.parentConceptIds, original.status, original.taxonomyVersion,
      ]);
      visited.push(id);
      result = {
        review_id: payload.review_id, status: mode === "uncertain" ? "uncertain" : "complete",
        rationale: "Compared the proposed meaning and scope against this entire supplied chunk.",
        decisions: [{
          concept_id: "tested_fact", equivalent_ids: mode === "foreign" ? ["not_in_this_chunk"]
            : id === "opaque_identity" ? [id] : [],
          related_ids: [], uncertain: false,
          rationale: id === "opaque_identity" ? "Equivalent legislative competence." : "Different meaning and scope.",
        }],
      };
    } else {
      finalCalls++;
      assert.equal(payload.canonical_concepts.some((concept: CanonicalConcept) => concept.id === "opaque_identity"), true);
      assert.equal(payload.complete_registry_semantic_scan.reviewed_count, 4);
      result = structuredClone(finalReview);
      if (mode === "contradictory") {
        const review = result as ConceptReview;
        review.decisions[0].decision = "new";
        review.decisions[0].existing_concept_id = null;
      }
    }
    return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(result) }] } }] });
  });
  let now = 0;
  const budget = new TextRequestBudget(5000, 100_000, 100, 1000, () => now, async ms => { now += ms; });
  return { provider: new BoundedGooglePipelineAI(config, undefined, budget), visited, finalCalls: () => finalCalls };
}

test("bounded review compares all live rows, including nonlexical cross-subject candidates, without truncating definitions", async context => {
  assert.equal(extractionCandidates(question, registry).some(concept => concept.id === "opaque_identity"), false);
  const { provider, visited, finalCalls } = mockProvider(context);
  const review = await provider.reviewConcepts(question, extraction, registry) as ConceptReview;
  assert.deepEqual([...visited].sort(), ["alpha", "beta", "gamma", "opaque_identity"]);
  assert.equal(finalCalls(), 1);
  assert.equal(review.registry_scan?.reviewed_concept_count, 4);
  const bound = { ...extraction, concept_review: bindConceptReview(question, extraction, registry, "test-reviewer", review) };
  assert.doesNotThrow(() => assertConceptAdmission(bound, question, registry));
  const omitted = structuredClone(bound);
  omitted.concept_review.registry_scan!.chunks.pop();
  omitted.concept_review = bindConceptReview(question, omitted, registry, "test-reviewer", omitted.concept_review);
  assert.throws(() => assertConceptAdmission(omitted, question, registry), /omitted registry/);
});

for (const mode of ["uncertain", "foreign", "contradictory"] as const) {
  test(`bounded review fails closed on ${mode} semantic evidence`, async context => {
    const { provider, finalCalls } = mockProvider(context, mode);
    await assert.rejects(provider.reviewConcepts(question, extraction, registry), /semantic comparison|conflicts/);
    assert.equal(finalCalls(), mode === "contradictory" ? 1 : 0);
  });
}

test("shared budget accounts for simultaneous workers and enforces both token and request windows", async () => {
  let now = 0;
  const sleeps: number[] = [];
  const budget = new TextRequestBudget(100, 150, 2, 1000, () => now, async ms => { sleeps.push(ms); now += ms; });
  await Promise.all([budget.admit(80), budget.admit(80), budget.admit(20)]);
  assert.deepEqual(sleeps, [1000]);
  await budget.admit(20);
  assert.deepEqual(sleeps, [1000, 1000]);
  await assert.rejects(budget.admit(101), /maximum/);
});

test("bounded extraction preserves all active master names, IDs and legacy details while measuring before generation", async context => {
  const master = buildMasterRecords({
    version: "test", subjects: [{
      id: "S04", name: "Polity & Constitution", boundary: "Constitutional and legislative subjects",
      topics: [{ id: "S04-T01", name: "Legislature", subtopics: ["Parliament"] }],
    }],
  });
  const calls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    if (String(url).includes("countTokens")) {
      calls.push("count");
      return Response.json({ totalTokens: 1000 });
    }
    calls.push("generate");
    const sent = JSON.parse(body.contents[0].parts[0].text);
    assert.deepEqual(sent.active_subject_topic_master.columns,
      ["id", "type", "name", "parentId", "subjectId", "description_or_details", "legacyIds"]);
    assert.deepEqual(sent.active_subject_topic_master.rows, master.filter(record => record.isActive).map(record => [
      record.id, record.type, record.name, record.parentId, record.subjectId,
      record.type === "subject" ? record.description : record.details, record.legacyIds,
    ]));
    assert.equal("subject" in sent.question, false);
    assert.equal("topic" in sent.question, false);
    assert.match(body.systemInstruction.parts[0].text, /does NOT establish novelty/);
    return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(extraction) }] } }] });
  });
  const provider = new BoundedGooglePipelineAI(config, master, new TextRequestBudget());
  await provider.extract(question, registry);
  assert.deepEqual(calls, ["count", "generate"]);
});
