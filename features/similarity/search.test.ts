import assert from "node:assert/strict";
import { test } from "node:test";
import { embeddingModel, embeddingPrefix, promptVersion, schemaVersion } from "./config";
import { buildEmbeddingInput, hashContent } from "./pipeline";
import { profileExtractionSchema, sourceQuestionSchema, storedProfileSchema, type SourceQuestion, type StoredProfile } from "./schema";
import { findSimilarQuestions, type SimilarityStore } from "./search";
import type { QuestionReference, QuestionSourceContainer } from "./types";
import { flagQuestionForReview, unverifiedQuestion, type QuestionVerification } from "./verification";

const source: QuestionReference = { sourceContainer: "questions", questionId: "418" };

function refreshEmbeddingInput(profile: StoredProfile) {
  profile.concept_review = {
    decisions: [...profile.concept_profile.primary_concepts, ...profile.concept_profile.secondary_concepts].map(concept => ({
      concept_id: concept.concept_id, decision: "reuse", existing_concept_id: concept.concept_id,
      meaning_scope_rationale: "Reviewed canonical concept with equivalent meaning and scope.",
      role: concept.role, role_status: "supported", role_rationale: "The source supports this question-specific role.",
      source_evidence: [{ concept_id: concept.concept_id, field: "question", exact_text: "Source question" }],
    })),
  };
  profile.concept_embedding_input = buildEmbeddingInput(profileExtractionSchema.parse(profile));
  profile.processing.embeddingInputHash = hashContent(embeddingPrefix + profile.concept_embedding_input);
}

class MemoryStore implements SimilarityStore {
  profiles = new Map<string, StoredProfile>();
  questions = new Map<string, SourceQuestion>();
  verifications = new Map<string, QuestionVerification>();
  status: string | undefined;
  years = ["2026", "2025"];
  searches: { sources: QuestionSourceContainer[]; years?: string[] }[] = [];
  questionReads = 0;
  add(id: string, vector: number[], year = "2026", container: QuestionSourceContainer = "questions") {
    const question = sourceQuestionSchema.parse({
      id, question: `Source question ${id}.`, exam: "Test", year, subject: "Geography",
      options: ["A", "B"], answer: "A", explanation: `Explanation for ${id}.`,
      modelAnswer: "A descriptive model answer.",
    });
    const profile = storedProfileSchema.parse({
      id: `${container}:${id}`, sourceContainer: container, questionId: id, schemaVersion,
      sourceMetadata: { exam: question.exam, year: question.year, paper: null },
      classification: {
        subject: "Geography", topic: "Borders", subtopics: [],
        question_format: "single_correct_mcq", polarity: "positive_selection",
        reasoning_type: ["recall"], question_intent: "Identify a land border.",
        review: {
          status: "supported", primary_concept_id: "land_borders",
          subject_confidence: 0.95, topic_confidence: 0.95,
          rationale: "The tested primary concept concerns geographical boundaries.",
          source_evidence: [{ concept_id: "land_borders", field: "question", exact_text: "Source question" }],
        },
      },
      concept_profile: {
        primary_concepts: [{ concept_id: "land_borders", canonical_name: "Land borders", role: "primary", confidence: 0.9 }],
        secondary_concepts: [], underlying_principle: "Countries sharing boundaries.",
        knowledge_requirements: ["Know the land boundary relationships."], entities: [], relationships: [],
      },
      claims: [],
      similarity_profile: { concept_summary: "Land boundaries.", matching_cautions: [] },
      provenance: {
        inputs_used: ["question", "provided_answer"], answer_status: "provided_not_independently_verified",
        truth_labels_based_on: "provided_answer_only", needs_review: false, review_notes: [],
      },
      concept_embedding_input: "", embedding: vector,
      processing: {
        status: "ready", sourceContentHash: hashContent(question), embeddingInputHash: null,
        promptVersion, taxonomyVersion: "v1", extractionModel: "offline",
        embeddingModel, embeddingDimensions: vector.length,
        embeddingSpaceVersion: `${embeddingModel}:${vector.length}:sentence-similarity:normalized:v1`,
        updatedAt: "2026-01-01T00:00:00Z", error: null,
      },
    });
    refreshEmbeddingInput(profile);
    this.profiles.set(profile.id, profile);
    this.questions.set(profile.id, question);
    return profile;
  }
  async readProfile(id: string) { return this.profiles.get(id); }
  async readQuestion(reference: QuestionReference) {
    this.questionReads++;
    const key = `${reference.sourceContainer}:${reference.questionId}`;
    const question = this.questions.get(key);
    return question ? { question, verification: this.verifications.get(key) } : undefined;
  }
  async userStatus() { return this.status; }
  async latestYears() { return this.years; }
  async candidates(_profile: StoredProfile, sources: QuestionSourceContainer[], years?: string[]) {
    this.searches.push({ sources, years });
    return [...this.profiles.values()];
  }
}

