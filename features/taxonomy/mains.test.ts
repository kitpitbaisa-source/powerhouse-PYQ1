import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import type { Database } from "@azure/cosmos";
import ts from "typescript";
import { withOriginalSubjectFallback } from "../../src/features/classification";
import { applyMainsSyllabus, loadMainsSyllabusQuestions, mainsSyllabusSourceHash } from "./mains";

const syllabusId = "UPSC-CSE-MAINS-GS-2026-v1";
const records = [
  { id: "MAINS-GS1", type: "paper", paperId: "MAINS-GS1", parentId: null, name: "General Studies 1", syllabusId, isActive: true },
  { id: "MAINS-GS1-HISTORY", type: "subject", paperId: "MAINS-GS1", parentId: "MAINS-GS1", name: "History", syllabusId, isActive: true },
  { id: "MAINS-GS1-X01", type: "topic", paperId: "MAINS-GS1", parentId: "MAINS-GS1-HISTORY", name: "Ancient & Medieval Indian History",
    syllabusId, isActive: true, nameOrigin: "editorial_extension", officialText: null },
];
function reviewedQuestion() {
  const source = { id: "20102", question: "Examine the main aspects of Akbar's religious syncretism.",
    subject: "Legacy history", topic: "Legacy culture", paper: "GS1", exam: "CSE Mains", year: "2025" };
  return { ...source, mainsSyllabus: { syllabusId, paperId: "MAINS-GS1", subjectId: "MAINS-GS1-HISTORY",
    topicId: "MAINS-GS1-X01", review: { status: "mapped", issues: [], sourceHash: mainsSyllabusSourceHash(source) } } };
}
test("Mains labels come from reviewed syllabus IDs, including approved supplementary topics, without mutating source labels", () => {
  const original = reviewedQuestion();
  const [displayed] = applyMainsSyllabus([original], records);
  assert.equal(displayed.subject, "History");
  assert.equal(displayed.topic, "Ancient & Medieval Indian History");
  assert.equal(displayed.subjectClassification?.subjectId, "MAINS-GS1-HISTORY");
  assert.deepEqual(displayed.legacyClassification, { subject: "Legacy history", topic: "Legacy culture", paper: "GS1" });
  assert.equal(original.subject, "Legacy history");
  assert.equal(original.topic, "Legacy culture");
  assert.equal(withOriginalSubjectFallback(displayed).subject, "History");
});
test("stale, pending, inactive and cross-version mappings remain visible but never fall back to legacy taxonomy", () => {
  const question = reviewedQuestion();
  const cases = [
    { source: { ...question, question: "A changed question." }, master: records },
    { source: { ...question, mainsSyllabus: { ...question.mainsSyllabus, review: { ...question.mainsSyllabus.review, status: "pending_review" } } }, master: records },
    { source: { ...question, mainsSyllabus: { ...question.mainsSyllabus, review: { ...question.mainsSyllabus.review, issues: ["unresolved"] } } }, master: records },
    { source: question, master: records.map(record => record.type === "topic" ? { ...record, isActive: false } : record) },
    { source: question, master: records.map(record => record.type === "subject" ? { ...record, syllabusId: "another-version" } : record) },
    { source: question, master: records.map(record => record.type === "topic" ? { ...record, parentId: "different-parent" } : record) },
  ];
  for (const { source, master } of cases) {
    const [displayed] = applyMainsSyllabus([source], master);
    assert.equal(displayed.subject, "Needs classification");
    assert.equal(displayed.topic, "Needs classification");
    assert.equal(withOriginalSubjectFallback(displayed).subject, "Needs classification");
    assert.equal(displayed.originalSubject, "Legacy history");
  }
});
test("archived placeholders are excluded while active questions remain", () => {
  const source = reviewedQuestion();
  assert.deepEqual(applyMainsSyllabus([{ ...source, id: "41803", isActive: false }, source], records).map(question => question.id), ["20102"]);
});
test("master read failures propagate instead of silently publishing legacy labels", async () => {
  const database = {
    container(name: string) {
      assert.equal(name, "mains_syllabus_master");
      return { items: { query() { return { async fetchAll() { throw new Error("master unavailable"); } }; } } };
    },
  } as unknown as Database;
  await assert.rejects(loadMainsSyllabusQuestions(database, [reviewedQuestion()]), /master unavailable/);
});
for (const entrypoint of ["server.ts", "api/index.ts"]) {
  test(`${entrypoint} uses the Mains syllabus for cached API results and hides archived records`, async () => {
    const source = readFileSync(new URL(`../../${entrypoint}`, import.meta.url), "utf8");
    const start = source.indexOf("async function getMainsQuestions()");
    const end = source.indexOf("async function getEssayQuestions()", start);
    assert.ok(start >= 0 && end > start);
    const question = reviewedQuestion();
    const database = {
      container() { return { items: { query() { return { async fetchAll() { return { resources: records }; } }; } } }; },
    } as unknown as Database;
    const getQuestions = runInNewContext(ts.transpileModule(source.slice(start, end), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText + "\ngetMainsQuestions;", {
      mainsCache: null, mainsCacheTimestamp: 0, CACHE_TTL: 60000,
      mainsQuestionsContainer: { items: { readAll() { return { async fetchAll() {
        return { resources: [question, { ...question, id: "41803", isActive: false }] };
      } }; } } },
      database, loadMainsSyllabusQuestions,
      loadQuestionSubtopics() { assert.fail("Mains must not use the legacy taxonomy loader."); },
    });
    const displayed = await getQuestions();
    assert.equal(displayed.length, 1);
    assert.equal(displayed[0].subject, "History");
    assert.equal(displayed[0].topic, "Ancient & Medieval Indian History");
    assert.equal((await getQuestions())[0].id, question.id);
  });
}
