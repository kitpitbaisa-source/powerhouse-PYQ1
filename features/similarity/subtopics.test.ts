import assert from "node:assert/strict";
import { test } from "node:test";
import { hashContent } from "./content-hash";
import { sourceQuestionSchema } from "./schema";
import { approvedMasterSubtopics, approvedQuestionSubject, loadQuestionSubtopics, mergeProfileSubtopics } from "./subtopics";
import { buildMasterRecords } from "../taxonomy/master";
import { flagQuestionForReview, questionVerificationSchema, unverifiedQuestion } from "./verification";
import type { Database } from "@azure/cosmos";

const master = buildMasterRecords({
  version: "test",
  subjects: [{
    id: "S12", name: "Science", boundary: "Science topics",
    topics: [{
      id: "S12-T01", name: "Physics",
      subtopicRecords: [
        { id: "S12-T01-ST01", name: "Optics" },
        { id: "S12-T01-ST02", name: "Mechanics" },
      ],
    }, {
      id: "S12-T02", name: "Chemistry",
      subtopicRecords: [{ id: "S12-T02-ST01", name: "Optics" }],
    }],
  }],
});
const classification = {
  subject: "Science", topic: "Physics", subtopics: ["Optics"],
  master: { subjectId: "S12", topicId: "S12-T01", subtopicIds: ["S12-T01-ST01"] },
};

test("question feeds load source-bound profile subtopics without changing source content", () => {
  const question = {
    id: 5765, question: "Identify the optical effect.", year: "2026", subject: "Science",
    options: ["A", "B"], answer: "A", explanation: "An explanation.",
  };
  const original = structuredClone(question);
  const sourceContentHash = hashContent(sourceQuestionSchema.parse(question));
  const [result] = mergeProfileSubtopics([question], [{
    questionId: "5765", classification, sourceContentHash,
  }], master);
  assert.deepEqual(result.subtopics, ["Optics"]);
  assert.deepEqual(question, original);
  assert.equal(hashContent(sourceQuestionSchema.parse(result)), sourceContentHash);
});

test("missing, stale, inactive and review-blocked profiles do not supply feed subtopics", () => {
  const question = { id: "1", question: "Original wording." };
  const profile = {
    questionId: "1", classification,
    sourceContentHash: hashContent(sourceQuestionSchema.parse(question)),
  };
  for (const source of [
    { ...question, question: "Changed wording." },
    { ...question, isActive: false },
    { ...question, verification: { status: "pending_review" } },
  ]) {
    assert.deepEqual(mergeProfileSubtopics([source], [profile], master)[0].subtopics, []);
  }
  assert.deepEqual(mergeProfileSubtopics([question], [], master)[0].subtopics, []);
  assert.deepEqual(mergeProfileSubtopics([question], [{ ...profile, questionId: "2" }], master)[0].subtopics, []);
  assert.deepEqual(mergeProfileSubtopics([{ ...question, subtopics: ["Unapproved source label"] }], [], master)[0].subtopics, []);
});

test("only active master-bound names under the assigned subject and topic are displayed", () => {
  assert.deepEqual(approvedMasterSubtopics(classification, master), ["Optics"]);
  for (const value of [
    { ...classification, master: undefined },
    { ...classification, subject: "History" },
    { ...classification, topic: "Chemistry" },
    { ...classification, subtopics: ["Invented label"] },
    { ...classification, master: { ...classification.master, subtopicIds: [] } },
    { ...classification, master: { ...classification.master, subtopicIds: ["S12-T02-ST01"] } },
    { ...classification, subtopics: ["Optics", "Optics"], master: { ...classification.master, subtopicIds: ["S12-T01-ST01", "S12-T01-ST01"] } },
  ]) {
    assert.deepEqual(approvedMasterSubtopics(value, master), []);
  }
  for (const id of ["S12", "S12-T01", "S12-T01-ST01"]) {
    assert.deepEqual(approvedMasterSubtopics(classification, master.filter(record => record.id !== id)), []);
    assert.deepEqual(approvedMasterSubtopics(classification, master.map(record =>
      record.id === id ? { ...record, isActive: false } : record
    )), []);
  }
});

test("unmatched individual names are hidden without replacing them or losing approved siblings", () => {
  const mixed = {
    ...classification,
    subtopics: ["Optics", "Renamed mechanics", "Invented"],
    master: { ...classification.master, subtopicIds: ["S12-T01-ST01", "S12-T01-ST02", "S12-T01-ST99"] },
  };
  assert.deepEqual(approvedMasterSubtopics(mixed, master), ["Optics"]);
  assert.deepEqual(mixed.subtopics, ["Optics", "Renamed mechanics", "Invented"]);
});