test("missing and unready profiles return explicit empty matches without searching or reading questions", async () => {
  const store = new MemoryStore();
  assert.deepEqual(await findSimilarQuestions(source, undefined, store), {
    status: "pending", source, matches: [], message: "No ready concept profile is available for this question.",
  });
  const profile = store.add("418", [1, 0, 0]);
  for (const status of ["pending_extraction", "extracting", "pending_review", "pending_embedding", "embedding", "failed", "stale"] as const) {
    profile.processing.status = status;
    assert.deepEqual((await findSimilarQuestions(source, undefined, store)).matches, []);
  }
  assert.equal(store.searches.length, 0);
  assert.equal(store.questionReads, 0);
});

test("unreviewed or uncertain concept roles cannot supply ready search vectors", async () => {
  const store = new MemoryStore();
  const profile = store.add("418", [1, 0, 0]);
  const candidate = store.add("2", [1, 0, 0]);
  const reviewed = structuredClone(profile.concept_review);
  for (const review of [
    undefined,
    { decisions: [{ ...reviewed.decisions[0], decision: "review" as const }] },
    { decisions: [{ ...reviewed.decisions[0], role_status: "unrelated" as const }] },
  ]) {
    profile.concept_review = review;
    assert.equal((await findSimilarQuestions(source, undefined, store)).status, "stale");
    profile.concept_review = reviewed;
    candidate.concept_review = review;
    assert.deepEqual((await findSimilarQuestions(source, undefined, store)).matches, []);
  }
});

test("a persisted review-only profile parses and returns pending without requiring an extraction", async () => {
  const store = new MemoryStore();
  const ready = store.add("418", [1, 0, 0]);
  const verification = flagQuestionForReview(unverifiedQuestion(ready.processing.sourceContentHash), {
    code: "CANONICAL_SCOPE_REVIEW", check: "concepts",
    reason: "The proposed concept overlaps an existing identity.",
    requiredAction: "Review the canonical meaning and scope.", evidence: ["Source evidence"],
  });
  const profile = storedProfileSchema.parse({
    id: ready.id, sourceContainer: ready.sourceContainer, questionId: ready.questionId,
    schemaVersion, sourceMetadata: ready.sourceMetadata, verification,
    provenance: { ...ready.provenance, needs_review: true },
    embedding: null, concept_embedding_input: "",
    processing: {
      ...ready.processing, status: "pending_review", embeddingInputHash: null,
      error: "REVIEW_FLAG[CANONICAL_SCOPE_REVIEW]: The proposed concept overlaps an existing identity.",
    },
  });
  store.profiles.set(profile.id, profile);
  const result = await findSimilarQuestions(source, undefined, store);
  assert.equal(result.status, "pending");
  assert.deepEqual(result.matches, []);
  assert.match(result.message, /review is required/);
  assert.equal(store.questionReads, 0);
  assert.equal(store.searches.length, 0);
});

test("a blocking verification flag excludes source and candidate vectors even with an old ready processing status", async () => {
  const store = new MemoryStore();
  const profile = store.add("418", [1, 0, 0]);
  const candidate = store.add("2", [1, 0, 0]);
  const issue = {
    code: "ANSWER_REVIEW_REQUIRED", check: "answer" as const,
    reason: "Conflicting answer evidence.", requiredAction: "Review the original answer key.",
    evidence: ["Review record 001"],
  };
  profile.verification = flagQuestionForReview(unverifiedQuestion(profile.processing.sourceContentHash), issue);
  assert.throws(() => storedProfileSchema.parse(profile), /cannot publish a ready vector/);
  const blocked = await findSimilarQuestions(source, undefined, store);
  assert.equal(blocked.status, "pending");
  assert.deepEqual(blocked.matches, []);
  assert.equal(store.questionReads, 0);
  delete profile.verification;
  candidate.verification = flagQuestionForReview(unverifiedQuestion(candidate.processing.sourceContentHash), issue);
  assert.deepEqual((await findSimilarQuestions(source, undefined, store)).matches, []);
});

test("changed source content or embedding inputs return stale empty results", async () => {
  const store = new MemoryStore();
  const profile = store.add("418", [1, 0, 0]);
  store.questions.get(profile.id).question = "Updated source content.";
  assert.equal((await findSimilarQuestions(source, undefined, store)).status, "stale");
  profile.processing.sourceContentHash = hashContent(store.questions.get(profile.id));
  profile.concept_embedding_input += "Changed extraction.";
  assert.equal((await findSimilarQuestions(source, undefined, store)).status, "stale");
  assert.equal(store.searches.length, 0);
});

