import assert from "node:assert/strict";
import test from "node:test";
import { similarityAttemptFields } from "./attempt.js";

const source = { sourceContainer: "questions", questionId: "110039" };

test("builds stored fields for an origin attempt", () => {
  assert.deepEqual(similarityAttemptFields({ role: "origin", source, matchScore: 90 }), {
    via: "similarity", similarityRole: "origin", similaritySource: source,
  });
});

test("keeps match score and rank on a match attempt", () => {
  assert.deepEqual(similarityAttemptFields({ role: "match", source, matchScore: 86.6, matchRank: 2 }), {
    via: "similarity", similarityRole: "match", similaritySource: source, matchScore: 87, matchRank: 2,
  });
});

test("ignores missing or invalid similarity info", () => {
  assert.equal(similarityAttemptFields(undefined), undefined);
  assert.equal(similarityAttemptFields({ role: "other", source }), undefined);
  assert.equal(similarityAttemptFields({ role: "match", source: { sourceContainer: "nope", questionId: "1" } }), undefined);
});
