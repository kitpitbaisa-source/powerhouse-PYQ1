import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMasterRecords, planMasterRevision, planMasterSeed } from "./master";

const catalogue = () => ({
  version: "reviewed-test",
  subjects: [{
    id: "S26",
    name: "Others",
    boundary: "Only named topic areas.",
    topics: [{ id: "S26-T03", name: "English", subtopics: ["Spelling", "Grammar"] }],
  }],
});

test("subjects and topics share the parent partition while subtopics remain details", () => {
  const records = buildMasterRecords(catalogue());
  assert.equal(records.length, 2);
  assert.equal(records[0].type, "subject");
  assert.equal(records[0].parentId, null);
  assert.equal(records[1].subjectId, records[0].id);
  assert.equal(records[1].parentId, records[0].id);
  assert.equal(records[1].type, "topic");
  if (records[1].type === "topic") assert.deepEqual(records[1].details, ["Spelling", "Grammar"]);
});

test("the seed rejects duplicate topics and IDs belonging to another subject", () => {
  const duplicate = catalogue();
  duplicate.subjects[0].topics.push({ id: "S26-T04", name: " ENGLISH ", subtopics: [] });
  assert.throws(() => buildMasterRecords(duplicate), /Duplicate topic/);
  const orphan = catalogue();
  orphan.subjects[0].topics[0].id = "S12-T01";
  assert.throws(() => buildMasterRecords(orphan), /parent subject/);
});

test("reruns preserve identical stored records and create only missing records", () => {
  const expected = buildMasterRecords(catalogue());
  const stored = expected.map(record => ({ ...record, _etag: "server-etag", _ts: 123 }));
  assert.deepEqual(planMasterSeed(expected, stored), { create: [], skipped: 2 });
  assert.deepEqual(planMasterSeed(expected, stored.slice(0, 1)), { create: [expected[1]], skipped: 1 });
});

test("conflicts and unknown stored records block seeding rather than overwrite them", () => {
  const expected = buildMasterRecords(catalogue());
  assert.throws(() => planMasterSeed(expected, [{ ...expected[0], name: "Different" }]), /differs from the seed/);
  const unexpected = buildMasterRecords({
    version: "reviewed-test",
    subjects: [{ id: "S01", name: "History", boundary: "History", topics: [{ id: "S01-T01", name: "Ancient" }] }],
  });
  assert.throws(() => planMasterSeed(expected, unexpected), /Unexpected master record/);
});

function englishRevision() {
  const previous = buildMasterRecords(catalogue());
  const subject = previous[0];
  const retired = previous[1];
  const source = {
    version: "english-subject",
    subjects: [
      {
        id: "S26", name: "Others", boundary: "Shared comprehension.",
        topics: [{ id: "S26-T02", name: "Comprehension & Communication" }],
      },
      {
        id: "S27", name: "English", boundary: "English language skills.",
        topics: [{ id: "S27-T01", name: "Grammar" }, { id: "S27-T09", name: "Spelling" }],
      },
    ],
    retiredRecords: [{
      ...retired,
      isActive: false,
      retirement: {
        reason: "English is now a subject.",
        replacementIds: ["S27-T01", "S27-T09"],
        requiresReview: true,
      },
    }],
  };
  return { previous, subject, source, expected: buildMasterRecords(source) };
}

test("revisions retain inactive IDs and resume without repeating completed updates", () => {
  const { previous, expected } = englishRevision();
  const plan = planMasterRevision(previous, expected, previous);
  assert.equal(plan.create.length, 4);
  assert.equal(plan.replace.length, 2);
  assert.equal(plan.skipped, 0);
  const partlyApplied = [plan.replace[0].record, previous[1], ...plan.create];
  const resumed = planMasterRevision(previous, expected, partlyApplied);
  assert.equal(resumed.create.length, 0);
  assert.equal(resumed.replace.length, 1);
  assert.equal(resumed.skipped, 5);
  assert.deepEqual(planMasterRevision(previous, expected, expected), { create: [], replace: [], skipped: 6 });
});

test("revisions reject concurrent edits, missing baseline records and implicit deletion", () => {
  const { previous, expected } = englishRevision();
  assert.throws(() => planMasterRevision(previous, expected, [
    { ...previous[0], name: "Changed concurrently" }, previous[1],
  ]), /unexpected changes/);
  assert.throws(() => planMasterRevision(previous, expected, previous.slice(1)), /is missing/);
  assert.throws(() => planMasterRevision(previous, expected.filter(record => record.id !== "S26-T03"), previous),
    /Retire S26-T03 explicitly/);
  assert.throws(() => planMasterRevision(previous, [
    ...expected.filter(record => record.id !== "S26-T03"),
    { ...expected.find(record => record.id === "S26-T03")!, subjectId: "S27" },
  ], previous), /cannot change its type or partition/);
});

test("retired topics require active replacement topics and cannot remain active", () => {
  const { source } = englishRevision();
  source.retiredRecords[0].retirement.replacementIds = ["S27-T99"];
  assert.throws(() => buildMasterRecords(source), /invalid replacement/);
  source.retiredRecords[0].retirement.replacementIds = ["S27-T01"];
  source.retiredRecords[0].isActive = true;
  assert.throws(() => buildMasterRecords(source), /active records must not have/);
});

test("unchanged subjects can retain their original record revision in a revised catalogue", () => {
  const source = catalogue();
  const records = buildMasterRecords({
    ...source, version: "new-catalogue",
    subjects: [{ ...source.subjects[0], sourceRevision: source.version }],
  });
  assert.equal(records[0].sourceRevision, source.version);
  assert.equal(records[1].sourceRevision, source.version);
});