test("question-level review flags block matching even when the profile mirror has not caught up", async () => {
  const store = new MemoryStore();
  const profile = store.add("418", [1, 0, 0]);
  const candidate = store.add("2", [1, 0, 0]);
  const sourceFlag = flagQuestionForReview(unverifiedQuestion(profile.processing.sourceContentHash), {
    code: "ANSWER_REVIEW_REQUIRED", check: "answer", reason: "The source answer needs review.",
    requiredAction: "Check original answer evidence.", evidence: [],
  });
  store.verifications.set(profile.id, sourceFlag);
  const blocked = await findSimilarQuestions(source, undefined, store);
  assert.equal(blocked.status, "pending");
  assert.deepEqual(blocked.matches, []);
  assert.equal(store.searches.length, 0);
  store.verifications.delete(profile.id);
  store.verifications.set(candidate.id, flagQuestionForReview(unverifiedQuestion(candidate.processing.sourceContentHash), {
    ...sourceFlag.issues[0], reason: "The candidate answer needs review.",
  }));
  assert.deepEqual((await findSimilarQuestions(source, undefined, store)).matches, []);
});

test("missing, uncertain and low-confidence classification reviews cannot supply source or candidate vectors", async () => {
  const store = new MemoryStore();
  const profile = store.add("418", [1, 0, 0]);
  const candidate = store.add("2", [1, 0, 0]);
  const reviewed = structuredClone(profile.classification.review);
  for (const review of [
    undefined,
    { ...reviewed, status: "uncertain" as const },
    { ...reviewed, status: "conflict" as const },
    { ...reviewed, subject_confidence: 0.84 },
    { ...reviewed, topic_confidence: 0.84 },
    { ...reviewed, source_evidence: [] },
    { ...reviewed, source_evidence: [{ ...reviewed.source_evidence[0], concept_id: "not_a_primary_concept" }] },
  ]) {
    profile.classification.review = review;
    assert.equal((await findSimilarQuestions(source, undefined, store)).status, "stale");
    profile.classification.review = reviewed;
    candidate.classification.review = review;
    assert.deepEqual((await findSimilarQuestions(source, undefined, store)).matches, []);
  }
});

test("compatible vectors rank by cosine and return source content plus profile reasons, never vectors", async () => {
  const store = new MemoryStore();
  store.add("418", [1, 0, 0]);
  store.add("2", [0.6, 0.8, 0]);
  const higher = store.add("3", [2, 0, 0], "2025", "state_pcs");
  store.questions.get(higher.id).question = "Entirely different wording.";
  higher.processing.sourceContentHash = hashContent(store.questions.get(higher.id));
  const result = await findSimilarQuestions(source, undefined, store);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.matches.map(match => [match.questionId, match.score]), [["3", 100], ["2", 60]]);
  assert.equal(result.matches[0].question.question, "Entirely different wording.");
  assert.equal(result.matches[0].question.sourceContainer, "state_pcs");
  assert.equal(result.matches[0].relation, "same_concept");
  assert.deepEqual(result.matches[0].sharedConcepts, [{ conceptId: "land_borders", canonicalName: "Land borders" }]);
  assert.match(result.matches[0].reasons[0], /Land borders/);
  assert.equal(JSON.stringify(result).includes("embedding"), false);
  assert.equal(JSON.stringify(result).includes("sourceContentHash"), false);
  assert.deepEqual(store.searches, [{ sources: ["questions", "state_pcs"], years: ["2026", "2025"] }]);
});

test("stale, inactive, incompatible, out-of-bank, and nonpositive candidates are not forced into results", async () => {
  const store = new MemoryStore();
  store.add("418", [1, 0, 0]);
  const stale = store.add("2", [1, 0, 0]);
  store.questions.get(stale.id).answer = "B";
  const inactive = store.add("3", [1, 0, 0]);
  store.questions.get(inactive.id).isActive = false;
  store.add("4", [1, 0]);
  store.add("5", [1, 0, 0], "2026", "csat-questions");
  store.add("6", [0, 1, 0]);
  store.add("7", [-1, 0, 0]);
  const outdated = store.add("8", [1, 0, 0]);
  outdated.processing.embeddingSpaceVersion = "old-space";
  assert.deepEqual((await findSimilarQuestions(source, undefined, store)).matches, []);
});

