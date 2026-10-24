import assert from "node:assert/strict";
import { test } from "node:test";
import { NEEDS_CLASSIFICATION, withSubjectDisplay } from "./classification";

test("cards, subject filters and counts share canonical display labels without losing unresolved questions", () => {
  const source = [
    { id: 1, subject: "Polity", subjectClassification: { subjectId: "S04", subject: "Polity & Constitution" } },
    { id: 2, subject: "Polity", subjectClassification: null },
    { id: 3, subject: "General Awareness", subjectClassification: { subjectId: "S22", subject: "General Awareness" } },
    { id: 4, subject: "Chemistry" },
  ];
  const original = structuredClone(source);
  const displayed = source.map(withSubjectDisplay);
  const subjects = [...new Set(displayed.map(question => question.subject))].sort();
  assert.deepEqual(subjects, ["General Awareness", NEEDS_CLASSIFICATION, "Polity & Constitution"]);
  const counts = Object.fromEntries(subjects.map(subject => [
    subject, displayed.filter(question => question.subject === subject).length,
  ]));
  assert.equal(counts[NEEDS_CLASSIFICATION], 2);
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), source.length);
  assert.deepEqual(displayed.filter(question => question.subject === NEEDS_CLASSIFICATION).map(question => question.id), [2, 4]);
  assert.deepEqual(source, original);
  assert.equal(displayed[0].originalSubject, "Polity");
});

test("fallback and unmapped active-looking labels are not silently accepted as reviewed classifications", () => {
  for (const subject of ["Polity", "General Awareness", "Science", ""]) {
    assert.equal(withSubjectDisplay({ subject }).subject, NEEDS_CLASSIFICATION);
  }
});

test("reapplying display normalization preserves the original source label for admin details", () => {
  const original = { subject: "Polity", subjectClassification: { subjectId: "S04", subject: "Polity & Constitution" } };
  const display = withSubjectDisplay(original);
  assert.deepEqual(withSubjectDisplay(display), display);
  assert.equal(withSubjectDisplay({ ...display, subjectClassification: null }).originalSubject, "Polity");
  assert.equal(withSubjectDisplay({ ...display, subjectClassification: null }).subject, NEEDS_CLASSIFICATION);
});
