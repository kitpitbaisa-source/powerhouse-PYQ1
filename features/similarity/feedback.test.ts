import assert from "node:assert/strict";
import { test } from "node:test";
import type { Database } from "@azure/cosmos";
import { saveSimilarityFeedback, similarityFeedbackDocument, similarityFeedbackId, toAdminFeedback, type SimilarityFeedback } from "./feedback";

const feedback: SimilarityFeedback = {
  sourceContainer: "questions", questionId: "100", matchProfileId: "questions:200",
  userKey: "test-user", reason: "not_related", comment: "Different mechanisms.", score: 76,
};

test("shared-container similarity identity includes both questions, bank and user", () => {
  const variants = [
    feedback,
    { ...feedback, questionId: "101" },
    { ...feedback, sourceContainer: "state_pcs" as const },
    { ...feedback, matchProfileId: "questions:201" },
    { ...feedback, userKey: "another-user" },
  ];
  assert.equal(new Set(variants.map(similarityFeedbackId)).size, variants.length);
  const updated: SimilarityFeedback = { ...feedback, reason: "other", score: 20 };
  assert.equal(similarityFeedbackId(feedback), similarityFeedbackId(updated));
});

test("similarity votes share feedback storage, replace the same pair and retain creation and migration metadata", async () => {
  const documents = new Map<string, Record<string, any>>();
  const migrations = { sourceContainer: "similarity-feedback", sourceId: "old-vote" };
  const createdAt = "2026-10-24T12:00:00.000Z";
  documents.set(similarityFeedbackId(feedback), {
    ...similarityFeedbackDocument(feedback, "old-ranking", createdAt), migration: migrations,
  });
  let ensured = false;
  const database = {
    containers: {
      async createIfNotExists(definition: unknown) {
        assert.deepEqual(definition, { id: "feedback", partitionKey: { paths: ["/id"] } });
        ensured = true;
      },
    },
    container(name: string) {
      assert.equal(name, "feedback");
      return {
        item(id: string, partition: string) {
          assert.equal(partition, id);
          return { async read() { return { resource: documents.get(id) }; } };
        },
        items: { async upsert(document: Record<string, any>) { documents.set(document.id, document); } },
      };
    },
  } as unknown as Database;
  await saveSimilarityFeedback(database, { ...feedback, reason: "wrong_concept" }, "new-ranking");
  await saveSimilarityFeedback(database, { ...feedback, questionId: "101" }, "new-ranking");
  assert.equal(ensured, true);
  assert.equal(documents.size, 2);
  const saved = documents.get(similarityFeedbackId(feedback))!;
  assert.equal(saved.reason, "wrong_concept");
  assert.equal(saved.feedbackType, "similarity");
  assert.equal(saved.sourceKey, "questions:100");
  assert.equal(saved.createdAt, createdAt);
  assert.equal(saved.rankingVersion, "new-ranking");
  assert.deepEqual(saved.migration, migrations);
});

test("feedback read failures are not swallowed and do not overwrite existing votes", async () => {
  for (const code of [404, 429]) {
    let written = false;
    const database = {
      containers: { async createIfNotExists() {} },
      container() {
        return {
          item() { return { async read() { throw Object.assign(new Error("read failed"), { code }); } }; },
          items: { async upsert() { written = true; } },
        };
      },
    } as unknown as Database;
    if (code === 404) {
      await saveSimilarityFeedback(database, feedback, "ranking");
      assert.equal(written, true);
    } else {
      await assert.rejects(saveSimilarityFeedback(database, feedback, "ranking"), /read failed/);
      assert.equal(written, false);
    }
  }
});

test("admin feedback keeps legacy comments readable and exposes similarity pair, reason and score without changing storage", () => {
  const legacy = { id: "fb-old", comment: "Please correct this question.", questionType: "prelims", createdAt: "2026-10-01" };
  assert.deepEqual(toAdminFeedback(legacy), { ...legacy, feedbackType: "general" });
  const stored = similarityFeedbackDocument(feedback, "ranking-v1", "2026-11-03T12:00:00.000Z");
  const displayed = toAdminFeedback(stored);
  assert.equal(displayed.questionType, "similarity");
  assert.match(displayed.comment, /Reason: not related/);
  assert.match(displayed.comment, /questions:100 -> questions:200/);
  assert.match(displayed.comment, /Score: 76; ranking: ranking-v1/);
  assert.ok(displayed.comment.endsWith(feedback.comment!));
  assert.equal(stored.comment, feedback.comment);
});