test("free users cannot read old source or candidate questions; stored premium roles can", async () => {
  const store = new MemoryStore();
  store.add("418", [1, 0, 0]);
  store.add("2", [1, 0, 0], "2024");
  assert.deepEqual((await findSimilarQuestions(source, "free@gmail.com", store)).matches, []);
  for (const role of ["subscribed", "admin", "editor"]) {
    store.status = role;
    assert.equal((await findSimilarQuestions(source, "premium@gmail.com", store)).matches.length, 1);
    assert.equal(store.searches.at(-1).years, undefined);
  }
  store.status = undefined;
  const callsBefore = store.searches.length;
  assert.deepEqual((await findSimilarQuestions({ ...source, questionId: "2" }, undefined, store)).matches, []);
  assert.equal(store.searches.length, callsBefore);
  assert.equal((await findSimilarQuestions(source, "admin@gmail.com", store, ["admin@gmail.com"])).matches.length, 1);
});

test("partial concept overlap is explained without changing the vector ranking score", async () => {
  const store = new MemoryStore();
  store.add("418", [1, 0, 0]);
  const candidate = store.add("2", [0.8, 0.6, 0]);
  candidate.concept_profile.primary_concepts = [{
    concept_id: "coastal_borders", canonical_name: "Coastal borders", role: "primary", confidence: 0.9,
  }];
  candidate.concept_profile.secondary_concepts = [{
    concept_id: "land_borders", canonical_name: "Land borders", role: "secondary", confidence: 0.9,
  }];
  candidate.classification.review.source_evidence[0].concept_id = "coastal_borders";
  candidate.classification.review.primary_concept_id = "coastal_borders";
  refreshEmbeddingInput(candidate);
  const result = await findSimilarQuestions(source, undefined, store);
  assert.equal(result.matches[0].relation, "partial_concept_overlap");
  assert.equal(result.matches[0].score, 80);
});

test("highlight evidence includes important concepts even when they are not shared", async () => {
  const store = new MemoryStore();
  const reference = store.add("418", [1, 0, 0]);
  const candidate = store.add("2", [0.8, 0.6, 0]);
  reference.concept_profile.secondary_concepts.push({
    concept_id: "source_private", canonical_name: "Reference-only concept", role: "secondary", confidence: 0.9,
  });
  candidate.concept_profile.secondary_concepts.push({
    concept_id: "candidate_private", canonical_name: "Candidate-only concept", role: "secondary", confidence: 0.9,
  });
  reference.highlight_evidence = [
    { concept_id: "land_borders", field: "question", exact_text: "Source question" },
    { concept_id: "source_private", field: "question", exact_text: "418" },
  ];
  candidate.highlight_evidence = [
    { concept_id: "land_borders", field: "question", exact_text: "question 2" },
    { concept_id: "land_borders", field: "option", option_index: 0, exact_text: "A" },
    { concept_id: "land_borders", field: "explanation", exact_text: "Explanation for 2." },
    { concept_id: "candidate_private", field: "question", exact_text: "Source" },
  ];
  refreshEmbeddingInput(reference);
  refreshEmbeddingInput(candidate);
  const result = await findSimilarQuestions(source, undefined, store);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("Expected ready similarity results.");
  assert.deepEqual(result.sourceHighlights, reference.highlight_evidence);
  assert.deepEqual(result.matches[0].highlights, candidate.highlight_evidence);
  assert.deepEqual(result.matches[0].sharedConcepts, [{ conceptId: "land_borders", canonicalName: "Land borders" }]);
  assert.equal(result.matches[0].score, 80);
  store.questions.get(candidate.id).question += " Changed.";
  const stale = await findSimilarQuestions(source, undefined, store);
  assert.equal(stale.matches.length, 0);
  if (stale.status !== "ready") throw new Error("Expected a ready reference without stale matches.");
  assert.deepEqual(stale.sourceHighlights, reference.highlight_evidence);
});

test("mains searches stay in their bank and return descriptive content", async () => {
  const store = new MemoryStore();
  store.add("418", [1, 0, 0], "2026", "mains-questions");
  store.add("2", [1, 0, 0], "2026", "mains-questions");
  store.add("3", [1, 0, 0]);
  const result = await findSimilarQuestions({ ...source, sourceContainer: "mains-questions" }, undefined, store);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].question.kind, "descriptive");
  assert.deepEqual(store.searches[0].sources, ["mains-questions"]);
});

test("return at most 12 matches and propagate database errors instead of empty success", async () => {
  const store = new MemoryStore();
  store.add("418", [1, 0, 0]);
  for (let id = 1; id <= 20; id++) store.add(String(id), [1, 0, 0]);
  assert.equal((await findSimilarQuestions(source, undefined, store)).matches.length, 12);
  store.candidates = async () => { throw new Error("Database unavailable."); };
  await assert.rejects(findSimilarQuestions(source, undefined, store), /Database unavailable/);
  store.userStatus = async () => { throw new Error("User lookup denied."); };
  await assert.rejects(findSimilarQuestions(source, "test@gmail.com", store), /User lookup denied/);
});
