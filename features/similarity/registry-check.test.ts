import assert from "node:assert/strict";
import test from "node:test";
import { registryFingerprint as pipelineFingerprint } from "./concept-review.js";
import { createRegistryChecker, createCompletedReceipt, createRegistryIndex, registryFingerprint } from "./registry-check.mjs";

const concept = (id: string, overrides: any = {}) => ({
  id, canonical_name: id.replaceAll("_", " "), definition: `Specific meaning of ${id}.`,
  subject: "History", topic: "Movements", aliases: [], parentConceptIds: [],
  status: "active", taxonomyVersion: "v1", ...overrides,
});
const records = [concept("gandhi_league", { aliases: ["Harijan Sevak Sangh"] }), concept("periyar_movement")];
const target = {
  id: "proposal", definition: concept("proposal"),
  sources: [{ id: "questions:1", role: "primary",
    question: { question: "Who founded the league?", options: ["Gandhi", "Periyar"], answer: "Gandhi" } }],
};
const receipt = (candidates = records, overrides: any = {}) => createCompletedReceipt([target], candidates, {
  comparedAllRows: true, reviewedBy: "GPT-6.1 Sol", reviewedAt: "2026-10-23T08:00:00.000Z",
  rationale: "The tested founding association was compared against every supplied record.",
  decisions: [{ concept_id: "proposal", equivalent_ids: ["gandhi_league"], related_ids: [],
    uncertain: false, rationale: "The same founder and organization; the other movement is distinct." }],
  ...overrides,
});
const workspace = (concepts = records, receipts: any[] = [], targets = [target]) => ({
  formatVersion: 1, capturedAt: "2026-10-23T08:00:00.000Z",
  registryFingerprint: registryFingerprint(concepts), concepts, targets, receipts,
});

test("registry fingerprints agree with pipeline binding, including aliases, order and retirement", () => {
  const list = [...records, concept("old", { aliases: ["z", "a"], parentConceptIds: ["z", "a"],
    status: "retired", retirement: { replacementConceptId: "gandhi_league", retiredAt: "date", reviewedBy: "reviewer", auditReference: "ref" } })];
  assert.equal(registryFingerprint([...list].reverse()), pipelineFingerprint(list as any));
});

test("candidate search ranks exact aliases, supports filters and keeps retired records opt-in", () => {
  const index = createRegistryIndex([...records,
    concept("retired_alias", { aliases: ["Harijan Sevak Sangh"], status: "retired" }),
    concept("other_subject", { subject: "Science", definition: "Harijan Sevak Sangh is a source example." })]);
  assert.equal(index.search({ query: "HARIJAN-SEVAK SANGH" }).results[0].id, "gandhi_league");
  assert.equal(index.search({ query: "Harijan Sevak Sangh", subject: "Science" }).results[0].id, "other_subject");
  assert.equal(index.search({ query: "Harijan Sevak Sangh", status: "retired" }).total, 1);
  assert.equal(index.search({ query: "unrelatedunknown" }).candidateSearchOnly, true);
});

test("unchanged complete reviews require no repeated comparisons but never admit concepts", () => {
  const checker = createRegistryChecker(workspace(records, [receipt()]));
  assert.equal(checker.summary.coveredComparisons, 2);
  assert.equal(checker.summary.remainingComparisons, 0);
  assert.equal(checker.reviewTasks().tasks.length, 0);
  assert.equal(checker.summary.admissionApproved, false);
  assert.deepEqual(checker.target("proposal").plan.equivalentIds, ["gandhi_league"]);
});

test("a new record and a changed definition queue only the affected records", () => {
  const changed = [records[0], { ...records[1], definition: "A changed, independent meaning." }, concept("new_record")];
  const checker = createRegistryChecker(workspace(changed, [receipt()]));
  assert.equal(checker.summary.coveredComparisons, 1);
  assert.deepEqual(checker.target("proposal").plan.remainingIds, ["periyar_movement", "new_record"]);
  assert.deepEqual(checker.reviewTasks().tasks.flatMap(task => task.records.map(record => record.id)).sort(),
    ["new_record", "periyar_movement"]);
});

test("a changed source, proposal scope or role invalidates its old comparison context", () => {
  for (const change of ["source", "definition", "role"]) {
    const altered = structuredClone(target);
    if (change === "source") altered.sources[0].question.answer = "Periyar";
    if (change === "definition") altered.definition.definition = "A narrower founding-date association.";
    if (change === "role") altered.sources[0].role = "secondary";
    const checker = createRegistryChecker(workspace(records, [receipt()], [altered]));
    assert.equal(checker.summary.coveredComparisons, 0, change);
    assert.equal(checker.summary.remainingComparisons, 2, change);
  }
});

test("partial receipts never establish complete registry coverage", () => {
  const checker = createRegistryChecker(workspace(records, [receipt([records[0]])]));
  assert.equal(checker.target("proposal").plan.complete, false);
  assert.equal(checker.summary.remainingComparisons, 1);
});

test("uncertain scopes remain blocked without being automatically sent for repeated full scans", () => {
  const uncertain = receipt(records, { decisions: [{ concept_id: "proposal", equivalent_ids: [], related_ids: [],
    uncertain: true, rationale: "The supplied scope is unresolved." }] });
  const checker = createRegistryChecker(workspace(records, [uncertain]));
  assert.equal(checker.summary.uncertainComparisons, 2);
  assert.equal(checker.target("proposal").plan.complete, false);
  assert.equal(checker.reviewTasks().tasks.length, 0);
  assert.equal(checker.reviewTasks(250, true).tasks.length, 1);
});

test("contradictory cached judgments become pending conflicts, not last-writer wins", () => {
  const conflict = receipt(records, { decisions: [{ concept_id: "proposal", equivalent_ids: [],
    related_ids: ["gandhi_league"], uncertain: false, rationale: "This scope is only related, not equivalent." }] });
  const checker = createRegistryChecker(workspace(records, [receipt(), conflict]));
  assert.deepEqual(checker.target("proposal").plan.conflicts, ["gandhi_league"]);
  assert.equal(checker.reviewTasks().tasks.length, 1);
  assert.equal(checker.summary.remainingComparisons, 1);
});

test("incomplete, forged-ID and corrupted receipts are rejected", () => {
  assert.throws(() => receipt(records, { comparedAllRows: false }));
  assert.throws(() => receipt(records, { decisions: [] }));
  assert.throws(() => receipt(records, { decisions: [{ concept_id: "proposal", equivalent_ids: ["invented"],
    related_ids: [], uncertain: false, rationale: "Invalid target." }] }));
  const corrupted = receipt();
  corrupted.decisions[0].rationale = "Changed after hashing.";
  assert.throws(() => createRegistryChecker(workspace(records, [corrupted])), /corrupted/);
});

test("explicit scoped supersession resolves a conflict without erasing other comparisons or audit history", () => {
  const earlier = receipt();
  const conflict = receipt(records, { decisions: [{ concept_id: "proposal", equivalent_ids: [],
    related_ids: ["gandhi_league"], uncertain: false, rationale: "A competing narrower interpretation." }] });
  const resolution = receipt([records[0]], { supersedes: [earlier.id, conflict.id],
    rationale: "The exact founder and organization were rechecked; no narrower temporal predicate is tested." });
  const checker = createRegistryChecker(workspace(records, [earlier, conflict, resolution]));
  assert.equal(checker.summary.remainingComparisons, 0);
  assert.deepEqual(checker.target("proposal").plan.conflicts, []);
  assert.equal(checker.target("proposal").reviews.length, 3);
  assert.equal(checker.summary.admissionApproved, false);
});
