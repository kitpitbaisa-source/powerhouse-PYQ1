import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
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

for (const entrypoint of ["server.ts", "api/index.ts"]) {
  test(`${entrypoint} writes typed general feedback and lists both feedback types`, async () => {
    const source = readFileSync(new URL(`../../${entrypoint}`, import.meta.url), "utf8");
    const start = source.indexOf('serverApp.post("/api/feedback"');
    const end = source.indexOf("// Admin: list all payments", start);
    assert.ok(start >= 0 && end > start);
    const documents: Record<string, any>[] = [
      { id: "legacy", comment: "Existing comment", questionType: "prelims" },
      similarityFeedbackDocument(feedback, "ranking", "2026-11-03T12:00:00.000Z"),
    ];
    const routes: Record<string, (...args: any[]) => Promise<void>> = {};
    runInNewContext(ts.transpileModule(source.slice(start, end), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText, {
      serverApp: {
        post(route: string, handler: typeof routes[string]) { routes[`POST ${route}`] = handler; },
        get(route: string, handler: typeof routes[string]) { routes[`GET ${route}`] = handler; },
      },
      ensureFeedbackContainer: async () => {},
      feedbackContainer: {
        items: {
          async create(document: Record<string, any>) { documents.push(document); },
          query() { return { async fetchAll() { return { resources: documents }; } }; },
        },
      },
      toAdminFeedback, console,
    });
    let response: any;
    const res = {
      json(value: unknown) { response = value; },
      status(code: number) { assert.fail(`Unexpected feedback status ${code}`); },
    };
    await routes["POST /api/feedback"]({ body: { comment: " New comment ", questionType: "csat" } }, res);
    assert.equal(response.feedback.feedbackType, "general");
    assert.equal(response.feedback.comment, "New comment");
    assert.equal(response.feedback.questionType, "csat");
    await routes["GET /api/admin/feedback"]({}, res);
    assert.equal(response.find(document => document.id === "legacy").feedbackType, "general");
    const similarity = response.find(document => document.feedbackType === "similarity");
    assert.equal(similarity.questionType, "similarity");
    assert.match(similarity.comment, /Reason: not related/);
    assert.equal(documents[0].feedbackType, undefined);
  });
}