function classifiedQuestion() {
  const source = {
    id: "subject-display", question: "Which optical effect is described?", options: ["A", "B"],
    answer: "A", explanation: "An optical effect.", subject: "Legacy science", topic: "Physics",
  };
  const verification = unverifiedQuestion(hashContent(sourceQuestionSchema.parse(source)));
  return {
    ...source,
    verification: questionVerificationSchema.parse({
      ...verification, reviewedBy: "classification-reviewer",
      masterClassification: { subjectId: "S12", topicId: "S12-T01" },
      checks: {
        ...verification.checks,
        master_classification: { status: "passed", evidence: ["Source-bound classification review."] },
      },
    }),
  };
}

test("subject display resolves approved IDs to current master names without altering the source", () => {
  const question = classifiedQuestion();
  const original = structuredClone(question);
  assert.deepEqual(approvedQuestionSubject(question, master), { subjectId: "S12", subject: "Science" });
  assert.deepEqual(approvedQuestionSubject(question, master.map(record =>
    record.id === "S12" ? { ...record, name: "Current science name" } : record
  )), { subjectId: "S12", subject: "Current science name" });
  assert.deepEqual(question, original);
});

test("a passed classification remains displayable while an unrelated concept review is pending", () => {
  const question = classifiedQuestion();
  question.verification = flagQuestionForReview(question.verification, {
    code: "CONCEPT_REVIEW_REQUIRED", check: "concepts", reason: "Review concepts separately.",
    requiredAction: "Complete the concept review.", evidence: ["Existing concept hold."],
  });
  assert.equal(question.verification.status, "pending_review");
  assert.deepEqual(approvedQuestionSubject(question, master), { subjectId: "S12", subject: "Science" });
});

test("unreviewed, stale, inactive and invalid master-bound subject mappings remain unresolved", () => {
  const question = classifiedQuestion();
  for (const source of [
    { ...question, verification: undefined },
    { ...question, question: "Changed source wording." },
    { ...question, subject: "Changed subject without review." },
    { ...question, isActive: false },
    { ...question, verification: { ...question.verification, masterClassification: undefined } },
    { ...question, verification: { ...question.verification, checks: {
      ...question.verification.checks, master_classification: { status: "not_checked", evidence: [] },
    } } },
    { ...question, verification: flagQuestionForReview(question.verification, {
      code: "NEW_SUBTOPIC_REVIEW_REQUIRED", check: "master_classification",
      reason: "Child mapping requires approval.", requiredAction: "Review the proposed child.", evidence: ["Source evidence."],
    }) },
  ]) {
    assert.equal(approvedQuestionSubject(source, master), null);
  }
  for (const id of ["S12", "S12-T01"]) {
    assert.equal(approvedQuestionSubject(question, master.filter(record => record.id !== id)), null);
    assert.equal(approvedQuestionSubject(question, master.map(record =>
      record.id === id ? { ...record, isActive: false } : record
    )), null);
  }
  assert.equal(approvedQuestionSubject(question, master.map(record =>
    record.type === "topic" && record.id === "S12-T01" ? { ...record, parentId: "S99" } : record
  )), null);
});

test("General Awareness is retained as an active master subject, not treated as a legacy alias", () => {
  const awarenessMaster = buildMasterRecords({
    version: "test", subjects: [{ id: "S22", name: "General Awareness", boundary: "General awareness",
      topics: [{ id: "S22-T01", name: "General awareness topics", subtopicRecords: [] }] }],
  });
  const question = classifiedQuestion();
  const verification = questionVerificationSchema.parse({
    ...question.verification, masterClassification: { subjectId: "S22", topicId: "S22-T01" },
  });
  assert.deepEqual(approvedQuestionSubject({ ...question, verification }, awarenessMaster),
    { subjectId: "S22", subject: "General Awareness" });
});

test("feeds expose approved subject metadata even without a ready concept profile or vector", async () => {
  const question = classifiedQuestion();
  const queried: string[] = [];
  const database = {
    container(name: string) {
      queried.push(name);
      return { items: { query() { return { async fetchAll() {
        return { resources: name === "subject_topic_master" ? master : [] };
      } }; } } };
    },
  } as unknown as Database;
  const [result] = await loadQuestionSubtopics(database, "questions", [question]);
  assert.deepEqual(result.subjectClassification, { subjectId: "S12", subject: "Science" });
  assert.deepEqual(result.subtopics, []);
  assert.equal(result.subject, question.subject);
  assert.deepEqual(result.verification, question.verification);
  assert.ok(queried.includes("subject_topic_master"));
});
