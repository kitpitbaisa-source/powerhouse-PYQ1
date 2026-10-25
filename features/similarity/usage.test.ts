import assert from "node:assert/strict";
import test from "node:test";
import { matchClickSchema, summarizeSimilarityUsage } from "./usage.js";

test("summarizes opens, clicks and load times per user", () => {
  const rows = [
    { type: "open", email: "a@gmail.com", sourceContainer: "questions", questionId: "1", resultSource: "stored", durationMs: 800, at: "2026-10-25T10:00:00Z" },
    { type: "open", email: "a@gmail.com", sourceContainer: "questions", questionId: "1", resultSource: "computed", durationMs: 9000, at: "2026-10-25T11:00:00Z" },
    { type: "open", email: "anonymous", sourceContainer: "questions", questionId: "2", resultSource: "stored", durationMs: 700, at: "2026-10-25T09:00:00Z" },
    { type: "match_click", email: "a@gmail.com", sourceContainer: "questions", questionId: "1", matchProfileId: "questions:5", at: "2026-10-25T12:00:00Z" },
  ];
  const summary = summarizeSimilarityUsage(rows, 7);
  assert.equal(summary.opens, 3);
  assert.equal(summary.clicks, 1);
  assert.equal(summary.storedOpens, 2);
  assert.equal(summary.computedOpens, 1);
  assert.equal(summary.medianMs, 800);
  assert.deepEqual(summary.users[0], { email: "a@gmail.com", opens: 2, clicks: 1, lastAt: "2026-10-25T12:00:00Z" });
  assert.deepEqual(summary.topQuestions[0], { question: "questions:1", count: 2 });
  assert.deepEqual(summary.topMatches, [{ match: "questions:5", count: 1 }]);
});

test("handles an empty period", () => {
  const summary = summarizeSimilarityUsage([], 7);
  assert.equal(summary.opens, 0);
  assert.equal(summary.medianMs, null);
});

test("validates match click events", () => {
  const base = { sourceContainer: "questions", questionId: "1", matchProfileId: "questions:5", rank: 1, score: 80 };
  assert.ok(matchClickSchema.safeParse(base).success);
  assert.ok(!matchClickSchema.safeParse({ ...base, sourceContainer: "other" }).success);
  assert.ok(!matchClickSchema.safeParse({ ...base, rank: 0 }).success);
});
